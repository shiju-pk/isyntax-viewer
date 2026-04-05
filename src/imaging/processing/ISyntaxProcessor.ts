import { ResponseType, type ServerResponse } from '../../parsers/isyntax/ServerResponse';
import type { InitImageResponse } from '../../parsers/isyntax/InitImageResponse';
import type { ZoomLevelView } from '../model/ZoomLevelView';
import { ISyntaxImage } from '../model/ISyntaxImage';
import { RiceAndSnakeDecoder } from '../../codecs/isyntax/RiceAndSnakeDecoder';
import type { GetCoefficientsResponse } from '../../parsers/isyntax/GetCoefficientsResponse';
import { RiceDecoder } from '../../codecs/isyntax/RiceDecoder';
import { InitImageResponseParser } from '../../parsers/isyntax/InitImageResponseParser';
import { GetCoefficientsResponseParser } from '../../parsers/isyntax/GetCoefficientsResponseParser';
import { ISyntaxInvertor } from './ISyntaxInverter';
import { CodecConstants } from '../../core/constants';
import { DecoderRegistry } from '../../codecs/DecoderRegistry';
import type { DecodeInfo } from '../../codecs/IPixelDecoder';
import { detectStreamCodec } from '../../codecs/signatureDetector';

class ISyntaxProcessor {
  private _iSyntaxImage: ISyntaxImage;
  constructor(iSyntaxImage: ISyntaxImage) {
    this._iSyntaxImage = iSyntaxImage;
  }
  ProcessInitImageResponse(
    serverResponse: ServerResponse,
    serverResponsePixelLevel: number,
    iir: InitImageResponse
  ): ZoomLevelView {
    if (iir.version < ISyntaxImage.STENTOR_DTSIMAGE_VERSION3_0) {
      throw new Error('Unsupported version');
    }
    this._iSyntaxImage.initializeFromIIR(iir);

    const fmt = CodecConstants.instance.ImageFormat;

    if (fmt.isJPEGFormat(iir.format)) {
      // JPEG / J2K: create a zlv at level 0 — decode happens async via
      // ProcessInitImageResponseAsync.  The zlv is returned empty here;
      // the caller must await the async path for decoded pixel data.
      let zlv;
      if (!(zlv = this._iSyntaxImage.getZoomLevelView(0))) {
        zlv = this._iSyntaxImage.createZoomLevelView(0);
      }
      return zlv;
    }

    // iSyntax wavelet path
    let zlv;
    if (!(zlv = this._iSyntaxImage.getZoomLevelView(iir.xformLevels))) {
      zlv = this._iSyntaxImage.createZoomLevelView(iir.xformLevels);
    }

    // Guard: server can return an empty InitImage (dataLength=0, rows=0)
    // for instances without pixel data (e.g. label/macro/overview).
    if (iir.dataLength <= 0 || iir.rows <= 0 || iir.cols <= 0) {
      throw new Error(
        `Empty InitImage response: rows=${iir.rows}, cols=${iir.cols}, ` +
        `dataLength=${iir.dataLength}. Instance may not have iSyntax pixel data.`
      );
    }

    RiceAndSnakeDecoder.decode(iir, zlv, this._iSyntaxImage);
    return zlv;
  }

  /**
   * Async decode path for JPEG / JPEG 2000 InitImage responses.
   * Returns raw decoded pixel data via the WASM decoder.
   */
  async ProcessInitImageResponseAsync(
    iir: InitImageResponse
  ): Promise<{ pixelData: Uint8Array | Int8Array | Uint16Array | Int16Array; rows: number; cols: number; planes: number; bytesPerPixel: number }> {
    if (!iir.compressedPartition || iir.compressedPartitionLength === 0) {
      throw new Error('No compressed partition in InitImage response for JPEG/J2K format');
    }

    const fmt = CodecConstants.instance.ImageFormat;

    // Signature-based codec detection (mirrors C++ ScaledGenericDecode):
    // The header format field gives us JPEG_RGB/JPEG_MONO or J2K_RGB/J2K_MONO,
    // but the actual compressed bytes may have a different signature.
    // Trust the signature over the header when detected.
    let resolvedFormat = iir.format;
    let compressedData = iir.compressedPartition;
    const sig = detectStreamCodec(iir.compressedPartition);

    if (sig.codec !== 'unknown') {
      const isColor = fmt.isColor(iir.format);
      if (sig.codec === 'jpeg') {
        resolvedFormat = isColor ? fmt.JPEG_RGB : fmt.JPEG_MONO;
      } else {
        resolvedFormat = isColor ? fmt.J2K_RGB : fmt.J2K_MONO;
      }
      // Strip leading zero-padding if the signature was found at an offset
      if (sig.dataOffset > 0) {
        compressedData = iir.compressedPartition.subarray(
          sig.dataOffset,
          sig.dataOffset + sig.dataLength,
        );
      }
    }

    const decoder = DecoderRegistry.getDecoder(resolvedFormat);
    if (!decoder) {
      throw new Error(`No decoder registered for format: ${resolvedFormat}`);
    }

    await decoder.initialize();

    const info: DecodeInfo = {
      format: resolvedFormat,
      rows: iir.rows,
      cols: iir.cols,
      bitsPerPixel: 8,
      signed: false,
    };

    const decoded = await decoder.decode(compressedData, info);
    return decoded;
  }

  ProcessGetCoefficientsResponse(
    serverResponse: ServerResponse,
    serverResponsePixelLevel: number,
    gcr: GetCoefficientsResponse
  ): ZoomLevelView {
    let zlv;
    if (
      !(zlv = this._iSyntaxImage.getZoomLevelView(serverResponsePixelLevel))
    ) {
      zlv = this._iSyntaxImage.createZoomLevelView(serverResponsePixelLevel);
    }
    RiceDecoder.decode(gcr, zlv, this._iSyntaxImage);
    return zlv;
  }

  ComputeZoomLevelView(
    serverResponse: ServerResponse,
    serverResponsePixelLevel: number
  ): ZoomLevelView {
    let zlv;
    switch (serverResponse.type) {
      case ResponseType.InitImage: {
        if (!serverResponse.response) {
          throw new Error('serverResponse.response is null');
        }
        const iir = InitImageResponseParser.parse(serverResponse.response);
        zlv = this.ProcessInitImageResponse(
          serverResponse,
          serverResponsePixelLevel,
          iir
        );
        break;
      }
      case ResponseType.GetCoefficients: {
        if (!serverResponse.response) {
          throw new Error('serverResponse.response is null');
        }
        const gcr = GetCoefficientsResponseParser.parse(
          serverResponse.response
        );
        zlv = this.ProcessGetCoefficientsResponse(
          serverResponse,
          serverResponsePixelLevel,
          gcr
        );
        break;
      }
      default:
        throw new Error('Unsupported response type');
    }
    if (zlv.hasFullLevel() && serverResponsePixelLevel) {
      zlv = ISyntaxInvertor.InvertISyntax(
        this._iSyntaxImage,
        serverResponsePixelLevel
      );
    }

    return zlv;
  }
}

export { ISyntaxProcessor };
