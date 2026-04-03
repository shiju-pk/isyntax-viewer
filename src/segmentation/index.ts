// Segmentation module barrel export

// Types
export {
  SegmentationRepresentationType,
  SegmentationEvents,
  DEFAULT_SEGMENTATION_DISPLAY_CONFIG,
  DEFAULT_BRUSH_CONFIG,
} from './types';
export type {
  Segmentation,
  Segment,
  LabelmapData,
  ContourData,
  ContourPath,
  SegmentationRepresentation,
  SegmentationDisplayConfig,
  BrushConfiguration,
  ThresholdConfiguration,
  ColorRGBA,
  ColorLUT,
} from './types';

// State management
export {
  segmentationState,
  generateSegmentationUID,
} from './SegmentationState';

// Color LUT
export {
  DEFAULT_COLOR_LUT,
  addColorLUT,
  getColorLUT,
  removeColorLUT,
  getSegmentColor,
  setSegmentColor,
} from './ColorLUT';

// Rendering
export { LabelmapRenderer } from './rendering/LabelmapRenderer';
export { ContourRenderer } from './rendering/ContourRenderer';

// Tools
export { BrushTool } from './tools/BrushTool';
export { EraserTool } from './tools/EraserTool';
export { ThresholdBrushTool } from './tools/ThresholdBrushTool';
export { ScissorsTool } from './tools/ScissorsTool';
export { FloodFillTool } from './tools/FloodFillTool';
