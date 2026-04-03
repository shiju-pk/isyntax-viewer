/**
 * LRU image cache with configurable max size, eviction, and events.
 *
 * Pattern inspired by cornerstone3D's cache.ts:
 *   - Size tracking per entry
 *   - LRU eviction when capacity exceeded
 *   - Locked entries that resist eviction
 *   - Events on add/remove/purge
 */

import { eventBus } from '../rendering/events/EventBus';

export const CacheEvents = {
  IMAGE_ADDED: 'CACHE:IMAGE_ADDED',
  IMAGE_REMOVED: 'CACHE:IMAGE_REMOVED',
  CACHE_PURGED: 'CACHE:CACHE_PURGED',
  CACHE_FULL: 'CACHE:CACHE_FULL',
} as const;

export interface CacheEntry<T = ImageData> {
  imageId: string;
  data: T;
  sizeInBytes: number;
  lastAccessed: number;
  locked: boolean;
}

export interface ImageCacheOptions {
  /** Maximum cache size in bytes. Default 1 GB. */
  maxSizeBytes?: number;
}

export class ImageCache {
  private cache = new Map<string, CacheEntry>();
  private _maxSizeBytes: number;
  private _currentSizeBytes = 0;

  constructor(options: ImageCacheOptions = {}) {
    this._maxSizeBytes = options.maxSizeBytes ?? 1024 * 1024 * 1024; // 1 GB
  }

  // --- Public API ---

  get maxSizeBytes(): number {
    return this._maxSizeBytes;
  }

  set maxSizeBytes(value: number) {
    this._maxSizeBytes = value;
    this._evictIfNeeded(0);
  }

  get currentSizeBytes(): number {
    return this._currentSizeBytes;
  }

  get size(): number {
    return this.cache.size;
  }

  get utilizationPercent(): number {
    return this._maxSizeBytes > 0
      ? (this._currentSizeBytes / this._maxSizeBytes) * 100
      : 0;
  }

  /**
   * Get a cached image by ID. Updates LRU access time.
   */
  get(imageId: string): CacheEntry | undefined {
    const entry = this.cache.get(imageId);
    if (entry) {
      entry.lastAccessed = performance.now();
    }
    return entry;
  }

  /**
   * Get image data directly (convenience).
   */
  getImageData(imageId: string): ImageData | undefined {
    return this.get(imageId)?.data;
  }

  /**
   * Store an image in the cache.
   * Evicts LRU entries if needed to make room.
   */
  put(imageId: string, data: ImageData, options?: { locked?: boolean }): boolean {
    const sizeInBytes = data.data.byteLength;

    // Remove existing entry if present
    if (this.cache.has(imageId)) {
      this.remove(imageId);
    }

    // Check if the single item exceeds max cache size
    if (sizeInBytes > this._maxSizeBytes) {
      return false;
    }

    // Evict until there's room
    if (!this._evictIfNeeded(sizeInBytes)) {
      return false;
    }

    const entry: CacheEntry = {
      imageId,
      data,
      sizeInBytes,
      lastAccessed: performance.now(),
      locked: options?.locked ?? false,
    };

    this.cache.set(imageId, entry);
    this._currentSizeBytes += sizeInBytes;

    eventBus.emit(CacheEvents.IMAGE_ADDED as any, { imageId, sizeInBytes });
    return true;
  }

  /**
   * Check if an image exists in the cache.
   */
  has(imageId: string): boolean {
    return this.cache.has(imageId);
  }

  /**
   * Remove a specific image from the cache.
   */
  remove(imageId: string): boolean {
    const entry = this.cache.get(imageId);
    if (!entry) return false;

    this.cache.delete(imageId);
    this._currentSizeBytes -= entry.sizeInBytes;

    eventBus.emit(CacheEvents.IMAGE_REMOVED as any, { imageId, sizeInBytes: entry.sizeInBytes });
    return true;
  }

  /**
   * Lock an entry to prevent LRU eviction.
   */
  lock(imageId: string): void {
    const entry = this.cache.get(imageId);
    if (entry) entry.locked = true;
  }

  /**
   * Unlock an entry to allow LRU eviction.
   */
  unlock(imageId: string): void {
    const entry = this.cache.get(imageId);
    if (entry) entry.locked = false;
  }

  /**
   * Clear all entries from the cache.
   */
  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    this._currentSizeBytes = 0;

    eventBus.emit(CacheEvents.CACHE_PURGED as any, { entriesRemoved: count });
  }

  /**
   * Get all image IDs in the cache.
   */
  getImageIds(): string[] {
    return Array.from(this.cache.keys());
  }

  // --- Private ---

  /**
   * Evict least-recently-used unlocked entries until there's room for `requiredBytes`.
   * Returns true if enough space was freed, false if not possible (e.g., remaining entries locked).
   */
  private _evictIfNeeded(requiredBytes: number): boolean {
    while (this._currentSizeBytes + requiredBytes > this._maxSizeBytes && this.cache.size > 0) {
      const evicted = this._evictLRU();
      if (!evicted) {
        // All remaining entries are locked — can't free more
        eventBus.emit(CacheEvents.CACHE_FULL as any, {
          currentSizeBytes: this._currentSizeBytes,
          maxSizeBytes: this._maxSizeBytes,
          requiredBytes,
        });
        return false;
      }
    }
    return true;
  }

  /**
   * Evict the single least-recently-used unlocked entry.
   * Returns true if an entry was evicted, false if all are locked.
   */
  private _evictLRU(): boolean {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (!entry.locked && entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (!oldestKey) return false;

    this.remove(oldestKey);
    return true;
  }
}

/**
 * Singleton default image cache instance.
 */
export const imageCache = new ImageCache();
