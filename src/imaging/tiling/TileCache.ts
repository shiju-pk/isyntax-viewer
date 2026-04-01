import type { TileCoord } from './types';
import { TileGrid } from './TileGrid';

interface CacheEntry {
  key: string;
  imageData: ImageData;
  lastAccessed: number;
  byteSize: number;
}

export class TileCache {
  private cache = new Map<string, CacheEntry>();
  private maxBytes: number;
  private currentBytes = 0;

  constructor(maxBytes = 256 * 1024 * 1024) {
    this.maxBytes = maxBytes;
  }

  get(coord: TileCoord): ImageData | null {
    const key = TileGrid.tileKey(coord);
    const entry = this.cache.get(key);
    if (!entry) return null;
    entry.lastAccessed = performance.now();
    return entry.imageData;
  }

  set(coord: TileCoord, imageData: ImageData): void {
    const key = TileGrid.tileKey(coord);
    const byteSize = imageData.data.byteLength;

    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.remove(coord);
    }

    // Evict until there is room
    while (this.currentBytes + byteSize > this.maxBytes && this.cache.size > 0) {
      this.evictLRU();
    }

    this.cache.set(key, {
      key,
      imageData,
      lastAccessed: performance.now(),
      byteSize,
    });
    this.currentBytes += byteSize;
  }

  has(coord: TileCoord): boolean {
    return this.cache.has(TileGrid.tileKey(coord));
  }

  remove(coord: TileCoord): void {
    const key = TileGrid.tileKey(coord);
    const entry = this.cache.get(key);
    if (entry) {
      this.currentBytes -= entry.byteSize;
      this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
    this.currentBytes = 0;
  }

  get size(): number {
    return this.cache.size;
  }

  get usedBytes(): number {
    return this.currentBytes;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey)!;
      this.currentBytes -= entry.byteSize;
      this.cache.delete(oldestKey);
    }
  }
}
