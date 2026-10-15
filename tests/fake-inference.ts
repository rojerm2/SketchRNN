// This module is substituted only by Vite's explicit e2e mode. It never enters a production build.
import type { Inference, Token } from "../src/types";
export class MagentaInference implements Inference {
  scale = 41.1;
  count = 0;
  saved = 0;
  async load() {}
  reset() {
    this.count = 0;
  }
  update() {
    this.count++;
  }
  checkpoint() {
    this.saved = this.count;
  }
  restore() {
    this.count = this.saved;
  }
  predict() {}
  sample(): Token {
    return this.count > this.saved + 30 ? [0, 0, 0, 0, 1] : [2, 1, 1, 0, 0];
  }
  dispose() {}
}
