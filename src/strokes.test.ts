import { describe, expect, it } from "vitest";
import { finiteToken, simplify, toTokens } from "./strokes";
describe("stroke representation", () => {
  it("preserves pen-up boundaries without connecting separate paths", () => {
    const tokens = toTokens([
      [
        [10, 10],
        [20, 10],
        [20, 20],
      ],
      [
        [40, 50],
        [50, 60],
      ],
    ]);
    expect(tokens).toEqual([
      [10, 0, 1, 0, 0],
      [0, 10, 0, 1, 0],
      [20, 30, 1, 0, 0],
      [10, 10, 0, 1, 0],
    ]);
    let previousDown = true;
    const drawn: boolean[] = [];
    for (const t of tokens) {
      drawn.push(previousDown);
      previousDown = !!t[2];
    }
    expect(drawn).toEqual([true, true, false, true]);
  });
  it("ignores clicks and handles empty input", () => {
    expect(toTokens([])).toEqual([]);
    expect(toTokens([[[10, 10]]])).toEqual([]);
  });
  it("simplifies straight paths and preserves significant corners and endpoints", () => {
    expect(
      simplify([
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
      ]),
    ).toEqual([
      [0, 0],
      [3, 0],
    ]);
    expect(
      simplify([
        [0, 0],
        [0, 10],
        [10, 10],
      ]),
    ).toEqual([
      [0, 0],
      [0, 10],
      [10, 10],
    ]);
  });
  it("validates finite offsets and one-hot pen states", () => {
    expect(finiteToken([2, 3, 0, 1, 0])).toBe(true);
    expect(finiteToken([Infinity, 3, 0, 1, 0])).toBe(false);
    expect(finiteToken([2, 3, 1, 1, 0])).toBe(false);
  });
});
