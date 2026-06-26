import { ArrowDownToLine, ArrowUpToLine, SlidersHorizontal } from "lucide-react";
import type { Transform } from "./types";
import { useEngine } from "./useEngine";

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="toonse-slider">
      <span>
        {label}
        <strong>{Number.isFinite(value) ? value.toFixed(step < 1 ? 2 : 0) : "0"}</strong>
      </span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="toonse-numberField">
      {label}
      <input type="number" value={Math.round(value * 100) / 100} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function RightPanel({ isOpen }: { isOpen: boolean }) {
  const engine = useEngine();

  if (!isOpen) return null;

  const obj = engine.selectedId ? engine.objects[engine.selectedId] : null;
  const transform: Transform | null = obj ? engine.getFrameTransform(obj.id) : null;
  const bounds = obj
    ? (() => {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const point of obj.points) {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        }
        return { width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
      })()
    : null;

  return (
    <aside className="toonse-rightPanel">
      <div className="toonse-panelHeader">
        <span>
          <SlidersHorizontal size={14} /> Properties
        </span>
      </div>

      {obj && transform && bounds ? (
        <div className="toonse-properties">
          <label className="toonse-textField">
            Name
            <input
              value={obj.name}
              onChange={(event) => {
                obj.name = event.target.value;
                engine.notify();
              }}
            />
          </label>

          <div className="toonse-grid2">
            <NumberField label="X" value={transform.x} onChange={(value) => engine.updateTransform("x", value)} />
            <NumberField label="Y" value={transform.y} onChange={(value) => engine.updateTransform("y", value)} />
            <NumberField label="Width" value={bounds.width * transform.scaleX} onChange={(value) => engine.setVisualSize("width", value)} />
            <NumberField label="Height" value={bounds.height * transform.scaleY} onChange={(value) => engine.setVisualSize("height", value)} />
          </div>

          <Slider label="Rotate" value={transform.rotation} min={-360} max={360} onChange={(value) => engine.updateTransform("rotation", value)} />
          <Slider label="Scale X" value={transform.scaleX} min={-5} max={5} step={0.01} onChange={(value) => engine.updateTransform("scaleX", value)} />
          <Slider label="Scale Y" value={transform.scaleY} min={-5} max={5} step={0.01} onChange={(value) => engine.updateTransform("scaleY", value)} />
          <Slider label="Skew X" value={transform.skewX} min={-75} max={75} onChange={(value) => engine.updateTransform("skewX", value)} />
          <Slider label="Skew Y" value={transform.skewY} min={-75} max={75} onChange={(value) => engine.updateTransform("skewY", value)} />
          <Slider label="3D Flip X" value={transform.flipX} min={-180} max={180} onChange={(value) => engine.updateTransform("flipX", value)} />
          <Slider label="3D Flip Y" value={transform.flipY} min={-180} max={180} onChange={(value) => engine.updateTransform("flipY", value)} />
          <Slider label="Perspective X" value={transform.perspectiveX} min={-1.8} max={1.8} step={0.01} onChange={(value) => engine.updateTransform("perspectiveX", value)} />
          <Slider label="Perspective Y" value={transform.perspectiveY} min={-1.8} max={1.8} step={0.01} onChange={(value) => engine.updateTransform("perspectiveY", value)} />
          <Slider label="Z Index" value={obj.zIndex} min={-50} max={200} onChange={(value) => engine.setZIndex(obj.id, value)} />

          <div className="toonse-rowButtons">
            <button type="button" onClick={() => engine.bringForward(obj.id)}>
              <ArrowUpToLine size={14} /> Front
            </button>
            <button type="button" onClick={() => engine.sendBackward(obj.id)}>
              <ArrowDownToLine size={14} /> Back
            </button>
          </div>

          <div className="toonse-boneList">
            <strong>Bones</strong>
            {engine.bones.length ? (
              engine.bones.map((bone) => <span key={bone.id}>{bone.name}</span>)
            ) : (
              <span>No attached drawings yet</span>
            )}
          </div>
        </div>
      ) : (
        <p className="toonse-empty">Select a drawing to edit transforms, z-index, fill, perspective, and rigging.</p>
      )}
    </aside>
  );
}
