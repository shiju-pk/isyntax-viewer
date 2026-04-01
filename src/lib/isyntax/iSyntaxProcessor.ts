import { ResponseType, type ServerResponse } from './serverResponse';
import type { InitImageResponse } from './initImageResponse';
import type { ZoomLevelView } from './zoomLevelView';
import { ISyntaxImage } from './iSyntaxImage';
import { RiceAndSnakeDecoder } from './riceAndSnakeDecoder';
import type { GetCoefficientsResponse } from './getCoefficientsResponse';
import { RiceDecoder } from './riceDecoder';
import { InitImageResponseParser } from './initImageResponseParser';
import { GetCoefficientsResponseParser } from './getCoefficientsResponseParser';
import { ISyntaxInvertor } from './iSyntaxInverter';

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
    let zlv;
    if (!(zlv = this._iSyntaxImage.getZoomLevelView(iir.xformLevels))) {
      zlv = this._iSyntaxImage.createZoomLevelView(iir.xformLevels);
    }
    RiceAndSnakeDecoder.decode(iir, zlv, this._iSyntaxImage);
    return zlv;
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
