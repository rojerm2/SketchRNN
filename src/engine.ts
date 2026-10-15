import { finiteToken, MAX_PREFIX, START } from "./strokes";
import type { Inference, Phase, Token } from "./types";

export type Status =
  | "loading"
  | "ready"
  | "drawing"
  | "reading"
  | "generating"
  | "paused"
  | "finished"
  | "stopped"
  | "error";
export interface Snapshot {
  status: Status;
  phase: Phase;
  generated: readonly Token[];
  prefix: readonly Token[];
  message: string;
  scale: number;
}
export interface Scheduler {
  request(callback: () => void): number;
  cancel(id: number): void;
}
const browserScheduler: Scheduler = {
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};
export const MAX_STEPS = 300;

export class GenerationEngine {
  private frame = 0;
  private epoch = 0;
  private index = 0;
  private input: Token = START;
  private savedPrefix: readonly Token[] = [];
  private listeners = new Set<() => void>();
  private snapshot: Snapshot = {
    status: "loading",
    phase: "idle",
    generated: [],
    prefix: [],
    message: "",
    scale: 1,
  };
  private temperature = 0.5;
  setTemperature(value: number) {
    this.temperature = Math.max(0.1, Math.min(1, value));
  }
  constructor(
    private adapter: Inference,
    private scheduler = browserScheduler,
  ) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private set(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }
  private cancel() {
    this.epoch++;
    this.scheduler.cancel(this.frame);
    this.frame = 0;
  }
  async load() {
    this.cancel();
    const epoch = this.epoch;
    this.set({ status: "loading", message: "" });
    try {
      await this.adapter.load();
      if (epoch !== this.epoch) {
        this.adapter.dispose();
        return;
      }
      this.set({ status: "ready", scale: this.adapter.scale });
    } catch (error) {
      if (epoch === this.epoch) this.fail(error);
    }
  }
  private fail(error: unknown) {
    this.cancel();
    this.set({
      status: "error",
      phase: "idle",
      message:
        error instanceof Error
          ? error.message
          : "Inference failed. Reload the model to try again.",
    });
  }
  clear() {
    // Loading is allowed to finish; Clear still removes all drawing data immediately.
    const loading = this.snapshot.status === "loading";
    if (!loading) this.cancel();
    this.savedPrefix = [];
    const errorMessage =
      this.snapshot.status === "error" ? this.snapshot.message : "";
    this.set({
      generated: [],
      prefix: [],
      phase: "idle",
      message: errorMessage,
      status: loading
        ? "loading"
        : this.snapshot.status === "error"
          ? "error"
          : "ready",
    });
  }
  drawing() {
    this.cancel();
    this.savedPrefix = [];
    this.set({
      status: "drawing",
      generated: [],
      prefix: [],
      phase: "idle",
      message: "",
    });
  }
  endDrawing() {
    if (this.snapshot.status === "drawing") this.set({ status: "ready" });
  }
  begin(prefix: readonly Token[]) {
    if (
      !["ready", "finished", "stopped"].includes(this.snapshot.status) ||
      !prefix.length
    )
      return;
    if (prefix.length > MAX_PREFIX) {
      this.set({
        message: `Keep the input below ${MAX_PREFIX} simplified points. Clear and try a shorter sketch.`,
      });
      return;
    }
    this.cancel();
    this.savedPrefix = prefix.map((t) => [...t] as Token);
    this.index = 0;
    this.input = START;
    this.adapter.reset();
    this.set({
      status: "reading",
      phase: "reading",
      generated: [],
      prefix: this.savedPrefix,
      message: "",
    });
    const epoch = this.epoch;
    const prime = () => {
      if (epoch !== this.epoch || this.snapshot.status !== "reading") return;
      try {
        // Bound prefix work to one recurrent update per animation frame.
        this.adapter.update(
          this.index === 0 ? START : this.savedPrefix[this.index - 1],
        );
        this.index++;
        if (this.index <= this.savedPrefix.length)
          this.frame = this.scheduler.request(prime);
        else {
          this.adapter.checkpoint();
          this.input = this.savedPrefix[this.savedPrefix.length - 1];
          this.set({ status: "generating", phase: "predicting" });
          this.queue();
        }
      } catch (e) {
        this.fail(e);
      }
    };
    this.frame = this.scheduler.request(prime);
  }
  again() {
    if (
      !this.savedPrefix.length ||
      !["finished", "stopped", "paused"].includes(this.snapshot.status)
    )
      return;
    this.cancel();
    this.adapter.restore();
    this.input = this.savedPrefix[this.savedPrefix.length - 1];
    this.set({
      status: "generating",
      phase: "predicting",
      generated: [],
      message: "",
    });
    this.queue();
  }
  private queue() {
    const epoch = this.epoch;
    this.frame = this.scheduler.request(() => {
      if (epoch !== this.epoch || this.snapshot.status !== "generating") return;
      this.advanceStage();
      if (this.snapshot.status === "generating") this.queue();
    });
  }
  private pending!: Token;
  private advanceStage() {
    try {
      if (this.snapshot.phase === "predicting") {
        this.adapter.predict(this.temperature);
        this.set({ phase: "sampling" });
      } else if (this.snapshot.phase === "sampling") {
        this.pending = this.adapter.sample();
        if (!finiteToken(this.pending))
          throw new Error(
            "The model returned an invalid point. Reload the model and try a shorter prefix.",
          );
        this.set({ phase: "rendering" });
      } else if (this.snapshot.phase === "rendering") {
        const generated = [...this.snapshot.generated, this.pending];
        this.input = this.pending;
        if (this.pending[4] || generated.length >= MAX_STEPS) {
          this.set({
            generated,
            status: "finished",
            phase: "idle",
            message: this.pending[4]
              ? "The model emitted its end token."
              : `Stopped at the ${MAX_STEPS}-step safety limit.`,
          });
        } else this.set({ generated, phase: "updating" });
      } else if (this.snapshot.phase === "updating") {
        this.adapter.update(this.input);
        this.set({ phase: "predicting" });
      }
    } catch (e) {
      this.fail(e);
    }
  }
  pause() {
    if (this.snapshot.status === "generating") {
      this.cancel();
      this.set({ status: "paused" });
    }
  }
  resume() {
    if (this.snapshot.status === "paused") {
      this.set({ status: "generating" });
      this.queue();
    }
  }
  step() {
    if (this.snapshot.status !== "paused") return;
    const before = this.snapshot.generated.length;
    // Finish the pending cycle without repeating a sample already taken before Pause.
    for (
      let i = 0;
      i < 4 &&
      this.snapshot.generated.length === before &&
      this.snapshot.status === "paused";
      i++
    )
      this.advanceStage();
  }
  stop() {
    if (!["reading", "generating", "paused"].includes(this.snapshot.status))
      return;
    const wasReading = this.snapshot.status === "reading";
    this.cancel();
    if (wasReading) this.savedPrefix = [];
    this.set({
      status: "stopped",
      phase: "idle",
      prefix: wasReading ? [] : this.snapshot.prefix,
      message: "Generation stopped. Your original input is preserved.",
    });
  }
  dispose() {
    this.cancel();
    this.adapter.dispose();
    this.listeners.clear();
  }
}
