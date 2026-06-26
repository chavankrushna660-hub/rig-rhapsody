import type React from "react";
import {
  Bone,
  Brush,
  CircleDot,
  Droplets,
  Eraser,
  FlaskConical,
  MousePointer2,
  PaintBucket,
  PenLine,
  Spline,
  Wand2,
} from "lucide-react";
import type { ToolType } from "./types";
import { useEngine } from "./useEngine";

const tools: { id: ToolType; icon: React.ReactNode; label: string }[] = [
  { id: "select", icon: <MousePointer2 size={23} />, label: "Select" },
  { id: "pen", icon: <PenLine size={23} />, label: "Pen" },
  { id: "brush", icon: <Brush size={23} />, label: "Brush" },
  { id: "texture", icon: <Wand2 size={23} />, label: "Texture Brush" },
  { id: "fillBrush", icon: <Droplets size={23} />, label: "Fill Brush" },
  { id: "eraser", icon: <Eraser size={23} />, label: "Eraser" },
  { id: "fillBucket", icon: <PaintBucket size={23} />, label: "Fill Bucket" },
  { id: "pivot", icon: <CircleDot size={23} />, label: "Pivot Point" },
  { id: "bone", icon: <Bone size={23} />, label: "Bone Rig" },
  { id: "deform", icon: <FlaskConical size={23} />, label: "Geometry Deform" },
  { id: "curve", icon: <Spline size={23} />, label: "Curve Edit" },
];

export function Toolbar() {
  const engine = useEngine();

  return (
    <div className="toonse-toolbar">
      {tools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className={`toonse-tool ${engine.tool === tool.id ? "is-active" : ""}`}
          onClick={() => engine.setTool(tool.id)}
          title={tool.label}
          aria-label={tool.label}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}
