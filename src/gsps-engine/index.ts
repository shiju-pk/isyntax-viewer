/**
 * gsps-engine — GSPS Presentation State Engine
 *
 * Parses Grayscale Softcopy Presentation State (GSPS) DICOM instances
 * and applies them to viewports: graphic annotations, text annotations,
 * graphic layers, VOI transforms, spatial transforms, and shutters.
 */

// Types
export type {
  GSPSGraphicType,
  GSPSGraphicObject,
  GSPSTextObject,
  GSPSGraphicAnnotation,
  GSPSGraphicLayer,
  GSPSReferencedSeries,
  GSPSVOITransform,
  GSPSSpatialTransform,
  ShutterShape,
  GSPSDisplayShutter,
  ParsedGSPSInstance,
  GSPSApplicationResult,
  GSPSAnnotationEntry,
} from './types';

// Parser
export { parseGSPSInstance, parseGSPSFromXml } from './GSPSParser';

// Annotation processor
export {
  processGraphicAnnotations,
  buildApplicationResult,
} from './GraphicAnnotationProcessor';
