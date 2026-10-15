export type Point = readonly [number, number];
export type Line = readonly Point[];
export type Token = readonly [number, number, number, number, number];
export type Phase =
  | "idle"
  | "reading"
  | "updating"
  | "predicting"
  | "sampling"
  | "rendering";
export interface Inference {
  load(): Promise<void>;
  readonly scale: number;
  reset(): void;
  update(token: Token): void;
  checkpoint(): void;
  restore(): void;
  predict(temperature: number): void;
  sample(): Token;
  dispose(): void;
}
