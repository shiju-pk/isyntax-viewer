/**
 * GSPSParser — Parses GSPS DICOM instances into structured data.
 *
 * Handles both standard DICOM GSPS (XML attributes) and embedded iSitePS.
 * Extracts graphic annotations, text annotations, graphic layers,
 * referenced images/series, VOI transforms, spatial transforms, and shutters.
 *
 * Ported from legacy `gspsreader.js`, `graphicannotationprocessor.js`,
 * `graphiclayerprocessor.js`, `referencedseriesprocessor.js` without
 * jQuery/Dojo dependencies.
 */

import type {
  ParsedGSPSInstance,
  GSPSGraphicAnnotation,
  GSPSGraphicObject,
  GSPSTextObject,
  GSPSGraphicLayer,
  GSPSReferencedSeries,
  GSPSVOITransform,
  GSPSSpatialTransform,
  GSPSDisplayShutter,
  GSPSGraphicType,
  ShutterShape,
} from './types';

// ---------------------------------------------------------------------------
// DICOM tag constants used in GSPS parsing
// ---------------------------------------------------------------------------

const GSPS_TAGS = {
  // Graphic Annotation Module
  GraphicAnnotationSequence: '00700001',
  GraphicLayer: '00700002',
  TextObjectSequence: '00700008',
  GraphicObjectSequence: '00700009',

  // Text Object attributes
  UnformattedTextValue: '00700006',
  BoundingBoxAnnotationUnits: '00700003',
  AnchorPointAnnotationUnits: '00700004',
  BoundingBoxTopLeftHandCorner: '00700010',
  BoundingBoxBottomRightHandCorner: '00700011',
  BoundingBoxTextHorizontalJustification: '00700012',
  AnchorPoint: '00700014',
  AnchorPointVisibility: '00700015',

  // Graphic Object attributes
  GraphicAnnotationUnits: '00700005',
  NumberOfGraphicPoints: '00700021',
  GraphicData: '00700022',
  GraphicType: '00700023',
  GraphicFilled: '00700024',

  // Referenced Image Sequence
  ReferencedImageSequence: '00081140',
  ReferencedSOPInstanceUID: '00081155',
  ReferencedSOPClassUID: '00081150',

  // Referenced Series Sequence
  ReferencedSeriesSequence: '00081115',
  SeriesInstanceUID: '0020000e',

  // Graphic Layer Module
  GraphicLayerSequence: '00700060',
  GraphicLayerOrder: '00700062',
  GraphicLayerDescription: '00700068',
  GraphicLayerRecommendedDisplayGrayscaleValue: '00700066',

  // Softcopy VOI LUT Module
  SoftcopyVOILUTSequence: '00289132',
  WindowCenter: '00281050',
  WindowWidth: '00281051',
  VOILUTFunction: '00281056',

  // Displayed Area Selection Module
  DisplayedAreaSelectionSequence: '0070005a',
  DisplayedAreaTopLeftHandCorner: '00700052',
  DisplayedAreaBottomRightHandCorner: '00700053',
  PresentationSizeMode: '00700100',
  PresentationPixelSpacing: '00700101',

  // Spatial Transformation
  ImageRotation: '00700042',
  ImageHorizontalFlip: '00700041',

  // Display Shutter Module
  ShutterShape: '00181600',
  ShutterLeftVerticalEdge: '00181602',
  ShutterRightVerticalEdge: '00181604',
  ShutterUpperHorizontalEdge: '00181606',
  ShutterLowerHorizontalEdge: '00181608',
  CenterOfCircularShutter: '00181610',
  RadiusOfCircularShutter: '00181612',
  VerticesOfThePolygonalShutter: '00181620',
  ShutterPresentationValue: '00181622',

  // Presentation LUT
  PresentationLUTShape: '20500020',

  // SOP Instance UID
  SOPInstanceUID: '00080018',

  // iSite private tags
  StentorGraphicType: '00732000',
  iSiteEmbeddedPSData: '00731010',
} as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a GSPS DICOM instance from a flat attribute map.
 *
 * @param attributes - Flat map of DICOM tag → value from the GSPS instance.
 * @returns A fully parsed GSPS instance.
 */
