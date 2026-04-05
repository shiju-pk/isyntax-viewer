import type { CanvasTransform } from '../camera/types';
import type { IRendererBackend } from './IRendererBackend';

export class Canvas2DBackend implements IRendererBackend {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private offscreen: OffscreenCanvas | null = null;

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  clear(color: [number, number, number] = [0, 0, 0]): void {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;
    const targetW = (displayWidth * dpr) | 0;
    const targetH = (displayHeight * dpr) | 0;

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const [r, g, b] = color;
    this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    this.ctx.fillRect(0, 0, displayWidth, displayHeight);
  }

  drawImage(
    source: ImageBitmap | ImageData | OffscreenCanvas,
    transform: CanvasTransform,
    imageWidth: number,
    imageHeight: number
  ): void {
    let drawable: ImageBitmap | OffscreenCanvas;

    if (source instanceof ImageData) {
      if (
        !this.offscreen ||
        this.offscreen.width !== imageWidth ||
        this.offscreen.height !== imageHeight
      ) {
        this.offscreen = new OffscreenCanvas(imageWidth, imageHeight);
      }
      const offCtx = this.offscreen.getContext('2d')!;
      offCtx.putImageData(source, 0, 0);
      drawable = this.offscreen;
    } else {
      drawable = source;
    }

    this.ctx.save();

    if (transform.rotation !== 0) {
      const displayWidth = this.canvas.clientWidth;
      const displayHeight = this.canvas.clientHeight;
      const cx = displayWidth / 2;
      const cy = displayHeight / 2;
      this.ctx.translate(cx, cy);
      this.ctx.rotate((transform.rotation * Math.PI) / 180);
      this.ctx.translate(-cx, -cy);
    }

    const drawW = imageWidth * Math.abs(transform.scaleX);
    const drawH = imageHeight * Math.abs(transform.scaleY);

    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    if (transform.scaleX < 0 || transform.scaleY < 0) {
      this.ctx.save();
      this.ctx.translate(
        transform.scaleX < 0 ? transform.offsetX + drawW : transform.offsetX,
        transform.scaleY < 0 ? transform.offsetY + drawH : transform.offsetY
      );
      this.ctx.scale(
        transform.scaleX < 0 ? -1 : 1,
        transform.scaleY < 0 ? -1 : 1
      );
      this.ctx.drawImage(drawable, 0, 0, drawW, drawH);
      this.ctx.restore();
    } else {
      this.ctx.drawImage(
        drawable,
        transform.offsetX,
        transform.offsetY,
        drawW,
        drawH
      );
    }

    this.ctx.restore();
  }

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  dispose(): void {
    this.offscreen = null;
  }
}
