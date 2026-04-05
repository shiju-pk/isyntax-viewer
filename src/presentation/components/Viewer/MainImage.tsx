import { useRef, useEffect } from 'react';
import {
  RenderingEngine,
  ViewportType,
  eventBus,
  RenderingEvents,
  OverlayCompositorStage,
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
  RotateTool,
  LengthTool,
  AngleTool,
  EllipticalROITool,
  RectangleROITool,
  ArrowAnnotateTool,
  ProbeTool,
  CircleTool,
  FreehandTool,
  TextAnnotationTool,
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
  SegmentationRepresentationType,
} from '../../../segmentation';
import type { OverlayGroup } from '../../../overlay-engine/types';

interface MainImageProps {
  imageData: ImageData | null;
  mode: InteractionMode;
  /** Instance UID of the currently displayed image — scopes annotations per image. */
  imageId?: string;
  onControllerReady?: (controller: ICanvasController) => void;
  /** Parsed DICOM 6000 overlay group — composited in the render pipeline after VOI/LUT. */
  overlayGroup?: OverlayGroup | null;
}

const VIEWPORT_ID = 'main-viewport';

// Register all tool classes (once)
const _registered = (() => {
  registerToolClass(NewPanTool);
  registerToolClass(NewZoomTool);
  registerToolClass(NewWindowLevelTool);
  registerToolClass(RotateTool);
  registerToolClass(LengthTool);
  registerToolClass(AngleTool);
  registerToolClass(EllipticalROITool);
  registerToolClass(RectangleROITool);
  registerToolClass(ArrowAnnotateTool);
  registerToolClass(ProbeTool);
  registerToolClass(CircleTool);
  registerToolClass(FreehandTool);
  registerToolClass(TextAnnotationTool);
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
  rotate: 'Rotate',
  length: 'Length',
  angle: 'Angle',
  ellipticalROI: 'EllipticalROI',
  rectangleROI: 'RectangleROI',
  arrowAnnotate: 'ArrowAnnotate',
  probe: 'Probe',
  circle: 'Circle',
  freehand: 'Freehand',
  textAnnotation: 'TextAnnotation',
  brush: 'Brush',
  eraser: 'Eraser',
  thresholdBrush: 'ThresholdBrush',
  scissors: 'Scissors',
  floodFill: 'FloodFill',
};

const SEGMENTATION_MODES: Set<InteractionMode> = new Set([
  'brush', 'eraser', 'thresholdBrush', 'scissors', 'floodFill',
]);

export default function MainImage({ imageData, mode, imageId, onControllerReady, overlayGroup }: MainImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RenderingEngine | null>(null);
  const toolGroupRef = useRef<ToolGroup | null>(null);
  const dispatcherRef = useRef<MouseToolEventDispatcher | null>(null);
  const svgHelperRef = useRef<SVGDrawingHelper | null>(null);
  const labelmapRendererRef = useRef<LabelmapRenderer | null>(null);
  const contourRendererRef = useRef<ContourRenderer | null>(null);
  const overlayStageRef = useRef<OverlayCompositorStage | null>(null);
  const imageIdRef = useRef<string>(imageId ?? '');
  const modeRef = useRef<InteractionMode>(mode);
  modeRef.current = mode;
  /** Tracks the labelmap segmentation ID per imageId */
  const segIdMapRef = useRef<Map<string, string>>(new Map());

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
        imageId: imageIdRef.current,
        triggerRender: () => engine.renderViewport(VIEWPORT_ID),
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
        // Clear previous SVG content before redrawing
        svgHelper.clearAll();

        // Annotations (SVG) — filtered by current imageId
        const currentImageId = imageIdRef.current || undefined;
        const allAnnotations = annotationManager.getAllAnnotationsForImage(currentImageId);
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

      // Add OverlayCompositorStage to the pipeline (after VOI/LUT, before final compositing)
      const overlayStage = new OverlayCompositorStage();
      overlayStageRef.current = overlayStage;
      (viewport as import('../../../rendering').Viewport).addPipelineStage(overlayStage);
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
        getMode: () => modeRef.current,
        reset: () => {
          viewport.resetCamera();
          eventBus.emit(RenderingEvents.CAMERA_MODIFIED, {
            viewportId: viewport.id,
            camera: viewport.getCamera().getState(),
          });
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
        flipHorizontal: () => {
          const camera = viewport.getCamera();
          camera.flipHorizontal();
          eventBus.emit(RenderingEvents.CAMERA_MODIFIED, {
            viewportId: viewport.id,
            camera: camera.getState(),
          });
          engine.renderViewport(VIEWPORT_ID);
        },
        flipVertical: () => {
          const camera = viewport.getCamera();
          camera.flipVertical();
          eventBus.emit(RenderingEvents.CAMERA_MODIFIED, {
            viewportId: viewport.id,
            camera: camera.getState(),
          });
          engine.renderViewport(VIEWPORT_ID);
        },
        rotateRight90: () => {
          const camera = viewport.getCamera();
          camera.rotate(90);
          eventBus.emit(RenderingEvents.CAMERA_MODIFIED, {
            viewportId: viewport.id,
            camera: camera.getState(),
          });
          engine.renderViewport(VIEWPORT_ID);
        },
        getCameraOrientation: () => {
          const cam = viewport.getCamera().getState();
          return { rotation: cam.rotation, flipH: cam.flipH, flipV: cam.flipV };
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
      overlayStageRef.current = null;
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

  // Update overlay stage when overlay group changes
  useEffect(() => {
    const stage = overlayStageRef.current;
    if (!stage) return;
    stage.setOverlayGroup(overlayGroup ?? null);
    stage.setEnabled(!!overlayGroup);
    // Re-render so the overlay is composited
    if (engineRef.current) {
      engineRef.current.renderViewport(VIEWPORT_ID);
    }
  }, [overlayGroup]);

  // Update imageId ref and viewport ref when the displayed image changes
  useEffect(() => {
    imageIdRef.current = imageId ?? '';

    const toolGroup = toolGroupRef.current;
    const engine = engineRef.current;
    if (!toolGroup || !engine) return;

    const viewport = engine.getViewport(VIEWPORT_ID);
    if (viewport) {
      toolGroup.setViewportRef({
        viewport,
        element: viewport.element,
        canvas: viewport.canvas,
        imageId: imageIdRef.current,
        triggerRender: () => engine.renderViewport(VIEWPORT_ID),
      });
    }

    // Clear SVG overlays when switching images — new image will re-render its own annotations
    svgHelperRef.current?.clearAll();
  }, [imageId]);

  // Update active tool when mode changes
  useEffect(() => {
    const toolGroup = toolGroupRef.current;
    if (!toolGroup) return;

    const toolName = MODE_TO_TOOL_NAME[mode];
    if (toolName) {
      toolGroup.setToolActive(toolName, [{ mouseButton: MouseButton.Primary }]);
      dispatcherRef.current?.updateCursor();
    }

    // Auto-create & bind labelmap when a segmentation tool is activated
    if (SEGMENTATION_MODES.has(mode) && imageData && imageIdRef.current) {
      const currentImgId = imageIdRef.current;
      let segId = segIdMapRef.current.get(currentImgId);

      if (!segId) {
        // Create a new labelmap sized to the current image
        const seg = segmentationState.createLabelmap(imageData.width, imageData.height, {
          imageId: currentImgId,
          label: `Segmentation (${currentImgId.slice(-8)})`,
        });
        segId = seg.segmentationId;
        segIdMapRef.current.set(currentImgId, segId);

        // Bind representation to the viewport
        segmentationState.addRepresentationToViewport(
          VIEWPORT_ID,
          segId,
          SegmentationRepresentationType.Labelmap,
        );
      }

      // Set the segmentationId on ALL segmentation tools so they know where to paint
      for (const segMode of SEGMENTATION_MODES) {
        const segToolName = MODE_TO_TOOL_NAME[segMode];
        const segToolInstance = toolGroup.getToolInstance(segToolName);
        if (segToolInstance && 'segmentationId' in segToolInstance) {
          (segToolInstance as BrushTool).segmentationId = segId;
        }
      }
    }
  }, [mode, imageData]);

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
      tabIndex={0}
      role="img"
      aria-label="Medical image viewport"
      className="w-full h-full block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    />
  );
}
