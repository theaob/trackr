export type IssueLinkType = "BLOCKS" | "RELATES_TO" | "DUPLICATES";

export const ISSUE_LINK_TYPES: IssueLinkType[] = ["BLOCKS", "RELATES_TO", "DUPLICATES"];

/**
 * A link row is stored once, from the source's perspective ("source BLOCKS
 * target"). Whichever issue is rendering it asks for its own label rather
 * than storing the inverse as a second row.
 */
const LINK_TYPE_LABELS: Record<IssueLinkType, { outward: string; inward: string }> = {
  BLOCKS: { outward: "blocks", inward: "is blocked by" },
  RELATES_TO: { outward: "relates to", inward: "relates to" },
  DUPLICATES: { outward: "duplicates", inward: "is duplicated by" },
};

/** The label to show on the side named by `direction`. */
export function describeIssueLink(
  type: IssueLinkType | string,
  direction: "outward" | "inward"
): string {
  const labels = LINK_TYPE_LABELS[type as IssueLinkType];
  return labels ? labels[direction] : type;
}

/** Whether a link type reads the same in both directions, so a second row for the reverse pair would be redundant. */
export function isSymmetricLinkType(type: IssueLinkType | string): boolean {
  const labels = LINK_TYPE_LABELS[type as IssueLinkType];
  return !!labels && labels.outward === labels.inward;
}
