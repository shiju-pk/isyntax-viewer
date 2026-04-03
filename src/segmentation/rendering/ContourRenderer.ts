/**
 * ContourRenderer — renders contour segmentation overlays as SVG paths.
 *
 * Uses the SVGDrawingHelper to draw closed/open contour paths
 * on the SVG overlay, with per-segment colors and visibility.
 */

import type { IViewport } from '../../rendering/viewports/types';
import type { SVGDrawingHelper } from '../../tools/drawing/SVGDrawingHelper';
import { segmentationState } from '../SegmentationState';
import { getSegmentColor } from '../ColorLUT';
import {
  SegmentationRepresentationType,
  type ContourData,
  type ContourPath,
  type SegmentationRepresentation,
} from '../types';
import type { Point2 } from '../../tools/base/types';

export class ContourRenderer {
  /**
   * Render all contour representations for a viewport into the SVG overlay.
   */
  render(viewport: IViewport, svgHelper: SVGDrawingHelper): void {
    const reps = segmentationState.getViewportRepresentations(viewport.id);
    const contourReps = reps.filter(
      r => r.type === SegmentationRepresentationType.Contour && r.visible,
    );

    if (contourReps.length === 0) return;

    for (const rep of contourReps) {
      this._renderSingleContour(viewport, svgHelper, rep);
    }
  }

  private _renderSingleContour(
    viewport: IViewport,
    svgHelper: SVGDrawingHelper,
    rep: SegmentationRepresentation,
  ): void {
    const seg = segmentationState.getSegmentation(rep.segmentationId);
    if (!seg) return;

    const contourData = seg.representationData[SegmentationRepresentationType.Contour];
    if (!contourData) return;

    const camera = viewport.getCamera();
    const imageData = viewport.getImageData();
    if (!imageData) return;

    const cw = viewport.canvas.clientWidth;
    const ch = viewport.canvas.clientHeight;
    const iw = imageData.width;
    const ih = imageData.height;

    for (const [segIdx, paths] of contourData.contours) {
      const segment = seg.segments.get(segIdx);
      if (!segment || !segment.visible) continue;

      const color = getSegmentColor(rep.colorLUTIndex, segIdx);
      const hexColor = `rgb(${color[0]},${color[1]},${color[2]})`;

      for (let pathIdx = 0; pathIdx < paths.length; pathIdx++) {
        const contourPath = paths[pathIdx];
        const groupId = `seg-${rep.segmentationId}-${segIdx}-${pathIdx}`;

        svgHelper.clearGroup(groupId);
        const group = svgHelper.getOrCreateGroup(groupId);

        // Convert world points to canvas points
        const canvasPoints: Point2[] = contourPath.points.map(p => {
          const [cx, cy] = camera.worldToCanvas(p.x, p.y, cw, ch, iw, ih);
          return { x: cx, y: cy };
        });

        if (canvasPoints.length < 2) continue;

        svgHelper.drawPath(group, canvasPoints, contourPath.closed, {
          color: hexColor,
          lineWidth: rep.config.outlineWidth,
        });
      }
    }
  }

  /**
   * Remove all SVG groups for a segmentation from the helper.
   */
  clearSegmentation(svgHelper: SVGDrawingHelper, segmentationId: string): void {
    // Groups are named `seg-{segId}-{segIdx}-{pathIdx}`, so we clear by prefix.
    // SVGDrawingHelper doesn't have prefix clearing, so we clear them one by one.
    // This is called during cleanup.
    const seg = segmentationState.getSegmentation(segmentationId);
    if (!seg) return;

    const contourData = seg.representationData[SegmentationRepresentationType.Contour];
    if (!contourData) return;

    for (const [segIdx, paths] of contourData.contours) {
      for (let pathIdx = 0; pathIdx < paths.length; pathIdx++) {
        svgHelper.removeGroup(`seg-${segmentationId}-${segIdx}-${pathIdx}`);
      }
    }
  }
}
