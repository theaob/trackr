"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { User } from "@/types";
import MentionInput, { ImagePasteResult } from "@/components/common/MentionInput";
import MarkdownContent from "@/components/common/MarkdownContent";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { useModKeyLabel } from "@/hooks/useModKeyLabel";
import {
  applyWrapFormatting,
  applyLinePrefixFormatting,
  insertMarkdownTable,
  insertMarkdownLink,
  insertCodeBlock,
  handleTabIndent,
  shouldHandleTab,
} from "@/lib/markdownEditorUtils";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Table,
  Link,
  AtSign,
  Eye,
  Edit3,
  Maximize2,
  Minimize2,
  HelpCircle,
  Minus,
  Heading1,
  Heading2,
  Heading3,
  ChevronDown,
  FileText,
} from "lucide-react";
import { Tooltip } from "@/components/ui/Popover";

interface IssueDescriptionEditorProps {
  value: string;
  onChange: (val: string) => void;
  users: User[];
  /** Always show the editor (for create flows). Default: click-to-edit mode. */
  mode?: "click-to-edit" | "always-edit";
  /** Whether to show Save/Cancel buttons. Default: true */
  showSaveButtons?: boolean;
  onSave?: () => void | Promise<void>;
  onCancel?: () => void;
  onImagePaste?: (file: File) => Promise<ImagePasteResult>;
  canEdit?: boolean;
  placeholder?: string;
  /** Minimum rows for the textarea. Default: 6 */
  minRows?: number;
}

type EditorTab = "write" | "preview";

interface ToolbarAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  action: (
    text: string,
    selStart: number,
    selEnd: number,
    textareaRef: React.RefObject<HTMLTextAreaElement | null>
  ) => { newText: string; newSelectionStart: number; newSelectionEnd: number } | null;
}

// Markdown cheatsheet content
const CHEATSHEET_ITEMS = [
  { syntax: "**bold**", result: "bold text" },
  { syntax: "*italic*", result: "italic text" },
  { syntax: "~~strikethrough~~", result: "strikethrough" },
  { syntax: "`inline code`", result: "inline code" },
  { syntax: "# Heading 1", result: "heading" },
  { syntax: "## Heading 2", result: "heading" },
  { syntax: "- item", result: "bullet list" },
  { syntax: "1. item", result: "numbered list" },
  { syntax: "- [ ] task", result: "task list" },
  { syntax: "> quote", result: "blockquote" },
  { syntax: "[text](url)", result: "link" },
  { syntax: "![alt](url)", result: "image" },
  { syntax: "---", result: "horizontal rule" },
  { syntax: "@name", result: "mention" },
];

