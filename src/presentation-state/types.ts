/**
 * Presentation State — Type Definitions
 *
 * Models the PS → PSWindow → PSImage hierarchy from the legacy viewer,
 * redesigned as plain TypeScript interfaces with no framework dependency.
 *
 * Ported from legacy `presentationstate.js`, `pswindow.js`, `psimage.js`,
 * `psdescriptor.js`, `stackattributes.js`, `vlutmoduleattributes.js`,
 * `plutmoduleattributes.js`.
 */

// ---------------------------------------------------------------------------
// PS Descriptor — identifies and classifies a presentation state
// ---------------------------------------------------------------------------

/** Type of presentation state (maps to legacy PSType enum). */
export enum PSType {
  RawDICOM = 0,
  Technologist = 1,
  Radiologist = 2,
  PreRead = 3,
  User = 4,
  GSPS = 5,
  CADSR = 6,
  Conference = 7,
  ReferenceCPS = 8,
}

/** Priority weight for PS type selection (lower = higher priority). */
export const PS_TYPE_PRIORITY: Record<PSType, number> = {
  [PSType.Radiologist]: 0,
  [PSType.PreRead]: 1,
  [PSType.Technologist]: 2,
  [PSType.GSPS]: 3,
  [PSType.User]: 4,
  [PSType.CADSR]: 4,
  [PSType.RawDICOM]: 4,
  [PSType.Conference]: 4,
  [PSType.ReferenceCPS]: 4,
};

/** How the PS is stored on the server. */
export enum PSStorageType {
  RawDICOM = 0,
  ISite = 1,
  RawDICOM_ISite = 2,
  Other = 3,
}

/** Status of PS load operation. */
export enum PSLoadStatus {
  Unknown = 0,
  Failed = 1,
  Success = 2,
  PartialLoad = 3,
}

/** Uniquely identifies and describes a presentation state. */
export interface PSDescriptor {
  /** Unique key for this PS (server-assigned or generated). */
  key: string;

  /** Human-readable label. */
  label: string;

  /** Description. */
  description: string;

  /** PS type (Radiologist, User, GSPS, etc.). */
  psType: PSType;

  /** Storage type. */
  storageType: PSStorageType;

  /** Load status. */
  loadStatus: PSLoadStatus;

  /** PS version string (e.g. '1.3'). */
  version: string;

  /** Creator's name. */
  creatorName: string;

  /** Accession number this PS belongs to. */
  accessionNumber: string;

  /** Creation timestamp. */
  createdAt: Date | null;

  /** Last modification timestamp. */
  modifiedAt: Date | null;

  /** Modifier's name. */
  modifierName: string;

  /** Whether this is an iSite-created GSPS (with embedded iSitePS). */
  gspsByISite: boolean;

  /** Whether this is a legacy iSitePS format. */
  isLegacyISitePS: boolean;
}

// ---------------------------------------------------------------------------
// VOI LUT Module
// ---------------------------------------------------------------------------

/** VOI LUT module attributes (window width/center). */
export interface VOILUTModule {
  /** Window width. */
  windowWidth: number;

  /** Window center (level). */
  windowCenter: number;

  /** VOI LUT function ('LINEAR' | 'SIGMOID' | 'LINEAR_EXACT'). */
  voiLutFunction?: string;

  /** Optional VOI LUT sequence data. */
  voiLutData?: number[];
}

// ---------------------------------------------------------------------------
// Presentation LUT Module
// ---------------------------------------------------------------------------

/** Presentation LUT module attributes (invert, gamma). */
export interface PresentationLUTModule {
  /** Photometric interpretation after applying PLUT ('MONOCHROME1' | 'MONOCHROME2'). */
  presentationLutShape: string;

  /** Whether the image is inverted. */
  isInverted: boolean;
}

// ---------------------------------------------------------------------------
// Stack Attributes — shared state across images in a stack/window
// ---------------------------------------------------------------------------

/** Shared display attributes applied across all images in a PSWindow. */
export interface StackAttributes {
  /** Stack-level window width/center override. Null = use per-image values. */
  voiLut: VOILUTModule | null;

  /** Stack-level presentation LUT override. Null = use per-image values. */
  presentationLut: PresentationLUTModule | null;

