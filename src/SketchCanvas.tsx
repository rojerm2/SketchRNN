import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { HEIGHT, simplify, WIDTH } from "./strokes";
import type { Line, Point, Token } from "./types";

interface Props {
  category: string;
  lines: readonly Line[];
  generated: readonly Token[];
  enabled: boolean;
  onStart(): void;
  onLine(line: Line): void;
  onEnd(): void;
  onWarning(message: string): void;
}

export function SketchCanvas({
  category,
  lines,
  generated,
  enabled,
  onStart,
  onLine,
  onEnd,
  onWarning,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const active = useRef<{ id: number; points: Point[] } | null>(null);
  const [draft, setDraft] = useState<Line>([]);
  useEffect(() => {
    const el = canvas.current!;
    const draw = () => {
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      el.width = Math.round(rect.width * dpr);
      el.height = Math.round(rect.height * dpr);
      const ctx = el.getContext("2d")!;
      ctx.setTransform(el.width / WIDTH, 0, 0, el.height / HEIGHT, 0, 0);
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#293e37";
      ctx.lineWidth = 3.4;
      for (const line of [...lines, draft]) {
        if (!line.length) continue;
        ctx.beginPath();
        ctx.moveTo(...line[0]);
        line.slice(1).forEach((p) => ctx.lineTo(...p));
        ctx.stroke();
      }
      const last = lines.at(-1)?.at(-1);
      if (!last) return;
      let [x, y] = last;
      let down = false;
      ctx.strokeStyle = "#9460cc";
      ctx.lineWidth = 2.8;
      for (const token of generated) {
        if (token[4]) break;
        if (down) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + token[0], y + token[1]);
          ctx.stroke();
        }
        x += token[0];
        y += token[1];
        down = !!token[2];
      }
      if (generated.length && !generated.at(-1)?.[4]) {
        ctx.fillStyle = "#9460cc";
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(el);
    return () => observer.disconnect();
  }, [lines, generated, draft]);

  const position = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.max(
        0,
        Math.min(WIDTH, ((event.clientX - rect.left) * WIDTH) / rect.width),
      ),
      Math.max(
        0,
        Math.min(HEIGHT, ((event.clientY - rect.top) * HEIGHT) / rect.height),
      ),
    ];
  };
  const finish = (
    event: PointerEvent<HTMLCanvasElement>,
    cancelled = false,
  ) => {
    if (active.current?.id !== event.pointerId) return;
    const line = simplify(active.current.points);
    active.current = null;
    setDraft([]);
    if (!cancelled && line.length > 1) onLine(line);
    onEnd();
  };
  return (
    <canvas
      ref={canvas}
      className="sketch-canvas"
      role="img"
      aria-label={`Sketch canvas. Draw a partial ${category} with a mouse, pen, or touch. The Example input button provides a keyboard-accessible alternative.`}
      data-testid="sketch-canvas"
      onPointerDown={(e) => {
        if (
          !enabled ||
          active.current ||
          (e.pointerType === "mouse" && e.button !== 0)
        )
          return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = { id: e.pointerId, points: [position(e)] };
        setDraft(active.current.points);
        onStart();
      }}
      onPointerMove={(e) => {
        if (active.current?.id !== e.pointerId) return;
        const points = active.current.points,
          p = position(e),
          last = points.at(-1)!;
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 2) return;
        if (points.length >= 4000) {
          onWarning(
            "This stroke reached 4,000 input points. Lift your pointer and use a shorter sketch.",
          );
          finish(e);
          return;
        }
        active.current.points = [...points, p];
        setDraft(active.current.points);
      }}
      onPointerUp={(e) => finish(e)}
      onPointerCancel={(e) => finish(e, true)}
      onLostPointerCapture={(e) => finish(e, true)}
    />
  );
}
