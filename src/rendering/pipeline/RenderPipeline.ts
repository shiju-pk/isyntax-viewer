import type { IRenderStage, RenderContext } from './IRenderStage';
import type { IRendererBackend } from '../backends/IRendererBackend';
import type { Camera2D } from '../camera/Camera2D';
import type { ViewportProperties } from '../viewports/types';
import { ImageMapper } from './stages/ImageMapper';
import { VOILUTStage } from './stages/VOILUTStage';
import { ColorMapStage } from './stages/ColorMapStage';
import { CompositorStage } from './stages/CompositorStage';

export class RenderPipeline {
  private stages: IRenderStage[];

  constructor(stages?: IRenderStage[]) {
    this.stages = stages ?? [
      new ImageMapper(),
      new VOILUTStage(),
      new ColorMapStage(),
      new CompositorStage(),
    ];
  }

  getStages(): readonly IRenderStage[] {
    return this.stages;
  }

  addStage(stage: IRenderStage, index?: number): void {
    if (index !== undefined) {
      this.stages.splice(index, 0, stage);
    } else {
      // Insert before compositor (last stage)
      this.stages.splice(this.stages.length - 1, 0, stage);
    }
  }

  removeStage(name: string): void {
    this.stages = this.stages.filter((s) => s.name !== name);
  }

  replaceStage(name: string, replacement: IRenderStage): void {
    const idx = this.stages.findIndex((s) => s.name === name);
    if (idx !== -1) {
      this.stages[idx] = replacement;
    }
  }

  execute(params: {
    viewportId: string;
    camera: Camera2D;
    backend: IRendererBackend;
    canvas: HTMLCanvasElement;
    properties: ViewportProperties;
    imageData: ImageData | null;
  }): void {
    const context: RenderContext = {
      ...params,
      outputImageData: null,
    };

    for (const stage of this.stages) {
      stage.execute(context);
    }
  }
}
