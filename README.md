# iSyntax Viewer

A viewer for Philips iSyntax images. Runs as a web application or as a native desktop application via [Tauri](https://tauri.app/). Connects to a Philips ResultsAuthority REST API to fetch and decode iSyntax pyramid images entirely in the browser using a native TypeScript implementation of the iSyntax codec.

> **Note:** Proof of concept — demo purpose only.

**Developer:** Shiju P K (shiju.pk@philips.com)

---

## Table of Contents

1. [Features](#features)
2. [Prerequisites](#prerequisites)
3. [Getting Started](#getting-started)
4. [Configuration](#configuration)
5. [Usage Guide](#usage-guide)
6. [Project Structure](#project-structure)
7. [Tech Stack](#tech-stack)
8. [Architecture Overview](#architecture-overview)
9. [API Endpoints](#api-endpoints)
10. [Tauri Desktop App](#tauri-desktop-app)

---

## Features

- **Study worklist** — view built-in and user-added studies in a table
- **Add study** — enter a Study ID and Stack ID to load any study from the connected server; persists across refreshes
- **Remove studies** — user-added studies can be removed; built-in studies are always present
- **Progressive image loading** — low-resolution preview loads instantly; detail levels load progressively
- **Interaction tools** — Pan, Zoom (mouse wheel + drag), Window/Level adjustment
- **Thumbnail panel** — resizable sidebar with per-series image carousels
- **DICOM metadata panel** — resizable sidebar showing all extracted DICOM tags
- **Viewport overlay** — patient name, modality, orientation labels, zoom level, W/L values
- **Download** — export current displayed image as PNG
- **Settings** — gear menu in the title bar with:
  - **About** — app version, developer info, OS and browser details
  - **Preferences** — configurable target hostname, persisted to localStorage
- **Tauri desktop packaging** — native `.msi`/`.dmg`/`.deb` installer

---

## Prerequisites

### Web app

- [Node.js](https://nodejs.org/) v18 or later
- npm (included with Node.js)

### Desktop app (Tauri)

All of the above, plus:

- [Rust](https://www.rust-lang.org/tools/install) v1.77.2 or later — install via `rustup`
- **Windows:** Visual Studio or Microsoft C++ Build Tools with the "Desktop development with C++" workload
- **macOS:** Xcode Command Line Tools — run `xcode-select --install`
- **Linux:** `libwebkit2gtk-4.1`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`  
  See full list at [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)

---

## Getting Started

### 1. Install dependencies

```sh
npm install
```

### 2. Start the development server

```sh
npm run dev
```

The app will be available at `http://localhost:5173`.

### 3. Open the app

Point your browser to `http://localhost:5173`. Built-in studies from `src/studies.json` load automatically. Use **Add Study** to add additional studies by Study ID and Stack ID.

---

## Configuration

### Target Hostname

The app connects to a Philips ResultsAuthority REST API. The default target is `http://localhost:5000`.

**At runtime:** Open **Settings → Preferences** from the title bar. Enter the hostname of your ResultsAuthority server (e.g. `http://10.0.0.5:5000`) and click **Save**. The value is persisted in `localStorage` and survives browser restarts. Leave the field empty to revert to the default.

**Backend CORS requirement:** The browser enforces cross-origin restrictions. Your ResultsAuthority backend must respond with appropriate `Access-Control-Allow-Origin` headers when the app is accessed via a browser. In Tauri (desktop mode) no CORS headers are needed.

### Built-in Studies

Edit `src/studies.json` to change the built-in study list:

```json
[
  { "studyId": "2.16.840...", "stackId": "PR3" },
  { "studyId": "2.16.840...", "stackId": "PR5" }
]
```

Changes take effect after rebuilding.

### Build version

The version shown in **Settings → About** is read from `package.json` and injected at build time via Vite's `define` feature (`__APP_VERSION__`). Update `version` in `package.json` to change it.

---

## Usage Guide

### Worklist

The main page shows all loaded studies. Columns: Patient Name, Patient ID, Study ID, Stack, Modality, Image Count.

- **Add Study** (top right): opens an inline form to enter a Study ID and Stack ID. The study's metadata is fetched from the server. The entry is saved to localStorage and reappears after a refresh.
- **Remove Study** (trash icon, hover over user-added rows): removes the study from the list and from localStorage.
- **Click a row**: opens the image viewer for that study.

### Image Viewer

#### Tools (title bar centre)

| Button | Action |
|--------|--------|
| Move (pan) | Click and drag to pan the image |
| Zoom | Scroll wheel to zoom; or click and drag vertically |
| W/L | Click and drag to adjust Window/Level (brightness/contrast) |
| Reset | Reset pan, zoom, and W/L to defaults |
| Download | Save the current view as a PNG file |
| Info (metadata) | Toggle the DICOM metadata panel |

#### Thumbnail panel (left)

- Shows one card per series, each containing image thumbnails
- Use the left/right arrows on a card to browse images within the series
- Click a thumbnail to load that image (triggers progressive enhancement)

#### Viewport overlay

Four corners display:
- **Top-left:** Patient name, patient ID, modality
- **Top-right:** Zoom percentage, Window/Level values, image resolution
- **Bottom-left / Bottom-right:** Anatomical orientation labels (e.g. A / P / L / R)

#### Progressive loading

When you first open a study, a low-resolution preview appears immediately (from the InitImage endpoint). When you click a thumbnail, higher-detail levels are fetched one by one from the GetCoefficients endpoint. A progress bar shows enhancement progress.

---

## Project Structure

```
src/
├── codecs/isyntax/        — Rice and RiceAndSnake entropy decoders
├── core/
│   ├── constants/         — Codec constants (image format codes)
│   ├── interfaces/        — ICodec, IImageService, ITransport, ICanvasController
│   └── types/             — DicomImageMetadata, StudyInfo, DecodedImage, ViewportState
├── dicom/
│   ├── metadata/          — DICOM XML → metadata extraction
│   ├── orientation.ts     — Image orientation → anatomical direction labels
│   ├── sop/               — Non-image SOP class filter registry
│   └── tags/              — Typed DICOM tag constants
├── imaging/
│   ├── model/             — PyramidImage, ISyntaxImage, ZoomLevelView
│   ├── processing/        — ISyntaxProcessor (decode orchestration), ISyntaxInverter (5/3 DWT)
│   └── tiling/            — TileManager, TileGrid, TileCache (for WSI tiled mode)
├── parsers/
│   ├── binary/            — Bit-level binary reader
│   ├── isyntax/           — InitImage and GetCoefficients binary protocol parsers
│   └── studydoc/          — Binary StudyDoc container parser
├── rendering/
│   ├── backends/          — Canvas2DBackend, WebGLBackend
│   ├── camera/            — Camera2D (pan, zoom, rotation, flip)
│   ├── engine/            — RenderingEngine, viewport lifecycle
│   ├── events/            — EventBus, RenderingEvents
│   ├── pipeline/          — RenderPipeline + stages (ImageMapper, VOILUT, ColorMap, Compositor)
│   └── viewports/         — Viewport base, StackViewport, WSIViewport (in development)
├── services/
│   ├── config/            — PreferencesService (localStorage hostname persistence)
│   ├── image/             — ISyntaxImageService (fetch + decode per instance)
│   ├── storage/           — StudyStorageService (user-added studies persistence)
│   └── study/             — StudyService (fetch + parse StudyDoc, cache)
├── tools/interaction/     — Pan, Zoom, WindowLevel tools; InteractionDispatcher
├── transport/endpoints/   — URL builders (use effective hostname at runtime)
├── presentation/
│   ├── pages/
│   │   ├── worklist/      — Worklist.tsx
│   │   └── viewer/        — ViewerPage.tsx
│   └── components/
│       ├── TitleBar/      — App header
│       ├── Settings/      — SettingsMenu, AboutDialog, PreferencesDialog
│       └── Viewer/        — MainImage, ThumbnailPanel, ToolPalette, MetadataPanel,
│                             ResizeHandle, ViewportOverlay
├── studies.json           — Built-in study definitions
└── vite-env.d.ts          — Vite env types + __APP_VERSION__ declaration
src-tauri/
├── tauri.conf.json        — Tauri window, bundle, and security configuration
├── Cargo.toml             — Rust dependencies (Tauri 2.x)
├── src/                   — Rust entry points (lib.rs, main.rs)
└── icons/                 — App icons for all platforms
```

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18 | UI framework |
| TypeScript | ~5.6 | Type safety |
| Vite | 6 | Dev server and bundler |
| Tailwind CSS | 4 | Utility-first styling |
| React Router | 7 | Client-side routing |
| Lucide React | — | Icons |
| pako | 2 | zlib/deflate decompression (StudyDoc parsing) |
| Tauri | 2 | Native desktop shell (Rust + WebView) |

---

## Architecture Overview

The app is structured in clean layers with no cross-layer imports:

```
Presentation  →  Services  →  Codecs / Parsers / Imaging
                   ↓
              Transport  →  ResultsAuthority REST API
```

### Image decode pipeline

```
HTTP binary response
  ↓
InitImageResponseParser / GetCoefficientsResponseParser
  ↓  (binary protocol parsing)
RiceAndSnakeDecoder / RiceDecoder
  ↓  (entropy decoding → wavelet coefficient arrays)
ISyntaxInverter (5/3 DWT synthesis)
  ↓  (inverse discrete wavelet transform)
ImageData (RGBA, ready to render)
```

### Render pipeline

```
ImageData
  ↓  ImageMapper
  ↓  VOILUTStage       — window/level transform (CPU or GPU)
  ↓  ColorMapStage     — reserved for future pseudo-color support
  ↓  CompositorStage   — camera transform + backend draw
        ↓
        Canvas2DBackend  — software rendering via Canvas 2D API
        WebGLBackend     — GPU-accelerated via WebGL2 shaders
```

For full architectural detail, see [DESIGN.md](DESIGN.md).

---

## API Endpoints

All endpoints are served by the Philips ResultsAuthority REST service.

| Purpose | Method | Path |
|---------|--------|------|
| Study metadata + image list | `GET` | `/ResultsAuthority/Study/{studyUID}/iSyntaxStudy?sid={stackId}` |
| Init image (coarsest level) | `GET` | `/ResultsAuthority/Study/{studyUID}/Instance/{instanceUID}/iSyntaxInitImage?TQ=0&V=0&P=0&sid={stackId}` |
| Wavelet coefficients (fine levels) | `GET` | `/ResultsAuthority/Study/{studyUID}/Instance/{instanceUID}/iSyntaxCoeffs?P=2&F=Y&L={level}&...&sid={stackId}` |

All responses are binary. The `studyUID` is a DICOM Study Instance UID. The `stackId` identifies a specific image acquisition (e.g. `PR3`, `PR5`).

---

## Tauri Desktop App

### Development

Launches the Vite dev server and opens the app in a native window with hot reload:

```sh
npm run tauri dev
```

### Production build

Builds the frontend, compiles the Rust backend, and packages a native installer:

```sh
npm run tauri build
```

Output is written to `src-tauri/target/release/bundle/`:

| Platform | Formats |
|----------|---------|
| Windows | `.msi` (bundle/msi/), `.exe` (bundle/nsis/) |
| macOS | `.dmg` (bundle/dmg/), `.app` (bundle/macos/) |
| Linux | `.deb` (bundle/deb/), `.AppImage` (bundle/appimage/) |

### Tauri CLI

```sh
# List all Tauri CLI commands
npm run tauri -- --help
```

### Window configuration

Edit `src-tauri/tauri.conf.json` to change window dimensions, title, or resizability:

```json
"app": {
  "windows": [{
    "title": "iSyntax Viewer",
    "width": 1280,
    "height": 800,
    "resizable": true
  }]
}
```

