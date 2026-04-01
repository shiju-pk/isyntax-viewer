# iSyntax Viewer

A web-based viewer for iSyntax digital pathology images, built with React, TypeScript, Vite, and Tailwind CSS.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- npm (included with Node.js)

## Getting Started

### Install dependencies

```sh
npm install
```

### Development server

Start the local dev server with hot module replacement:

```sh
npm run dev
```

The app will be available at `http://localhost:5173` by default.

### Production build

Type-check and bundle for production:

```sh
npm run build
```

Output is written to the `dist/` directory.

### Preview production build

Serve the production build locally:

```sh
npm run preview
```

## Project Structure

```
src/
  components/    # React UI components (App, Viewer, Worklist, TitleBar)
  lib/
    isyntax/     # iSyntax codec: decoding, inversion, pyramid image handling
    config.ts    # Runtime configuration
    canvasRenderer.ts
    dicomMetadata.ts
    isyntaxImageLoader.ts
    studyDocParser.ts
    studyDocService.ts
```

## Tech Stack

- **React 18** — UI framework
- **TypeScript** — type-safe JavaScript
- **Vite 6** — dev server and bundler
- **Tailwind CSS 4** — utility-first styling
- **pako** — zlib decompression for iSyntax data
