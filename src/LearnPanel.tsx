import type { Snapshot } from "./engine";
import { penName } from "./strokes";
import type { Phase, Token } from "./types";

const stages: { phase: Phase; label: string; detail: string }[] = [
  {
    phase: "reading",
    label: "Read prefix",
    detail:
      "Feed the start token and your simplified drawing into the decoder.",
  },
  {
    phase: "updating",
    label: "Update state",
    detail:
      "An LSTM updates its hidden and cell state using the previous token.",
  },
  {
    phase: "predicting",
    label: "Predict",
    detail: "Compute a distribution over the next movement and pen state.",
  },
  {
    phase: "sampling",
    label: "Sample",
    detail: "Draw one random movement and pen state from that distribution.",
  },
  {
    phase: "rendering",
    label: "Render",
    detail:
      "Move the pen; draw a segment only if the previous token left it down. Repeat.",
  },
];
const glossary = [
  [
    "RNN",
    "A neural network that carries context from one sequence step to the next.",
  ],
  [
    "LSTM",
    "A gated recurrent cell that maintains hidden state and cell memory.",
  ],
  [
    "Hidden state",
    "A changing numerical summary of the points read so far. It is not a stored picture.",
  ],
  [
    "Inference",
    "Using fixed model weights to compute an output for new input.",
  ],
  [
    "Sampling",
    "Selecting one possible next token from a predicted distribution.",
  ],
  [
    "Temperature",
    "A setting that changes sampling variability, not playback speed.",
  ],
  [
    "Pretrained weights",
    "Parameters learned previously by the original model authors; they stay fixed here.",
  ],
];

export function LearnPanel({
  snapshot,
  prefix,
  temperature,
}: {
  snapshot: Snapshot;
  prefix: readonly Token[];
  temperature: number;
}) {
  const all = [
    ...prefix.map((t) => ({ t, source: "You" })),
    ...snapshot.generated.map((t) => ({ t, source: "Model" })),
  ];
  const current = stages.find((s) => s.phase === snapshot.phase);
  return (
    <details className="learn-panel" id="learn">
      <summary>
        <span className="learn-icon" aria-hidden="true">
          ⌘
        </span>
        <span>
          <strong>How it works</strong>
          <small>Follow the sequence behind the sketch</small>
        </span>
        <span className="learn-summary-end">
          OPEN THE LAB NOTES <span aria-hidden="true">＋</span>
        </span>
      </summary>
      <div className="learn-body">
        <section className="cycle-section">
          <div className="section-label">01 / THE GENERATION CYCLE</div>
          <h3>One point at a time.</h3>
          <p>
            The highlighted stage is the current inference operation. Pausing
            freezes it; Step completes exactly one model timestep.
          </p>
          <ol className="cycle">
            {stages.map((stage, i) => (
              <li
                key={stage.phase}
                className={snapshot.phase === stage.phase ? "current" : ""}
                aria-current={
                  snapshot.phase === stage.phase ? "step" : undefined
                }
              >
                <span>{i + 1}</span>
                {stage.label}
              </li>
            ))}
          </ol>
          <p className="stage-detail">
            {current?.detail ??
              "Load an example and complete the sketch to watch the cycle. After rendering, the sampled token feeds the next state update."}
          </p>
          <div className="context-note">
            <strong>Context changes. Weights stay fixed.</strong>
            <p>
              The recurrent state summarizes previous points and changes at each
              update. This is inference, not training. Generate Again restores
              the state after your original prefix.
            </p>
          </div>
        </section>
        <section>
          <div className="section-label">02 / DRAWING AS A SEQUENCE</div>
          <h3>Actual model-space values</h3>
          <p>
            Recent tokens, in order. Offsets are divided by the checkpoint’s
            scale ({snapshot.scale.toFixed(1)} logical pixels per model unit).
            The pen state applies to the next movement.
          </p>
          <div className="sequence-table">
            <table>
              <caption className="sr-only">
                Recent actual stroke tokens, normalized to model space
              </caption>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Δx</th>
                  <th>Δy</th>
                  <th>Pen</th>
                </tr>
              </thead>
              <tbody>
                {all.slice(-6).map(({ t, source }, i) => (
                  <tr key={`${all.length}-${i}`}>
                    <td>{source}</td>
                    <td>{(t[0] / snapshot.scale).toFixed(3)}</td>
                    <td>{(t[1] / snapshot.scale).toFixed(3)}</td>
                    <td>
                      <span className="pen-chip">{penName(t)}</span>
                    </td>
                  </tr>
                ))}
                {!all.length && (
                  <tr>
                    <td colSpan={4}>Your sequence will appear here.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="fine-print">
            A timestep can lift or move the pen without making a visible line.
            End finishes the sequence. Selected temperature:{" "}
            {temperature.toFixed(2)}.
          </p>
        </section>
        <section>
          <div className="section-label">03 / WHAT THE MODEL PREDICTS</div>
          <h3>A distribution, not a picture.</h3>
          <p>
            The decoder predicts a mixture of 20 bivariate Gaussians for
            horizontal and vertical offsets, plus a distribution over draw,
            lift, and end. Sampling turns those possibilities into a single next
            token.
          </p>
          <p>
            This is generative vector drawing, not image classification. This
            lab uses a decoder only; the paper’s full variational autoencoder
            also has an encoder and latent representation.
          </p>
          <div className="experiment">
            <span className="section-label">TRY A CONTROLLED EXPERIMENT</span>
            <p>
              Keep your prefix. Generate several endings at{" "}
              <strong>0.25</strong>, then at <strong>0.90</strong>. Which
              features remain? Which become more variable?
            </p>
          </div>
        </section>
        <section className="glossary">
          <div className="section-label">04 / A SMALL GLOSSARY</div>
          <dl>
            {glossary.map(([term, definition]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </details>
  );
}
