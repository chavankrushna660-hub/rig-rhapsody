import { Bone, ChevronRight, Folder, ImagePlus, Layers, Trash2 } from "lucide-react";
import { useRef } from "react";
import { useEngine } from "./useEngine";

export function LeftPanel({ isOpen }: { isOpen: boolean }) {
  const engine = useEngine();
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const objects = Object.values(engine.objects).sort((a, b) => b.zIndex - a.zIndex);
  const groupedObjectIds = new Set(engine.rigGroups.flatMap((group) => group.memberIds));
  const looseObjects = objects.filter((obj) => !groupedObjectIds.has(obj.id));

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
        {engine.rigGroups.map((group) => (
          <div key={group.id} className="toonse-groupBlock">
            <div className={`toonse-group ${engine.selectedGroupId === group.id ? "is-selected" : ""}`} onClick={() => engine.selectGroup(group.id)}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  engine.toggleGroupExpanded(group.id);
                }}
                title="Expand group"
                aria-label="Expand group"
              >
                <ChevronRight size={14} className={group.expanded ? "rotate-90" : ""} />
              </button>
              <Folder size={14} />
              <span className="toonse-layerName">{group.name}</span>
              <small>{group.memberIds.length} parts</small>
            </div>
            {group.expanded && (
              <div className="toonse-groupChildren">
                {group.boneIds.map((boneId) => {
                  const bone = engine.bones.find((item) => item.id === boneId);
                  if (!bone) return null;
                  return (
                    <div key={bone.id} className={`toonse-layer toonse-boneLayer ${engine.selectedBoneId === bone.id ? "is-selected" : ""}`} onClick={() => engine.selectBone(bone.id)}>
                      <Bone size={14} />
                      <span className="toonse-layerName">{bone.name}</span>
                      <small>{Math.round(bone.lockedDistance)}px</small>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          engine.deleteBone(bone.id);
                        }}
                        title="Delete bone"
                        aria-label="Delete bone"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
                {group.memberIds.map((memberId) => {
                  const obj = engine.objects[memberId];
                  if (!obj) return null;
                  return (
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
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {looseObjects.map((obj) => (
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
