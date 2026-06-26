import type React from "react";
import type { Bone, DrawingObject, Frame, HandleName, Point, ToolType, Transform } from "./types";

const genId = () => Math.random().toString(36).slice(2, 9);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const defaultTransform = (x = 0, y = 0): Transform => ({
  x,
  y,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  pivotX: 0,
  pivotY: 0,
  skewX: 0,
  skewY: 0,
  flipX: 0,
  flipY: 0,
  perspectiveX: 0,
  perspectiveY: 0,
});

function cloneTransform(t: Transform): Transform {
  return { ...t };
}

function matrixToTransform(m: DOMMatrix): Transform {
  const scaleX = Math.hypot(m.a, m.b) || 1;
  const rotation = (Math.atan2(m.b, m.a) * 180) / Math.PI;
  const det = m.a * m.d - m.b * m.c;
  const scaleY = det / scaleX || 1;
  const skewX = (Math.atan2(m.a * m.c + m.b * m.d, scaleX * scaleX) * 180) / Math.PI;
  return {
    ...defaultTransform(m.e, m.f),
    rotation,
    scaleX,
    scaleY,
    skewX,
  };
}

function boundsOf(points: Point[]) {
  if (!points.length) return { minX: -1, minY: -1, maxX: 1, maxY: 1, width: 2, height: 2, cx: 0, cy: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  return { minX, minY, maxX, maxY, width, height, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function densify(points: Point[], spacing = 4): Point[] {
  if (points.length < 2) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const steps = Math.max(1, Math.ceil(dist(a, b) / spacing));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
    }
  }
  return out;
}

export class Engine {
  static inst = new Engine();

  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  cssWidth = 1024;
  cssHeight = 768;
  dpr = 1;

  objects: Record<string, DrawingObject> = {};
  bones: Bone[] = [];
  frames: Frame[] = [{ id: genId(), transforms: {} }];
  currentFrameIdx = 0;

  selectedId: string | null = null;
  tool: ToolType = "brush";
  onionSkin = true;
  autoFrames = false;
  isPlaying = false;
  currentColor = "#f27d26";
  currentWidth = 6;
  canvasColor = "#ffffff";

  listeners = new Set<() => void>();
  updateCount = 0;

  isDrawing = false;
  currentStroke: Point[] = [];
  pointerId: number | null = null;
  dragAction: HandleName | "move" | "draw" | "erase" | "deform" | "curve" | "bone" | null = null;
  dragStartPt: Point | null = null;
  dragStartLocal: Point | null = null;
  initialTransform: Transform | null = null;
  initialMatrix: DOMMatrix | null = null;
  initialParentInverse: DOMMatrix | null = null;
  activePointIdx: number | null = null;
  deformationOriginalPoints: Point[] = [];
  curveOriginalPoints: Point[] = [];
  curveStartLocal: Point | null = null;
  pendingBone: { parentId: string; anchor: Point; start: Point; current: Point } | null = null;
  autoFrameCreatedForGesture = false;
  playInterval: ReturnType<typeof setInterval> | null = null;

  subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.updateCount++;
    this.listeners.forEach((listener) => listener());
  }

  setCanvas(canvas: HTMLCanvasElement, host?: HTMLElement | null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    if (typeof window !== "undefined") {
      (window as unknown as { __TOONSE_ENGINE__?: Engine }).__TOONSE_ENGINE__ = this;
    }
    this.resizeCanvas(host ?? canvas.parentElement);
  }

  resizeCanvas(host?: HTMLElement | null) {
    if (!this.canvas || !this.ctx) return;
    const rect = host?.getBoundingClientRect() ?? this.canvas.getBoundingClientRect();
    this.cssWidth = Math.max(320, rect.width || this.cssWidth);
    this.cssHeight = Math.max(240, rect.height || this.cssHeight);
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);
    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.render();
  }

  setTool(tool: ToolType) {
    this.tool = tool;
    this.dragAction = null;
    this.pendingBone = null;
    this.notify();
    this.render();
  }

  selectObject(id: string | null, toggle = false) {
    if (toggle && this.selectedId === id) {
      this.selectedId = null;
    } else {
      this.selectedId = id;
    }
    this.notify();
    this.render();
  }

  setCurrentColor(color: string) {
    this.currentColor = color;
    this.notify();
  }

  setCanvasColor(color: string) {
    this.canvasColor = color;
    this.notify();
    this.render();
  }

  addFrame() {
    const prevTransforms = this.frames[this.currentFrameIdx]?.transforms ?? {};
    this.frames.splice(this.currentFrameIdx + 1, 0, {
      id: genId(),
      transforms: JSON.parse(JSON.stringify(prevTransforms)),
    });
    this.currentFrameIdx++;
    this.notify();
    this.render();
  }

  deleteFrame(idx: number) {
    if (this.frames.length <= 1) return;
    this.frames.splice(idx, 1);
    this.currentFrameIdx = Math.min(this.currentFrameIdx, this.frames.length - 1);
    this.notify();
    this.render();
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      this.playInterval = setInterval(() => {
        this.currentFrameIdx = (this.currentFrameIdx + 1) % this.frames.length;
        this.notify();
        this.render();
      }, 1000 / 12);
    } else if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
    this.notify();
    this.render();
  }

  deleteObject(id: string) {
    delete this.objects[id];
    this.bones = this.bones.filter((bone) => bone.parentId !== id && bone.childId !== id);
    for (const frame of this.frames) delete frame.transforms[id];
    if (this.selectedId === id) this.selectedId = null;
    this.notify();
    this.render();
  }

  clearFills() {
    Object.values(this.objects).forEach((obj) => {
      obj.fillColor = undefined;
    });
    this.notify();
    this.render();
  }

  applyFillToSelected(color = this.currentColor) {
    if (!this.selectedId) return;
    this.objects[this.selectedId].fillColor = color;
    this.notify();
    this.render();
  }

  setZIndex(id: string, zIndex: number) {
    if (!this.objects[id]) return;
    this.objects[id].zIndex = Math.round(zIndex);
    this.notify();
    this.render();
  }

  bringForward(id: string) {
    const max = Math.max(0, ...Object.values(this.objects).map((obj) => obj.zIndex));
    this.setZIndex(id, max + 1);
  }

  sendBackward(id: string) {
    const min = Math.min(0, ...Object.values(this.objects).map((obj) => obj.zIndex));
    this.setZIndex(id, min - 1);
  }

  updateTransform(prop: keyof Transform, value: number) {
    if (!this.selectedId) return;
    const t = this.getFrameTransform(this.selectedId);
    if (!t) return;
    if (prop === "scaleX" || prop === "scaleY") value = value === 0 ? 0.01 : value;
    t[prop] = value;
    this.notify();
    this.render();
  }

  setVisualSize(axis: "width" | "height", value: number) {
    if (!this.selectedId) return;
    const obj = this.objects[this.selectedId];
    const t = this.getFrameTransform(this.selectedId);
    if (!obj || !t) return;
    const b = this.getLocalBounds(obj);
    if (axis === "width") t.scaleX = clamp(value / Math.max(1, b.width), -20, 20);
    if (axis === "height") t.scaleY = clamp(value / Math.max(1, b.height), -20, 20);
    this.notify();
    this.render();
  }

  async importPng(file: File) {
    if (!file.type.includes("png") && !file.type.includes("image")) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });
    const id = genId();
    const width = Math.min(img.naturalWidth, this.cssWidth * 0.55);
    const height = (width / img.naturalWidth) * img.naturalHeight;
    const points = [
      { x: -width / 2, y: -height / 2 },
      { x: width / 2, y: -height / 2 },
      { x: width / 2, y: height / 2 },
      { x: -width / 2, y: height / 2 },
    ];
    this.objects[id] = {
      id,
      name: `PNG ${Object.keys(this.objects).length + 1}`,
      kind: "image",
      points,
      color: this.currentColor,
      width: 1,
      isClosed: true,
      zIndex: this.nextZIndex(),
      imageSrc: dataUrl,
      imageElement: img,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    };
    for (const frame of this.frames) frame.transforms[id] = defaultTransform(this.cssWidth / 2, this.cssHeight / 2);
    this.selectedId = id;
    this.notify();
    this.render();
  }

  handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!this.canvas) return;
    const pt = this.getPointer(e);
    this.pointerId = e.pointerId;
    this.isDrawing = true;
    this.dragStartPt = pt;
    this.autoFrameCreatedForGesture = false;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Multi-touch UI controls can still receive their own pointer streams.
    }

    if (this.tool === "brush" || this.tool === "pen" || this.tool === "texture") {
      this.dragAction = "draw";
      this.currentStroke = [pt];
      this.render();
      return;
    }

    if (this.tool === "fillBrush" || this.tool === "fillBucket") {
      this.fillAtPoint(pt);
      this.dragAction = this.tool === "fillBrush" ? "draw" : null;
      return;
    }

    if (this.tool === "eraser") {
      this.dragAction = "erase";
      this.eraseAt(pt);
      return;
    }

    if (this.tool === "pivot" && this.selectedId) {
      const local = this.screenToLocal(this.selectedId, pt);
      const t = this.getFrameTransform(this.selectedId);
      if (local && t) {
        t.pivotX = local.x;
        t.pivotY = local.y;
        this.notify();
        this.render();
      }
      return;
    }

    if (this.tool === "bone") {
      const hitId = this.hitTestTop(pt) ?? this.nearestObjectToPoint(pt, undefined, 160);
      if (hitId) {
        const anchor = this.screenToLocal(hitId, pt) ?? { x: 0, y: 0 };
        this.pendingBone = { parentId: hitId, anchor, start: pt, current: pt };
        this.dragAction = "bone";
        this.selectedId = hitId;
        this.notify();
        this.render();
      }
      return;
    }

    if (this.tool === "deform" && this.selectedId) {
      const local = this.screenToLocal(this.selectedId, pt);
      if (!local) return;
      const obj = this.objects[this.selectedId];
      this.activePointIdx = this.nearestPointIndex(obj, local, 90);
      this.deformationOriginalPoints = obj.points.map((p) => ({ ...p }));
      this.dragStartLocal = local;
      this.dragAction = "deform";
      return;
    }

    if (this.tool === "curve" && this.selectedId) {
      const local = this.screenToLocal(this.selectedId, pt);
      if (!local) return;
      this.curveStartLocal = local;
      this.curveOriginalPoints = this.objects[this.selectedId].points.map((p) => ({ ...p }));
      this.dragAction = "curve";
      return;
    }

    if (this.tool === "select") {
      this.startSelectDrag(pt);
    }
  }

  handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!this.isDrawing || !this.canvas) return;
    const pt = this.getPointer(e);
    if (this.pendingBone) this.pendingBone.current = pt;

    if (this.dragAction === "draw" && (this.tool === "brush" || this.tool === "pen" || this.tool === "texture")) {
      const last = this.currentStroke[this.currentStroke.length - 1];
      if (!last || dist(last, pt) > (this.tool === "pen" ? 2 : 1.2)) this.currentStroke.push(pt);
      this.render();
      return;
    }

    if (this.tool === "fillBrush" && this.dragAction === "draw") {
      this.fillAtPoint(pt);
      return;
    }

    if (this.dragAction === "erase") {
      this.eraseAt(pt);
      return;
    }

    if (this.dragAction === "bone") {
      this.render();
      return;
    }

    if (this.dragAction === "deform" && this.selectedId && this.dragStartLocal) {
      const local = this.screenToLocal(this.selectedId, pt);
      if (!local) return;
      const obj = this.objects[this.selectedId];
      const dx = local.x - this.dragStartLocal.x;
      const dy = local.y - this.dragStartLocal.y;
      const radius = 180;
      obj.points = this.deformationOriginalPoints.map((p) => {
        const d = dist(p, this.dragStartLocal!);
        const weight = clamp(1 - d / radius, 0, 1) ** 2;
        return { x: p.x + dx * weight, y: p.y + dy * weight };
      });
      this.notify();
      this.render();
      return;
    }

    if (this.dragAction === "curve" && this.selectedId && this.curveStartLocal) {
      const local = this.screenToLocal(this.selectedId, pt);
      if (!local) return;
      const dx = local.x - this.curveStartLocal.x;
      const dy = local.y - this.curveStartLocal.y;
      const radius = 230;
      this.objects[this.selectedId].points = this.curveOriginalPoints.map((p) => {
        const d = dist(p, this.curveStartLocal!);
        const weight = clamp(1 - d / radius, 0, 1);
        const eased = weight * weight * (3 - 2 * weight);
        return { x: p.x + dx * eased, y: p.y + dy * eased };
      });
      this.notify();
      this.render();
      return;
    }

    if (this.tool === "select" && this.selectedId && this.dragAction && this.initialTransform && this.dragStartPt) {
      this.applyTransformDrag(pt);
    }
  }

  handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (this.canvas && this.pointerId !== null) {
      try {
        this.canvas.releasePointerCapture(this.pointerId);
      } catch {
        // Already released by the browser.
      }
    }

    if (this.dragAction === "draw" && (this.tool === "brush" || this.tool === "pen" || this.tool === "texture")) {
      this.finishStroke();
    }

    if (this.dragAction === "bone" && this.pendingBone) {
      const childId =
        this.hitTestTop(this.pendingBone.current, this.pendingBone.parentId) ??
        this.nearestObjectToPoint(this.pendingBone.current, this.pendingBone.parentId, 180);
      if (childId) {
        const childAnchor = this.screenToLocal(childId, this.pendingBone.current) ?? { x: 0, y: 0 };
        this.addBone(this.pendingBone.parentId, childId, this.pendingBone.anchor, childAnchor);
      }
      this.pendingBone = null;
    }

    this.isDrawing = false;
    this.pointerId = null;
    this.dragAction = null;
    this.dragStartPt = null;
    this.dragStartLocal = null;
    this.initialTransform = null;
    this.initialMatrix = null;
    this.initialParentInverse = null;
    this.activePointIdx = null;
    this.deformationOriginalPoints = [];
    this.curveOriginalPoints = [];
    this.curveStartLocal = null;
    this.autoFrameCreatedForGesture = false;
    this.notify();
    this.render();
  }

  private startSelectDrag(pt: Point) {
    if (this.selectedId) {
      const handle = this.hitHandle(this.selectedId, pt);
      if (handle) {
        this.prepareTransformDrag(handle, pt);
        return;
      }
      if (this.hitTestObject(this.selectedId, pt)) {
        this.prepareTransformDrag("move", pt);
        return;
      }
      return;
    }

    const hitId = this.hitTestTop(pt);
    if (hitId) {
      this.selectedId = hitId;
      this.prepareTransformDrag("move", pt);
      this.notify();
      this.render();
    }
  }

  private prepareTransformDrag(action: HandleName | "move", pt: Point) {
    if (!this.selectedId) return;
    if (this.autoFrames && !this.autoFrameCreatedForGesture) {
      this.addFrame();
      this.autoFrameCreatedForGesture = true;
    }
    this.dragAction = action;
    this.dragStartPt = pt;
    this.initialTransform = cloneTransform(this.getFrameTransform(this.selectedId));
    this.initialMatrix = this.getEffectiveMatrix(this.selectedId, this.currentFrameIdx);
    const parentId = this.getParentId(this.selectedId);
    const parentMatrix = parentId ? this.getEffectiveMatrix(parentId, this.currentFrameIdx) : new DOMMatrix();
    this.initialParentInverse = parentMatrix.inverse();
    this.dragStartLocal = new DOMPoint(pt.x, pt.y).matrixTransform(this.initialMatrix.inverse());
  }

  private applyTransformDrag(pt: Point) {
    if (!this.selectedId || !this.initialTransform || !this.dragStartPt || !this.initialMatrix) return;
    const t = this.getFrameTransform(this.selectedId);
    const obj = this.objects[this.selectedId];
    const action = this.dragAction;

    if (action === "move") {
      const inv = this.initialParentInverse ?? new DOMMatrix();
      const start = new DOMPoint(this.dragStartPt.x, this.dragStartPt.y).matrixTransform(inv);
      const now = new DOMPoint(pt.x, pt.y).matrixTransform(inv);
      t.x = this.initialTransform.x + now.x - start.x;
      t.y = this.initialTransform.y + now.y - start.y;
      this.notify();
      this.render();
      return;
    }

    const b = this.getLocalBounds(obj);
    const localNow = new DOMPoint(pt.x, pt.y).matrixTransform(this.initialMatrix.inverse());
    const localStart = this.dragStartLocal ?? localNow;

    if (action === "rotate") {
      const pivotWorld = new DOMPoint(this.initialTransform.pivotX, this.initialTransform.pivotY).matrixTransform(this.initialMatrix);
      const a1 = Math.atan2(this.dragStartPt.y - pivotWorld.y, this.dragStartPt.x - pivotWorld.x);
      const a2 = Math.atan2(pt.y - pivotWorld.y, pt.x - pivotWorld.x);
      t.rotation = this.initialTransform.rotation + ((a2 - a1) * 180) / Math.PI;
    } else if (action === "perspective") {
      t.perspectiveX = clamp(this.initialTransform.perspectiveX + (pt.x - this.dragStartPt.x) / 260, -1.8, 1.8);
      t.perspectiveY = clamp(this.initialTransform.perspectiveY + (pt.y - this.dragStartPt.y) / 260, -1.8, 1.8);
      t.skewX = clamp(this.initialTransform.skewX + (pt.x - this.dragStartPt.x) / 4, -75, 75);
    } else if (action === "flip") {
      t.flipX = clamp(this.initialTransform.flipX + (pt.x - this.dragStartPt.x) / 2, -180, 180);
      t.flipY = clamp(this.initialTransform.flipY + (pt.y - this.dragStartPt.y) / 2, -180, 180);
    } else if (action) {
      const horizontal = action.includes("e") ? { fixed: b.minX, moving: b.maxX } : action.includes("w") ? { fixed: b.maxX, moving: b.minX } : null;
      const vertical = action.includes("s") ? { fixed: b.minY, moving: b.maxY } : action.includes("n") ? { fixed: b.maxY, moving: b.minY } : null;
      if (horizontal) {
        const startLen = localStart.x - horizontal.fixed || 1;
        const newLen = localNow.x - horizontal.fixed;
        t.scaleX = clamp(this.initialTransform.scaleX * (newLen / startLen), -20, 20) || 0.01;
      }
      if (vertical) {
        const startLen = localStart.y - vertical.fixed || 1;
        const newLen = localNow.y - vertical.fixed;
        t.scaleY = clamp(this.initialTransform.scaleY * (newLen / startLen), -20, 20) || 0.01;
      }
    }
    this.notify();
    this.render();
  }

  private finishStroke() {
    const raw = this.currentStroke;
    this.currentStroke = [];
    if (raw.length < 2) return;
    const dense = densify(raw, this.tool === "pen" ? 7 : 3.5);
    const rawBounds = boundsOf(dense);
    const center = { x: rawBounds.cx, y: rawBounds.cy };
    const localPoints = dense.map((p) => ({ x: p.x - center.x, y: p.y - center.y }));
    const closed = dist(raw[0], raw[raw.length - 1]) < Math.max(22, this.currentWidth * 4);
    const id = genId();
    const baseName = this.tool === "texture" ? "Texture" : this.tool === "pen" ? "Pen" : "Brush";
    this.objects[id] = {
      id,
      name: `${baseName} ${Object.keys(this.objects).length + 1}`,
      kind: "stroke",
      points: localPoints,
      color: this.currentColor,
      fillColor: closed ? `${this.currentColor}55` : undefined,
      width: this.currentWidth,
      isClosed: closed,
      zIndex: this.nextZIndex(),
      texture: this.tool === "texture",
    };
    for (const frame of this.frames) frame.transforms[id] = defaultTransform(center.x, center.y);
    this.selectedId = id;
    this.tool = "select";
    this.notify();
    this.render();
  }

  private fillAtPoint(pt: Point) {
    let target = this.selectedId && this.hitTestObject(this.selectedId, pt) ? this.selectedId : this.hitTestTop(pt);
    if (!target && this.selectedId) target = this.selectedId;
    if (!target) return;
    this.objects[target].fillColor = this.currentColor;
    this.selectedId = this.selectedId ?? target;
    this.notify();
    this.render();
  }

  private eraseAt(pt: Point) {
    const radius = Math.max(10, this.currentWidth * 2.4);
    let changed = false;
    for (const obj of Object.values(this.objects)) {
      if (obj.kind !== "stroke") continue;
      const local = this.screenToLocal(obj.id, pt);
      if (!local) continue;
      const before = obj.points.length;
      obj.points = obj.points.filter((p) => dist(p, local) > radius);
      if (obj.points.length !== before) changed = true;
    }
    if (changed) {
      this.notify();
      this.render();
    }
  }

  private addBone(parentId: string, childId: string, parentAnchor: Point, childAnchor: Point) {
    if (parentId === childId || this.wouldCreateCycle(parentId, childId)) return;
    if (this.getParentId(childId)) return;
    const bone: Bone = {
      id: genId(),
      name: `${this.objects[parentId].name} → ${this.objects[childId].name}`,
      parentId,
      childId,
      parentAnchor,
      childAnchor,
    };
    for (let i = 0; i < this.frames.length; i++) {
      const parentWorld = this.getEffectiveMatrix(parentId, i);
      const childWorld = this.getEffectiveMatrix(childId, i);
      const local = parentWorld.inverse().multiply(childWorld);
      this.frames[i].transforms[childId] = matrixToTransform(local);
      this.frames[i].transforms[childId].pivotX = childAnchor.x;
      this.frames[i].transforms[childId].pivotY = childAnchor.y;
    }
    this.bones.push(bone);
    this.selectedId = childId;
    this.tool = "select";
    this.notify();
    this.render();
  }

  private wouldCreateCycle(parentId: string, childId: string) {
    let current: string | null = parentId;
    while (current) {
      if (current === childId) return true;
      current = this.getParentId(current);
    }
    return false;
  }

  getParentId(id: string) {
    return this.bones.find((bone) => bone.childId === id)?.parentId ?? null;
  }

  getChildren(id: string) {
    return this.bones.filter((bone) => bone.parentId === id).map((bone) => bone.childId);
  }

  getFrameTransform(id: string, frameIdx = this.currentFrameIdx): Transform {
    const frame = this.frames[frameIdx];
    if (!frame.transforms[id]) frame.transforms[id] = defaultTransform();
    return frame.transforms[id];
  }

  private localMatrix(t: Transform) {
    const m = new DOMMatrix();
    m.translateSelf(t.x, t.y);
    m.translateSelf(t.pivotX, t.pivotY);
    m.rotateSelf(t.rotation);
    m.skewXSelf(t.skewX);
    m.skewYSelf(t.skewY);
    const flipScaleX = Math.cos((t.flipX * Math.PI) / 180);
    const flipScaleY = Math.cos((t.flipY * Math.PI) / 180);
    m.scaleSelf(t.scaleX * (Math.abs(flipScaleX) < 0.04 ? 0.04 : flipScaleX), t.scaleY * (Math.abs(flipScaleY) < 0.04 ? 0.04 : flipScaleY));
    m.translateSelf(-t.pivotX, -t.pivotY);
    return m;
  }

  getEffectiveMatrix(id: string, frameIdx = this.currentFrameIdx, seen = new Set<string>()): DOMMatrix {
    if (seen.has(id)) return new DOMMatrix();
    seen.add(id);
    const local = this.localMatrix(this.getFrameTransform(id, frameIdx));
    const parentId = this.getParentId(id);
    if (!parentId) return local;
    return this.getEffectiveMatrix(parentId, frameIdx, seen).multiply(local);
  }

  private getLocalBounds(obj: DrawingObject) {
    return boundsOf(obj.points);
  }

  private projectPoint(p: Point, obj: DrawingObject, t: Transform): Point {
    const b = this.getLocalBounds(obj);
    const nx = b.width ? (p.x - b.cx) / b.width : 0;
    const ny = b.height ? (p.y - b.cy) / b.height : 0;
    return {
      x: p.x + nx * ny * t.perspectiveX * b.width * 0.42,
      y: p.y + nx * ny * t.perspectiveY * b.height * 0.42,
    };
  }

  private objectPath(ctx: CanvasRenderingContext2D, obj: DrawingObject, transform: Transform) {
    if (!obj.points.length) return;
    ctx.beginPath();
    const start = this.projectPoint(obj.points[0], obj, transform);
    ctx.moveTo(start.x, start.y);
    if (obj.points.length === 2 || this.tool === "pen") {
      for (let i = 1; i < obj.points.length; i++) {
        const p = this.projectPoint(obj.points[i], obj, transform);
        ctx.lineTo(p.x, p.y);
      }
    } else {
      for (let i = 1; i < obj.points.length - 1; i++) {
        const p = this.projectPoint(obj.points[i], obj, transform);
        const next = this.projectPoint(obj.points[i + 1], obj, transform);
        ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
      }
      const last = this.projectPoint(obj.points[obj.points.length - 1], obj, transform);
      ctx.lineTo(last.x, last.y);
    }
    if (obj.isClosed) ctx.closePath();
  }

  private renderObject(obj: DrawingObject, frameIdx: number, alpha = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const matrix = this.getEffectiveMatrix(obj.id, frameIdx);
    const t = this.getFrameTransform(obj.id, frameIdx);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);

    if (obj.kind === "image" && obj.imageElement) {
      const b = this.getLocalBounds(obj);
      ctx.drawImage(obj.imageElement, b.minX, b.minY, b.width, b.height);
    } else {
      this.objectPath(ctx, obj, t);
      if (obj.fillColor) {
        ctx.fillStyle = obj.fillColor;
        ctx.fill();
      }
      this.objectPath(ctx, obj, t);
      ctx.strokeStyle = obj.color;
      ctx.lineWidth = obj.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = obj.texture ? obj.color : "transparent";
      ctx.shadowBlur = obj.texture ? obj.width * 1.6 : 0;
      ctx.stroke();
    }
    ctx.restore();
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.fillStyle = this.canvasColor;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    const sorted = Object.values(this.objects).sort((a, b) => a.zIndex - b.zIndex);
    if (this.onionSkin && this.frames.length > 1) {
      const prev = Math.max(0, this.currentFrameIdx - 1);
      if (prev !== this.currentFrameIdx) sorted.forEach((obj) => this.renderObject(obj, prev, 0.24));
    }
    sorted.forEach((obj) => this.renderObject(obj, this.currentFrameIdx, 1));
    this.drawBones();
    if (this.currentStroke.length) this.drawCurrentStroke();
    if (this.selectedId) this.drawSelection(this.selectedId);
    if (this.tool === "deform" && this.selectedId) this.drawDeformPoints(this.selectedId);
    if (this.pendingBone) this.drawPendingBone();
  }

  private drawCurrentStroke() {
    if (!this.ctx || this.currentStroke.length < 1) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = this.currentColor;
    ctx.lineWidth = this.currentWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(this.currentStroke[0].x, this.currentStroke[0].y);
    for (let i = 1; i < this.currentStroke.length; i++) ctx.lineTo(this.currentStroke[i].x, this.currentStroke[i].y);
    ctx.stroke();
    ctx.restore();
  }

  private drawBones() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#38bdf8";
    ctx.fillStyle = "#0ea5e9";
    for (const bone of this.bones) {
      const parent = this.localToScreen(bone.parentId, bone.parentAnchor);
      const child = this.localToScreen(bone.childId, bone.childAnchor);
      if (!parent || !child) continue;
      ctx.beginPath();
      ctx.moveTo(parent.x, parent.y);
      ctx.lineTo(child.x, child.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(parent.x, parent.y, 8, 0, Math.PI * 2);
      ctx.arc(child.x, child.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPendingBone() {
    if (!this.ctx || !this.pendingBone) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = "#f27d26";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(this.pendingBone.start.x, this.pendingBone.start.y);
    ctx.lineTo(this.pendingBone.current.x, this.pendingBone.current.y);
    ctx.stroke();
    ctx.restore();
  }

  private drawSelection(id: string) {
    if (!this.ctx || !this.objects[id]) return;
    const ctx = this.ctx;
    const handles = this.getHandles(id);
    const corners = [handles.nw, handles.ne, handles.se, handles.sw];
    ctx.save();
    ctx.strokeStyle = "#f27d26";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([9, 5]);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#f27d26";
    for (const [name, p] of Object.entries(handles)) {
      const radius = name === "rotate" || name === "perspective" || name === "flip" ? 13 : 11;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const pivot = this.localToScreen(id, { x: this.getFrameTransform(id).pivotX, y: this.getFrameTransform(id).pivotY });
    if (pivot) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(pivot.x, pivot.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawDeformPoints(id: string) {
    if (!this.ctx || !this.objects[id]) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "#14b8a6";
    const pts = this.objects[id].points;
    const step = Math.max(1, Math.floor(pts.length / 700));
    for (let i = 0; i < pts.length; i += step) {
      const p = this.localToScreen(id, pts[i]);
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  getHandles(id: string): Record<HandleName, Point> {
    const obj = this.objects[id];
    const b = this.getLocalBounds(obj);
    const top = b.minY;
    const bottom = b.maxY;
    const left = b.minX;
    const right = b.maxX;
    const cx = b.cx;
    const cy = b.cy;
    const map = (p: Point) => this.localToScreen(id, p) ?? p;
    return {
      nw: map({ x: left, y: top }),
      n: map({ x: cx, y: top }),
      ne: map({ x: right, y: top }),
      e: map({ x: right, y: cy }),
      se: map({ x: right, y: bottom }),
      s: map({ x: cx, y: bottom }),
      sw: map({ x: left, y: bottom }),
      w: map({ x: left, y: cy }),
      rotate: map({ x: cx, y: top - Math.max(44, b.height * 0.18) }),
      perspective: map({ x: right + Math.max(42, b.width * 0.15), y: top }),
      flip: map({ x: left - Math.max(42, b.width * 0.15), y: cy }),
    };
  }

  private hitHandle(id: string, pt: Point): HandleName | null {
    const handles = this.getHandles(id);
    let best: HandleName | null = null;
    let bestD = Infinity;
    for (const [name, p] of Object.entries(handles) as [HandleName, Point][]) {
      const d = dist(p, pt);
      if (d < 28 && d < bestD) {
        best = name;
        bestD = d;
      }
    }
    return best;
  }

  private hitTestTop(pt: Point, excludeId?: string) {
    const sorted = Object.values(this.objects)
      .filter((obj) => obj.id !== excludeId)
      .sort((a, b) => b.zIndex - a.zIndex);
    return sorted.find((obj) => this.hitTestObject(obj.id, pt))?.id ?? null;
  }

  private nearestObjectToPoint(pt: Point, excludeId?: string, maxDistance = 90) {
    let bestId: string | null = null;
    let bestDistance = maxDistance;
    for (const obj of Object.values(this.objects)) {
      if (obj.id === excludeId) continue;
      const local = this.screenToLocal(obj.id, pt);
      if (!local) continue;
      const b = this.getLocalBounds(obj);
      const dx = Math.max(b.minX - local.x, 0, local.x - b.maxX);
      const dy = Math.max(b.minY - local.y, 0, local.y - b.maxY);
      const distance = Math.hypot(dx, dy);
      if (distance <= bestDistance) {
        bestDistance = distance;
        bestId = obj.id;
      }
    }
    return bestId;
  }

  private hitTestObject(id: string, pt: Point) {
    const obj = this.objects[id];
    if (!obj) return false;
    const local = this.screenToLocal(id, pt);
    if (!local) return false;
    const b = this.getLocalBounds(obj);
    if (obj.kind === "image") return local.x >= b.minX && local.x <= b.maxX && local.y >= b.minY && local.y <= b.maxY;
    if (obj.isClosed || obj.fillColor) {
      const path = new Path2D();
      path.moveTo(obj.points[0].x, obj.points[0].y);
      obj.points.slice(1).forEach((p) => path.lineTo(p.x, p.y));
      path.closePath();
      if (this.ctx?.isPointInPath(path, local.x, local.y)) return true;
    }
    return obj.points.some((p) => dist(p, local) <= Math.max(18, obj.width * 2.8));
  }

  private nearestPointIndex(obj: DrawingObject, local: Point, radius: number) {
    let best = 0;
    let bestD = Infinity;
    obj.points.forEach((p, idx) => {
      const d = dist(p, local);
      if (d < bestD && d <= radius) {
        best = idx;
        bestD = d;
      }
    });
    return best;
  }

  private screenToLocal(id: string, pt: Point): Point | null {
    try {
      const inv = this.getEffectiveMatrix(id, this.currentFrameIdx).inverse();
      const p = new DOMPoint(pt.x, pt.y).matrixTransform(inv);
      return { x: p.x, y: p.y };
    } catch {
      return null;
    }
  }

  private localToScreen(id: string, pt: Point): Point | null {
    if (!this.objects[id]) return null;
    const p = new DOMPoint(pt.x, pt.y).matrixTransform(this.getEffectiveMatrix(id, this.currentFrameIdx));
    return { x: p.x, y: p.y };
  }

  private getPointer(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = this.canvas!.getBoundingClientRect();
    const scaleX = this.cssWidth / rect.width;
    const scaleY = this.cssHeight / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  private nextZIndex() {
    return Math.max(0, ...Object.values(this.objects).map((obj) => obj.zIndex)) + 1;
  }
}
