import type { TileCoord, TileGridInfo, VisibleBounds } from './types';

export class TileGrid {
  private info: TileGridInfo;

  constructor(info: TileGridInfo) {
    this.info = info;
  }

  getInfo(): TileGridInfo {
    return { ...this.info };
  }

  getColumnsAtLevel(level: number): number {
    const levelWidth = this.getImageWidthAtLevel(level);
    return Math.ceil(levelWidth / this.info.tileWidth);
  }

  getRowsAtLevel(level: number): number {
    const levelHeight = this.getImageHeightAtLevel(level);
    return Math.ceil(levelHeight / this.info.tileHeight);
  }

  getImageWidthAtLevel(level: number): number {
    const scale = Math.pow(2, this.info.levels - 1 - level);
    return Math.ceil(this.info.imageWidth / scale);
  }

  getImageHeightAtLevel(level: number): number {
    const scale = Math.pow(2, this.info.levels - 1 - level);
    return Math.ceil(this.info.imageHeight / scale);
  }

  tileCoordToPixel(coord: TileCoord): { x: number; y: number } {
    return {
      x: coord.col * this.info.tileWidth,
      y: coord.row * this.info.tileHeight,
    };
  }

  pixelToTileCoord(pixelX: number, pixelY: number, level: number): TileCoord {
    return {
      level,
      col: Math.floor(pixelX / this.info.tileWidth),
      row: Math.floor(pixelY / this.info.tileHeight),
    };
  }

  getVisibleTiles(
    bounds: VisibleBounds,
    level: number
  ): TileCoord[] {
    const cols = this.getColumnsAtLevel(level);
    const rows = this.getRowsAtLevel(level);

    const startCol = Math.max(0, Math.floor(bounds.left / this.info.tileWidth));
    const endCol = Math.min(cols - 1, Math.floor(bounds.right / this.info.tileWidth));
    const startRow = Math.max(0, Math.floor(bounds.top / this.info.tileHeight));
    const endRow = Math.min(rows - 1, Math.floor(bounds.bottom / this.info.tileHeight));

    const tiles: TileCoord[] = [];
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        tiles.push({ level, col, row });
      }
    }

    return tiles;
  }

  getLevelForZoom(zoom: number): number {
    // Higher zoom → higher resolution level
    const level = Math.round(Math.log2(zoom) + this.info.levels - 1);
    return Math.max(0, Math.min(this.info.levels - 1, level));
  }

  static tileKey(coord: TileCoord): string {
    return `${coord.level},${coord.col},${coord.row}`;
  }
}
