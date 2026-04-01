import { useRef, useEffect } from 'react';
import {
  RenderingEngine,
  ViewportType,
} from '../../../rendering';
import type { IViewport } from '../../../rendering';
import type { ICanvasController } from '../../../core/interfaces';
import type { InteractionMode } from '../../../core/types';
import {
  InteractionDispatcher,
  PanTool,
  ZoomTool,
  WindowLevelTool,
} from '../../../tools';
interface MainImageProps {
  imageData: ImageData | null;
  mode: InteractionMode;
  onControllerReady?: (controller: ICanvasController) => void;
}

const VIEWPORT_ID = 'main-viewport';

const toolInstances = {
  pan: new PanTool(),
  zoom: new ZoomTool(),
  windowLevel: new WindowLevelTool(),
};

function modeToTool(mode: InteractionMode) {
  switch (mode) {
    case 'pan':
      return toolInstances.pan;
    case 'zoom':
      return toolInstances.zoom;
    case 'windowLevel':
      return toolInstances.windowLevel;
    default:
      return toolInstances.pan;
  }
}

export default function MainImage({ imageData, mode, onControllerReady }: MainImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RenderingEngine | null>(null);
  const dispatcherRef = useRef<InteractionDispatcher | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new RenderingEngine('main-engine');
    engineRef.current = engine;

    engine.enableElement({
      viewportId: VIEWPORT_ID,
      type: ViewportType.STACK,
      element: containerRef.current,
    });

    const viewport = engine.getViewport(VIEWPORT_ID);

    // Set up interaction dispatcher
    const dispatcher = new InteractionDispatcher();
    dispatcherRef.current = dispatcher;
    if (viewport) {
      dispatcher.attach(viewport);
      dispatcher.setActiveTool(modeToTool(mode));
    }

    // Provide backward-compatible ICanvasController shim
    if (onControllerReady && viewport) {
      const shim: ICanvasController = {
        render: () => engine.renderViewport(VIEWPORT_ID),
        setImageData: (data: ImageData) => {
          viewport.setImageData(data);
          engine.renderViewport(VIEWPORT_ID);
        },
        setMode: (m: InteractionMode) => {
          dispatcher.setActiveTool(modeToTool(m));
        },
        getMode: () => mode,
        reset: () => {
          viewport.resetCamera();
          engine.renderViewport(VIEWPORT_ID);
        },
        getViewportState: () => {
          const cam = viewport.getCamera().getState();
          const props = viewport.getProperties();
          return {
            panX: cam.panX,
            panY: cam.panY,
            zoom: cam.zoom,
            windowCenter: props.windowCenter ?? 128,
            windowWidth: props.windowWidth ?? 256,
          };
        },
        dispose: () => {
          // handled by cleanup
        },
      };
      onControllerReady(shim);
    }

    return () => {
      dispatcher.detach();
      dispatcherRef.current = null;
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Update image data when it changes
  useEffect(() => {
    if (!engineRef.current) return;
    const viewport = engineRef.current.getViewport(VIEWPORT_ID);
    if (viewport && imageData) {
      viewport.setImageData(imageData);
      engineRef.current.renderViewport(VIEWPORT_ID);
    }
  }, [imageData]);

  // Update active tool when mode changes
  useEffect(() => {
    if (dispatcherRef.current) {
      dispatcherRef.current.setActiveTool(modeToTool(mode));
    }
  }, [mode]);

  // Observe container resizes (panel drags, window resize, layout shifts)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (engineRef.current) {
        engineRef.current.resize();
      }
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full block rounded-lg"
    />
  );
}
