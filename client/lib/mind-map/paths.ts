export function linkPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  side: "left" | "right" | "center"
): string {
  const direction = side === "left" ? -1 : 1;
  const midX = x1 + direction * Math.max(24, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
}
