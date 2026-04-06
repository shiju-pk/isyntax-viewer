declare class JpegImage {
  width: number;
  height: number;
  components: { blocksPerLine: number; blocksPerColumn: number }[];
  colorTransform: boolean | undefined;
  parse(data: Uint8Array): void;
  getData(width: number, height: number): Uint8Array;
  getData16(width: number, height: number): Uint16Array;
}

export default JpegImage;
