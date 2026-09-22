"use client";

import React from "react";
import ReactMarkdown, { Components, defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { User } from "@/types";
import { preprocessMentions } from "@/lib/markdownMentions";

interface MarkdownContentProps {
  text: string | null | undefined;
  users?: User[];
  className?: string;
}

function MentionPill({ target, children, users }: { target: string; children?: React.ReactNode; users: User[] }) {
  const matchedUser = users.find((u) => u.id === target);
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-px mx-0.5 rounded-sm bg-jira-blue-subtle text-jira-blue font-semibold text-xs border border-jira-blue/20 hover:bg-jira-blue/10 transition-colors select-none"
      title={matchedUser ? `${matchedUser.name} (${matchedUser.role || matchedUser.email})` : undefined}
    >
      <span className="text-jira-blue/70 text-[11px]">@</span>
      <span>{children}</span>
    </span>
  );
}

function buildComponents(users: User[]): Components {
  return {
    a({ href, children }) {
      if (href?.startsWith("mention:")) {
        return (
          <MentionPill target={decodeURIComponent(href.slice("mention:".length))} users={users}>
            {children}
          </MentionPill>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-jira-blue hover:underline break-words"
        >
          {children}
        </a>
      );
    },
    img({ src, alt }) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt || "Image"}
          loading="lazy"
          className="max-w-full max-h-[480px] h-auto rounded-md border border-jira-gray-200 my-2 object-contain bg-white shadow-xs cursor-pointer hover:border-jira-blue transition-colors"
          onClick={() => {
            if (src) window.open(src, "_blank", "noopener,noreferrer");
          }}
          title={alt ? `${alt} (Click to open full size)` : "Click to open full size"}
        />
      );
    },
    h1: ({ children }) => <h1 className="text-lg font-bold text-jira-navy mt-3 mb-1.5 first:mt-0">{children}</h1>,
    h2: ({ children }) => <h2 className="text-base font-bold text-jira-navy mt-3 mb-1.5 first:mt-0">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-bold text-jira-navy mt-2.5 mb-1 first:mt-0">{children}</h3>,
    h4: ({ children }) => <h4 className="text-sm font-semibold text-jira-navy mt-2 mb-1 first:mt-0">{children}</h4>,
    h5: ({ children }) => <h5 className="text-xs font-semibold text-jira-navy mt-2 mb-1 first:mt-0">{children}</h5>,
    h6: ({ children }) => (
      <h6 className="text-xs font-semibold text-jira-gray-600 mt-2 mb-1 first:mt-0">{children}</h6>
    ),
    p: ({ children }) => <p className="leading-relaxed mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
    ul: ({ children }) => <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-0.5 marker:text-jira-gray-400">{children}</ul>,
    ol: ({ children }) => (
      <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-0.5 marker:text-jira-gray-400">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-jira-gray-300 pl-3 my-2 text-jira-gray-600 italic">
        {children}
      </blockquote>
    ),
    strong: ({ children }) => <strong className="font-bold text-jira-navy">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    del: ({ children }) => <del className="text-jira-gray-500">{children}</del>,
    hr: () => <hr className="my-3 border-jira-gray-200" />,
    table: ({ children }) => (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full border border-jira-gray-200 text-xs">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-jira-gray-50">{children}</thead>,
    tbody: ({ children }) => <tbody className="divide-y divide-jira-gray-100">{children}</tbody>,
    tr: ({ children }) => <tr>{children}</tr>,
    th: ({ children }) => (
      <th className="px-2 py-1 text-left font-semibold text-jira-gray-600 border-b border-jira-gray-200">
        {children}
      </th>
    ),
    td: ({ children }) => <td className="px-2 py-1 text-jira-navy align-top">{children}</td>,
    pre: ({ children }) => (
      <pre className="bg-jira-navy text-jira-gray-50 rounded-md p-3 overflow-x-auto my-2 text-xs leading-relaxed">
        {children}
      </pre>
    ),
    code: ({ className, children }) => {
      const isBlock = /language-/.test(className || "") || String(children).includes("\n");
      if (isBlock) {
        return (
          <code className={`font-mono ${className || ""}`}>{children}</code>
        );
      }
      return (
        <code className="px-1 py-0.5 rounded bg-jira-gray-100 text-jira-navy font-mono text-[0.85em]">
          {children}
        </code>
      );
    },
    input: ({ type, checked }) =>
      type === "checkbox" ? (
        <input type="checkbox" checked={!!checked} disabled className="mr-1.5 align-middle accent-jira-blue" />
      ) : null,
  };
}

// react-markdown's default urlTransform strips any URL scheme it doesn't
// recognize (mailto, http(s), etc.) down to an empty string, which would
// silently kill our `mention:` links. Let those through untouched and defer
// to the default sanitizer for everything else (real links).
function urlTransform(url: string): string {
  return url.startsWith("mention:") ? url : defaultUrlTransform(url);
}

export default function MarkdownContent({ text, users = [], className = "" }: MarkdownContentProps) {
  if (!text) return null;

  const withMentions = preprocessMentions(text, users);

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={buildComponents(users)} urlTransform={urlTransform}>
        {withMentions}
      </ReactMarkdown>
    </div>
  );
}
