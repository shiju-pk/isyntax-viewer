
# Product Requirements Document (PRD)
## Next-Generation PACS Viewer

**Project Name:** PACS Viewer Modernization  
**Document Version:** 1.0  
**Status:** Draft  
**Owner:** Shiju P K  
**Frontend Stack:** TypeScript  
**Architecture Style:** Modular, phase-based, backend-adapter-driven  
**Last Updated:** 2026-04-07

---

# 1. Overview

## 1.1 Purpose

This document defines the product requirements for building a feature-rich, modern PACS viewer from an existing simple TypeScript-based viewer. The new viewer will be developed incrementally in phases, starting with a robust diagnostic 2D foundation and expanding toward advanced clinical, workflow, and enterprise capabilities.

The PACS backend is proprietary, and not all APIs are known upfront. Therefore, the viewer must be designed to support progressive backend discovery and phased integration through abstraction layers and adapter-based contracts.

## 1.2 Vision

Build a high-performance, clinically useful PACS viewer that can evolve phase by phase into an industry-grade imaging viewer with strong diagnostic workflows, extensibility, and enterprise readiness.

## 1.3 Background

A simple PACS viewer has already been implemented using TypeScript. That implementation proves the base feasibility of image viewing, but it does not yet include the broader workflow and diagnostic capabilities expected in mature PACS viewers.

The next-generation viewer must:
- preserve flexibility while backend APIs are still being discovered,
- support phased feature delivery,
- align with common industry PACS capabilities,
- remain maintainable and extensible over time.

---

# 2. Goals

## 2.1 Primary Goals

- Create a modern PACS viewer with strong diagnostic viewing capabilities.
- Build the viewer phase by phase to reduce risk and support incremental delivery.
- Isolate proprietary PACS dependencies behind stable frontend contracts.
- Prioritize performance, usability, and workflow efficiency.
- Support future expansion into advanced visualization and enterprise workflows.

## 2.2 Secondary Goals

- Align internal models with DICOM concepts where practical.
- Reduce rewrite when new proprietary PACS APIs become available.
- Support configurable deployment, extensibility, and future specialty modules.

## 2.3 Non-Goals for Early Releases

The following are not mandatory for early phases unless explicitly prioritized:
- Full RIS/HIS workflow integration
- Voice dictation/report authoring
- Full cinematic 3D rendering
- Complete specialty-modality support from day one
- Full structured reporting authoring
- Full AI integration at launch
- Complete save-back support before backend APIs are known

---

# 3. Product Principles

## 3.1 Backend-Agnostic Viewer Core

The viewer UI and core workflow logic must not directly depend on proprietary PACS API details.

## 3.2 Adapter-Based Integration

All server communication must go through adapter interfaces such as:
- authentication adapter,
- study/worklist adapter,
- metadata adapter,
- image retrieval adapter,
- persistence adapter,
- export adapter.

## 3.3 Capability-Driven Design

Because PACS APIs are proprietary and may be partially known, the viewer must support:
- feature flags,
- capability discovery,
- graceful degradation,
- partial backend implementations.

## 3.4 Performance First

The viewer must remain responsive during:
- image loading,
- stack scrolling,
- zoom/pan/window-level,
- cine playback,
- layout switching,
- synchronization,
- MPR in later phases.

## 3.5 Workflow Over Feature Count

Each phase should deliver meaningful end-to-end workflow value rather than isolated technical features.

---

# 4. Users

## 4.1 Primary Users

- Radiologists
- Diagnostic imaging specialists
- Clinical reviewers
- PACS administrators

## 4.2 Secondary Users

- Referring physicians
- Technologists
- Deployment/support engineers
- Integration engineers

---

# 5. Assumptions and Constraints

- The current viewer is implemented in TypeScript.
- The viewer already supports basic image display functionality.
- The PACS backend is proprietary.
- Not all backend APIs are currently known.
- API details may be provided incrementally through code references and implementation examples.
- The viewer must be developed in controlled phases.
- The system should support both mocked and real backend integration.

