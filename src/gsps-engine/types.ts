/**
 * GSPS Engine — Type Definitions
 *
 * Models Grayscale Softcopy Presentation State (GSPS) objects per DICOM
 * Part 3, Supplement 33. Covers graphic annotations, text annotations,
 * graphic layers, referenced images, display transforms, and shutters.
 *
 * Ported from legacy `gspsreader.js`, `graphicannotationprocessor.js`,
 * `graphiclayerprocessor.js` without framework dependencies.
 */

// ---------------------------------------------------------------------------
// GSPS Graphic Types (DICOM 00700023)
// ---------------------------------------------------------------------------

/** Standard DICOM graphic types for graphic object sequences. */
export type GSPSGraphicType =
  | 'POINT'
  | 'POLYLINE'
  | 'INTERPOLATED'
  | 'CIRCLE'
  | 'ELLIPSE';

// ---------------------------------------------------------------------------
// Graphic Object (from 00700009 — Graphic Object Sequence)
// ---------------------------------------------------------------------------

/** A single graphic object from a GSPS Graphic Object Sequence item. */
export interface GSPSGraphicObject {
  /** DICOM graphic type (00700023). */
  graphicType: GSPSGraphicType;

  /** Number of graphic data points (00700021). */
  numberOfPoints: number;

  /** Flat array of [col, row] pairs (00700022). */
  graphicData: number[];

  /** Whether the graphic is filled (00700024). */
  graphicFilled: boolean;

  /** Graphic annotation units: 'PIXEL' | 'DISPLAY' (00700005). */
  graphicAnnotationUnits: string;
}

// ---------------------------------------------------------------------------
// Text Object (from 00700008 — Text Object Sequence)
// ---------------------------------------------------------------------------

/** A single text object from a GSPS Text Object Sequence item. */
export interface GSPSTextObject {
  /** The text string value (00700006). */
  unformattedTextValue: string;

  /** Bounding box annotation units (00700003). */
  boundingBoxAnnotationUnits?: string;

  /** Top-left corner of bounding box [col, row] (00700010). */
  boundingBoxTopLeftHandCorner?: [number, number];

  /** Bottom-right corner of bounding box [col, row] (00700011). */
  boundingBoxBottomRightHandCorner?: [number, number];

  /** Text justification: 'LEFT' | 'RIGHT' | 'CENTER' (00700012). */
  boundingBoxTextHorizontalJustification?: string;

  /** Anchor point [col, row] (00700014). */
  anchorPoint?: [number, number];

  /** Whether anchor point is visible (00700015). */
  anchorPointVisibility?: boolean;

  /** Anchor point annotation units (00700004). */
  anchorPointAnnotationUnits?: string;
}

// ---------------------------------------------------------------------------
// Graphic Annotation (from 00700001 — Graphic Annotation Sequence)
// ---------------------------------------------------------------------------

/** A single item in the Graphic Annotation Sequence (00700001). */
export interface GSPSGraphicAnnotation {
  /** Referenced image UIDs this annotation applies to. */
  referencedImageUIDs: string[];

  /** Graphic objects in this annotation. */
  graphicObjects: GSPSGraphicObject[];

  /** Text objects in this annotation. */
  textObjects: GSPSTextObject[];

  /** Graphic layer name this annotation belongs to (00700002). */
  graphicLayer?: string;
}

// ---------------------------------------------------------------------------
// Graphic Layer (from 00700060 — Graphic Layer Sequence)
// ---------------------------------------------------------------------------

/** A single graphic layer definition. */
export interface GSPSGraphicLayer {
  /** Layer name (00700002). */
  name: string;

  /** Layer order (00700062) — lower numbers are rendered first. */
  order: number;

  /** Recommended display grayscale value (0071x0067). */
  grayscaleValue?: number;

  /** Recommended display RGB values [R, G, B] (0071x0068). */
  rgbValue?: [number, number, number];

  /** Description of the layer (00700068). */
  description?: string;
}

// ---------------------------------------------------------------------------
// Referenced Series / Image
// ---------------------------------------------------------------------------

/** A referenced series within a GSPS instance. */
export interface GSPSReferencedSeries {
  /** Series Instance UID. */
  seriesUID: string;

  /** Referenced image UIDs within this series. */
  imageUIDs: string[];
}

// ---------------------------------------------------------------------------
// Display Transforms (VOI, Spatial)
// ---------------------------------------------------------------------------

