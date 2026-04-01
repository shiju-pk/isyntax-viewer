export interface TileCoord {
  level: number;
  col: number;
  row: number;
}

export enum TileState {
  PENDING = 'pending',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error',
}

export interface Tile {
  coord: TileCoord;
  state: TileState;
  imageData: ImageData | null;
  pixelX: number;
  pixelY: number;
  width: number;
  height: number;
}

export interface TileRequest {
  coord: TileCoord;
  priority: number;
}

export interface TileGridInfo {
  imageWidth: number;
  imageHeight: number;
  tileWidth: number;
  tileHeight: number;
  levels: number;
}

export interface VisibleBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
