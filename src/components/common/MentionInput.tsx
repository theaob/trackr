"use client";

import React, { useState, useRef, useEffect } from "react";
import { User } from "@/types";
import UserAvatar from "@/components/common/UserAvatar";
import { AtSign, Loader2 } from "lucide-react";

export interface ImagePasteResult {
  success: boolean;
  url?: string;
  fileName?: string;
  error?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (val: string) => void;
  users: User[];
  placeholder?: string;
  className?: string;
  rows?: number;
  multiline?: boolean;
  onSubmit?: (e?: any) => void | Promise<void>;
  onImagePaste?: (file: File) => Promise<ImagePasteResult>;
  autoFocus?: boolean;
  disabled?: boolean;
}

export default function MentionInput({
  value,
  onChange,
  users,
  placeholder,
  className = "",
  rows = 3,
  multiline = true,
  onSubmit,
  onImagePaste,
  autoFocus = false,
  disabled = false,
}: MentionInputProps) {
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Filter candidates matching the query
  const filteredUsers = React.useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.role && u.role.toLowerCase().includes(q))
    );
  }, [users, mentionQuery]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredUsers]);

  // Handle image clipboard pasting
  const handlePaste = async (
    e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    if (!onImagePaste) return;
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    let imageFile: File | null = null;
    if (clipboardData.files && clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        const file = clipboardData.files[i];
        if (file.type.startsWith("image/")) {
          imageFile = file;
          break;
        }
      }
    }

    if (!imageFile && clipboardData.items) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.type.startsWith("image/")) {
          imageFile = item.getAsFile();
          break;
        }
      }
    }

    if (!imageFile) return;

    e.preventDefault();

    const target = inputRef.current;
    const cursorPos = target ? (target.selectionStart ?? value.length) : value.length;
    const selectionEnd = target ? (target.selectionEnd ?? cursorPos) : cursorPos;

    const before = value.slice(0, cursorPos);
    const after = value.slice(selectionEnd);

    const placeholderName =
      imageFile.name && imageFile.name !== "image.png" && imageFile.name !== "blob"
        ? imageFile.name
        : "image.png";
    const placeholderText = `![Uploading ${placeholderName}...]()`;

    const needsPrefixNewline = multiline && before.length > 0 && !before.endsWith("\n");
    const needsSuffixNewline = multiline && after.length > 0 && !after.startsWith("\n");
    const insertPlaceholder = `${needsPrefixNewline ? "\n" : ""}${placeholderText}${
      needsSuffixNewline ? "\n" : ""
    }`;

    const textWithPlaceholder = `${before}${insertPlaceholder}${after}`;
    onChange(textWithPlaceholder);
    setIsUploadingImage(true);

    try {
      const res = await onImagePaste(imageFile);
      if (res.success && res.url) {
        const displayFileName = res.fileName || placeholderName;
        const markdownImage = `![${displayFileName}](${res.url})`;
        onChange(textWithPlaceholder.replace(placeholderText, markdownImage));
      } else {
        onChange(textWithPlaceholder.replace(insertPlaceholder, ""));
      }
    } catch {
      onChange(textWithPlaceholder.replace(insertPlaceholder, ""));
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Check text around cursor to detect @mention
  const checkMentionTrigger = (text: string, cursorPos: number) => {
    // Look backwards from cursor position
    const textBeforeCursor = text.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex !== -1) {
      // Ensure the @ is preceded by start of string, whitespace, or newline
      const charBeforeAt = atIndex > 0 ? textBeforeCursor[atIndex - 1] : " ";
      if (/\s/.test(charBeforeAt) || atIndex === 0) {
        const query = textBeforeCursor.slice(atIndex + 1);
        // Valid mention query shouldn't contain newlines and typically <= 30 chars
        if (!query.includes("\n") && query.length <= 30) {
          setMentionQuery(query);
          setMentionStartIndex(atIndex);
          setIsOpen(true);
          return;
        }
      }
    }

    setIsOpen(false);
    setMentionQuery(null);
    setMentionStartIndex(-1);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const newVal = e.target.value;
    onChange(newVal);
    const cursorPos = e.target.selectionStart || 0;
    checkMentionTrigger(newVal, cursorPos);
  };

  const handleSelectUser = (user: User) => {
    if (mentionStartIndex === -1 || !inputRef.current) return;

    const beforeMention = value.slice(0, mentionStartIndex);
    const afterMention = value.slice(
      inputRef.current.selectionStart || mentionStartIndex + (mentionQuery?.length || 0) + 1
    );

    // Insert @Name with a trailing space
    const mentionText = `@${user.name} `;
    const updatedValue = `${beforeMention}${mentionText}${afterMention}`;
    onChange(updatedValue);

    setIsOpen(false);
    setMentionQuery(null);
    setMentionStartIndex(-1);

    // Reposition cursor right after the inserted mention
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    if (isOpen && filteredUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredUsers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev <= 0 ? filteredUsers.length - 1 : prev - 1
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSelectUser(filteredUsers[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        return;
      }
    }

    // If Enter pressed without mention open on singleLine or Ctrl/Cmd+Enter
    if (!isOpen && onSubmit && e.key === "Enter") {
      if (!multiline || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        onSubmit();
      }
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Quick mention button handler
  const handleTriggerMention = () => {
    if (!inputRef.current) return;
    const cursorPos = inputRef.current.selectionStart || value.length;
    const before = value.slice(0, cursorPos);
    const after = value.slice(cursorPos);
    const needSpace = before.length > 0 && !/\s$/.test(before);
    const insertText = needSpace ? " @" : "@";
    const newVal = `${before}${insertText}${after}`;
    onChange(newVal);

    setTimeout(() => {
      if (inputRef.current) {
        const newPos = before.length + insertText.length;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPos, newPos);
        checkMentionTrigger(newVal, newPos);
      }
    }, 10);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          rows={rows}
          autoFocus={autoFocus}
          disabled={disabled}
          className={className}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          className={className}
        />
      )}

      {isUploadingImage && (
        <div className="absolute right-2 bottom-2 pointer-events-none flex items-center gap-1.5 text-[11px] text-jira-blue bg-white/95 px-2 py-1 rounded shadow-xs border border-jira-blue/30 font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Uploading image...</span>
        </div>
      )}

      {/* Floating Mention Suggestions Dropdown */}
      {isOpen && filteredUsers.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-72 max-h-56 overflow-y-auto bg-white border border-jira-gray-300 rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95">
          <div className="px-3 py-1.5 border-b border-jira-gray-100 flex items-center justify-between text-[11px] font-bold text-jira-gray-500 uppercase tracking-wider">
            <span>Mention someone</span>
            <span className="text-[10px] lowercase font-normal">
              use ↑ ↓ and Enter
            </span>
          </div>
          {filteredUsers.map((user, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelectUser(user)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full px-3 py-2 flex items-center gap-2.5 text-left transition-colors ${
                  isSelected ? "bg-jira-blue-subtle/70" : "hover:bg-jira-gray-50"
                }`}
              >
                <UserAvatar
                  user={user}
                  size="sm"
                  className="border border-jira-gray-200"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-jira-navy truncate">
                    {user.name}
                  </div>
                  <div className="text-[11px] text-jira-gray-500 truncate">
                    {user.role || user.email}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