---

# 6. Scope

## 6.1 In Scope

The full target product may eventually include:

### 6.1.1 Study and Series Workflow
- Open study
- Study/series navigation
- Thumbnail panel
- Series filtering and sorting
- Open multiple series
- Compare with prior studies
- Viewport synchronization
- Multi-layout workflow

### 6.1.2 Core Image Interaction
- Window/level
- Zoom
- Pan
- Fit-to-window
- Invert
- Rotate
- Flip
- Stack scroll
- Cine playback
- Reset viewport
- Orientation markers
- Demographic/study overlays

### 6.1.3 Measurements and Annotations
- Length
- Angle
- Cobb angle
- Rectangle ROI
- Ellipse ROI
- Freehand ROI
- Text annotation
- Measurement statistics
- Edit/delete annotations
- Persistence support

### 6.1.4 Overlay and Presentation Features
- Embedded overlays
- Bitmap overlays
- GSPS or equivalent presentation-state rendering
- Graphic annotations
- Graphic layers
- Shutter/display-area behavior where required

### 6.1.5 Workflow Productivity
- Hanging protocols
- Layout presets
- Prior comparison
- User preferences
- Session persistence
- Shortcuts and interaction customization

### 6.1.6 Advanced Visualization
- MPR
- Oblique MPR
- Crosshair linking
- Slab thickness
- Multi-planar synchronization
- Segmentation overlays
- Volume workflows

### 6.1.7 Persistence and Export
- Save annotations
- Save display state
- Export image/screenshot
- Bookmark/key image workflow
- Deep links
- Session restore

### 6.1.8 Administration and Enterprise Support
- Authentication/session handling
- Role-based access
- Audit hooks
- Deployment configuration
- Diagnostics and environment information
- Feature toggles

## 6.2 Out of Scope for Initial Phase

- Full reporting workflow
- Full 3D cinematic rendering
- Complete specialty packages
- Native AI inference pipeline
- Cross-enterprise data federation

---

# 7. High-Level Product Requirements

## 7.1 Viewer Core

The system shall:
- display medical images in diagnostic viewing layouts,
- support multi-series study review,
- preserve viewport state during common interactions,
- support configurable layouts and active viewport management.

## 7.2 PACS Integration Layer

The system shall:
- define stable frontend contracts for PACS interaction,
- allow multiple adapter implementations,
- isolate backend-specific payloads from UI components,
- support progressive integration of newly discovered APIs.

## 7.3 Capability Discovery

The system shall:
- expose supported PACS capabilities to the frontend,
- enable or disable features based on backend support,
- avoid runtime failures when a feature is not supported.

## 7.4 Performance

The system shall:
- load first viewable image quickly,
- support smooth stack scrolling,
- avoid UI thread blocking where possible,
- support efficient caching and progressive loading,
- scale to large studies.

## 7.5 Reliability

The system shall:
- recover gracefully from failed requests,
- report unsupported data clearly,
- avoid crashing on incomplete metadata or unsupported objects,
- provide diagnosable error states.

---

# 8. Functional Requirements

## 8.1 Study Loading

The system shall:
- open a study from a study identifier or proprietary equivalent,
- load study metadata,
- load series metadata,
- load image/frame metadata,
- retrieve pixel data progressively where possible,
- support cancel and retry.

## 8.2 Study Navigation

The system shall:
- show available series as thumbnails or navigable items,
- allow users to select one or more series,
- support sorting and grouping of series,
- maintain clear active series/viewport context.

## 8.3 Image Display and Interaction

The system shall support:
- window/level,
- pan,
- zoom,
- fit-to-window,
- invert,
- rotate,
- flip,
- scroll through stack,
- cine playback,
- reset image state,
- orientation and demographic labels.

## 8.4 Viewport Management

The system shall:
- support multiple viewport layouts,
- allow viewport selection and activation,
- support synchronized operations between selected viewports,
- preserve state during layout transitions where feasible.

