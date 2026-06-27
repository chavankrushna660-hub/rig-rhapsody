export type Point = { x: number; y: number };

export type Transform = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  pivotX: number;
  pivotY: number;
  skewX: number;
  skewY: number;
  flipX: number;
  flipY: number;
  perspectiveX: number;
  perspectiveY: number;
};

export type DrawingObject = {
  id: string;
  name: string;
  kind: "stroke" | "image";
  points: Point[];
  color: string;
  fillColor?: string;
  width: number;
  isClosed: boolean;
  zIndex: number;
  texture?: boolean;
  imageSrc?: string;
  imageElement?: HTMLImageElement;
  naturalWidth?: number;
  naturalHeight?: number;
};

export type Frame = {
  id: string;
  transforms: Record<string, Transform>;
};

export type BoneEndpoint = {
  drawingId: string;
  localX: number;
  localY: number;
};

export type Bone = {
  id: string;
  name: string;
  parentId: string;
  childId: string;
  parentAnchor: Point;
  childAnchor: Point;
  start: BoneEndpoint;
  end: BoneEndpoint;
  lockedDistance: number;
  allowDetach: boolean;
  color: string;
  thickness: number;
  visible: boolean;
  groupId: string;
  createdAt: number;
};

export type RigGroup = {
  id: string;
  name: string;
  memberIds: string[];
  boneIds: string[];
  transform: Pick<Transform, "x" | "y" | "rotation" | "scaleX" | "scaleY">;
  expanded: boolean;
  visible: boolean;
  locked: boolean;
};

export type ToolType =
  | "select"
  | "pen"
  | "brush"
  | "texture"
  | "fillBrush"
  | "eraser"
  | "fillBucket"
  | "pivot"
  | "bone"
  | "deform"
  | "curve";

export type HandleName =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "rotate"
  | "perspective"
  | "flip";
