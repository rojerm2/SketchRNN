import { useEffect, useState, useSyncExternalStore } from "react";
import { GenerationEngine, type Status } from "./engine";
import { MagentaInference } from "./inference";
import { SketchCanvas } from "./SketchCanvas";
import { LearnPanel } from "./LearnPanel";
import { EXAMPLE, MAX_PREFIX, penName, toTokens } from "./strokes";
import type { Line } from "./types";
import "./styles.css";

function Icon({
  name,
}: {
  name:
    | "spark"
    | "again"
    | "clear"
    | "pause"
    | "play"
    | "step"
    | "stop"
    | "pen"
    | "arrow";
}) {
  const paths = {
    spark: "m12 3 2.1 6.9L21 12l-6.9 2.1L12 21l-2.1-6.9L3 12l6.9-2.1L12 3Z",
    again: "M20 7v5h-5M20 12a8 8 0 1 0-2 5",
    clear: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5",
    pause: "M9 5v14M15 5v14",
    play: "m8 5 11 7-11 7V5Z",
    step: "m5 5 10 7L5 19V5ZM19 5v14",
    stop: "M6 6h12v12H6z",
    pen: "m5 15 10-10 4 4L9 19l-5 1 1-5ZM13 7l4 4",
    arrow: "M4 12h16m-6-6 6 6-6 6",
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
const statusLabel: Record<Status, string> = {
  loading: "Loading model",
  ready: "Ready to draw",
  drawing: "Drawing",
  reading: "Reading prefix",
  generating: "Generating",
  paused: "Paused",
  finished: "Finished",
  stopped: "Stopped",
  error: "Model error",
};

export default function App() {
  const [engine] = useState(() => new GenerationEngine(new MagentaInference()));
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const [lines, setLines] = useState<readonly Line[]>([]);
  const [temperature, setTemperature] = useState(0.5);
  const [revision, setRevision] = useState(0);
  const [example, setExample] = useState(false);
  const [warning, setWarning] = useState("");
  useEffect(() => {
    void engine.load();
    return () => engine.dispose();
  }, [engine]);
  const prefix = toTokens(lines);
  const busy = ["reading", "generating", "paused"].includes(snapshot.status);
  const canDraw = ["ready", "drawing", "finished", "stopped"].includes(
    snapshot.status,
  );
  const canComplete =
    ["ready", "finished", "stopped"].includes(snapshot.status) &&
    prefix.length > 0 &&
    prefix.length <= MAX_PREFIX;
  const canAgain =
    ["finished", "stopped", "paused"].includes(snapshot.status) &&
    snapshot.prefix.length > 0;
  const latest = snapshot.generated.at(-1);
  const reset = () => {
    engine.clear();
    setLines([]);
    setRevision((r) => r + 1);
    setExample(false);
    setWarning("");
  };
  const useExample = () => {
    engine.clear();
    setLines(EXAMPLE);
    setRevision((r) => r + 1);
    setExample(true);
    setWarning("");
  };
  const inputHelp =
    prefix.length > MAX_PREFIX
      ? `Input is too long (${prefix.length} points). Clear and draw a simpler prefix; the limit is ${MAX_PREFIX}.`
      : warning;

  return (
    <>
      <a className="skip-link" href="#workspace">
        Skip to drawing lab
      </a>
      <header className="topbar">
        <a className="brand" href="#" aria-label="SketchRNN Lab home">
          <img src="/favicon.svg" alt="" />
          <span>
            SketchRNN <b>Lab</b>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a className="nav-active" href="#workspace">
            The playground
          </a>
          <a
            href="https://arxiv.org/abs/1704.03477"
            target="_blank"
            rel="noreferrer"
          >
            Read the paper <span aria-hidden="true">↗</span>
          </a>
        </nav>
        <div className="local-badge">
          <span aria-hidden="true">◉</span> Runs on your device
        </div>
      </header>
      <main>
        <div className="intro">
          <div>
            <div className="eyebrow">
              <span /> A SMALL EXPERIMENT IN MACHINE CREATIVITY
            </div>
            <h1>
              You start the sketch.
              <br className="mobile-break" />{" "}
              <span>A neural network follows.</span>
            </h1>
            <p>
              Explore how a recurrent neural network draws — one point, one
              possibility at a time.
            </p>
          </div>
          <a className="intro-link" href="#learn">
            A little drawing. A lot to learn. <span aria-hidden="true">↘</span>
          </a>
        </div>
        <div className="workspace" id="workspace">
          <section className="drawing-card" aria-label="Drawing workspace">
            <div className="canvas-toolbar">
              <div className="canvas-title">
                <Icon name="pen" />
                <strong>Your sketchbook</strong>
                <span className="input-label">
                  {example ? "Example input" : "Freehand input"}
                </span>
              </div>
              <button className="text-button" onClick={reset}>
                <Icon name="clear" />
                Clear
              </button>
            </div>
            <div className={`canvas-surface ${!canDraw ? "locked" : ""}`}>
              <SketchCanvas
                key={revision}
                lines={lines}
                generated={snapshot.generated}
                enabled={canDraw}
                onStart={() => {
                  engine.drawing();
                  setWarning("");
                }}
                onLine={(line) => {
                  setLines((previous) => [...previous, line]);
                  setExample(false);
                }}
                onEnd={() => engine.endDrawing()}
                onWarning={setWarning}
              />
              {!lines.length && snapshot.status !== "drawing" && (
                <div className="canvas-empty">
                  <div className="empty-illustration" aria-hidden="true">
                    <svg viewBox="0 0 100 80">
                      <path d="M20 60 23 17 40 32Q50 27 60 32L78 17 82 60M20 60q30 20 62 0" />
                      <path
                        className="illustration-dashed"
                        d="M36 49h1m26 0h1M46 59l5 3 5-3"
                      />
                    </svg>
                    <span>＋</span>
                  </div>
                  <h2>Every sketch starts somewhere.</h2>
                  <p>Draw part of a cat. Leave a little to the imagination.</p>
                  <span className="empty-small">MOUSE, PEN OR TOUCH</span>
                </div>
              )}
              <div className="canvas-corner" aria-hidden="true">
                800 × 520 · LOGICAL CANVAS
              </div>
            </div>
            <div className="canvas-bottom">
              <div className="legend">
                <span>
                  <i className="human-line" />
                  You draw
                </span>
                <span>
                  <i className="model-line" />
                  Model continues
                </span>
              </div>
              <button
                className="example-button"
                onClick={useExample}
                disabled={
                  snapshot.status === "loading" ||
                  snapshot.status === "error" ||
                  snapshot.status === "drawing"
                }
              >
                Try an example input <span aria-hidden="true">↗</span>
              </button>
            </div>
          </section>
          <aside className="controls" aria-label="Generation controls">
            <div className="controls-heading">
              <span className="section-label">THE EXPERIMENT</span>
              <span className="small-tag">01</span>
            </div>
            <h2>Meet your drawing partner.</h2>
            <p className="controls-description">
              Give it a beginning.
              <br />
              See where it takes the next line.
            </p>
            <div className="model-card">
              <div className="cat-symbol" aria-hidden="true">
                <svg viewBox="0 0 48 48">
                  <path d="m9 29 2-20 10 9h6l10-9 2 20q-15 17-30 0Z M17 28h1m12 0h1m-10 7 3 2 3-2" />
                </svg>
              </div>
              <div>
                <strong>Cat</strong>
                <small>Pretrained SketchRNN · 512-unit LSTM</small>
              </div>
              <span className="model-check" aria-label="Selected category">
                ✓
              </span>
            </div>
            <p className="category-help">
              Start with ears, a head, or a simple outline. This model has
              learned from cat sketches.
            </p>
            <div className="temperature-heading">
              <label htmlFor="temperature">Temperature</label>
              <output htmlFor="temperature">{temperature.toFixed(2)}</output>
            </div>
            <input
              id="temperature"
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => {
                const value = Number(e.target.value);
                setTemperature(value);
                engine.setTemperature(value);
              }}
            />
            <div className="range-labels">
              <span>More predictable</span>
              <span>More varied</span>
            </div>
            <p className="temperature-help">
              Changes sampling variation, not drawing speed.
            </p>
            <div className="actions">
              <button
                className="primary-button"
                onClick={() => engine.begin(prefix)}
                disabled={!canComplete}
              >
                <Icon name="spark" />
                Complete Sketch
                <Icon name="arrow" />
              </button>
              <button
                className="secondary-button"
                onClick={() => engine.again()}
                disabled={!canAgain}
              >
                <Icon name="again" />
                Generate Again
              </button>
              <div className="playback">
                <button
                  onClick={() =>
                    snapshot.status === "paused"
                      ? engine.resume()
                      : engine.pause()
                  }
                  disabled={!["generating", "paused"].includes(snapshot.status)}
                >
                  <Icon
                    name={snapshot.status === "paused" ? "play" : "pause"}
                  />
                  {snapshot.status === "paused" ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={() => engine.step()}
                  disabled={snapshot.status !== "paused"}
                >
                  <Icon name="step" />
                  Step
                </button>
                <button onClick={() => engine.stop()} disabled={!busy}>
                  <Icon name="stop" />
                  Stop
                </button>
              </div>
            </div>
            <div
              className={`status-box status-${snapshot.status}`}
              role="status"
              aria-live="polite"
            >
              <span className="status-dot" />
              <div>
                <strong data-testid="status">
                  {statusLabel[snapshot.status]}
                </strong>
                <small>
                  {snapshot.status === "ready"
                    ? "Draw a prefix or load the example to begin."
                    : snapshot.status === "loading"
                      ? "Opening local cat weights…"
                      : snapshot.status === "reading"
                        ? "Building recurrent context from your input."
                        : snapshot.status === "paused"
                          ? "Step adds one timestep. A lift may leave no mark."
                          : snapshot.status === "generating"
                            ? "Sampling the next movement on your device."
                            : snapshot.status === "error"
                              ? "Reload the model to try again."
                              : snapshot.status === "drawing"
                                ? "Finish your stroke, then choose Complete Sketch."
                                : snapshot.message}
                </small>
              </div>
            </div>
            {snapshot.status === "error" && (
              <div className="error-message" role="alert">
                <p>
                  {snapshot.message ||
                    "Model unavailable. Run npm run prepare:model and rebuild."}
                </p>
                <button
                  className="secondary-button"
                  onClick={() => void engine.load()}
                >
                  Reload model
                </button>
              </div>
            )}
          </aside>
        </div>
        {(inputHelp ||
          (snapshot.message &&
            !["finished", "stopped", "error"].includes(snapshot.status))) && (
          <p className="input-warning" role="alert">
            {inputHelp || snapshot.message}
          </p>
        )}
        <div className="inspection" aria-label="Live inference inspection">
          <div>
            <span className="inspection-icon" aria-hidden="true">
              ⌁
            </span>
            <span className="section-label">LIVE INSPECTION</span>
          </div>
          <div>
            <span>Generated steps</span>
            <strong data-testid="step-count">
              {snapshot.generated.length.toString().padStart(3, "0")}
            </strong>
          </div>
          <div>
            <span>Sampled movement</span>
            <strong data-testid="movement">
              {latest
                ? `Δx ${(latest[0] / snapshot.scale).toFixed(3)} · Δy ${(latest[1] / snapshot.scale).toFixed(3)}`
                : "Waiting for a sample"}
            </strong>
          </div>
          <div>
            <span>Pen state</span>
            <strong data-testid="pen-state">
              {latest ? penName(latest) : "—"}
            </strong>
          </div>
          <span className="inspection-note">Actual model output</span>
        </div>
        <LearnPanel
          snapshot={snapshot}
          prefix={prefix}
          temperature={temperature}
        />
        <div className="below-note">
          <span aria-hidden="true">✳</span>
          <p>
            Same beginning. Different possibilities.
            <br />
            <span>
              Keep your input and generate again to explore how sampling changes
              the ending.
            </span>
          </p>
          <span className="note-index">AN INTERACTIVE RESEARCH COMPANION</span>
        </div>
      </main>
      <footer>
        <p>
          Based on{" "}
          <a
            href="https://arxiv.org/abs/1704.03477"
            target="_blank"
            rel="noreferrer"
          >
            A Neural Representation of Sketch Drawings
          </a>
          <br />
          <span>
            David Ha &amp; Douglas Eck, 2017 · Pretrained model &amp;
            implementation by Google Magenta
          </span>
        </p>
        <div>
          <a href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">
            Credits &amp; licenses ↗
          </a>
          <span>Decoder-only inference · No training</span>
        </div>
      </footer>
    </>
  );
}
