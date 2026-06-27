import { ArrowDownToLine, ArrowUpToLine, Bone, Folder, SlidersHorizontal } from "lucide-react";
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
  const group = engine.getSelectedGroup();
  const selectedBone = engine.getSelectedBone();
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

      {engine.pendingBoneConfirm ? (
        <div className="toonse-properties">
          <div className="toonse-boneCard">
            <strong>Bone created</strong>
            <span>From: {engine.objects[engine.pendingBoneConfirm.startId]?.name}</span>
            <span>To: {engine.objects[engine.pendingBoneConfirm.endId]?.name}</span>
            <span>Distance: {Math.round(engine.pendingBoneConfirm.lockedDistance)}px</span>
          </div>
          <label className="toonse-textField">
            Group name
            <input value={engine.pendingBoneConfirm.groupName} onChange={(event) => engine.setPendingBoneGroupName(event.target.value)} />
          </label>
          <label className="toonse-checkRow">
            <input type="checkbox" checked={engine.pendingBoneConfirm.autoGroup} onChange={(event) => engine.setPendingBoneAutoGroup(event.target.checked)} />
            Create group automatically
          </label>
          <label className="toonse-checkRow">
            <input type="checkbox" checked={engine.pendingBoneConfirm.allowDetach} onChange={(event) => engine.setPendingBoneAllowDetach(event.target.checked)} />
            Allow detachments
          </label>
          <div className="toonse-rowButtons">
            <button type="button" onClick={() => engine.confirmPendingBone()}>
              Done
            </button>
            <button type="button" onClick={() => engine.cancelPendingBone()}>
              Cancel
            </button>
          </div>
        </div>
      ) : selectedBone ? (
        <div className="toonse-properties">
          <div className="toonse-boneCard">
            <strong>
              <Bone size={14} /> {selectedBone.name}
            </strong>
            <span>Start: {engine.objects[selectedBone.start.drawingId]?.name}</span>
            <span>End: {engine.objects[selectedBone.end.drawingId]?.name}</span>
            <span>Current Distance: {Math.round(engine.getBoneCurrentDistance(selectedBone.id))}px</span>
            <span>Locked Distance: {Math.round(selectedBone.lockedDistance)}px</span>
          </div>
          <label className="toonse-checkRow">
            <input type="checkbox" checked={selectedBone.allowDetach} onChange={(event) => engine.setBoneAllowDetach(selectedBone.id, event.target.checked)} />
            Allow detachments
          </label>
          <p className="toonse-empty">When detachments are off, connected drawings stay permanently locked at this exact distance while still rotating and scaling from their bone pivots.</p>
        </div>
      ) : group ? (
        <div className="toonse-properties">
          <div className="toonse-boneCard">
            <strong>
              <Folder size={14} /> {group.name}
            </strong>
            <span>{group.memberIds.length} drawings</span>
            <span>{group.boneIds.length} bones</span>
          </div>
          <Slider label="Group X" value={group.transform.x} min={-1000} max={1000} onChange={(value) => engine.updateGroupTransform("x", value)} />
          <Slider label="Group Y" value={group.transform.y} min={-1000} max={1000} onChange={(value) => engine.updateGroupTransform("y", value)} />
          <Slider label="Group Rotate" value={group.transform.rotation} min={-360} max={360} onChange={(value) => engine.updateGroupTransform("rotation", value)} />
          <Slider label="Group Scale X" value={group.transform.scaleX} min={-5} max={5} step={0.01} onChange={(value) => engine.updateGroupTransform("scaleX", value)} />
          <Slider label="Group Scale Y" value={group.transform.scaleY} min={-5} max={5} step={0.01} onChange={(value) => engine.updateGroupTransform("scaleY", value)} />
          <div className="toonse-boneList">
            <strong>Members</strong>
            {group.memberIds.map((id) => (
              <span key={id}>{engine.objects[id]?.name}</span>
            ))}
          </div>
        </div>
      ) : engine.tool === "bone" ? (
        <div className="toonse-properties">
          <div className="toonse-boneCard">
            <strong>
              <Bone size={14} /> Bone Tool Options
            </strong>
            <span>Ready to draw bone from one drawing to another.</span>
          </div>
          <label className="toonse-colorInput">
            Bone Color
            <input type="color" value={engine.boneColor} onChange={(event) => engine.setBoneColor(event.target.value)} />
          </label>
          <Slider label="Bone Thickness" value={engine.boneThickness} min={1} max={14} onChange={(value) => engine.setBoneThickness(value)} />
          <label className="toonse-checkRow">
            <input type="checkbox" checked={engine.showBones} onChange={(event) => engine.setShowBones(event.target.checked)} />
            Show bones
          </label>
          <label className="toonse-checkRow">
            <input type="checkbox" checked={engine.autoGroupBones} onChange={(event) => engine.setAutoGroupBones(event.target.checked)} />
            Auto-group
          </label>
          <label className="toonse-checkRow">
            <input type="checkbox" checked={engine.defaultAllowDetach} onChange={(event) => engine.setDefaultAllowDetach(event.target.checked)} />
            Allow detachments
          </label>
        </div>
      ) : obj && transform && bounds ? (
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
            {engine.getConnectedBones(obj.id).length ? (
              engine.getConnectedBones(obj.id).map((bone) => (
                <button key={bone.id} type="button" className="toonse-boneLink" onClick={() => engine.selectBone(bone.id)}>
                  {bone.name} · {Math.round(bone.lockedDistance)}px {bone.allowDetach ? "detachable" : "locked"}
                </button>
              ))
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
