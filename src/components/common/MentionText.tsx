"use client";

import React from "react";
import { User } from "@/types";

interface MentionTextProps {
  text: string | null | undefined;
  users?: User[];
  className?: string;
}

export default function MentionText({ text, users = [], className = "" }: MentionTextProps) {
  if (!text) return null;

  // Regex to match mentions:
  // 1. Bracket format: @[Name]
  // 2. Simple format: @FirstName LastName or @Word
  const mentionRegex = /(@\[([^\]]+)\]|@([a-zA-Z0-9_\.\-]+(?:\s+[a-zA-Z0-9_\.\-]+)?))/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Known user names for exact matching (case-insensitive)
  const userMap = new Map<string, User>();
  users.forEach((u) => {
    userMap.set(u.name.toLowerCase(), u);
    const firstName = u.name.split(" ")[0]?.toLowerCase();
    if (firstName && !userMap.has(firstName)) {
      userMap.set(firstName, u);
    }
  });

  while ((match = mentionRegex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = mentionRegex.lastIndex;

    // Check if there is plain text before this match
    if (matchStart > lastIndex) {
      elements.push(
        <span key={`text-${lastIndex}`}>{text.substring(lastIndex, matchStart)}</span>
      );
    }

    const rawName = match[2] || match[3];
    const matchedUser = userMap.get(rawName.trim().toLowerCase());

    elements.push(
      <span
        key={`mention-${matchStart}`}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.2 mx-0.5 rounded-sm bg-jira-blue-subtle text-jira-blue font-semibold text-xs border border-jira-blue/20 hover:bg-jira-blue/10 transition-colors select-none"
        title={matchedUser ? `${matchedUser.name} (${matchedUser.role || matchedUser.email})` : `@${rawName}`}
      >
        <span className="text-jira-blue/70 text-[11px]">@</span>
        <span>{matchedUser ? matchedUser.name : rawName}</span>
      </span>
    );

    lastIndex = matchEnd;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    elements.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
  }

  return <div className={`whitespace-pre-wrap ${className}`}>{elements}</div>;
}
