export const BRANCH_COLORS = [
  "#f97316",
  "#06b6d4",
  "#ec4899",
  "#a855f7",
  "#22c55e",
  "#eab308",
  "#3b82f6",
  "#14b8a6"
] as const;

export function branchColorForIndex(index: number): string {
  return BRANCH_COLORS[index % BRANCH_COLORS.length] ?? BRANCH_COLORS[0];
}
