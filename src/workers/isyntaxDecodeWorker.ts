/**
 * iSyntax decode worker — runs in a WebWorker thread.
 * Handles InitImage and GetCoefficients decoding off the main thread.
 * Transfers decoded pixel data back via zero-copy Transferable.
 *
 * Each imageKey gets its own ISyntaxImage + ISyntaxProcessor state,
 * so multiple images can be decoded concurrently.
 *
 * Supports iSyntax (wavelet), JPEG, and JPEG 2000 formats.
 */

import { ISyntaxImage } from '../imaging/model/ISyntaxImage';
import { ISyntaxProcessor } from '../imaging/processing/ISyntaxProcessor';
import { ServerResponse, ResponseType } from '../parsers/isyntax/ServerResponse';
import { InitImageResponseParser } from '../parsers/isyntax/InitImageResponseParser';
import { CodecConstants } from '../core/constants';
import type { IImageFrame } from '../core/types';

interface ProcessorState {
  image: ISyntaxImage;
  processor: ISyntaxProcessor;
  totalLevels: number;
}

/** Per-image processor state — survives across multiple decode calls */
const processorMap = new Map<string, ProcessorState>();

function getOrCreateState(imageKey: string, rows: number, cols: number): ProcessorState {
  let state = processorMap.get(imageKey);
  if (!state) {
    const frame: IImageFrame = { rows, columns: cols, imageId: imageKey };
    const image = new ISyntaxImage(frame);
    const processor = new ISyntaxProcessor(image);
    state = { image, processor, totalLevels: 0 };
    processorMap.set(imageKey, state);
  }
  return state;
}

self.onmessage = (e: MessageEvent) => {
  const { taskId, type, buffer, level, imageKey, rows = 512, cols = 512 } = e.data;

  handleMessage(taskId, type, buffer, level, imageKey, rows, cols).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    (self as unknown as Worker).postMessage({ taskId, error: message });
  });
};

async function handleMessage(
  taskId: string,
  type: string,
  buffer: ArrayBuffer,
  level: number,
  imageKey: string,
  rows: number,
  cols: number,
): Promise<void> {
  const uint8Array = new Uint8Array(buffer);
  const fmt = CodecConstants.instance.ImageFormat;

  if (type === 'initImage') {
    // Parse header first to get actual dimensions and format
    const iir = InitImageResponseParser.parse(uint8Array);

    // Create state with actual server dimensions
    const state = getOrCreateState(imageKey, iir.rows, iir.cols);

    // Re-init with correct dimensions from server
    const frame: IImageFrame = { rows: iir.rows, columns: iir.cols, imageId: imageKey };
    state.image = new ISyntaxImage(frame);
    state.processor = new ISyntaxProcessor(state.image);
    state.totalLevels = iir.xformLevels;

    // eslint-disable-next-line no-console
    console.log(`[Worker] initImage: imageKey=${imageKey}, format=${iir.format}, xformLevels=${iir.xformLevels}, rows=${iir.rows}, cols=${iir.cols}, isJPEG=${fmt.isJPEGFormat(iir.format)}`);

    if (fmt.isJPEGFormat(iir.format)) {
      // ---- JPEG / J2K async path ----
      // ProcessInitImageResponse sets up the image model
      const serverResponse = new ServerResponse(ResponseType.InitImage, 0, uint8Array);
      state.processor.ComputeZoomLevelView(serverResponse, 0);

      // Async WASM decode
      const decoded = await state.processor.ProcessInitImageResponseAsync(iir);

      const resultBuffer = (decoded.pixelData as Uint8Array).buffer.slice(
        (decoded.pixelData as Uint8Array).byteOffset,
        (decoded.pixelData as Uint8Array).byteOffset + (decoded.pixelData as Uint8Array).byteLength
      );

      const result = {
        pixelData: resultBuffer,
        pixelLevel: 0,
        rows: decoded.rows,
        cols: decoded.cols,
        planes: decoded.planes,
        format: iir.format,
        bytesPerPixel: decoded.bytesPerPixel,
        xformLevels: 0,
        isJPEG: true,
      };

      (self as unknown as Worker).postMessage({ taskId, result }, [resultBuffer]);
    } else {
      // ---- iSyntax wavelet path (unchanged) ----
      const serverResponse = new ServerResponse(ResponseType.InitImage, iir.xformLevels, uint8Array);
      const zlv = state.processor.ComputeZoomLevelView(serverResponse, iir.xformLevels);

      const llData = zlv.getFullLevelLL();
      if (!llData) throw new Error('No decoded data from InitImage');

      const resultBuffer = llData.buffer.slice(
        llData.byteOffset,
        llData.byteOffset + llData.byteLength
      );

      const result = {
        pixelData: resultBuffer,
        pixelLevel: zlv.pixelLevel,
        rows: zlv.levelRows,
        cols: zlv.levelColumns,
        planes: zlv.planes,
        format: state.image.getImageFormat() || 'MONO',
        bytesPerPixel: state.image.bytesPerPixel,
        xformLevels: iir.xformLevels,
      };

      (self as unknown as Worker).postMessage({ taskId, result }, [resultBuffer]);
    }

  } else if (type === 'coefficients') {
    const state = processorMap.get(imageKey);
    if (!state) throw new Error(`No processor state for imageKey "${imageKey}". Call initImage first.`);

    // eslint-disable-next-line no-console
    console.log(`[Worker] coefficients: imageKey=${imageKey}, level=${level}, totalLevels=${state.totalLevels}, bufferSize=${uint8Array.byteLength}`);

    const serverResponse = new ServerResponse(ResponseType.GetCoefficients, level, uint8Array);
    const zlv = state.processor.ComputeZoomLevelView(serverResponse, level);

    // eslint-disable-next-line no-console
    console.log(`[Worker] after ComputeZoomLevelView: pixelLevel=${zlv.pixelLevel}, hasLL=${zlv.hasFullLevelLL()}, hasHigh=${zlv.hasFullLevelHighCoefficients()}, hasFullLevel=${zlv.hasFullLevel()}`);

    const llData = zlv.getFullLevelLL();
    if (!llData) throw new Error(`No decoded data for level ${level}`);

    const resultBuffer = llData.buffer.slice(
      llData.byteOffset,
      llData.byteOffset + llData.byteLength
    );

    const result = {
      pixelData: resultBuffer,
      pixelLevel: zlv.pixelLevel,
      rows: zlv.levelRows,
      cols: zlv.levelColumns,
      planes: zlv.planes,
      format: state.image.getImageFormat() || 'MONO',
      bytesPerPixel: state.image.bytesPerPixel,
    };

    (self as unknown as Worker).postMessage({ taskId, result }, [resultBuffer]);

  } else {
    throw new Error(`Unknown task type: ${type}`);
  }
}
