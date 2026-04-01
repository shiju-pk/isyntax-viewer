import type { ICanvasController } from '../../core/interfaces';
import type { InteractionMode, ViewportState } from '../../core/types';

export function createCanvasRenderer(
  canvas: HTMLCanvasElement,
  initialImageData?: ImageData
): ICanvasController {
  const ctx = canvas.getContext('2d')!;
  let imageData: ImageData | null = initialImageData ?? null;
  let mode: InteractionMode = 'pan';

  const viewport: ViewportState = {
    panX: 0,
    panY: 0,
    zoom: 1,
    windowCenter: 128,
    windowWidth: 256,
  };

  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  function render() {
    if (!imageData) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Calculate fit-to-viewport scale
    const scaleX = displayWidth / imageData.width;
    const scaleY = displayHeight / imageData.height;
    const fitScale = Math.min(scaleX, scaleY);
    const totalScale = fitScale * viewport.zoom;

    const imgW = imageData.width * totalScale;
    const imgH = imageData.height * totalScale;
    const offsetX = (displayWidth - imgW) / 2 + viewport.panX;
    const offsetY = (displayHeight - imgH) / 2 + viewport.panY;

    // Create an offscreen canvas for the image
    const offscreen = new OffscreenCanvas(imageData.width, imageData.height);
    const offCtx = offscreen.getContext('2d')!;
    offCtx.putImageData(imageData, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(offscreen, offsetX, offsetY, imgW, imgH);
  }

  function onMouseDown(e: MouseEvent) {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = mode === 'pan' ? 'grabbing' : 'crosshair';
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    switch (mode) {
      case 'pan':
        viewport.panX += dx;
        viewport.panY += dy;
        break;
      case 'zoom':
        viewport.zoom = Math.max(0.1, viewport.zoom + dy * -0.005);
        break;
      case 'windowLevel':
        viewport.windowCenter += dy;
        viewport.windowWidth = Math.max(1, viewport.windowWidth + dx);
        break;
    }
    render();
  }

  function onMouseUp() {
    isDragging = false;
    canvas.style.cursor = mode === 'pan' ? 'grab' : 'crosshair';
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    viewport.zoom = Math.max(0.1, Math.min(20, viewport.zoom * zoomDelta));
    render();
  }

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.style.cursor = 'grab';

  return {
    render,
    setImageData(newImageData: ImageData) {
      imageData = newImageData;
      render();
    },
    setMode(newMode: InteractionMode) {
      mode = newMode;
      canvas.style.cursor = mode === 'pan' ? 'grab' : 'crosshair';
    },
    getMode() {
      return mode;
    },
    reset() {
      viewport.panX = 0;
      viewport.panY = 0;
      viewport.zoom = 1;
      viewport.windowCenter = 128;
      viewport.windowWidth = 256;
      render();
    },
    getViewportState() {
      return { ...viewport };
    },
    dispose() {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
    },
  };
}
