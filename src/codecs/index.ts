// Codecs layer — image decode/encode
export { RiceAndSnakeDecoder } from './isyntax/RiceAndSnakeDecoder';
export { RiceDecoder } from './isyntax/RiceDecoder';

// Multi-decoder interface and registry
export type { IPixelDecoder, DecodeInfo, DecodedPixels } from './IPixelDecoder';
export { DecoderRegistry } from './DecoderRegistry';

// Concrete decoders
export { ISyntaxPixelDecoder } from './isyntax/ISyntaxPixelDecoder';
export { JPEGPixelDecoder } from './jpeg/JPEGPixelDecoder';
export { JPEG2000PixelDecoder } from './jpeg2000/JPEG2000PixelDecoder';

// Signature detection
export { detectStreamCodec } from './signatureDetector';
export type { StreamCodec, SignatureResult } from './signatureDetector';
