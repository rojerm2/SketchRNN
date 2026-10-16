import { SketchRNN } from "@magenta/sketch";
import type { Inference, Token } from "./types";
import { MODELS, type ModelDefinition } from "./models";

export class MagentaInference implements Inference {
  private model: SketchRNN;
  private abort?: AbortController;
  constructor(private definition: ModelDefinition = MODELS[0]) {
    this.model = new SketchRNN(`/models/${definition.category}.gen.json`);
  }
  private state!: ReturnType<SketchRNN["zeroState"]>;
  private saved!: ReturnType<SketchRNN["zeroState"]>;
  private pdf!: ReturnType<SketchRNN["getPDF"]>;
  get scale() {
    return this.model.scaleFactor;
  }
  async load() {
    // Check HTTP status: the upstream loader otherwise attempts to parse an error page.
    this.abort?.abort();
    this.abort = new AbortController();
    const response = await fetch(
      `/models/${this.definition.category}.gen.json`,
      {
        signal: AbortSignal.any([
          this.abort.signal,
          AbortSignal.timeout(30000),
        ]),
      },
    );
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("json")
    ) {
      throw new Error(
        `${this.definition.label} weights are missing. Run npm run prepare:model, then reload the model.`,
      );
    }
    const bytes = await response.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const checksum = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (checksum !== this.definition.sha256) {
      throw new Error(
        `The ${this.definition.category} checkpoint did not pass its integrity check. Run npm run prepare:model, rebuild, and reload.`,
      );
    }
    this.model.dispose();
    const url = URL.createObjectURL(
      new Blob([bytes], { type: "application/json" }),
    );
    this.model = new SketchRNN(url);
    try {
      await this.model.initialize();
    } finally {
      URL.revokeObjectURL(url);
    }
    this.model.setPixelFactor(2);
    this.reset();
  }
  reset() {
    this.state = this.model.zeroState();
  }
  update(token: Token) {
    this.state = this.model.update([...token], this.state);
  }
  checkpoint() {
    this.saved = this.model.copyState(this.state);
  }
  restore() {
    this.state = this.model.copyState(this.saved);
  }
  predict(temperature: number) {
    this.pdf = this.model.getPDF(this.state, temperature);
  }
  sample(): Token {
    return this.model.sample(this.pdf) as [
      number,
      number,
      number,
      number,
      number,
    ];
  }
  dispose() {
    this.abort?.abort();
    this.model.dispose();
  }
}
