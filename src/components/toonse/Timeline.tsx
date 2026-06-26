import { Eye, EyeOff, Pause, Play, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEngine } from "./useEngine";

export function Timeline() {
  const engine = useEngine();

  return (
    <div className="toonse-timeline">
      <div className="toonse-timelineControls">
        <button type="button" onPointerDown={() => engine.togglePlay()}>
          {engine.isPlaying ? <Pause size={15} /> : <Play size={15} />} {engine.isPlaying ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          className={engine.onionSkin ? "is-active" : ""}
          onPointerDown={() => {
            engine.onionSkin = !engine.onionSkin;
            engine.notify();
            engine.render();
          }}
        >
          {engine.onionSkin ? <Eye size={15} /> : <EyeOff size={15} />} Onion
        </button>
        <button
          type="button"
          className={engine.autoFrames ? "is-active" : ""}
          onPointerDown={() => {
            engine.autoFrames = !engine.autoFrames;
            engine.notify();
          }}
        >
          <Sparkles size={15} /> Autoframes
        </button>
      </div>

      <div className="toonse-frames">
        {engine.frames.map((frame, index) => (
          <div key={frame.id} className="toonse-frameWrap">
            <button
              type="button"
              className={`toonse-frame ${engine.currentFrameIdx === index ? "is-active" : ""}`}
              onPointerDown={() => {
                engine.currentFrameIdx = index;
                engine.notify();
                engine.render();
              }}
            >
              {index + 1}
            </button>
            {engine.currentFrameIdx === index && engine.frames.length > 1 && (
              <button
                type="button"
                className="toonse-deleteFrame"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  engine.deleteFrame(index);
                }}
                aria-label="Delete frame"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        ))}
        <button type="button" className="toonse-addFrame" onPointerDown={() => engine.addFrame()} aria-label="Add frame">
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