## 8.5 Measurement Tools

The system shall support:
- length measurement,
- angle measurement,
- Cobb angle in later phase if prioritized,
- rectangle ROI,
- ellipse ROI,
- freehand ROI,
- annotation text,
- measurement visibility toggle,
- annotation editing and deletion.

## 8.6 Overlay and Presentation State

The system shall eventually support:
- embedded overlay rendering,
- graphic annotation rendering,
- GSPS or equivalent display-state application,
- graphic layer handling,
- display-area/shutter behavior where needed,
- visibility toggles for supported overlay layers.

## 8.7 Hanging Protocols

The system shall:
- support default layouts by modality/procedure,
- support prior-comparison layouts,
- support data-driven protocol matching,
- support site-level and user-level preferences.

## 8.8 Priors and Comparison Workflow

The system shall:
- load prior studies when available,
- show side-by-side comparisons,
- support synchronized scrolling and window/level where appropriate,
- support configurable comparison layouts.

## 8.9 MPR and Advanced Visualization

The system shall eventually support:
- axial/sagittal/coronal MPR,
- oblique MPR,
- crosshair linking,
- slab thickness control,
- volume synchronization,
- segmentation overlays.

## 8.10 Persistence

The system shall:
- support local session persistence first,
- later support backend persistence through adapters,
- distinguish temporary local state from backend-saved clinical state.

## 8.11 Export

The system shall eventually support:
- screenshot/image export,
- key image/bookmark support,
- export hooks for further workflows.

## 8.12 Preferences and Configuration

The system shall:
- support user preferences,
- persist preferences across sessions,
- support environment-specific configuration,
- support feature toggles and backend-driven capability configuration.

---

# 9. Non-Functional Requirements

## 9.1 Performance Requirements

- First usable image should load quickly.
- Stack scrolling must remain smooth for common studies.
- User interactions must feel immediate.
- Large studies must not freeze the UI.
- Rendering work should use optimized strategies and background processing where possible.

## 9.2 Reliability Requirements

- Failed backend calls must not crash the viewer.
- Unsupported presentation data must be surfaced explicitly.
- Corrupt or partial data should be handled gracefully.
- Retries and recoverable workflows should be supported where meaningful.

## 9.3 Maintainability Requirements

- Code must be modular and testable.
- PACS-specific logic must be isolated.
- Rendering, tooling, and data integration must be separable.
- Feature additions should minimize change to existing validated code.

## 9.4 Security Requirements

- Authentication and session handling must be secure.
- Patient-sensitive data must not be logged unnecessarily.
- Audit and access-control hooks must be supported.
- Role-based feature access should be possible.

## 9.5 Usability Requirements

- Common reading actions must be accessible with minimal clicks.
- Keyboard and mouse workflows should be supported.
- UI should prioritize viewport space and reading efficiency.
- Advanced functionality should not clutter early-phase workflows.

---

# 10. Proposed Architecture

## 10.1 Major Modules

- Application shell
- Viewer workspace
- Viewport manager
- Rendering engine wrapper
- Tool and annotation engine
- Study/series browser
- Hanging protocol engine
- Presentation-state engine
- PACS adapter layer
- Persistence layer
- Telemetry/logging layer
- Configuration and feature-flag layer

## 10.2 Key Design Rule

All proprietary PACS responses must be normalized into stable viewer-domain models before reaching the UI.

## 10.3 Suggested Core Domain Models

- `Study`
- `Series`
- `Instance`
- `ImageFrame`
- `ViewportState`
- `ToolState`
- `Annotation`
- `Overlay`
- `PresentationState`
- `UserPreference`
- `CapabilitySet`

---

# 11. Proprietary PACS Integration Strategy

## 11.1 Integration Approach

Because the backend is proprietary, integration will proceed incrementally.

Each newly revealed PACS API should be documented in three steps:

### Step 1: Raw Contract Capture
Capture:
- endpoint/function name,
- request payload,
- response payload,
- auth/session behavior,
- error codes,
- pagination/streaming behavior,
- performance characteristics.