export function parseGSPSInstance(
  attributes: Record<string, unknown>,
): ParsedGSPSInstance {
  const sopInstanceUID = getString(attributes, GSPS_TAGS.SOPInstanceUID) ?? '';

  // Parse referenced series
  const referencedSeries = parseReferencedSeries(attributes);

  // Parse graphic annotations
  const graphicAnnotations = parseGraphicAnnotations(attributes);

  // Parse graphic layers
  const graphicLayers = parseGraphicLayers(attributes);

  // Parse VOI transforms
  const voiTransforms = parseVOITransforms(attributes);

  // Parse spatial transform
  const spatialTransform = parseSpatialTransform(attributes);

  // Parse display shutters
  const shutters = parseDisplayShutters(attributes);

  // Presentation LUT shape
  const presentationLutShape = getString(attributes, GSPS_TAGS.PresentationLUTShape);

  // Check for embedded iSitePS
  const embeddedISitePSXml = getString(attributes, GSPS_TAGS.iSiteEmbeddedPSData);
  const hasEmbeddedISitePS = !!embeddedISitePSXml;

  return {
    sopInstanceUID,
    referencedSeries,
    graphicAnnotations,
    graphicLayers,
    voiTransforms,
    spatialTransform,
    shutters,
    presentationLutShape: presentationLutShape ?? undefined,
    hasEmbeddedISitePS,
    embeddedISitePSXml: embeddedISitePSXml ?? undefined,
  };
}

/**
 * Parse a GSPS instance from an XML Document (legacy server format).
 *
 * @param xmlDoc - The XML document representing a GSPS instance.
 * @returns A fully parsed GSPS instance.
 */
export function parseGSPSFromXml(xmlDoc: Document): ParsedGSPSInstance {
  const attributes = xmlToAttributeMap(xmlDoc);
  return parseGSPSInstance(attributes);
}

// ---------------------------------------------------------------------------
// Section Parsers
// ---------------------------------------------------------------------------

function parseReferencedSeries(
  attrs: Record<string, unknown>,
): GSPSReferencedSeries[] {
  const result: GSPSReferencedSeries[] = [];
  const seqData = getSequence(attrs, GSPS_TAGS.ReferencedSeriesSequence);

  for (const item of seqData) {
    const seriesUID = getString(item, GSPS_TAGS.SeriesInstanceUID) ?? '';
    const imageSeq = getSequence(item, GSPS_TAGS.ReferencedImageSequence);
    const imageUIDs: string[] = [];

    for (const imgItem of imageSeq) {
      const uid = getString(imgItem, GSPS_TAGS.ReferencedSOPInstanceUID);
      if (uid) imageUIDs.push(uid);
    }

    if (seriesUID) {
      result.push({ seriesUID, imageUIDs });
    }
  }

  return result;
}

function parseGraphicAnnotations(
  attrs: Record<string, unknown>,
): GSPSGraphicAnnotation[] {
  const result: GSPSGraphicAnnotation[] = [];
  const seqData = getSequence(attrs, GSPS_TAGS.GraphicAnnotationSequence);

  for (const item of seqData) {
    // Referenced images for this annotation
    const refImageSeq = getSequence(item, GSPS_TAGS.ReferencedImageSequence);
    const referencedImageUIDs: string[] = [];
    for (const refItem of refImageSeq) {
      const uid = getString(refItem, GSPS_TAGS.ReferencedSOPInstanceUID);
      if (uid) referencedImageUIDs.push(uid);
    }

    // Graphic layer
    const graphicLayer = getString(item, GSPS_TAGS.GraphicLayer) ?? undefined;

    // Parse graphic objects
    const graphicObjects = parseGraphicObjects(item);

    // Parse text objects
    const textObjects = parseTextObjects(item);

    result.push({
      referencedImageUIDs,
      graphicObjects,
      textObjects,
      graphicLayer,
    });
  }

  return result;
}

function parseGraphicObjects(
  annotationItem: Record<string, unknown>,
): GSPSGraphicObject[] {
  const result: GSPSGraphicObject[] = [];
  const seqData = getSequence(annotationItem, GSPS_TAGS.GraphicObjectSequence);

  for (const item of seqData) {
    const graphicType = (getString(item, GSPS_TAGS.GraphicType) ?? 'POLYLINE') as GSPSGraphicType;
    const numberOfPoints = getNumber(item, GSPS_TAGS.NumberOfGraphicPoints) ?? 0;
    const graphicData = getNumberArray(item, GSPS_TAGS.GraphicData);
    const graphicFilled = getString(item, GSPS_TAGS.GraphicFilled) === 'Y';
    const graphicAnnotationUnits = getString(item, GSPS_TAGS.GraphicAnnotationUnits) ?? 'PIXEL';

    result.push({
      graphicType,
      numberOfPoints,
      graphicData,
      graphicFilled,
      graphicAnnotationUnits,
    });
  }

  return result;
}

