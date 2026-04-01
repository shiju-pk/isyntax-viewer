import type { TileCoord, TileGridInfo, TileRequest, VisibleBounds } from './types';
import { TileState } from './types';
import { TileGrid } from './TileGrid';
import { TileCache } from './TileCache';

export type TileFetcher = (coord: TileCoord) => Promise<ImageData>;
export type TileReadyCallback = (coord: TileCoord, imageData: ImageData) => void;

export class TileManager {
  private grid: TileGrid;
  private cache: TileCache;
  private fetcher: TileFetcher;
  private onTileReady: TileReadyCallback;
  private pendingRequests = new Map<string, TileState>();
  private abortController: AbortController | null = null;

  constructor(
    gridInfo: TileGridInfo,
    fetcher: TileFetcher,
    onTileReady: TileReadyCallback,
    cacheSizeBytes?: number
  ) {
    this.grid = new TileGrid(gridInfo);
    this.cache = new TileCache(cacheSizeBytes);
    this.fetcher = fetcher;
    this.onTileReady = onTileReady;
  }

  getGrid(): TileGrid {
    return this.grid;
  }

  getCache(): TileCache {
    return this.cache;
  }

  updateVisibleRegion(
    bounds: VisibleBounds,
    zoom: number
  ): void {
    const level = this.grid.getLevelForZoom(zoom);
    const visibleCoords = this.grid.getVisibleTiles(bounds, level);

    // Prioritize tiles closer to center
    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;

    const requests: TileRequest[] = visibleCoords
      .filter((coord) => {
        const key = TileGrid.tileKey(coord);
        return !this.cache.has(coord) && !this.pendingRequests.has(key);
      })
      .map((coord) => {
        const tilePixel = this.grid.tileCoordToPixel(coord);
        const tileCenterX =
          tilePixel.x + this.grid.getInfo().tileWidth / 2;
        const tileCenterY =
          tilePixel.y + this.grid.getInfo().tileHeight / 2;
        const dist = Math.sqrt(
          (tileCenterX - centerX) ** 2 + (tileCenterY - centerY) ** 2
        );
        return { coord, priority: dist };
      })
      .sort((a, b) => a.priority - b.priority);

    for (const req of requests) {
      this.fetchTile(req.coord);
    }
  }

  private async fetchTile(coord: TileCoord): Promise<void> {
    const key = TileGrid.tileKey(coord);
    if (this.pendingRequests.has(key)) return;

    this.pendingRequests.set(key, TileState.LOADING);

    try {
      const imageData = await this.fetcher(coord);
      this.pendingRequests.delete(key);
      this.cache.set(coord, imageData);
      this.onTileReady(coord, imageData);
    } catch {
      this.pendingRequests.set(key, TileState.ERROR);
    }
  }

  cancelPending(): void {
    this.abortController?.abort();
    this.abortController = new AbortController();
    this.pendingRequests.clear();
  }

  dispose(): void {
    this.cancelPending();
    this.cache.clear();
  }
}