### Step 2: Normalization
Map raw responses into stable viewer models.

### Step 3: Capability Registration
Register backend support using capability flags such as:
- `supportsStudyQuery`
- `supportsSeriesMetadata`
- `supportsImageStreaming`
- `supportsMultiFrame`
- `supportsPriors`
- `supportsGSPS`
- `supportsOverlays`
- `supportsSaveAnnotations`
- `supportsVolumeMetadata`
- `supportsSegmentation`

---

# 12. Phased Delivery Plan

# Phase 0 - Foundation and Architecture Hardening

## Goal
Prepare the system for sustainable phased expansion and proprietary backend integration.

## Deliverables
- Modular project structure
- PACS adapter interfaces
- Domain models
- Capability registry
- Feature-flag system
- Configuration system
- Logging/telemetry hooks
- Mock PACS adapter
- Error handling framework
- Performance instrumentation baseline

## Exit Criteria
- Viewer can load mocked studies through adapter interfaces
- UI does not directly depend on proprietary API details
- Features can be enabled/disabled through capability flags

---

# Phase 1 - Diagnostic 2D Core

## Goal
Deliver a solid day-to-day review viewer for common diagnostic studies.

## Features
- Study open
- Series list/thumbnails
- Stack viewport
- Window/level
- Zoom/pan
- Invert
- Rotate/flip
- Cine
- Layout selection
- Demographic/study overlays
- Orientation markers
- Basic synchronization
- Loading indicators
- Retry and recoverable error handling

## Exit Criteria
- Common CT/MR/CR/DX studies can be reviewed reliably
- Interaction performance is acceptable
- Viewer remains stable on representative study sizes

---

# Phase 2 - Measurement and Annotation Workflow

## Goal
Add clinically useful interpretation tools.

## Features
- Length
- Angle
- Rectangle ROI
- Ellipse ROI
- Freehand ROI
- Text annotation
- Edit/delete annotation
- Visibility toggle
- Session persistence
- Basic measurement statistics

## Exit Criteria
- Measurements work reliably
- Tool state survives layout changes during a session
- Persistence model is abstracted from storage implementation

---

# Phase 3 - Overlay and Presentation-State Fidelity

## Goal
Improve clinical display fidelity and support legacy PACS workflows.

## Features
- Embedded overlays
- Bitmap overlays
- Graphic annotations
- GSPS or equivalent presentation-state application
- Layer visibility
- Display-area/shutter support if needed
- Fallback messaging for unsupported presentation objects

## Exit Criteria
- Supported overlays and display states render correctly
- Unsupported features are surfaced clearly

---

# Phase 4 - Priors, Comparison, and Hanging Protocols

## Goal
Improve reading productivity and workflow efficiency.

## Features
- Prior study loading
- Side-by-side comparison
- Linked viewport navigation
- Layout presets
- Hanging protocol engine
- Modality/procedure matching rules
- User/site defaults

## Exit Criteria
- Common comparison workflows can be launched efficiently
- Protocol selection is data-driven, not hardcoded

---

# Phase 5 - Advanced Volumetric Workflow

## Goal
Introduce advanced CT/MR visualization workflows.

## Features
- MPR
- Oblique MPR
- Crosshair linking
- Slab controls
- Multi-planar synchronization
- Volume caching strategy
- Segmentation overlay support

## Exit Criteria
- MPR is stable and responsive on target studies
- Memory usage remains controlled
- Segmentation overlays align correctly

---

# Phase 6 - Persistence, Export, and Enterprise Readiness

## Goal
Move toward production-grade clinical workflow support.

## Features
- Save annotations/display state to backend where supported
- User preferences
- Session restore
- Export/screenshot
- Key image/bookmark support
- Audit hooks
- Role-based access hooks
- Diagnostics and environment info

## Exit Criteria
- Workflow state can be restored
- Enterprise operational needs are supported
- System is ready for pilot/controlled deployment