function parseTextObjects(
  annotationItem: Record<string, unknown>,
): GSPSTextObject[] {
  const result: GSPSTextObject[] = [];
  const seqData = getSequence(annotationItem, GSPS_TAGS.TextObjectSequence);

  for (const item of seqData) {
    const textObj: GSPSTextObject = {
      unformattedTextValue: getString(item, GSPS_TAGS.UnformattedTextValue) ?? '',
    };

    const bbUnits = getString(item, GSPS_TAGS.BoundingBoxAnnotationUnits);
    if (bbUnits) textObj.boundingBoxAnnotationUnits = bbUnits;

    const bbTL = getNumberPair(item, GSPS_TAGS.BoundingBoxTopLeftHandCorner);
    if (bbTL) textObj.boundingBoxTopLeftHandCorner = bbTL;

    const bbBR = getNumberPair(item, GSPS_TAGS.BoundingBoxBottomRightHandCorner);
    if (bbBR) textObj.boundingBoxBottomRightHandCorner = bbBR;

    const bbJust = getString(item, GSPS_TAGS.BoundingBoxTextHorizontalJustification);
    if (bbJust) textObj.boundingBoxTextHorizontalJustification = bbJust;

    const anchor = getNumberPair(item, GSPS_TAGS.AnchorPoint);
    if (anchor) textObj.anchorPoint = anchor;

    const anchorVis = getString(item, GSPS_TAGS.AnchorPointVisibility);
    if (anchorVis !== null) textObj.anchorPointVisibility = anchorVis === 'Y';

    const anchorUnits = getString(item, GSPS_TAGS.AnchorPointAnnotationUnits);
    if (anchorUnits) textObj.anchorPointAnnotationUnits = anchorUnits;

    result.push(textObj);
  }

  return result;
}

function parseGraphicLayers(
  attrs: Record<string, unknown>,
): GSPSGraphicLayer[] {
  const result: GSPSGraphicLayer[] = [];
  const seqData = getSequence(attrs, GSPS_TAGS.GraphicLayerSequence);

  for (const item of seqData) {
    const name = getString(item, GSPS_TAGS.GraphicLayer) ?? '';
    const order = getNumber(item, GSPS_TAGS.GraphicLayerOrder) ?? 0;
    const description = getString(item, GSPS_TAGS.GraphicLayerDescription) ?? undefined;
    const grayscaleValue = getNumber(item, GSPS_TAGS.GraphicLayerRecommendedDisplayGrayscaleValue) ?? undefined;

    result.push({ name, order, description, grayscaleValue });
  }

  // Sort by order (lower first)
  result.sort((a, b) => a.order - b.order);

  return result;
}

function parseVOITransforms(
  attrs: Record<string, unknown>,
): GSPSVOITransform[] {
  const result: GSPSVOITransform[] = [];

  // Direct attributes (non-sequence VOI)
  const wc = getNumber(attrs, GSPS_TAGS.WindowCenter);
  const ww = getNumber(attrs, GSPS_TAGS.WindowWidth);
  if (wc != null && ww != null) {
    const func = getString(attrs, GSPS_TAGS.VOILUTFunction) ?? undefined;
    result.push({ windowCenter: wc, windowWidth: ww, voiLutFunction: func });
  }

  // Softcopy VOI LUT Sequence
  const seqData = getSequence(attrs, GSPS_TAGS.SoftcopyVOILUTSequence);
  for (const item of seqData) {
    const swc = getNumber(item, GSPS_TAGS.WindowCenter);
    const sww = getNumber(item, GSPS_TAGS.WindowWidth);
    if (swc != null && sww != null) {
      const func = getString(item, GSPS_TAGS.VOILUTFunction) ?? undefined;
      result.push({ windowCenter: swc, windowWidth: sww, voiLutFunction: func });
    }
  }

  return result;
}

function parseSpatialTransform(
  attrs: Record<string, unknown>,
): GSPSSpatialTransform | null {
  const rotation = getNumber(attrs, GSPS_TAGS.ImageRotation);
  const flipStr = getString(attrs, GSPS_TAGS.ImageHorizontalFlip);
  const flip = flipStr === 'Y';

  // Displayed Area Selection Sequence
  const seqData = getSequence(attrs, GSPS_TAGS.DisplayedAreaSelectionSequence);
  const firstArea = seqData[0];

  if (!rotation && !flip && !firstArea) return null;

  const result: GSPSSpatialTransform = {};

  if (rotation != null) result.imageRotation = rotation;
  if (flipStr) result.imageHorizontalFlip = flip;

  if (firstArea) {
    const tl = getNumberPair(firstArea, GSPS_TAGS.DisplayedAreaTopLeftHandCorner);
    const br = getNumberPair(firstArea, GSPS_TAGS.DisplayedAreaBottomRightHandCorner);
    const sizeMode = getString(firstArea, GSPS_TAGS.PresentationSizeMode);
    const pixelSpacing = getNumberPair(firstArea, GSPS_TAGS.PresentationPixelSpacing);

    if (tl) result.topLeft = tl;
    if (br) result.bottomRight = br;
    if (sizeMode) result.presentationSizeMode = sizeMode;
    if (pixelSpacing) result.presentationPixelSpacing = pixelSpacing;
  }

  return result;
}

