// Converts @mentions in raw text into markdown links (`[@Name](mention:<id>)`)
// before the text is handed to a markdown parser, so react-markdown's normal
// link-rendering pipeline can be reused to render mention pills via a custom
// `a` component. Mentions inside fenced code blocks or inline code spans are
// left untouched so literal `@word` in a code sample isn't rewritten.

export interface MentionableUser {
  id: string;
  name: string;
}

const MENTION_REGEX = /(@\[([^\]]+)\]|@([a-zA-Z0-9_.-]+(?:\s+[a-zA-Z0-9_.-]+)?))/g;
const CODE_SEGMENT_REGEX = /(```[\s\S]*?```|`[^`\n]*`)/g;

function buildUserMap(users: MentionableUser[]): Map<string, MentionableUser> {
  const userMap = new Map<string, MentionableUser>();
  users.forEach((u) => {
    userMap.set(u.name.toLowerCase(), u);
    const firstName = u.name.split(" ")[0]?.toLowerCase();
    if (firstName && !userMap.has(firstName)) {
      userMap.set(firstName, u);
    }
  });
  return userMap;
}

// Markdown link labels can't contain unescaped `]`; mention names shouldn't
// have brackets anyway, but strip them defensively.
function sanitizeLabel(name: string): string {
  return name.replace(/[[\]]/g, "");
}

function convertMentions(segment: string, userMap: Map<string, MentionableUser>): string {
  return segment.replace(MENTION_REGEX, (_fullMatch, _all, bracketName, simpleName) => {
    const rawName = (bracketName || simpleName || "").trim();
    const matchedUser = userMap.get(rawName.toLowerCase());
    const label = sanitizeLabel(matchedUser ? matchedUser.name : rawName);
    const target = matchedUser ? matchedUser.id : `unknown:${encodeURIComponent(rawName)}`;
    return `[@${label}](mention:${target})`;
  });
}

export function preprocessMentions(text: string, users: MentionableUser[] = []): string {
  if (!text) return "";

  const userMap = buildUserMap(users);

  return text
    .split(CODE_SEGMENT_REGEX)
    .map((segment, i) => (i % 2 === 1 ? segment : convertMentions(segment, userMap)))
    .join("");
}
