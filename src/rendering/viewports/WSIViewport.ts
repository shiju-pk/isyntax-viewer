import { Viewport } from './Viewport';
import { ViewportStatus, type ViewportInput } from './types';
import { eventBus } from '../events/EventBus';
import { RenderingEvents } from '../events/RenderingEvents';
import { TileManager, type TileFetcher } from '../../imaging/tiling/TileManager';
import { TileGrid } from '../../imaging/tiling/TileGrid';
import type { TileCoord, TileGridInfo, VisibleBounds } from '../../imaging/tiling/types';
import { renderingEngineCache } from '../engine/RenderingEngineCache';

export interface WSIImageInfo {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  levels: number;
}

export class WSIViewport extends Viewport {
  private imageInfo: WSIImageInfo | null = null;
  private tileManager: TileManager | null = null;
  private offscreenTileCanvas: OffscreenCanvas | null = null;
  /** Parallel cache: TileKey → ImageBitmap for GPU-accelerated tile rendering */
  private bitmapCache = new Map<string, ImageBitmap>();

  static override get useCustomRenderingPipeline(): boolean {
    return true;
  }

  constructor(input: ViewportInput) {
    super(input);
  }

  setWSIImage(info: WSIImageInfo, fetcher?: TileFetcher): void {
    this.imageInfo = info;
    this.viewportStatus = ViewportStatus.LOADING;

    if (fetcher) {
      // Dispose previous tile manager if any
      this.tileManager?.dispose();
      this._clearBitmapCache();

      const gridInfo: TileGridInfo = {
        imageWidth: info.width,
        imageHeight: info.height,
        tileWidth: info.tileWidth,
        tileHeight: info.tileHeight,
        levels: info.levels,
      };

      this.tileManager = new TileManager(
        gridInfo,
        fetcher,
        this.onTileReady
      );
    }
  }

  getWSIImageInfo(): WSIImageInfo | null {
    return this.imageInfo;
  }

  getTileManager(): TileManager | null {
    return this.tileManager;
  }

  private onTileReady = (coord: TileCoord, imageData: ImageData): void => {
    // Asynchronously create an ImageBitmap for GPU-accelerated rendering
    const key = TileGrid.tileKey(coord);
    createImageBitmap(imageData).then((bitmap) => {
      // Close any previous bitmap for this key
      this.bitmapCache.get(key)?.close();
      this.bitmapCache.set(key, bitmap);

      // Schedule a re-render via the rendering engine's rAF loop
      const engine = renderingEngineCache.get(this.renderingEngineId);
      if (engine) {
        engine.renderViewport(this.id);
      }
    });
  };

  override render(): void {
    const startTime = performance.now();

    this.backend.clear([0, 0, 0]);

    if (this.imageData) {
      // If a composite/full image is set, render it like a normal viewport
      super.render();
      return;
    }

    if (!this.imageInfo || !this.tileManager) return;

    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;
    const cameraState = this.camera.getState();
    const grid = this.tileManager.getGrid();
    const cache = this.tileManager.getCache();

    // Compute visible bounds in image space from camera state
    const transform = this.camera.computeTransform(
      displayWidth,
      displayHeight,
      this.imageInfo.width,
      this.imageInfo.height
    );

    const level = grid.getLevelForZoom(cameraState.zoom);
    const levelWidth = grid.getImageWidthAtLevel(level);
    const levelHeight = grid.getImageHeightAtLevel(level);

    const fitScale = Math.min(
      displayWidth / this.imageInfo.width,
      displayHeight / this.imageInfo.height
    ) * cameraState.zoom;

    // Derive visible bounds in tile-level pixel coordinates
    const bounds: VisibleBounds = {
      left: Math.max(0, -transform.offsetX / fitScale),
      top: Math.max(0, -transform.offsetY / fitScale),
      right: Math.min(levelWidth, (-transform.offsetX + displayWidth) / fitScale),
      bottom: Math.min(levelHeight, (-transform.offsetY + displayHeight) / fitScale),
    };

    // Trigger tile loading for visible region
    this.tileManager.updateVisibleRegion(bounds, cameraState.zoom);

    // Render cached tiles using ImageBitmap (GPU-accelerated) when available
    const visibleTiles = grid.getVisibleTiles(bounds, level);
    const ctx = this.canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (const coord of visibleTiles) {
      const key = TileGrid.tileKey(coord);
      const bitmap = this.bitmapCache.get(key);

      const tilePixel = grid.tileCoordToPixel(coord);

      if (bitmap) {
        // Fast path: draw pre-created ImageBitmap directly (GPU-accelerated)
        const tileScreenX = transform.offsetX + tilePixel.x * fitScale;
        const tileScreenY = transform.offsetY + tilePixel.y * fitScale;
        const tileW = bitmap.width * fitScale;
        const tileH = bitmap.height * fitScale;
        ctx.drawImage(bitmap, tileScreenX, tileScreenY, tileW, tileH);
      } else {
        // Fallback: bitmap not ready yet, use offscreen canvas + putImageData
        const tileData = cache.get(coord);
        if (!tileData) continue;

        const tileScreenX = transform.offsetX + tilePixel.x * fitScale;
        const tileScreenY = transform.offsetY + tilePixel.y * fitScale;
        const tileW = tileData.width * fitScale;
        const tileH = tileData.height * fitScale;

        if (
          !this.offscreenTileCanvas ||
          this.offscreenTileCanvas.width !== tileData.width ||
          this.offscreenTileCanvas.height !== tileData.height
        ) {
          this.offscreenTileCanvas = new OffscreenCanvas(tileData.width, tileData.height);
        }
        const offCtx = this.offscreenTileCanvas.getContext('2d')!;
        offCtx.putImageData(tileData, 0, 0);
        ctx.drawImage(this.offscreenTileCanvas, tileScreenX, tileScreenY, tileW, tileH);
      }
    }

    if (visibleTiles.length > 0) {
      this.viewportStatus = ViewportStatus.RENDERED;
    }

    const renderTimeMs = performance.now() - startTime;
    eventBus.emit(RenderingEvents.IMAGE_RENDERED, {
      viewportId: this.id,
      renderingEngineId: this.renderingEngineId,
      renderTimeMs,
    });
  }

  private _clearBitmapCache(): void {
    for (const bitmap of this.bitmapCache.values()) {
      bitmap.close();
    }
    this.bitmapCache.clear();
  }

  override dispose(): void {
    this.tileManager?.dispose();
    this.tileManager = null;
    this._clearBitmapCache();
    this.offscreenTileCanvas = null;
    this.imageInfo = null;
    super.dispose();
  }
}
