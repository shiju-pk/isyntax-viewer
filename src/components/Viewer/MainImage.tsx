import { useRef, useEffect, useCallback } from 'react';
import { createCanvasRenderer, type CanvasController, type InteractionMode } from '../../lib/canvasRenderer';

interface MainImageProps {
  imageData: ImageData | null;
  mode: InteractionMode;
  onControllerReady?: (controller: CanvasController) => void;
}

export default function MainImage({ imageData, mode, onControllerReady }: MainImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<CanvasController | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const controller = createCanvasRenderer(canvasRef.current);
    controllerRef.current = controller;
    onControllerReady?.(controller);

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (controllerRef.current && imageData) {
      controllerRef.current.setImageData(imageData);
    }
  }, [imageData]);

  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.setMode(mode);
    }
  }, [mode]);

  const handleResize = useCallback(() => {
    controllerRef.current?.render();
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block rounded-lg"
    />
  );
}
