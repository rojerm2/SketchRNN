import type { Line, Point, Token } from "./types";

export const WIDTH = 800;
export const HEIGHT = 520;
export const MAX_PREFIX = 240;
export const START: Token = [0, 0, 1, 0, 0];
export const penName = (t: Token) => (t[4] ? "End" : t[3] ? "Lift" : "Draw");

function distanceSquared(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const u =
    dx || dy
      ? Math.max(
          0,
          Math.min(
            1,
            ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy),
          ),
        )
      : 0;
  return (p[0] - a[0] - u * dx) ** 2 + (p[1] - a[1] - u * dy) ** 2;
}

export function simplify(line: Line, tolerance = 2): Point[] {
  if (line.length < 3) return [...line];
  const keep = new Set([0, line.length - 1]);
  const stack = [[0, line.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let max = tolerance ** 2,
      index = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distanceSquared(line[i], line[a], line[b]);
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (index >= 0) {
      keep.add(index);
      stack.push([a, index], [index, b]);
    }
  }
  return [...keep].sort((a, b) => a - b).map((i) => line[i]);
}

export function toTokens(lines: readonly Line[]): Token[] {
  const usable = lines.filter((l) => l.length > 1);
  if (!usable.length) return [];
  let previous = usable[0][0];
  const tokens: Token[] = [];
  usable.forEach((line, lineIndex) => {
    // A token's pen state controls the NEXT movement, as in Magenta's renderer.
    if (lineIndex > 0)
      tokens.push([
        line[0][0] - previous[0],
        line[0][1] - previous[1],
        1,
        0,
        0,
      ]);
    for (let i = 1; i < line.length; i++) {
      const lift = i === line.length - 1;
      tokens.push([
        line[i][0] - line[i - 1][0],
        line[i][1] - line[i - 1][1],
        lift ? 0 : 1,
        lift ? 1 : 0,
        0,
      ]);
    }
    previous = line[line.length - 1];
  });
  return tokens;
}

export function finiteToken(token: Token) {
  return (
    token.length === 5 &&
    token.every(Number.isFinite) &&
    token.slice(2).every((v) => v === 0 || v === 1) &&
    token[2] + token[3] + token[4] === 1
  );
}
