import React from "react";
import { useEngine } from "./useEngine";

export function CanvasArea() {
  const engine = useEngine();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const hostRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!canvasRef.current) return;
    engine.setCanvas(canvasRef.current, hostRef.current);
    const resize = () => engine.resizeCanvas(hostRef.current);
    const observer = new ResizeObserver(resize);
    if (hostRef.current) observer.observe(hostRef.current);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [engine]);

  return (
    <div ref={hostRef} className="toonse-canvasHost">
      <div className="toonse-grid" />
      <canvas
        ref={canvasRef}
        className="toonse-canvas"
        onPointerDown={(event) => engine.handlePointerDown(event)}
        onPointerMove={(event) => engine.handlePointerMove(event)}
        onPointerUp={(event) => engine.handlePointerUp(event)}
        onPointerCancel={(event) => engine.handlePointerUp(event)}
      />
    </div>
  );
}
