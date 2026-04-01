import type { IRenderStage, RenderContext } from '../IRenderStage';

export class ColorMapStage implements IRenderStage {
  readonly name = 'ColorMapStage';

  execute(context: RenderContext): void {
    // Stub: pseudo-color / palette LUT application.
    // Will be implemented when colormap support is needed.
    // For now, pass through unchanged.
    if (!context.outputImageData && context.imageData) {
      context.outputImageData = context.imageData;
    }
  }
}
