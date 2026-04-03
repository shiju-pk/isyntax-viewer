import { useRef, useEffect } from 'react';
import {
  RenderingEngine,
  ViewportType,
} from '../../../rendering';
import type { IViewport } from '../../../rendering';
import type { ICanvasController } from '../../../core/interfaces';
import type { InteractionMode } from '../../../core/types';
import {
  ToolGroup,
  registerToolClass,
  MouseToolEventDispatcher,
  SVGDrawingHelper,
  MouseButton,
  NewPanTool,
  NewZoomTool,
  NewWindowLevelTool,
  LengthTool,
  AngleTool,
  EllipticalROITool,
  RectangleROITool,
  ArrowAnnotateTool,
  ProbeTool,
  annotationManager,
} from '../../../tools';
import type { AnnotationTool } from '../../../tools/base/AnnotationTool';
import {
  BrushTool,
  EraserTool,
  ThresholdBrushTool,
  ScissorsTool,
  FloodFillTool,
  LabelmapRenderer,
  ContourRenderer,
  segmentationState,
} from '../../../segmentation';

interface MainImageProps {
  imageData: ImageData | null;
  mode: InteractionMode;
  onControllerReady?: (controller: ICanvasController) => void;
}

const VIEWPORT_ID = 'main-viewport';

// Register all tool classes (once)
const _registered = (() => {
  registerToolClass(NewPanTool);
  registerToolClass(NewZoomTool);
  registerToolClass(NewWindowLevelTool);
  registerToolClass(LengthTool);
  registerToolClass(AngleTool);
  registerToolClass(EllipticalROITool);
  registerToolClass(RectangleROITool);
  registerToolClass(ArrowAnnotateTool);
  registerToolClass(ProbeTool);
  registerToolClass(BrushTool);
  registerToolClass(EraserTool);
  registerToolClass(ThresholdBrushTool);
  registerToolClass(ScissorsTool);
  registerToolClass(FloodFillTool);
  return true;
})();

const MODE_TO_TOOL_NAME: Record<InteractionMode, string> = {
  pan: 'Pan',
  zoom: 'Zoom',
  windowLevel: 'WindowLevel',
  length: 'Length',
  angle: 'Angle',
  ellipticalROI: 'EllipticalROI',
  rectangleROI: 'RectangleROI',
  arrowAnnotate: 'ArrowAnnotate',
  probe: 'Probe',
  brush: 'Brush',
  eraser: 'Eraser',
  thresholdBrush: 'ThresholdBrush',
  scissors: 'Scissors',
  floodFill: 'FloodFill',
};

export default function MainImage({ imageData, mode, onControllerReady }: MainImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RenderingEngine | null>(null);
  const toolGroupRef = useRef<ToolGroup | null>(null);
  const dispatcherRef = useRef<MouseToolEventDispatcher | null>(null);
  const svgHelperRef = useRef<SVGDrawingHelper | null>(null);
  const labelmapRendererRef = useRef<LabelmapRenderer | null>(null);
  const contourRendererRef = useRef<ContourRenderer | null>(null);

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

    // Set up new ToolGroup-based system
    const toolGroup = new ToolGroup('main-tools');
    toolGroupRef.current = toolGroup;

    // Add all tools
    for (const toolName of Object.values(MODE_TO_TOOL_NAME)) {
      toolGroup.addTool(toolName);
    }

    if (viewport) {
      toolGroup.setViewportRef({
        viewport,
        element: viewport.element,
        canvas: viewport.canvas,
      });

      // Activate the current mode's tool
      const toolName = MODE_TO_TOOL_NAME[mode];
      toolGroup.setToolActive(toolName, [{ mouseButton: MouseButton.Primary }]);

      // Event dispatcher
      const dispatcher = new MouseToolEventDispatcher(toolGroup);
      dispatcherRef.current = dispatcher;
      dispatcher.attach(viewport);
      dispatcher.updateCursor();

      // SVG overlay for annotations and contour segmentations
      const svgHelper = new SVGDrawingHelper(containerRef.current!);
      svgHelperRef.current = svgHelper;

      // Segmentation renderers
      const labelmapRenderer = new LabelmapRenderer();
      labelmapRendererRef.current = labelmapRenderer;
      const contourRenderer = new ContourRenderer();
      contourRendererRef.current = contourRenderer;

      // Render annotations and segmentations after each viewport render
      const renderOverlays = () => {
        // Annotations (SVG)
        const allAnnotations = annotationManager.getAllAnnotationsForImage();
        for (const ann of allAnnotations) {
          const tool = toolGroup.getToolInstance(ann.metadata.toolName);
          if (tool && 'renderAnnotation' in tool) {
            (tool as AnnotationTool).renderAnnotation(svgHelper, ann);
          }
        }

        // Segmentation labelmap (canvas overlay)
        labelmapRenderer.render(viewport!);

        // Segmentation contours (SVG)
        contourRenderer.render(viewport!, svgHelper);
      };

      // Hook into the rendering engine's render event
      engine.onAfterRender(() => renderOverlays());
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
          const name = MODE_TO_TOOL_NAME[m];
          if (name && toolGroupRef.current) {
            toolGroupRef.current.setToolActive(name, [{ mouseButton: MouseButton.Primary }]);
            dispatcherRef.current?.updateCursor();
          }
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
        dispose: () => { },
      };
      onControllerReady(shim);
    }

    return () => {
      dispatcherRef.current?.detach();
      dispatcherRef.current = null;
      svgHelperRef.current?.dispose();
      svgHelperRef.current = null;
      labelmapRendererRef.current?.dispose();
      labelmapRendererRef.current = null;
      contourRendererRef.current = null;
      toolGroupRef.current?.destroy();
      toolGroupRef.current = null;
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
    const toolGroup = toolGroupRef.current;
    if (!toolGroup) return;

    const toolName = MODE_TO_TOOL_NAME[mode];
    if (toolName) {
      toolGroup.setToolActive(toolName, [{ mouseButton: MouseButton.Primary }]);
      dispatcherRef.current?.updateCursor();
    }
  }, [mode]);

  // Observe container resizes
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
