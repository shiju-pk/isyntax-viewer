import type { CameraState, FitToCanvasParams, CanvasTransform } from './types';

export class Camera2D {
  private state: CameraState = {
    panX: 0,
    panY: 0,
    zoom: 1,
    rotation: 0,
    flipH: false,
    flipV: false,
  };

  getState(): Readonly<CameraState> {
    return { ...this.state };
  }

  setState(partial: Partial<CameraState>): void {
    Object.assign(this.state, partial);
  }

  reset(): void {
    this.state = {
      panX: 0,
      panY: 0,
      zoom: 1,
      rotation: 0,
      flipH: false,
      flipV: false,
    };
  }

  pan(dx: number, dy: number): void {
    this.state.panX += dx;
    this.state.panY += dy;
  }

  zoomBy(factor: number): void {
    this.state.zoom = Math.max(0.01, Math.min(100, this.state.zoom * factor));
  }

  setZoom(zoom: number): void {
    this.state.zoom = Math.max(0.01, Math.min(100, zoom));
  }

  rotate(degrees: number): void {
    this.state.rotation = (this.state.rotation + degrees) % 360;
  }

  flipHorizontal(): void {
    this.state.flipH = !this.state.flipH;
  }

  flipVertical(): void {
    this.state.flipV = !this.state.flipV;
  }

  computeFitScale(params: FitToCanvasParams): number {
    const scaleX = params.canvasWidth / params.imageWidth;
    const scaleY = params.canvasHeight / params.imageHeight;
    return Math.min(scaleX, scaleY);
  }

  computeTransform(
    canvasWidth: number,
    canvasHeight: number,
    imageWidth: number,
    imageHeight: number
  ): CanvasTransform {
    const fitScale = this.computeFitScale({
      canvasWidth,
      canvasHeight,
      imageWidth,
      imageHeight,
    });
    const totalScale = fitScale * this.state.zoom;

    const scaleX = this.state.flipH ? -totalScale : totalScale;
    const scaleY = this.state.flipV ? -totalScale : totalScale;

    const imgW = imageWidth * totalScale;
    const imgH = imageHeight * totalScale;
    const offsetX = (canvasWidth - imgW) / 2 + this.state.panX;
    const offsetY = (canvasHeight - imgH) / 2 + this.state.panY;

    return {
      offsetX,
      offsetY,
      scaleX,
      scaleY,
      rotation: this.state.rotation,
    };
  }

  worldToCanvas(
    worldX: number,
    worldY: number,
    canvasWidth: number,
    canvasHeight: number,
    imageWidth: number,
    imageHeight: number
  ): [number, number] {
    const t = this.computeTransform(
      canvasWidth,
      canvasHeight,
      imageWidth,
      imageHeight
    );
    const absScaleX = Math.abs(t.scaleX);
    const absScaleY = Math.abs(t.scaleY);
    const drawW = imageWidth * absScaleX;
    const drawH = imageHeight * absScaleY;

    // 1. Position within the drawn image rect (before flip)
    let px = t.offsetX + worldX * absScaleX;
    let py = t.offsetY + worldY * absScaleY;

    // 2. Apply flip — mirror around image center, matching Canvas2DBackend
    if (t.scaleX < 0) {
      const imgCenterX = t.offsetX + drawW / 2;
      px = 2 * imgCenterX - px;
    }
    if (t.scaleY < 0) {
      const imgCenterY = t.offsetY + drawH / 2;
      py = 2 * imgCenterY - py;
    }

    // 3. Apply rotation around canvas center
    if (t.rotation !== 0) {
      const cx = canvasWidth / 2;
      const cy = canvasHeight / 2;
      const rad = (t.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const dx = px - cx;
      const dy = py - cy;
      px = cx + dx * cos - dy * sin;
      py = cy + dx * sin + dy * cos;
    }

    return [px, py];
  }

  canvasToWorld(
    canvasX: number,
    canvasY: number,
    canvasWidth: number,
    canvasHeight: number,
    imageWidth: number,
    imageHeight: number
  ): [number, number] {
    const t = this.computeTransform(
      canvasWidth,
      canvasHeight,
      imageWidth,
      imageHeight
    );
    let px = canvasX;
    let py = canvasY;

    // 1. Undo rotation around canvas center
    if (t.rotation !== 0) {
      const cx = canvasWidth / 2;
      const cy = canvasHeight / 2;
      const rad = -(t.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const dx = px - cx;
      const dy = py - cy;
      px = cx + dx * cos - dy * sin;
      py = cy + dx * sin + dy * cos;
    }

    const absScaleX = Math.abs(t.scaleX);
    const absScaleY = Math.abs(t.scaleY);
    const drawW = imageWidth * absScaleX;
    const drawH = imageHeight * absScaleY;

    // 2. Undo flip — mirror around image center
    if (t.scaleX < 0) {
      const imgCenterX = t.offsetX + drawW / 2;
      px = 2 * imgCenterX - px;
    }
    if (t.scaleY < 0) {
      const imgCenterY = t.offsetY + drawH / 2;
      py = 2 * imgCenterY - py;
    }

    // 3. Undo scale + offset
    const wx = (px - t.offsetX) / absScaleX;
    const wy = (py - t.offsetY) / absScaleY;
    return [wx, wy];
  }
}