  /** Whether stack-level W/L override is active. */
  wwwlOverrideActive: boolean;

  /** Whether stack-level invert override is active. */
  invertOverrideActive: boolean;
}

// ---------------------------------------------------------------------------
// PSImage — per-image display state within a window
// ---------------------------------------------------------------------------

/** Display attributes for a single image within a PSWindow. */
export interface PSImage {
  /** The SOP Instance UID of the referenced image. */
  imageUID: string;

  /** Per-image VOI LUT (cloned from image defaults, may be overridden). */
  voiLut: VOILUTModule;

  /** Per-image Presentation LUT. */
  presentationLut: PresentationLUTModule;

  /** Annotations associated with this image (annotation UIDs). */
  annotationIds: string[];

  /** Reference to shared stack attributes. */
  stackAttributes: StackAttributes;

  /** Row cosine vector from ImageOrientationPatient. */
  rowVector: [number, number, number] | null;

  /** Column cosine vector from ImageOrientationPatient. */
  colVector: [number, number, number] | null;

  /** Normal vector to the image plane (cross product of row × col). */
  normalVector: [number, number, number] | null;

  /** Image position (patient coordinates). */
  imagePosition: [number, number, number] | null;
}

// ---------------------------------------------------------------------------
// PSWindow — a viewport window containing a stack of images
// ---------------------------------------------------------------------------

/** Type of PS window. */
export enum PSWindowType {
  Series = 0,
  KeyImages = 1,
}

/** A viewport window containing an ordered stack of PSImages. */
export interface PSWindow {
  /** Unique window ID. */
  id: string;

  /** Window type (series or key images). */
  type: PSWindowType;

  /** Ordered list of PSImages in this window. */
  images: PSImage[];

  /** Shared stack attributes for this window. */
  stackAttributes: StackAttributes;

  /** Series model data (series UID, description, etc.). */
  seriesUID?: string;

  /** Series description. */
  seriesDescription?: string;
}

// ---------------------------------------------------------------------------
// PresentationState — top-level container
// ---------------------------------------------------------------------------

/** Top-level presentation state containing windows and a descriptor. */
export interface PresentationState {
  /** PS descriptor (metadata about this PS). */
  descriptor: PSDescriptor;

  /** Windows in this presentation state. */
  windows: PSWindow[];

  /** Key image window (null if no key images). */
  keyImageWindow: PSWindow | null;

  /** Default PS key used for initialization. */
  defaultPSKey: string | null;
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/** Create a default StackAttributes. */
export function createDefaultStackAttributes(
  voiLut?: VOILUTModule,
  presentationLut?: PresentationLUTModule,
): StackAttributes {
  return {
    voiLut: voiLut ?? null,
    presentationLut: presentationLut ?? null,
    wwwlOverrideActive: false,
    invertOverrideActive: false,
  };
}

/** Create a default PSDescriptor. */
export function createDefaultPSDescriptor(): PSDescriptor {
  return {
    key: generatePSKey(),
    label: '',
    description: '',
    psType: PSType.User,
    storageType: PSStorageType.Other,
    loadStatus: PSLoadStatus.Unknown,
    version: '1.3',
    creatorName: '',
    accessionNumber: '',
    createdAt: null,
    modifiedAt: null,
    modifierName: '',
    gspsByISite: false,
    isLegacyISitePS: false,
  };
}

/** Generate a hex-based unique PS key. */
function generatePSKey(): string {
  return Date.now().toString(16).toUpperCase();
}

/**
 * Compare two PSDescriptors by type priority, then by modification date.
 * Returns negative if `a` should be selected over `b`.
 */
export function comparePSDescriptors(a: PSDescriptor, b: PSDescriptor): number {
  const priorityA = PS_TYPE_PRIORITY[a.psType] ?? 99;
  const priorityB = PS_TYPE_PRIORITY[b.psType] ?? 99;

  if (priorityA !== priorityB) return priorityA - priorityB;

  // Same priority — prefer more recently modified
  const dateA = a.modifiedAt?.getTime() ?? a.createdAt?.getTime() ?? 0;
  const dateB = b.modifiedAt?.getTime() ?? b.createdAt?.getTime() ?? 0;
  return dateB - dateA; // newer first
}