---

# Phase 7 - Specialty and Premium Extensions

## Goal
Add specialty-specific and premium workflows after core viewer maturity.

## Candidate Features
- CAD markers
- Mammography workflows
- PET/CT fusion
- Advanced 3D rendering
- AI overlays
- Structured reporting integration
- Collaboration/review workflows

---

# 13. UX Requirements

- The viewer must open into a clean diagnostic workspace.
- The active viewport must be obvious.
- Series navigation must be simple and efficient.
- Toolbar grouping must follow workflow logic.
- Early phases must avoid visual clutter.
- Advanced tools should remain discoverable but not intrusive.
- Loading, failure, and unsupported-state messages must be explicit.
- Preferences should persist across sessions when configured.

---

# 14. Success Metrics

## 14.1 Product Metrics
- Study open success rate
- Time to first image
- Time to first usable layout
- Interaction latency for scroll/zoom/window-level
- Annotation workflow success rate
- Comparison workflow efficiency
- Hanging protocol auto-match rate
- MPR responsiveness
- Save/export success rate

## 14.2 Quality Metrics
- Crash-free session rate
- Recoverable error rate
- Rendering correctness defects
- Performance regressions across releases

---

# 15. Risks and Mitigations

## 15.1 Risk: Proprietary API Uncertainty
**Mitigation:**
- Adapter-based architecture
- Mock contracts
- Capability flags
- Incremental integration

## 15.2 Risk: Feature Bloat Too Early
**Mitigation:**
- Strict phase scope
- Exit criteria before next phase
- Workflow-first prioritization

## 15.3 Risk: Performance Degradation on Large Studies
**Mitigation:**
- Performance instrumentation from phase 0
- Progressive loading
- Caching strategy
- Background processing
- Volume-specific memory controls

## 15.4 Risk: Standards/Behavior Mismatch
**Mitigation:**
- Use DICOM concepts as internal canonical model where practical
- Explicit handling of unsupported behavior
- Validation against representative study sets

---

# 16. Open Questions

These items must be clarified progressively during implementation:

- How are study identifiers represented in the proprietary PACS?
- How are study, series, and image metadata retrieved?
- Is image retrieval frame-based, tiled, streamed, or file-based?
- Is prior-study retrieval supported?
- Are overlays and presentation states available as native DICOM-derived objects or proprietary payloads?
- Is backend save-back supported for annotations or display state?
- What authentication/session model is required?
- Are multi-frame and volume workflows supported efficiently?
- Are CAD markers available?
- Is server-side rendering involved anywhere?
- What browser and deployment constraints exist?

---

# 17. Recommended Initial Build Order

Recommended implementation order:

1. Phase 0 - Foundation
2. Phase 1 - Diagnostic 2D Core
3. Phase 2 - Measurement and Annotation
4. Phase 4 - Priors and Hanging Protocols
5. Phase 3 - Overlay and Presentation Fidelity
6. Phase 5 - MPR and Advanced Visualization
7. Phase 6 - Persistence and Enterprise Readiness

## Rationale
- The early phases should maximize practical reading value.
- Measurement and comparison workflows often provide immediate clinical utility.
- Overlay and GSPS support may move earlier if legacy PACS dependency is strong.
- MPR should wait until metadata and retrieval are stable.

---

# 18. Inputs Required for Detailed Planning

To convert this PRD into an implementation-ready technical plan, the following inputs are needed:

- Current viewer architecture
- Current supported features
- Existing PACS integration code
- Metadata payload examples
- Image retrieval code or API references
- Save/export flow details
- Legacy viewer features that must be preserved
- Modality priorities
- Diagnostic vs review-use priority
- Performance expectations and study-size assumptions

---

# 19. Future Companion Documents

This PRD should later be complemented by:
- Technical architecture document
- PACS API contract document
- Capability matrix
- Feature backlog
- User stories and acceptance criteria
- Test strategy
- Performance benchmark plan
- UX interaction specification

---