export default function IssueDescriptionEditor({
  value,
  onChange,
  users,
  mode = "click-to-edit",
  showSaveButtons = true,
  onSave,
  onCancel,
  onImagePaste,
  canEdit = true,
  placeholder = "Add details, steps, or acceptance criteria...",
  minRows = 6,
}: IssueDescriptionEditorProps) {
  const [isEditing, setIsEditing] = useState(mode === "always-edit");
  const [activeTab, setActiveTab] = useState<EditorTab>("write");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCheatsheet, setShowCheatsheet] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const headingMenuRef = useRef<HTMLDivElement>(null);
  const cheatsheetRef = useRef<HTMLDivElement>(null);
  const modKey = useModKeyLabel();

  // Close heading menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (headingMenuRef.current && !headingMenuRef.current.contains(e.target as Node)) {
        setShowHeadingMenu(false);
      }
      if (cheatsheetRef.current && !cheatsheetRef.current.contains(e.target as Node)) {
        setShowCheatsheet(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Apply a text transform and update textarea selection
  const applyTransform = useCallback(
    (
      transformFn: (
        text: string,
        selStart: number,
        selEnd: number
      ) => { newText: string; newSelectionStart: number; newSelectionEnd: number }
    ) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const selStart = ta.selectionStart ?? 0;
      const selEnd = ta.selectionEnd ?? selStart;
      const result = transformFn(value, selStart, selEnd);
      onChange(result.newText);
      // Restore selection after React re-render
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(result.newSelectionStart, result.newSelectionEnd);
      });
    },
    [value, onChange]
  );

  // Toolbar actions
  const toolbarActions: (ToolbarAction | "separator" | "heading-dropdown")[] = [
    "heading-dropdown",
    "separator",
    {
      id: "bold",
      icon: <Bold className="w-3.5 h-3.5" />,
      label: "Bold",
      shortcut: `${modKey}B`,
      action: (text, s, e) => applyWrapFormatting(text, s, e, "**", "**", "bold text"),
    },
    {
      id: "italic",
      icon: <Italic className="w-3.5 h-3.5" />,
      label: "Italic",
      shortcut: `${modKey}I`,
      action: (text, s, e) => applyWrapFormatting(text, s, e, "*", "*", "italic text"),
    },
    {
      id: "strikethrough",
      icon: <Strikethrough className="w-3.5 h-3.5" />,
      label: "Strikethrough",
      action: (text, s, e) => applyWrapFormatting(text, s, e, "~~", "~~", "strikethrough"),
    },
    {
      id: "code",
      icon: <Code className="w-3.5 h-3.5" />,
      label: "Inline Code",
      action: (text, s, e) => applyWrapFormatting(text, s, e, "`", "`", "code"),
    },
    "separator",
    {
      id: "bullet-list",
      icon: <List className="w-3.5 h-3.5" />,
      label: "Bullet List",
      action: (text, s, e) => applyLinePrefixFormatting(text, s, e, "- "),
    },
    {
      id: "numbered-list",
      icon: <ListOrdered className="w-3.5 h-3.5" />,
      label: "Numbered List",
      action: (text, s, e) =>
        applyLinePrefixFormatting(text, s, e, "1. ", { numbered: true }),
    },
    {
      id: "task-list",
      icon: <CheckSquare className="w-3.5 h-3.5" />,
      label: "Task List",
      action: (text, s, e) => applyLinePrefixFormatting(text, s, e, "- [ ] "),
    },
    "separator",
    {
      id: "blockquote",
      icon: <Quote className="w-3.5 h-3.5" />,
      label: "Blockquote",
      action: (text, s, e) => applyLinePrefixFormatting(text, s, e, "> "),
    },
    {
      id: "code-block",
      icon: <FileText className="w-3.5 h-3.5" />,
      label: "Code Block",
      action: (text, s, e) => insertCodeBlock(text, s, e),
    },
    {
      id: "table",
      icon: <Table className="w-3.5 h-3.5" />,
      label: "Table",
      action: (text, s, e) => insertMarkdownTable(text, s, e),
    },
    {
      id: "horizontal-rule",
      icon: <Minus className="w-3.5 h-3.5" />,
      label: "Horizontal Rule",
      action: (text, s, e) => {
        const before = text.slice(0, s);
        const after = text.slice(e);
        const needPrefix = before.length > 0 && !before.endsWith("\n");
        const needSuffix = after.length > 0 && !after.startsWith("\n");
        const insert = `${needPrefix ? "\n" : ""}---\n${needSuffix ? "\n" : ""}`;
        return {
          newText: before + insert + after,
          newSelectionStart: s + insert.length,
          newSelectionEnd: s + insert.length,
        };
      },
    },
    "separator",
    {
      id: "link",
      icon: <Link className="w-3.5 h-3.5" />,
      label: "Link",
      shortcut: `${modKey}K`,
      action: (text, s, e) => insertMarkdownLink(text, s, e),
    },
    {
      id: "mention",
      icon: <AtSign className="w-3.5 h-3.5" />,
      label: "Mention",
      action: (text, s, e, taRef) => {
        // Insert @ at cursor and let MentionInput handle the rest
        const before = text.slice(0, s);
        const after = text.slice(e);
        const needSpace = before.length > 0 && !/\s$/.test(before);
        const insertText = needSpace ? " @" : "@";
        const newText = before + insertText + after;
        const newPos = s + insertText.length;
        return { newText, newSelectionStart: newPos, newSelectionEnd: newPos };
      },
    },
  ];

  // Handle toolbar button click
  const handleToolbarAction = (action: ToolbarAction) => {
    applyTransform((text, s, e) => {
      const result = action.action(text, s, e, textareaRef);
      return result || { newText: text, newSelectionStart: s, newSelectionEnd: e };
    });
  };

  // Handle heading selection from dropdown
  const handleHeadingSelect = (prefix: string) => {
    applyTransform((text, s, e) =>
      applyLinePrefixFormatting(text, s, e, prefix, { isHeading: true })
    );
    setShowHeadingMenu(false);
  };

  // Handle keyboard shortcuts within the textarea
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const isMeta = e.metaKey || e.ctrlKey;

    // Cmd/Ctrl+B: Bold
    if (isMeta && e.key === "b") {
      e.preventDefault();
      applyTransform((text, s, end) =>
        applyWrapFormatting(text, s, end, "**", "**", "bold text")
      );
      return;
    }

    // Cmd/Ctrl+I: Italic
    if (isMeta && e.key === "i") {
      e.preventDefault();
      applyTransform((text, s, end) =>
        applyWrapFormatting(text, s, end, "*", "*", "italic text")
      );
      return;
    }

    // Cmd/Ctrl+K: Link
    if (isMeta && e.key === "k") {
      e.preventDefault();
      applyTransform((text, s, end) => insertMarkdownLink(text, s, end));
      return;
    }

    // Cmd/Ctrl+Enter: Save
    if (isMeta && e.key === "Enter") {
      e.preventDefault();
      if (onSave) {
        onSave();
      }
      return;
    }

    // Escape: Cancel
    if (e.key === "Escape") {
      e.preventDefault();
      if (onCancel) {
        onCancel();
      } else if (mode === "click-to-edit") {
        setIsEditing(false);
      }
      return;
    }

    // Tab / Shift+Tab: Indent / Outdent list items. Anywhere else Tab moves
    // focus as usual, so the editor never traps the keyboard.
    if (
      e.key === "Tab" &&
      shouldHandleTab(
        e.currentTarget.value,
        e.currentTarget.selectionStart ?? 0,
        e.currentTarget.selectionEnd ?? 0,
        e.shiftKey
      )
    ) {
      e.preventDefault();
      applyTransform((text, s, end) => handleTabIndent(text, s, end, e.shiftKey));
      return;
    }
  };

  // Enter editing mode
  const handleClickToEdit = () => {
    if (!canEdit || mode === "always-edit") return;
    setIsEditing(true);
    setActiveTab("write");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  // Save handler
  const handleSave = async () => {
    if (onSave) await onSave();
    if (mode === "click-to-edit") {
      setIsEditing(false);
      setIsFullscreen(false);
    }
  };

  // Cancel handler
  const handleCancel = () => {
    if (onCancel) onCancel();
    if (mode === "click-to-edit") {
      setIsEditing(false);
      setIsFullscreen(false);
    }
  };

  // ----- Display Mode (click-to-edit, not editing) -----
  if (mode === "click-to-edit" && !isEditing) {
    return (
      <div>
        <h3 className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-2">
          Description
        </h3>
        <div
          onClick={handleClickToEdit}
          className={`min-h-[80px] p-3 rounded-md border border-transparent transition-all text-sm text-ink leading-relaxed ${
            canEdit
              ? "hover:bg-surface-sunk cursor-pointer hover:border-subtle group"
              : "bg-page/50"
          }`}
        >
          {value ? (
            <MarkdownContent text={value} users={users} />
          ) : (
            <span className="text-muted italic">
              {canEdit ? placeholder : "No description provided."}
            </span>
          )}
          {canEdit && (
            <div className="invisible group-hover:visible flex items-center gap-1 mt-2 text-[11px] text-muted">
              <Edit3 className="w-3 h-3" />
              <span>Click to edit</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ----- Editor Mode -----
  const editorContent = (
    <div className={`flex flex-col ${isFullscreen ? "h-full" : ""}`}>
      {/* Header: tabs + actions. These controls stay out of the Tab order
          (tabIndex -1) so Tab moves straight from the previous field into the
          text; formatting also has keyboard shortcuts. */}
      <div className="flex items-center justify-between border-b border-subtle bg-page/70 rounded-t-md px-1">
        {/* Write / Preview tabs */}
        <div className="flex items-center">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setActiveTab("write")}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors border-b-2 ${
              activeTab === "write"
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-ink-2"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Edit3 className="w-3 h-3" />
              Write
            </span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setActiveTab("preview")}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors border-b-2 ${
              activeTab === "preview"
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-ink-2"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Eye className="w-3 h-3" />
              Preview
            </span>
          </button>
        </div>

        {/* Fullscreen + Cheatsheet */}
        <div className="flex items-center gap-0.5">
          <div className="relative" ref={cheatsheetRef}>
            <Tooltip content="Markdown cheatsheet">
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowCheatsheet(!showCheatsheet)}
                className="p-1.5 text-muted hover:text-ink-2 hover:bg-surface-sunk rounded transition-colors"
                aria-label="Markdown cheatsheet"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            {showCheatsheet && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-surface border border-subtle rounded-lg shadow-xl z-50 py-2 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 border-b border-subtle text-[11px] font-bold text-muted uppercase tracking-wider">
                  Markdown Cheatsheet
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {CHEATSHEET_ITEMS.map((item) => (
                    <div
                      key={item.syntax}
                      className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-page"
                    >
                      <code className="px-1.5 py-0.5 bg-surface-sunk rounded text-[11px] font-mono text-ink">
                        {item.syntax}
                      </code>
                      <span className="text-muted">{item.result}</span>
                    </div>
                  ))}
                </div>
                <div className="px-3 pt-2 pb-1 border-t border-subtle">
                  <div className="text-[10px] text-muted space-y-0.5">
                    <div><kbd className="px-1 py-0.5 bg-surface-sunk rounded text-[10px]">{modKey}B</kbd> Bold • <kbd className="px-1 py-0.5 bg-surface-sunk rounded text-[10px]">{modKey}I</kbd> Italic • <kbd className="px-1 py-0.5 bg-surface-sunk rounded text-[10px]">{modKey}K</kbd> Link</div>
                    <div><kbd className="px-1 py-0.5 bg-surface-sunk rounded text-[10px]">Tab</kbd> Indent list item • <kbd className="px-1 py-0.5 bg-surface-sunk rounded text-[10px]">{modKey}↵</kbd> Save</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Tooltip content={isFullscreen ? "Exit full screen" : "Full screen"}>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-muted hover:text-ink-2 hover:bg-surface-sunk rounded transition-colors"
              aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Formatting Toolbar (visible only in Write tab) */}
      {activeTab === "write" && (
        <div className="flex items-center flex-wrap gap-0.5 px-2 py-1 border-b border-subtle bg-surface">
          {toolbarActions.map((item, idx) => {
            if (item === "separator") {
              return (
                <div
                  key={`sep-${idx}`}
                  className="w-px h-4 bg-subtle mx-0.5"
                />
              );
            }

            if (item === "heading-dropdown") {
              return (
                <div key="heading-dropdown" className="relative" ref={headingMenuRef}>
                  <Tooltip content="Headings">
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowHeadingMenu(!showHeadingMenu)}
                      className="flex items-center gap-0.5 px-1.5 py-1 text-muted hover:text-ink-2 hover:bg-surface-sunk rounded transition-colors text-xs font-medium"
                    >
                      <span className="text-[11px]">Normal text</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </Tooltip>
                  {showHeadingMenu && (
                    <div className="absolute left-0 top-full mt-1 w-48 bg-surface border border-subtle rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95">
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => handleHeadingSelect("# ")}
                        className="w-full px-3 py-1.5 text-left hover:bg-page flex items-center gap-2"
                      >
                        <Heading1 className="w-4 h-4 text-muted" />
                        <span className="text-base font-bold text-ink">
                          Heading 1
                        </span>
                      </button>
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => handleHeadingSelect("## ")}
                        className="w-full px-3 py-1.5 text-left hover:bg-page flex items-center gap-2"
                      >
                        <Heading2 className="w-4 h-4 text-muted" />
                        <span className="text-sm font-bold text-ink">
                          Heading 2
                        </span>
                      </button>
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => handleHeadingSelect("### ")}
                        className="w-full px-3 py-1.5 text-left hover:bg-page flex items-center gap-2"
                      >
                        <Heading3 className="w-4 h-4 text-muted" />
                        <span className="text-xs font-bold text-ink">
                          Heading 3
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            const toolbarItem = item as ToolbarAction;
            return (
              <Tooltip key={toolbarItem.id} content={toolbarItem.shortcut ? `${toolbarItem.label} (${toolbarItem.shortcut})` : toolbarItem.label}>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => handleToolbarAction(toolbarItem)}
                  className="p-1.5 text-muted hover:text-ink-2 hover:bg-surface-sunk rounded transition-colors"
                  aria-label={toolbarItem.label}
                  aria-keyshortcuts={toolbarItem.shortcut}
                >
                  {toolbarItem.icon}
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}

      {/* Editor / Preview content */}
      <div className={`flex-1 ${isFullscreen ? "overflow-y-auto" : ""}`}>
        {activeTab === "write" ? (
          <MentionInput
            ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={onChange}
            users={users}
            rows={isFullscreen ? 20 : minRows}
            placeholder={placeholder + " (Type @ to mention, paste images directly)"}
            onImagePaste={onImagePaste}
            onKeyDown={handleEditorKeyDown}
            className={`w-full text-sm text-ink p-3 border-0 leading-relaxed resize-none ${
              isFullscreen ? "min-h-[300px]" : ""
            }`}
          />
        ) : (
          <div
            className={`p-4 text-sm text-ink leading-relaxed ${
              isFullscreen ? "min-h-[300px]" : "min-h-[120px]"
            }`}
          >
            {value ? (
              <MarkdownContent text={value} users={users} />
            ) : (
              <span className="text-muted italic">
                Nothing to preview
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer: save/cancel and hints */}
      {showSaveButtons && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-subtle bg-page/50 rounded-b-md">
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1.5 bg-accent text-accent-fg rounded text-xs font-semibold hover:bg-accent-hover transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-1.5 text-ink-2 hover:bg-surface-sunk rounded text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <span className="text-[11px] text-muted ml-auto flex items-center gap-2">
            <span>
              <kbd className="px-1 py-0.5 bg-surface-sunk border border-subtle rounded text-[10px] font-mono">{modKey}↵</kbd> Save
            </span>
            <span>Markdown supported</span>
          </span>
        </div>
      )}
    </div>
  );

  // Render the label for click-to-edit mode
  const label =
    mode === "click-to-edit" ? (
      <h3 className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-2">
        Description
      </h3>
    ) : null;

  // Fullscreen overlay
  if (isFullscreen) {
    return (
      <>
        {label}
        <Dialog open onOpenChange={(open) => !open && setIsFullscreen(false)}>
          <DialogContent size="xl" title="Edit description" className="h-[min(48rem,calc(100dvh-2rem))]">
            <div className="flex h-full flex-col overflow-hidden rounded-control border border-subtle focus-within:border-accent">
              {editorContent}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div>
      {label}
      <div className="border border-subtle rounded-md overflow-hidden focus-within:border-accent transition-colors">
        {editorContent}
      </div>
    </div>
  );
}