/** VOI LUT transform from GSPS. */
export interface GSPSVOITransform {
  windowWidth: number;
  windowCenter: number;
  voiLutFunction?: string;
}

/** Spatial transform from GSPS (displayed area selection). */
export interface GSPSSpatialTransform {
  /** Displayed area top-left [col, row]. */
  topLeft?: [number, number];

  /** Displayed area bottom-right [col, row]. */
  bottomRight?: [number, number];

  /** Presentation size mode: 'SCALE TO FIT' | 'TRUE SIZE' | 'MAGNIFY'. */
  presentationSizeMode?: string;

  /** Presentation pixel spacing [row, col]. */
  presentationPixelSpacing?: [number, number];

  /** Rotation angle in degrees. */
  imageRotation?: number;

  /** Whether image is horizontally flipped. */
  imageHorizontalFlip?: boolean;
}

// ---------------------------------------------------------------------------
// Display Shutter
// ---------------------------------------------------------------------------

export type ShutterShape = 'RECTANGULAR' | 'CIRCULAR' | 'POLYGONAL';

export interface GSPSDisplayShutter {
  shape: ShutterShape;

  /** For RECTANGULAR: [top, left, bottom, right]. */
  rectangularVertices?: [number, number, number, number];

  /** For CIRCULAR: center [row, col] and radius. */
  circularCenter?: [number, number];
  circularRadius?: number;

  /** For POLYGONAL: flat array of [row, col] vertices. */
  polygonalVertices?: number[];

  /** Shutter presentation value (grayscale fill). */
  shutterPresentationValue?: number;
}

// ---------------------------------------------------------------------------
// Parsed GSPS Instance (top-level)
// ---------------------------------------------------------------------------

/** A fully parsed GSPS instance ready for application to viewports. */
export interface ParsedGSPSInstance {
  /** SOP Instance UID of the GSPS object. */
  sopInstanceUID: string;

  /** Referenced series and their images. */
  referencedSeries: GSPSReferencedSeries[];

  /** Graphic annotations. */
  graphicAnnotations: GSPSGraphicAnnotation[];

  /** Graphic layers. */
  graphicLayers: GSPSGraphicLayer[];

  /** VOI LUT transforms (per referenced image or global). */
  voiTransforms: GSPSVOITransform[];

  /** Spatial transforms. */
  spatialTransform: GSPSSpatialTransform | null;

  /** Display shutters. */
  shutters: GSPSDisplayShutter[];

  /** Presentation LUT shape ('IDENTITY' | 'INVERSE'). */
  presentationLutShape?: string;

  /** Whether this GSPS contains embedded iSitePS data. */
  hasEmbeddedISitePS: boolean;

  /** Raw embedded iSitePS XML (if present, for legacy compatibility). */
  embeddedISitePSXml?: string;
}

// ---------------------------------------------------------------------------
// GSPS Application Result
// ---------------------------------------------------------------------------

/** Result of applying a GSPS instance to a set of images. */
export interface GSPSApplicationResult {
  /** Annotations created from graphic/text objects, keyed by image UID. */
  annotationsByImage: Map<string, GSPSAnnotationEntry[]>;

  /** Overlay activation layers set by graphic layer processor. */
  overlayActivationLayers: Map<number, boolean>;

  /** VOI transform to apply (if present in GSPS). */
  voiTransform: GSPSVOITransform | null;

  /** Spatial transform to apply (if present in GSPS). */
  spatialTransform: GSPSSpatialTransform | null;

  /** Display shutters to apply. */
  shutters: GSPSDisplayShutter[];

  /** Presentation LUT shape: 'IDENTITY' | 'INVERSE'. */
  presentationLutShape?: string;

  /** Key image UIDs discovered in the GSPS. */
  keyImageUIDs: string[];
}

/** A single annotation entry created from GSPS data. */
export interface GSPSAnnotationEntry {
  /** The tool name this maps to in the new annotation framework. */
  toolName: string;

  /** World-space points for the annotation handles. */
  points: Array<{ x: number; y: number }>;

  /** Optional text label (from text objects). */
  label?: string;

  /** Whether this is a text-only annotation (no graphic). */
  isTextOnly: boolean;

  /** Whether the anchor point is visible (for custom labels). */
  anchorPointVisible?: boolean;

  /** Original GSPS graphic type. */
  sourceGraphicType?: GSPSGraphicType | 'TEXT';
}
