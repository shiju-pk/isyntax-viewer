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

### 4. Quick Setup for Real PACS Backend

To connect to a live PACS system:

1. **Edit configuration:** Update `public/config.json`:
   ```json
   {
     "targetHostname": "http://your-pacs-server:5000",
     "authEnabled": true
   }
   ```

2. **Ensure backend APIs:** Your PACS must implement:
   - `POST /ResultsAuthority/auth/login` (authentication)
   - `GET /ResultsAuthority/worklist/query` (clinical worklist)
   - Existing iSyntax image endpoints

3. **Configure CORS:** Add these headers to your PACS responses:
   ```http
   Access-Control-Allow-Origin: http://localhost:5173
   Access-Control-Allow-Headers: Content-Type, Authorization
   ```

4. **Restart and login:** Refresh the app — you'll see the login page

---

## Configuration

### Real PACS Backend Setup

The app supports two modes:
- **Mock Mode** (default) — Uses hardcoded test data for development
- **Real PACS Mode** — Connects to a live Philips ResultsAuthority REST API

#### Enabling Real PACS Backend

**Method 1: Configuration File (Recommended for deployment)**

Edit `public/config.json`:
```json
{
  "targetHostname": "http://your-pacs-server:5000",
  "apiBasePath": "/ResultsAuthority",
  "adapterType": "isyntax",
  "authEnabled": true,
  "logLevel": "info"
}
```

**Method 2: Runtime Configuration**

1. Start the app in default mode
2. Open **Settings → Preferences** from the title bar
3. Enter your ResultsAuthority server hostname (e.g. `http://10.0.0.5:5000`)
4. Click **Save** — settings persist in `localStorage`

**Method 3: Environment Variables (Build-time)**

Set these environment variables before building:
```bash
VITE_TARGET_HOSTNAME=http://your-pacs-server:5000
VITE_API_BASE_PATH=/ResultsAuthority
```

### Authentication Setup

#### Enabling Authentication

Set `authEnabled: true` in your configuration. When enabled:

- Users are redirected to `/login` on app start
- Login page accepts username/password credentials
- Session management with automatic timeout detection
- Logout functionality in the title bar

#### Backend Authentication Requirements

Your PACS backend must implement these endpoints:

```http
POST /ResultsAuthority/auth/login
Content-Type: application/json

{
  "username": "user@domain.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "sessionToken": "jwt-token-here",
  "expiresAt": "2024-01-01T12:00:00Z"
}
```

```http
POST /ResultsAuthority/auth/logout
Authorization: Bearer {sessionToken}

Response:
{
  "success": true
}
```

#### Session Management

- **Timeout:** Configurable via `sessionTimeoutMs` (default: 30 minutes)
- **Keep-alive:** Automatic session validation every 60 seconds
- **Token storage:** Session tokens are kept in memory (not persisted)
- **Auto-logout:** Users are redirected to login on session expiry

### Clinical Worklist Integration

#### Backend Worklist API

Your PACS must implement the worklist query endpoint:

```http
GET /ResultsAuthority/worklist/query
Authorization: Bearer {sessionToken}
Query Parameters:
  - patientName (optional): Patient name filter
  - patientId (optional): Patient ID filter  
  - accessionNumber (optional): Accession number filter
  - modality (optional): Modality filter (CT, MR, etc.)
  - dateFrom (optional): Start date (YYYYMMDD)
  - dateTo (optional): End date (YYYYMMDD)
  - maxResults (optional): Limit results (default: 100)

Response:
[
  {
    "examKey": "unique-exam-identifier",
    "patientName": "DOE^JOHN",
    "patientId": "12345",
    "accessionNumber": "ACC001",
    "modality": "CT",
    "studyDate": "20240101",
    "studyDescription": "Chest CT with contrast",
    "studyUIDs": ["1.2.3.4.5.6.7.8.9"],
    "stackId": "PR3"
  }
]
```

#### Worklist Features

- **Real-time search:** Query filters are sent to backend
- **Patient privacy:** All patient data comes from your PACS
- **Study launching:** Click any worklist entry to open the viewer
- **Prior studies:** Automatic detection of patient's previous studies

### Backend CORS Requirements

**For browser access:** Your ResultsAuthority backend must respond with appropriate CORS headers:

