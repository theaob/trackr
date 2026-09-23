"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { User } from "@/types";
import MentionInput, { ImagePasteResult } from "@/components/common/MentionInput";
import MarkdownContent from "@/components/common/MarkdownContent";
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
  Image,
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
  X,
} from "lucide-react";

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
        <h3 className="text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-2">
          Description
        </h3>
        <div
          onClick={handleClickToEdit}
          className={`min-h-[80px] p-3 rounded-md border border-transparent transition-all text-sm text-jira-navy leading-relaxed ${
            canEdit
              ? "hover:bg-jira-gray-100 cursor-pointer hover:border-jira-gray-300 group"
              : "bg-jira-gray-50/50"
          }`}
        >
          {value ? (
            <MarkdownContent text={value} users={users} />
          ) : (
            <span className="text-jira-gray-500 italic">
              {canEdit ? placeholder : "No description provided."}
            </span>
          )}
          {canEdit && (
            <div className="invisible group-hover:visible flex items-center gap-1 mt-2 text-[11px] text-jira-gray-400">
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
      <div className="flex items-center justify-between border-b border-jira-gray-200 bg-jira-gray-50/70 rounded-t-md px-1">
        {/* Write / Preview tabs */}
        <div className="flex items-center">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setActiveTab("write")}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors border-b-2 ${
              activeTab === "write"
                ? "border-jira-blue text-jira-blue"
                : "border-transparent text-jira-gray-500 hover:text-jira-gray-700"
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
                ? "border-jira-blue text-jira-blue"
                : "border-transparent text-jira-gray-500 hover:text-jira-gray-700"
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
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowCheatsheet(!showCheatsheet)}
              className="p-1.5 text-jira-gray-400 hover:text-jira-gray-600 hover:bg-jira-gray-100 rounded transition-colors"
              title="Markdown cheatsheet"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
            {showCheatsheet && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-jira-gray-200 rounded-lg shadow-xl z-50 py-2 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 border-b border-jira-gray-100 text-[11px] font-bold text-jira-gray-500 uppercase tracking-wider">
                  Markdown Cheatsheet
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {CHEATSHEET_ITEMS.map((item) => (
                    <div
                      key={item.syntax}
                      className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-jira-gray-50"
                    >
                      <code className="px-1.5 py-0.5 bg-jira-gray-100 rounded text-[11px] font-mono text-jira-navy">
                        {item.syntax}
                      </code>
                      <span className="text-jira-gray-500">{item.result}</span>
                    </div>
                  ))}
                </div>
                <div className="px-3 pt-2 pb-1 border-t border-jira-gray-100">
                  <div className="text-[10px] text-jira-gray-400 space-y-0.5">
                    <div><kbd className="px-1 py-0.5 bg-jira-gray-100 rounded text-[10px]">{modKey}B</kbd> Bold • <kbd className="px-1 py-0.5 bg-jira-gray-100 rounded text-[10px]">{modKey}I</kbd> Italic • <kbd className="px-1 py-0.5 bg-jira-gray-100 rounded text-[10px]">{modKey}K</kbd> Link</div>
                    <div><kbd className="px-1 py-0.5 bg-jira-gray-100 rounded text-[10px]">Tab</kbd> Indent list item • <kbd className="px-1 py-0.5 bg-jira-gray-100 rounded text-[10px]">{modKey}↵</kbd> Save</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-jira-gray-400 hover:text-jira-gray-600 hover:bg-jira-gray-100 rounded transition-colors"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen editor"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Formatting Toolbar (visible only in Write tab) */}
      {activeTab === "write" && (
        <div className="flex items-center flex-wrap gap-0.5 px-2 py-1 border-b border-jira-gray-200 bg-white">
          {toolbarActions.map((item, idx) => {
            if (item === "separator") {
              return (
                <div
                  key={`sep-${idx}`}
                  className="w-px h-4 bg-jira-gray-200 mx-0.5"
                />
              );
            }

            if (item === "heading-dropdown") {
              return (
                <div key="heading-dropdown" className="relative" ref={headingMenuRef}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowHeadingMenu(!showHeadingMenu)}
                    className="flex items-center gap-0.5 px-1.5 py-1 text-jira-gray-500 hover:text-jira-gray-700 hover:bg-jira-gray-100 rounded transition-colors text-xs font-medium"
                    title="Headings"
                  >
                    <span className="text-[11px]">Normal text</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showHeadingMenu && (
                    <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-jira-gray-200 rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95">
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => handleHeadingSelect("# ")}
                        className="w-full px-3 py-1.5 text-left hover:bg-jira-gray-50 flex items-center gap-2"
                      >
                        <Heading1 className="w-4 h-4 text-jira-gray-500" />
                        <span className="text-base font-bold text-jira-navy">
                          Heading 1
                        </span>
                      </button>
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => handleHeadingSelect("## ")}
                        className="w-full px-3 py-1.5 text-left hover:bg-jira-gray-50 flex items-center gap-2"
                      >
                        <Heading2 className="w-4 h-4 text-jira-gray-500" />
                        <span className="text-sm font-bold text-jira-navy">
                          Heading 2
                        </span>
                      </button>
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => handleHeadingSelect("### ")}
                        className="w-full px-3 py-1.5 text-left hover:bg-jira-gray-50 flex items-center gap-2"
                      >
                        <Heading3 className="w-4 h-4 text-jira-gray-500" />
                        <span className="text-xs font-bold text-jira-navy">
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
              <button
                key={toolbarItem.id}
                type="button"
                tabIndex={-1}
                onClick={() => handleToolbarAction(toolbarItem)}
                className="p-1.5 text-jira-gray-500 hover:text-jira-gray-700 hover:bg-jira-gray-100 rounded transition-colors"
                title={
                  toolbarItem.shortcut
                    ? `${toolbarItem.label} (${toolbarItem.shortcut})`
                    : toolbarItem.label
                }
              >
                {toolbarItem.icon}
              </button>
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
            className={`w-full text-sm text-jira-navy p-3 border-0 outline-none leading-relaxed resize-none ${
              isFullscreen ? "min-h-[300px]" : ""
            }`}
          />
        ) : (
          <div
            className={`p-4 text-sm text-jira-navy leading-relaxed ${
              isFullscreen ? "min-h-[300px]" : "min-h-[120px]"
            }`}
          >
            {value ? (
              <MarkdownContent text={value} users={users} />
            ) : (
              <span className="text-jira-gray-400 italic">
                Nothing to preview
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer: save/cancel and hints */}
      {showSaveButtons && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-jira-gray-200 bg-jira-gray-50/50 rounded-b-md">
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1.5 bg-jira-blue text-white rounded text-xs font-semibold hover:bg-jira-blue-hover transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-1.5 text-jira-gray-700 hover:bg-jira-gray-100 rounded text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <span className="text-[11px] text-jira-gray-400 ml-auto flex items-center gap-2">
            <span>
              <kbd className="px-1 py-0.5 bg-jira-gray-100 border border-jira-gray-200 rounded text-[10px] font-mono">{modKey}↵</kbd> Save
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
      <h3 className="text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-2">
        Description
      </h3>
    ) : null;

  // Fullscreen overlay
  if (isFullscreen) {
    return (
      <>
        {label}
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-jira-gray-200 bg-jira-gray-50">
              <h3 className="text-sm font-semibold text-jira-navy">
                Edit Description
              </h3>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="p-1 text-jira-gray-400 hover:text-jira-gray-600 hover:bg-jira-gray-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
              {editorContent}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div>
      {label}
      <div className="border border-jira-gray-300 rounded-md overflow-hidden focus-within:border-jira-blue transition-colors">
        {editorContent}
      </div>
    </div>
  );
}
