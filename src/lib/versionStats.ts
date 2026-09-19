export function computeVersionStats(
  version: any,
  categoryByStatus: Map<string, string>
) {
  const issues = version.issues || [];
  const total = issues.length;
  let done = 0;
  let inProgress = 0;
  let todo = 0;
  let storyPoints = 0;
  let completedStoryPoints = 0;

  for (const issue of issues) {
    const pts = issue.storyPoints || 0;
    storyPoints += pts;

    const category = categoryByStatus.get(issue.status);
    if (category === "DONE") {
      done++;
      completedStoryPoints += pts;
    } else if (category === "IN_PROGRESS") {
      inProgress++;
    } else {
      todo++;
    }
  }

  const { issues: _issues, ...rest } = version;
  return {
    ...rest,
    issueCount: {
      total,
      done,
      inProgress,
      todo,
      storyPoints,
      completedStoryPoints,
    },
  };
}
