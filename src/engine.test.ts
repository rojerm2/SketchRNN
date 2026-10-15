import { describe, expect, it } from "vitest";
import { GenerationEngine, MAX_STEPS, type Scheduler } from "./engine";
import { START } from "./strokes";
import type { Inference, Token } from "./types";

class Clock implements Scheduler {
  callbacks = new Map<number, () => void>();
  id = 0;
  request(cb: () => void) {
    this.callbacks.set(++this.id, cb);
    return this.id;
  }
  cancel(id: number) {
    this.callbacks.delete(id);
  }
  tick() {
    const tasks = [...this.callbacks.values()];
    this.callbacks.clear();
    tasks.forEach((cb) => cb());
  }
  run(n: number) {
    for (let i = 0; i < n; i++) this.tick();
  }
}
class Fake implements Inference {
  scale = 40;
  updates: Token[] = [];
  saved: Token[] = [];
  samples = 0;
  token: Token = [2, 3, 1, 0, 0];
  async load() {}
  reset() {
    this.updates = [];
  }
  update(t: Token) {
    this.updates.push(t);
  }
  checkpoint() {
    this.saved = [...this.updates];
  }
  restore() {
    this.updates = [...this.saved];
  }
  predict() {}
  sample() {
    this.samples++;
    return this.token;
  }
  dispose() {}
}
const prefix: Token[] = [
  [10, 4, 1, 0, 0],
  [2, 3, 0, 1, 0],
];
async function setup(input = prefix) {
  const clock = new Clock(),
    fake = new Fake(),
    engine = new GenerationEngine(fake, clock);
  await engine.load();
  engine.begin(input);
  clock.run(3);
  return { clock, fake, engine };
}
describe("inference lifecycle", () => {
  it("feeds the initial token and all prefix tokens exactly once", async () => {
    const { engine, fake, clock } = await setup();
    expect(fake.updates).toEqual([START, ...prefix]);
    clock.run(3);
    expect(engine.getSnapshot().generated).toHaveLength(1);
    expect(fake.samples).toBe(1);
  });
  it("pause is inert; step completes exactly one timestep even mid-cycle", async () => {
    const { engine, fake, clock } = await setup();
    clock.run(2);
    engine.pause();
    clock.run(20);
    expect(engine.getSnapshot().generated).toHaveLength(0);
    expect(fake.samples).toBe(1);
    engine.step();
    expect(engine.getSnapshot().generated).toHaveLength(1);
    expect(fake.samples).toBe(1);
    engine.step();
    expect(engine.getSnapshot().generated).toHaveLength(2);
    expect(fake.samples).toBe(2);
    engine.resume();
    clock.run(4);
    expect(engine.getSnapshot().generated).toHaveLength(3);
  });
  it("regeneration restores prefix state and discards the generated ending", async () => {
    const input = prefix.map(token => [...token] as Token);
    const { engine, fake, clock } = await setup(input);
    input[0] = [999, 999, 1, 0, 0];
    clock.run(12);
    engine.stop();
    expect(fake.updates.length).toBeGreaterThan(3);
    engine.again();
    expect(fake.updates).toEqual([START, ...prefix]);
    expect(engine.getSnapshot().generated).toEqual([]);
    expect(engine.getSnapshot().prefix).toEqual(prefix);
    clock.run(3);
    expect(engine.getSnapshot().generated).toHaveLength(1);
  });
  it("clear and stop invalidate queued work, including prefix priming", async () => {
    const { engine, clock } = await setup();
    engine.clear();
    clock.run(100);
    expect(engine.getSnapshot().generated).toEqual([]);
    engine.begin(prefix);
    clock.tick();
    engine.stop();
    clock.run(100);
    expect(engine.getSnapshot().status).toBe("stopped");
    engine.again();
    clock.run(10);
    expect(engine.getSnapshot().generated).toEqual([]);
  });
  it("stops on end token and on maximum steps", async () => {
    const { engine, fake, clock } = await setup();
    fake.token = [0, 0, 0, 0, 1];
    clock.run(3);
    expect(engine.getSnapshot().status).toBe("finished");
    fake.token = [2, 3, 1, 0, 0];
    engine.again();
    clock.run(MAX_STEPS * 4 + 50);
    expect(engine.getSnapshot().generated).toHaveLength(MAX_STEPS);
    expect(engine.getSnapshot().message).toContain("safety limit");
  });
  it("recovers from loading errors and rejects nonfinite model output", async () => {
    const { engine, fake, clock } = await setup();
    fake.token = [NaN, 0, 1, 0, 0];
    clock.run(2);
    expect(engine.getSnapshot().status).toBe("error");
    fake.load = async () => {
      throw new Error("Missing weights");
    };
    await engine.load();
    expect(engine.getSnapshot().message).toBe("Missing weights");
    fake.load = async () => {};
    await engine.load();
    expect(engine.getSnapshot().status).toBe("ready");
  });
});