```http
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

**For Tauri desktop:** No CORS headers needed — native app bypasses browser restrictions.

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

### Authentication Endpoints

| Purpose | Method | Path | Auth Required |
|---------|--------|------|---------------|
| User login | `POST` | `/ResultsAuthority/auth/login` | No |
| User logout | `POST` | `/ResultsAuthority/auth/logout` | Yes |
| Session validation | `GET` | `/ResultsAuthority/auth/validate` | Yes |

### Worklist Endpoints

| Purpose | Method | Path | Auth Required |
|---------|--------|------|---------------|
| Query worklist | `GET` | `/ResultsAuthority/worklist/query` | Yes |
| Get study details | `GET` | `/ResultsAuthority/worklist/study/{examKey}` | Yes |
| Query prior studies | `GET` | `/ResultsAuthority/worklist/priors/{patientId}` | Yes |

### Image Endpoints

| Purpose | Method | Path | Auth Required |
|---------|--------|------|---------------|
| Study metadata + image list | `GET` | `/ResultsAuthority/Study/{studyUID}/iSyntaxStudy?sid={stackId}` | Yes |
| Init image (coarsest level) | `GET` | `/ResultsAuthority/Study/{studyUID}/Instance/{instanceUID}/iSyntaxInitImage?TQ=0&V=0&P=0&sid={stackId}` | Yes |
| Wavelet coefficients (fine levels) | `GET` | `/ResultsAuthority/Study/{studyUID}/Instance/{instanceUID}/iSyntaxCoeffs?P=2&F=Y&L={level}&...&sid={stackId}` | Yes |
| Presentation state | `GET` | `/ResultsAuthority/Study/{studyUID}/PresentationState?N={psName}` | Yes |

### Response Formats

- **Authentication endpoints:** JSON responses
- **Worklist endpoints:** JSON responses  
- **Image endpoints:** Binary responses (iSyntax protocol)
- **Error responses:** JSON with `{ "error": "message", "code": 400 }` format

All authenticated endpoints require `Authorization: Bearer {sessionToken}` header. The `studyUID` is a DICOM Study Instance UID. The `stackId` identifies a specific image acquisition (e.g. `PR3`, `PR5`).

---

## Troubleshooting

### Authentication Issues

**Problem:** Login fails with "Authentication failed"
- Check backend `/auth/login` endpoint is implemented
- Verify username/password are correct
- Check network connectivity to PACS server
- Inspect browser Network tab for HTTP error codes

**Problem:** Session expires immediately
- Verify backend returns valid `sessionToken` in login response
- Check `sessionTimeoutMs` configuration (default: 30 minutes)
- Ensure backend `/auth/validate` endpoint works correctly

### Worklist Issues

**Problem:** Worklist is empty
- Verify `authEnabled: true` in configuration
- Check backend `/worklist/query` endpoint implementation
- Ensure user has appropriate PACS permissions
- Test worklist API directly with tools like Postman

**Problem:** "Worklist not wired" message
- This indicates the ISyntaxPACSAdapter needs backend integration
- The `queryWorklist()` method currently returns empty results
- Backend worklist API must be implemented and wired

### Image Loading Issues

**Problem:** Images fail to load
- Verify study exists in PACS with correct `studyUID` and `stackId`
- Check backend image endpoints are accessible
- Ensure CORS headers are configured for browser access
- Test image URLs directly in browser/Postman

**Problem:** "Study not found" errors
- Verify `studyUID` format is correct DICOM UID
- Check `stackId` matches available stacks in PACS
- Ensure user has permissions to access the study

### Network Issues

**Problem:** CORS errors in browser
- Add CORS headers to backend responses (see Configuration section)
- Use Tauri desktop mode to bypass CORS restrictions
- Configure backend to allow frontend origin

**Problem:** Connection refused
- Verify PACS server is running and accessible
- Check `targetHostname` configuration points to correct server
- Test connectivity with `curl` or browser

### Configuration Issues

**Problem:** Config changes not taking effect
- Clear browser localStorage and refresh
- Restart development server after config file changes
- Check browser console for config loading errors
- Verify JSON syntax in `public/config.json`

### Development Mode Issues

**Problem:** Hot reload not working with authentication
- Restart dev server after enabling authentication
- Clear browser cache and localStorage
- Check for JavaScript errors in browser console

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

