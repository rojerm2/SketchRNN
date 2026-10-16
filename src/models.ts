import catalog from "./model-source.json";
import type { Line } from "./types";

const inputs: Record<
  string,
  { hint: string; example: readonly Line[]; icon: string }
> = {
  cat: {
    hint: "Start with ears, a head, or a simple outline. This model has learned from cat sketches.",
    example: [
      [
        [300, 245],
        [304, 208],
        [310, 170],
        [340, 197],
        [366, 189],
        [397, 189],
        [422, 198],
        [453, 171],
        [463, 213],
        [468, 242],
      ],
    ],
    icon: "m9 29 2-20 10 9h6l10-9 2 20q-15 17-30 0Z M17 28h1m12 0h1m-10 7 3 2 3-2",
  },
  bird: {
    hint: "Start with a curved head or part of a body. Leave room for a beak, wings, and tail.",
    example: [
      [
        [315, 230],
        [310, 210],
        [315, 185],
        [330, 170],
        [350, 169],
        [365, 178],
        [375, 192],
      ],
    ],
    icon: "M8 29q4-2 6-12 4-11 15-6 6 3 5 11l8 2-9 4q-8 13-25 1Z M27 16h1M13 25q6 6 12-3M21 35l-2 6m7-8v8",
  },
  flower: {
    hint: "Start with a few petals or part of a flower head. Leave space below for a stem and leaves.",
    example: [
      [
        [320, 230],
        [302, 205],
        [308, 185],
        [329, 181],
        [343, 198],
        [341, 170],
        [353, 154],
        [374, 155],
        [385, 173],
        [383, 195],
      ],
    ],
    icon: "M24 14c-12-16-21 3-9 7-16 7-1 20 9 7 10 13 25 0 9-7 12-4 3-23-9-7Z M24 30v13m0-3q-12 0-12-8 9 0 12 8m0-4q10 0 11-8-9 0-11 8M28 22a4 4 0 1 0-8 0 4 4 0 1 0 8 0",
  },
};

export const MODELS = catalog.models.map((model) => ({
  ...model,
  ...inputs[model.category],
}));
export type ModelDefinition = (typeof MODELS)[number];
