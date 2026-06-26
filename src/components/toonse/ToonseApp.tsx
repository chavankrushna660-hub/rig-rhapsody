import { Download, Moon, PanelLeftClose, PanelRightClose, Sun } from "lucide-react";
import { useState } from "react";
import { CanvasArea } from "./CanvasArea";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { Timeline } from "./Timeline";
import { Toolbar } from "./Toolbar";
import { useEngine } from "./useEngine";

export function ToonseApp() {
  const engine = useEngine();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [light, setLight] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportVideo = async () => {
    if (!engine.canvas) return;
    setExporting(true);
    const originalFrame = engine.currentFrameIdx;
    const wasPlaying = engine.isPlaying;
    if (wasPlaying) engine.togglePlay();
    try {
      const stream = engine.canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "toonse-animation.webm";
        link.click();
        URL.revokeObjectURL(url);
        engine.currentFrameIdx = originalFrame;
        engine.render();
        engine.notify();
        setExporting(false);
      };
      recorder.start();
      let frame = 0;
      const tick = () => {
        engine.currentFrameIdx = frame;
        engine.render();
        frame++;
        if (frame < engine.frames.length) {
          setTimeout(tick, 1000 / 12);
        } else {
          setTimeout(() => recorder.stop(), 1000 / 12);
        }
      };
      tick();
    } catch {
      setExporting(false);
    }
  };

  return (
    <main className={`toonse-app ${light ? "toonse-light" : ""}`}>
      <header className="toonse-header">
        <div className="toonse-headGroup">
          <h1>PRO-DRAW <span>v1.1 Rig</span></h1>
          <button type="button" onClick={() => setLeftOpen((open) => !open)} aria-label="Toggle left panel">
            <PanelLeftClose size={18} className={leftOpen ? "" : "rotate-180"} />
          </button>
        </div>
        <div className="toonse-headGroup">
          <button type="button" className="toonse-export" onClick={exportVideo} disabled={exporting}>
            <Download size={15} /> {exporting ? "Exporting" : "Export"}
          </button>
          <button type="button" onClick={() => setLight((value) => !value)} aria-label="Toggle theme">
            {light ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button type="button" onClick={() => setRightOpen((open) => !open)} aria-label="Toggle right panel">
            <PanelRightClose size={18} className={rightOpen ? "" : "rotate-180"} />
          </button>
        </div>
      </header>

      <section className="toonse-workspace">
        <Toolbar />
        <LeftPanel isOpen={leftOpen} />
        <CanvasArea />
        <RightPanel isOpen={rightOpen} />
      </section>
      <Timeline />
    </main>
  );
}
