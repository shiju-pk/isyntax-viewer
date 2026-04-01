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
    const cx = t.offsetX + worldX * Math.abs(t.scaleX);
    const cy = t.offsetY + worldY * Math.abs(t.scaleY);
    return [cx, cy];
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
    const wx = (canvasX - t.offsetX) / Math.abs(t.scaleX);
    const wy = (canvasY - t.offsetY) / Math.abs(t.scaleY);
    return [wx, wy];
  }
}