function parseDisplayShutters(
  attrs: Record<string, unknown>,
): GSPSDisplayShutter[] {
  const result: GSPSDisplayShutter[] = [];
  const shapeStr = getString(attrs, GSPS_TAGS.ShutterShape);
  if (!shapeStr) return result;

  const shapes = shapeStr.split('\\') as ShutterShape[];
  const presentationValue = getNumber(attrs, GSPS_TAGS.ShutterPresentationValue) ?? 0;

  for (const shape of shapes) {
    const shutter: GSPSDisplayShutter = { shape, shutterPresentationValue: presentationValue };

    switch (shape) {
      case 'RECTANGULAR': {
        const top = getNumber(attrs, GSPS_TAGS.ShutterUpperHorizontalEdge) ?? 0;
        const left = getNumber(attrs, GSPS_TAGS.ShutterLeftVerticalEdge) ?? 0;
        const bottom = getNumber(attrs, GSPS_TAGS.ShutterLowerHorizontalEdge) ?? 0;
        const right = getNumber(attrs, GSPS_TAGS.ShutterRightVerticalEdge) ?? 0;
        shutter.rectangularVertices = [top, left, bottom, right];
        break;
      }
      case 'CIRCULAR': {
        const center = getNumberPair(attrs, GSPS_TAGS.CenterOfCircularShutter);
        const radius = getNumber(attrs, GSPS_TAGS.RadiusOfCircularShutter);
        if (center) shutter.circularCenter = center;
        if (radius != null) shutter.circularRadius = radius;
        break;
      }
      case 'POLYGONAL': {
        const vertices = getNumberArray(attrs, GSPS_TAGS.VerticesOfThePolygonalShutter);
        if (vertices.length > 0) shutter.polygonalVertices = vertices;
        break;
      }
    }

    result.push(shutter);
  }

  return result;
}

// ---------------------------------------------------------------------------
// XML-to-attribute-map converter (for legacy server XML format)
// ---------------------------------------------------------------------------

function xmlToAttributeMap(xmlDoc: Document): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  const root = xmlDoc.documentElement;
  if (!root) return attrs;

  // Walk child elements — each child's tag name is the DICOM tag
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    const tag = child.tagName.toLowerCase();

    // Check if this is a sequence (has <val> children)
    const valChildren = child.getElementsByTagName('val');
    if (valChildren.length > 0) {
      const seqItems: Record<string, unknown>[] = [];
      for (let j = 0; j < valChildren.length; j++) {
        seqItems.push(xmlElementToMap(valChildren[j]));
      }
      attrs[tag] = seqItems;
    } else {
      // Simple value
      attrs[tag] = child.textContent?.trim() ?? '';
    }
  }

  return attrs;
}

function xmlElementToMap(element: Element): Record<string, unknown> {
  const map: Record<string, unknown> = {};

  for (let i = 0; i < element.children.length; i++) {
    const child = element.children[i];
    const tag = child.tagName.toLowerCase();

    const valChildren = child.getElementsByTagName('val');
    if (valChildren.length > 0) {
      const seqItems: Record<string, unknown>[] = [];
      for (let j = 0; j < valChildren.length; j++) {
        seqItems.push(xmlElementToMap(valChildren[j]));
      }
      map[tag] = seqItems;
    } else {
      map[tag] = child.textContent?.trim() ?? '';
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Attribute access helpers
// ---------------------------------------------------------------------------

function getString(attrs: Record<string, unknown>, tag: string): string | null {
  const val = attrs[tag];
  if (val === undefined || val === null) return null;
  if (typeof val === 'string') return val;
  return String(val);
}

function getNumber(attrs: Record<string, unknown>, tag: string): number | null {
  const val = attrs[tag];
  if (val === undefined || val === null) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function getNumberArray(attrs: Record<string, unknown>, tag: string): number[] {
  const val = attrs[tag];
  if (!val) return [];
  if (Array.isArray(val)) return val.map(Number).filter(Number.isFinite);
  if (typeof val === 'string') {
    return val.split('\\').map(Number).filter(Number.isFinite);
  }
  return [];
}

function getNumberPair(attrs: Record<string, unknown>, tag: string): [number, number] | null {
  const arr = getNumberArray(attrs, tag);
  if (arr.length >= 2) return [arr[0], arr[1]];
  return null;
}

function getSequence(attrs: Record<string, unknown>, tag: string): Record<string, unknown>[] {
  const val = attrs[tag];
  if (Array.isArray(val)) return val as Record<string, unknown>[];
  return [];
}
