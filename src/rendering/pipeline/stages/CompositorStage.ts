import type { IRenderStage, RenderContext } from '../IRenderStage';

export class CompositorStage implements IRenderStage {
  readonly name = 'CompositorStage';

  execute(context: RenderContext): void {
    const imgData = context.outputImageData;
    if (!imgData) return;

    const displayWidth = context.canvas.clientWidth;
    const displayHeight = context.canvas.clientHeight;

    context.backend.clear([0, 0, 0]);

    const transform = context.camera.computeTransform(
      displayWidth,
      displayHeight,
      imgData.width,
      imgData.height
    );

    context.backend.drawImage(imgData, transform, imgData.width, imgData.height);
  }
}
