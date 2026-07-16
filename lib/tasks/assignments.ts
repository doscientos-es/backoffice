/**
 * Returns the complete assignment list while keeping the legacy primary
 * assignee visible for tasks created before task_members was introduced.
 */
export function mergeTaskMemberIds(
  primaryId: string | null | undefined,
  memberIds: readonly (string | null | undefined)[],
): string[] {
  return [...new Set([primaryId, ...memberIds].filter((id): id is string => Boolean(id)))];
}
