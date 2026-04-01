import { useRef, useEffect } from 'react';

interface ThumbnailPanelProps {
  imageIds: string[];
  selectedIndex: number;
  thumbnails: Map<number, ImageData>;
  onThumbnailClick: (index: number) => void;
}

function ThumbnailCanvas({ imageData, size = 120 }: { imageData?: ImageData; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !imageData) return;
    const canvas = canvasRef.current;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, size, size);

    const scale = Math.min(size / imageData.width, size / imageData.height);
    const w = imageData.width * scale;
    const h = imageData.height * scale;
    const x = (size - w) / 2;
    const y = (size - h) / 2;

    const offscreen = new OffscreenCanvas(imageData.width, imageData.height);
    const offCtx = offscreen.getContext('2d')!;
    offCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(offscreen, x, y, w, h);
  }, [imageData, size]);

  return <canvas ref={canvasRef} className="block rounded" style={{ width: size, height: size }} />;
}

export default function ThumbnailPanel({ imageIds, selectedIndex, thumbnails, onThumbnailClick }: ThumbnailPanelProps) {
  return (
    <div className="flex flex-col gap-2 p-2 overflow-y-auto bg-gray-900/50 border-r border-gray-800 w-[148px] shrink-0">
      {imageIds.map((id, index) => (
        <button
          key={id}
          onClick={() => onThumbnailClick(index)}
          className={`rounded-lg border-2 transition-all overflow-hidden ${
            selectedIndex === index
              ? 'border-blue-500 shadow-lg shadow-blue-500/20'
              : 'border-transparent hover:border-gray-600'
          }`}
        >
          <ThumbnailCanvas imageData={thumbnails.get(index)} />
        </button>
      ))}
    </div>
  );
}
