# iSyntax Viewer — Design Document

**Version:** 1.0.0  
**Developer:** Shiju P K (shiju.pk@philips.com)  
**Platform:** React + TypeScript + Vite + Tauri  
**Purpose:** Browser and native desktop viewer for Philips iSyntax digital pathology images, served via a ResultsAuthority REST API.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Layer Responsibilities](#2-layer-responsibilities)
3. [Source Tree](#3-source-tree)
4. [Data Flow](#4-data-flow)
5. [iSyntax Codec Pipeline](#5-isyntax-codec-pipeline)
6. [Rendering Pipeline](#6-rendering-pipeline)
7. [Component Architecture](#7-component-architecture)
8. [State Management](#8-state-management)
9. [Persistence & Configuration](#9-persistence--configuration)
10. [Transport Layer](#10-transport-layer)
11. [Key Interfaces](#11-key-interfaces)
12. [Navigation & Routing](#12-navigation--routing)
13. [Feature: Settings System](#13-feature-settings-system)
14. [Feature: Study Worklist](#14-feature-study-worklist)
15. [Known Limitations & Future Work](#15-known-limitations--future-work)

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser / Tauri shell                   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Presentation Layer                        │  │
│  │  Worklist page ──► ViewerPage (MainImage + Overlays)       │  │
│  │  TitleBar ──► SettingsMenu ──► AboutDialog / Prefs Dialog  │  │
│  └───────────────────────────────┬───────────────────────────┘  │
│                                  │                               │
│  ┌───────────────────────────────▼───────────────────────────┐  │
│  │                     Services Layer                         │  │
│  │  StudyService (fetch + cache StudyDoc)                     │  │
│  │  ISyntaxImageService (fetch + decode + cache image levels) │  │
│  │  PreferencesService (localStorage persistence)             │  │
│  │  StudyStorageService (user-added studies persistence)      │  │
│  └──────────┬─────────────────────────────────────┬──────────┘  │
│             │                                     │              │
│  ┌──────────▼──────────┐          ┌───────────────▼──────────┐  │
│  │   Codec / Parser    │          │   Rendering Engine        │  │
│  │  StudyDocParser     │          │  RenderingEngine           │  │
│  │  InitImageParser    │          │  StackViewport             │  │
│  │  GetCoeffParser     │          │  RenderPipeline            │  │
│  │  RiceAndSnakeDec.   │          │  Canvas2DBackend           │  │
│  │  RiceDecoder        │          │  WebGLBackend              │  │
│  │  ISyntaxProcessor   │          │  Camera2D                  │  │
│  │  ISyntaxInverter    │          │  InteractionDispatcher     │  │
│  └──────────┬──────────┘          └───────────────────────────┘  │
│             │                                                     │
│  ┌──────────▼──────────────────────────────────────────────────┐ │
│  │                    Transport Layer                           │ │
│  │  HTTP fetch → ResultsAuthority REST API                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer Responsibilities

| Layer | Folder | Responsibility |
|-------|--------|----------------|
| **Presentation** | `src/presentation/` | React pages, components, dialogs, layout |
| **Services** | `src/services/` | Orchestrate data fetching, caching, image loading |
| **Config/Prefs** | `src/services/config/`, `src/services/storage/` | Runtime settings and localStorage persistence |
| **Codec** | `src/codecs/` | iSyntax pixel decoding (Rice, RiceAndSnake algorithms) |
| **Imaging** | `src/imaging/` | Pyramid image model, zoom level views, tile management |
| **Parsers** | `src/parsers/` | Binary protocol parsing (StudyDoc, InitImage, GetCoefficients) |
| **DICOM** | `src/dicom/` | DICOM tag extraction, metadata mapping, orientation labels |
| **Rendering** | `src/rendering/` | Rendering engine, viewports, camera, pipeline stages, backends |
| **Tools** | `src/tools/` | Interaction tools: Pan, Zoom, WindowLevel; event dispatch |
| **Transport** | `src/transport/` | URL builders, HTTP fetch abstraction |
| **Core** | `src/core/` | Shared types, interfaces, constants — no runtime dependencies |

---

## 3. Source Tree

```
src/
├── codecs/
│   └── isyntax/
│       ├── RiceDecoder.ts           — Rice entropy decoder (GetCoefficients responses)
│       └── RiceAndSnakeDecoder.ts   — Rice+Snake decoder (InitImage responses)
│
├── core/
│   ├── constants/                   — CodecConstants (image formats, bit depths)
│   ├── interfaces/
│   │   ├── ICanvasController.ts     — Legacy viewport controller (being replaced)
│   │   ├── ICodec.ts                — Abstract codec interface
│   │   ├── IImageService.ts         — Abstract image service interface
│   │   ├── IParser.ts               — Abstract parser interface
│   │   └── ITransport.ts            — Abstract HTTP transport interface
│   └── types/
│       ├── dicom.ts                 — DicomImageMetadata, StudyInfo, StudyDoc, SeriesGroup
│       ├── imaging.ts               — DecodedImage, ImageArray, ImageType, ProgressCallback
│       └── viewport.ts              — ViewportState, InteractionMode
│
├── dicom/
│   ├── metadata/DicomMetadata.ts    — XML → DicomImageMetadata extraction
│   ├── orientation.ts               — IOP → anatomical orientation labels (A/P/L/R/H/F)
│   ├── sop/SopClassRegistry.ts      — Non-image SOP class filter list
│   └── tags/DicomTags.ts            — Typed DICOM tag constants (hex strings)
│
├── imaging/
│   ├── model/
│   │   ├── ISyntaxImage.ts          — Pyramid image with iSyntax versioning
│   │   ├── PyramidImage.ts          — Base multi-resolution pyramid model
│   │   ├── ZoomLevelView.ts         — Per-level buffer (LL/LH/HL/HH subbands)
│   │   ├── ImageHelper.ts           — Level/dimension calculation utilities
│   │   └── Size.ts                  — Width/height value object
│   ├── processing/
│   │   ├── ISyntaxProcessor.ts      — Decode + inverse-wavelet orchestration
│   │   └── ISyntaxInverter.ts       — 5/3 inverse discrete wavelet transform
│   └── tiling/
│       ├── TileManager.ts           — Visible tile calculation + priority fetching
│       ├── TileGrid.ts              — Tile grid topology and coordinate math
│       ├── TileCache.ts             — LRU/size-bounded tile cache
│       └── types.ts                 — TileCoord, TileState, VisibleBounds, etc.
│
├── parsers/
│   ├── binary/DataViewBinaryReader.ts — Bit-level binary reader
│   ├── isyntax/
│   │   ├── ServerResponse.ts        — Response type enum + wrapper
│   │   ├── InitImageResponse.ts     — InitImage response data model
│   │   ├── InitImageResponseParser.ts — Binary parser for InitImage
│   │   ├── GetCoefficientsResponse.ts — GetCoefficients response model
│   │   └── GetCoefficientsResponseParser.ts — Binary parser for GetCoefficients
│   └── studydoc/
│       └── StudyDocParser.ts        — Parses binary StudyDoc container → XML documents
│
├── rendering/
│   ├── backends/
│   │   ├── Canvas2DBackend.ts       — CPU Canvas 2D rendering (software path)
│   │   └── WebGLBackend.ts          — WebGL2 accelerated rendering (shader-based VOI/LUT)
│   ├── camera/
│   │   └── Camera2D.ts              — 2D camera: pan, zoom, rotation, flip
│   ├── engine/
│   │   ├── RenderingEngine.ts       — Viewport lifecycle manager
│   │   ├── RenderingEngineCache.ts  — Global engine registry
│   │   └── ViewportTypeRegistry.ts  — Viewport type → class mapping
│   ├── events/
│   │   ├── EventBus.ts              — Simple typed pub/sub event bus
│   │   └── RenderingEvents.ts       — Event name constants
│   ├── pipeline/
│   │   ├── RenderPipeline.ts        — Stage execution orchestrator
│   │   ├── IRenderStage.ts          — Stage interface + RenderContext type
│   │   └── stages/
│   │       ├── ImageMapper.ts       — ImageData → pipeline context
│   │       ├── VOILUTStage.ts       — Window/Level transform (CPU)
│   │       ├── ColorMapStage.ts     — Stub for future pseudo-color LUT
│   │       └── CompositorStage.ts   — Camera transform + backend draw call
│   └── viewports/
│       ├── Viewport.ts              — Base viewport: camera, backend, properties
│       ├── StackViewport.ts         — Stack (series) viewport with image scrolling
│       ├── WSIViewport.ts           — Whole-slide image viewport (tiled, in development)
│       └── types.ts                 — ViewportInput, ViewportProperties, IViewport
│
├── services/
│   ├── config/
│   │   └── PreferencesService.ts    — Read/write/resolve target hostname preference
│   ├── image/
│   │   └── ISyntaxImageService.ts   — Fetch + decode iSyntax levels; caching per instance
│   ├── storage/
│   │   └── StudyStorageService.ts   — Add/remove/get user-added studies in localStorage
│   └── study/
│       └── StudyService.ts          — Fetch + parse StudyDoc; extract metadata + image UIDs
│
├── tools/
│   ├── interaction/
│   │   ├── InteractionDispatcher.ts — Pointer/wheel event → tool routing
│   │   ├── PanTool.ts               — Camera pan
│   │   ├── ZoomTool.ts              — Camera zoom (wheel + drag)
│   │   └── WindowLevelTool.ts       — VOI window/level adjustment
│   └── types.ts                     — ITool interface, ToolType enum, event data types
│
├── transport/
│   ├── endpoints/
│   │   └── config.ts                — URL builders using effective target hostname
│   ├── http/
│   │   └── HttpTransport.ts         — fetch() wrapper implementing ITransport
│   └── index.ts                     — Re-exports
│
├── presentation/
│   ├── App.tsx                      — React Router setup
│   ├── pages/
│   │   ├── worklist/Worklist.tsx    — Study list page
│   │   └── viewer/ViewerPage.tsx    — Image viewer page
│   └── components/
│       ├── TitleBar/TitleBar.tsx    — App header with back button + settings
│       ├── Settings/
│       │   ├── SettingsMenu.tsx     — Gear dropdown (About / Preferences)
│       │   ├── AboutDialog.tsx      — App info modal
│       │   └── PreferencesDialog.tsx — Target hostname settings modal
│       └── Viewer/
│           ├── MainImage.tsx        — Canvas viewport container + engine init
│           ├── ThumbnailPanel.tsx   — Resizable series/image thumbnail sidebar
│           ├── ToolPalette.tsx      — Pan / Zoom / W/L / Reset / Download / Metadata buttons
│           ├── MetadataPanel.tsx    — DICOM metadata sidebar
│           ├── ResizeHandle.tsx     — Drag handle for resizable panels
│           └── ViewportOverlay.tsx  — Overlaid patient/image info and live W/L display
│
├── studies.json                     — Built-in study list (studyId + stackId pairs)
└── vite-env.d.ts                    — Vite env + __APP_VERSION__ type declarations
```

---

## 4. Data Flow

### 4.1 Study Loading (Worklist)

```
Worklist mounts
  │
  ├── Load built-in studies from studies.json
  ├── Load user-added studies from StudyStorageService (localStorage)
  │
  └── For each StudyConfig { studyId, stackId }:
        StudyService.getStudyInfoAndImageIds()
          │
          ├── Check studyDocCache (in-memory Map)
          │     Hit → return cached StudyDoc
          │     Miss → fetch GET /ResultsAuthority/Study/{id}/iSyntaxStudy?sid={sid}
          │              → StudyDocParser.parse(arrayBuffer)
          │                  → decompress zlib entities → DOMParser XML
          │                  → StudyDoc { studyXml, imagesXml, imageXmlList[] }
          │
          ├── DicomMetadata.extractStudyInfo(studyXml) → StudyInfo
          └── DicomMetadata.extractImageUIDs(imagesXml) → imageIds[]
```

### 4.2 Image Loading (Viewer)

```
User clicks study row
  │
  navigate('/view/{studyId}?sid={stackId}', { state })
  │
  ViewerPage mounts
  │
  ├── getStudyInfoAndImageIds() → StudyInfo, imageIds[]
  ├── getAllImageMetadata()     → Map<instanceUID, DicomImageMetadata>
  └── getSeriesImageGroups()   → SeriesGroup[] (grouped by SeriesUID)

  For each instanceUID:
    ISyntaxImageService.initImage()
      │
      ├── GET /ResultsAuthority/Study/{id}/Instance/{uid}/iSyntaxInitImage?...
      ├── InitImageResponseParser.parse(uint8Array)
      │     → InitImageResponse { version, format, rows, cols, xformLevels, ... }
      ├── ISyntaxImage.initializeFromIIR(iir)
      ├── ISyntaxProcessor.ProcessInitImageResponse()
      │     → RiceAndSnakeDecoder.decode() → Int16Array/Int32Array
      │         (Rice entropy decoding + snake scanning)
      ├── ISyntaxInverter.synthesize() → inverse 5/3 DWT
      └── Convert to ImageData (RGBA) → DecodedImage

  User clicks thumbnail (progressive enhancement):
    ISyntaxImageService.loadAllLevels(onProgress)
      │
      └── For each level (highest → lowest / finest detail):
            GET /ResultsAuthority/Study/{id}/Instance/{uid}/iSyntaxCoeffs?L={level}&...
            GetCoefficientsResponseParser.parse()
            ISyntaxProcessor.ProcessGetCoefficientsResponse()
              → RiceDecoder.decode() → wavelet coefficients
            ISyntaxInverter.synthesize() → progressively sharper ImageData
```

### 4.3 Render Flow

```
ImageData set on MainImage
  │
  RenderingEngine.requestRenderFrame(viewportId)
  │
  StackViewport.render()
  │
  RenderPipeline.execute({ camera, backend, canvas, properties, imageData })
  │
  ├── ImageMapper      → copies ImageData into context.outputImageData
  ├── VOILUTStage      → applies window/level transform (CPU path)
  │                       or GPU via WebGLBackend.setVOI() if WebGL backend
  ├── ColorMapStage    → (stub, pass-through)
  └── CompositorStage  → camera.computeTransform() → backend.drawImage()
                          │
                          ├── Canvas2DBackend: OffscreenCanvas + drawImage()
                          └── WebGLBackend: WebGL2 texture + shader VOI/LUT
```

---

## 5. iSyntax Codec Pipeline

iSyntax uses a **wavelet-based pyramid codec**. The decode pipeline ports Philips' reference Java/Groovy implementation to TypeScript.

### Image Format Variants

| Format Code | Color Space | Planes |
|-------------|-------------|--------|
| `YBRF8` | YBR Full 8-bit | 3 |
| `YBRFE` | YBR Full Extended | 3 |
| `YBRP8` | YBR Partial 8-bit | 3 |
| `YBRPE` | YBR Partial Extended | 3 |
| Monochrome | Grayscale | 1 |

### Resolution Pyramid

Each image is a multi-level DWT pyramid:

```
Level N  (coarsest, from InitImage endpoint)
Level N-1
...
Level 0  (finest detail, from GetCoefficients endpoint)
```

`InitImageResponse.xformLevels` = total pyramid depth (N). The `RiceAndSnakeDecoder` handles the initial level; subsequent levels use `RiceDecoder`.

### Decoding Steps

```
Binary response bytes
  │
  ├── DataViewBinaryReader (bit-level reader)
  │     Supports: readBit(), readBits(n), scanToNext1() for Golomb-Rice decoding
  │
  ├── RiceAndSnakeDecoder (InitImage)
  │     1. Read Rice code parameters (maskBits, bps per plane)
  │     2. Decode zigzag "snake" scanning pattern
  │     3. Apply differential coding (prediction + residual)
  │     Output: Int16Array or Int32Array subbands (LL/LH/HL/HH)
  │
  ├── RiceDecoder (GetCoefficients)
  │     1. Parse partition headers (row/col partition count)
  │     2. Per partition: decode LH, HL, HH subband blocks
  │     3. Block-level Rice decoding
  │     Output: wavelet coefficient array
  │
  └── ISyntaxInverter (5/3 inverse DWT)
        Implements Daubechies 5/3 lifting scheme synthesis:
        1. Horizontal inverse pass
        2. Vertical inverse pass
        3. Upsampling by 2 per level
        Output: reconstructed pixel data at full resolution
```

### ISyntaxInverter (5/3 DWT)

The `ISyntaxInvertor.z5_3_synthesize()` method implements the standard reversible **LeGall 5/3 filter bank**:

- Reconstruction from LL (low-low), LH (low-high), HL (high-low), HH (high-high) subbands
- Integer arithmetic to avoid floating-point rounding errors
- Handles odd-dimension edge cases

---

## 6. Rendering Pipeline

### Pipeline Stages

```
ImageMapper
  ↓ copies input ImageData → context.outputImageData

VOILUTStage
  ↓ Optional window/level transform
  ↓ lower = windowCenter - windowWidth/2
  ↓ upper = windowCenter + windowWidth/2
  ↓ normalizes each RGB channel into [0, 255]
  ↓ optional invert

ColorMapStage
  ↓ Stub: future pseudo-color LUT support

CompositorStage
  ↓ camera.computeTransform() → { offsetX, offsetY, scaleX, scaleY, rotation }
  ↓ backend.clear()
  ↓ backend.drawImage(imageData, transform, w, h)
```

### Rendering Backends

| Backend | When Used | Notes |
|---------|-----------|-------|
| `Canvas2DBackend` | Default | Software rendering via `CanvasRenderingContext2D`. Uses `OffscreenCanvas` for ImageData → bitmap conversion. Supports rotation, flip, pan, zoom. |
| `WebGLBackend` | StackViewport | WebGL2 accelerated. GLSL shaders handle VOI window/level and invert directly on GPU. Faster for large images. |

### Camera2D

`Camera2D` maintains the viewport transform state:

| Property | Description |
|----------|-------------|
| `panX`, `panY` | Translation offsets |
| `zoom` | Scale factor (clamped 0.01–100) |
| `rotation` | Degrees, wraps at 360 |
| `flipH`, `flipV` | Boolean flags |

`computeTransform()` maps camera state → `CanvasTransform { offsetX, offsetY, scaleX, scaleY, rotation }`.

### Event Bus

`EventBus` is a simple typed pub/sub:

| Event | Payload | Consumers |
|-------|---------|-----------|
| `CAMERA_MODIFIED` | `{ viewportId, camera: CameraState }` | `ViewportOverlay` (zoom display) |
| `VOI_MODIFIED` | `{ viewportId, windowCenter, windowWidth }` | `ViewportOverlay` (W/L display) |
| `VIEWPORT_ENABLED` | `{ viewportId, renderingEngineId }` | — |

---

## 7. Component Architecture

### Page Hierarchy

```
App (React Router)
├── / → Worklist
│         ├── TitleBar
│         │     └── SettingsMenu → AboutDialog / PreferencesDialog
│         ├── AddStudy inline form
│         └── Study table rows (delete button on user-added rows)
│
└── /view/:studyId?sid= → ViewerPage
          ├── TitleBar (back button + SettingsMenu)
          │     └── ToolPalette (centered in title bar)
          ├── ThumbnailPanel (left, resizable)
          │     └── SeriesCard × N
          │           └── ThumbnailCanvas (OffscreenCanvas)
          ├── ResizeHandle (left)
          ├── Main canvas area
          │     ├── MainImage (RenderingEngine host)
          │     └── ViewportOverlay (corners: patient info, image info, W/L, zoom)
          ├── ResizeHandle (right, conditional)
          └── MetadataPanel (right, conditional)
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| `Worklist` | List studies (built-in + user-added), add/remove studies, navigate to viewer |
| `ViewerPage` | Load study, coordinate image loading, manage viewport state |
| `MainImage` | Mount `RenderingEngine`, init `StackViewport`, attach `InteractionDispatcher` |
| `ThumbnailPanel` | Show series/image carousels with canvas thumbnails, handle selection |
| `ToolPalette` | Toggle between Pan/Zoom/WindowLevel modes; reset; download; metadata toggle |
| `ViewportOverlay` | Four-corner overlay: patient name/ID top-left, image/zoom/WL stats top-right, orientation bottom corners |
| `MetadataPanel` | Scrollable DICOM tag table for selected image |
| `ResizeHandle` | Pointer-drag handler for panel width resizing |
| `TitleBar` | Navigation bar; composable via `children` for center content (ToolPalette in viewer) |
| `SettingsMenu` | Gear button + dropdown with keyboard/click-outside dismiss |
| `AboutDialog` | Read-only app info: version (from `__APP_VERSION__`), developer, OS, browser |
| `PreferencesDialog` | Target hostname input with URL validation and localStorage persistence |

---

## 8. State Management

All state is local `useState`/`useRef`. No Redux or Context API is used.

### ViewerPage State

| State | Type | Description |
|-------|------|-------------|
| `studyId` | `string` | From URL params / route state |
| `stackId` | `string` | From `?sid=` query param or route state |
| `studyInfo` | `StudyInfo \| null` | Patient/study metadata |
| `imageIds` | `string[]` | Ordered instance UIDs for the study |
| `seriesGroups` | `SeriesGroup[]` | Images grouped by SeriesUID |
| `selectedSeriesIndex` | `number` | Currently displayed series |
| `selectedImageIndex` | `number` | Currently displayed image within series |
| `currentImage` | `ImageData \| null` | Decoded pixel data for display |
| `thumbnails` | `Map<uid, ImageData>` | Init-level thumbnails per instance |
| `initImages` | `Map<uid, DecodedImage>` | Cached init-level decoded results |
| `metadataMap` | `Map<uid, DicomImageMetadata>` | DICOM metadata per instance |
| `mode` | `InteractionMode` | `'pan' \| 'zoom' \| 'windowLevel'` |
| `showMetadata` | `boolean` | Toggle metadata panel |
| `thumbWidth` / `metaWidth` | `number` | Resizable panel widths |
| `loading` / `progress` / `error` | — | UI feedback states |

### Refs

| Ref | Purpose |
|-----|---------|
| `controllerRef` | Legacy `ICanvasController` (from `MainImage`) |
| `serviceRef` | Active `ISyntaxImageService` for current image |
| `servicesRef` | `Map<uid, ISyntaxImageService>` for all loaded images |

---

## 9. Persistence & Configuration

### Preference Resolution Chain

```
getEffectiveTargetHostname()
  │
  ├── localStorage key 'isyntax_preferences'
  │     → JSON: { targetHostname?: string }
  │     → read by getPersistedTargetHostname()
  │
  └── Fallback: DEFAULT_TARGET_HOSTNAME = 'http://localhost:5000'
               (defined in PreferencesService.ts)
```

The transport layer (`src/transport/endpoints/config.ts`) calls `getEffectiveTargetHostname()` at request time, so changes take effect immediately after saving preferences (no restart needed).

### User-Added Studies Persistence

```
localStorage key 'isyntax_added_studies'
  → JSON: [ { studyId: string, stackId: string }, ... ]
```

Managed by `StudyStorageService`:
- `addStudy()` — deduplicates on `studyId + stackId`, then appends and saves
- `removeStudy()` — filters by compound key, saves remainder
- `getAddedStudies()` — parses and validates array structure

### Tauri vs Browser Behaviour

| Context | Request routing |
|---------|----------------|
| Browser | Full URL using effective hostname (`http://host:port/ResultsAuthority/...`) — backend must allow CORS |
| Tauri desktop | Same — no proxy needed, Tauri WebView doesn't enforce same-origin policy |

---

## 10. Transport Layer

### URL Builders (`src/transport/endpoints/config.ts`)

All URL constructors call `getApiBaseUrl()` at runtime:

```typescript
function getApiBaseUrl(): string {
  return `${getEffectiveTargetHostname()}/ResultsAuthority`;
}
```

| Function | Endpoint |
|----------|----------|
| `getStudyDocUrl(studyUID, sid)` | `GET .../Study/{uid}/iSyntaxStudy?sid={sid}` |
| `getInitImageUrl(studyUID, instanceUID, sid)` | `GET .../Study/{uid}/Instance/{iuid}/iSyntaxInitImage?TQ=0&V=0&P=0&sid={sid}` |
| `getCoefficientsUrl(studyUID, instanceUID, level, sid)` | `GET .../Study/{uid}/Instance/{iuid}/iSyntaxCoeffs?P=2&F=Y&L={level}&...&sid={sid}` |

### HttpTransport

`HttpTransport` implements `ITransport`:
- `fetchBinary(url)` → `Uint8Array`
- `fetchArrayBuffer(url)` → `ArrayBuffer`

---

## 11. Key Interfaces

```typescript
interface IImageService {
  readonly totalLevels: number;
  readonly isFullyLoaded: boolean;
  readonly cachedResult: DecodedImage | null;
  dicomMetadata: DicomImageMetadata | null;
  initImage(rows?, cols?): Promise<DecodedImage>;
  loadLevel(level): Promise<DecodedImage>;
  loadAllLevels(onProgress?): Promise<DecodedImage>;
  dispose(): void;
}

interface ICanvasController {           // legacy, transitioning to IViewport
  render(): void;
  setImageData(imageData: ImageData): void;
  setMode(mode: InteractionMode): void;
  reset(): void;
  getViewportState(): ViewportState;
  dispose(): void;
}

interface ICodec {
  readonly name: string;
  decode(data, ...args): { resultBuffer: ImageArray };
}

interface ITransport {
  fetchBinary(url): Promise<Uint8Array>;
  fetchArrayBuffer(url): Promise<ArrayBuffer>;
}

interface IRenderStage {
  readonly name: string;
  execute(context: RenderContext): void;
}

interface IRendererBackend {
  init(canvas): void;
  clear(color?): void;
  drawImage(source, transform, width, height): void;
  dispose(): void;
}
```

---

## 12. Navigation & Routing

React Router v7 is used with two routes:

| Route | Component | Notes |
|-------|-----------|-------|
| `/` | `Worklist` | Study list |
| `/view/:studyId` | `ViewerPage` | Image viewer; `stackId` from `?sid=` query param |

### Navigation call

```typescript
navigate(`/view/${row.studyId}?sid=${encodeURIComponent(row.stackId)}`, {
  state: { studyId: row.studyId, stackId: row.stackId }
});
```

`ViewerPage` reads `stackId` from URL search params first (survives page refresh), with `location.state` as fallback:

```typescript
const [stackId] = useState(searchParams.get('sid') || routeState?.stackId || '');
```

---

## 13. Feature: Settings System

### Menu Structure

```
TitleBar
  └── SettingsMenu (far-right gear icon)
        ├── click-outside / Escape → close
        ├── "About" (Info icon) → AboutDialog
        └── "Preferences" (SlidersHorizontal icon) → PreferencesDialog
```

### AboutDialog

Displays at runtime:
- App name (hardcoded: "iSyntax Viewer")
- Version: `__APP_VERSION__` (injected by Vite from `package.json` at build time)
- Developer: `Shiju P K`, `shiju.pk@philips.com`
- Browser: parsed from `navigator.userAgent`
- OS: parsed from `navigator.userAgent` (Windows NT version, macOS version, Linux)

### PreferencesDialog

- Single field: **Target Hostname** (e.g. `http://10.0.0.1:5000`)
- Validation: `new URL(value)` — must parse as a valid URL
- Empty input: clears override → uses default hostname
- Saved to `localStorage['isyntax_preferences'].targetHostname`

---

## 14. Feature: Study Worklist

### Study Sources

| Source | Persistence | Deletable |
|--------|-------------|-----------|
| `studies.json` built-in | Hardcoded at build time | No |
| User-added via form | `localStorage['isyntax_added_studies']` | Yes (trash icon) |

### Add Study Form

Inputs: `Study ID` (DICOM Study UID) + `Stack ID` (e.g. `PR3`)

On submit:
1. `StudyStorageService.addStudy()` — persists to localStorage (dedup check)
2. New `StudyRow` added to state with `loading: true`, `isUserAdded: true`
3. `fetchAndUpdateRow()` — calls `StudyService.getStudyInfoAndImageIds()` to populate patient name, ID, modality, image count

---

## 15. Known Limitations & Future Work

| Area | Status | Notes |
|------|--------|-------|
| `WSIViewport` | In development | Tiled whole-slide viewport for very large images |
| `ColorMapStage` | Stub | Pseudo-color LUT not yet implemented |
| `ICanvasController` | Deprecated | Being replaced by `IViewport` from rendering engine |
| Test coverage | None | No unit or integration tests yet |
| WebGL backend | Partial | W/L and invert working; rotation/flip on CPU path |
| Multi-frame DICOM | Not supported | Only single-series iSyntax supported |
| Authentication | None | No token/session handling in transport layer |
| Worker threads | None | Image decoding is on main thread; large images may block UI |
| Progressive tile rendering | Designed but inactive | `TileManager` infrastructure exists for future WSI path |
