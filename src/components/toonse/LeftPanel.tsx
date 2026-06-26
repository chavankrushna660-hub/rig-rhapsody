import { ImagePlus, Layers, Trash2 } from "lucide-react";
import { useRef } from "react";
import { useEngine } from "./useEngine";

export function LeftPanel({ isOpen }: { isOpen: boolean }) {
  const engine = useEngine();
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const objects = Object.values(engine.objects).sort((a, b) => b.zIndex - a.zIndex);

  return (
    <aside className="toonse-leftPanel">
      <div className="toonse-panelHeader">
        <span>
          <Layers size={14} /> Drawings
        </span>
        <strong>{objects.length}</strong>
      </div>

      <div className="toonse-colorBlock">
        <label>
          Stroke / fill color
          <input type="color" value={engine.currentColor} onChange={(event) => engine.setCurrentColor(event.target.value)} />
        </label>
        <label>
          Canvas color
          <input type="color" value={engine.canvasColor} onChange={(event) => engine.setCanvasColor(event.target.value)} />
        </label>
        <div className="toonse-rowButtons">
          <button type="button" onClick={() => engine.applyFillToSelected()}>
            Apply fill
          </button>
          <button type="button" onClick={() => engine.clearFills()}>
            Clear fills
          </button>
        </div>
        <input
          ref={fileRef}
          hidden
          type="file"
          accept="image/png,image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void engine.importPng(file);
            event.currentTarget.value = "";
          }}
        />
        <button type="button" className="toonse-upload" onClick={() => fileRef.current?.click()}>
          <ImagePlus size={15} /> Upload PNG
        </button>
      </div>

      <div className="toonse-layerList">
        {objects.map((obj) => (
          <div
            key={obj.id}
            className={`toonse-layer ${engine.selectedId === obj.id ? "is-selected" : ""}`}
            onClick={() => engine.selectObject(obj.id, true)}
          >
            <span className="toonse-swatch" style={{ backgroundColor: obj.fillColor ?? obj.color }} />
            <span className="toonse-layerName">{obj.name}</span>
            <small>Z {obj.zIndex}</small>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                engine.deleteObject(obj.id);
              }}
              title="Delete"
              aria-label="Delete drawing"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {!objects.length && <p className="toonse-empty">Draw on the canvas to create a selected drawing.</p>}
      </div>
    </aside>
  );
}
