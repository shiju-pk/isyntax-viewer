/**
 * DICOM overlay descriptor — describes one overlay plane (60xx group).
 */
export interface OverlayDescriptor {
  /** Overlay group index (0–15, mapping to DICOM groups 6000–601E) */
  groupIndex: number;
  rows: number;
  columns: number;
  originRow: number;
  originColumn: number;
  bitsAllocated: number;
  bitPosition: number;
  type: 'G' | 'R'; // Graphics or ROI
  label?: string;
  description?: string;
  /** Reference to the SOP Instance containing the overlay data */
  referencedInstanceUID?: string;
}
