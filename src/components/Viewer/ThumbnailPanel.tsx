import { useRef, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SeriesGroup } from '../../lib/studyDocService';

interface ThumbnailPanelProps {
  seriesGroups: SeriesGroup[];
  selectedSeriesIndex: number;
  selectedImageIndex: number;
  thumbnails: Map<string, ImageData>;
  onSelect: (seriesIndex: number, imageIndex: number) => void;
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

function SeriesCard({
  group,
  seriesIndex,
  isSelectedSeries,
  selectedImageIndex,
  thumbnails,
  onSelect,
}: {
  group: SeriesGroup;
  seriesIndex: number;
  isSelectedSeries: boolean;
  selectedImageIndex: number;
  thumbnails: Map<string, ImageData>;
  onSelect: (seriesIndex: number, imageIndex: number) => void;
}) {
  // Track which image is currently visible in this card
  const [visibleIndex, setVisibleIndex] = useState(isSelectedSeries ? selectedImageIndex : 0);

  // Sync visible index when the external selection targets this series
  useEffect(() => {
    if (isSelectedSeries) {
      setVisibleIndex(selectedImageIndex);
    }
  }, [isSelectedSeries, selectedImageIndex]);

  const imageCount = group.imageIds.length;
  const currentImageId = group.imageIds[visibleIndex];
  const hasMultiple = imageCount > 1;

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = (visibleIndex - 1 + imageCount) % imageCount;
    setVisibleIndex(next);
    onSelect(seriesIndex, next);
  };

  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = (visibleIndex + 1) % imageCount;
    setVisibleIndex(next);
    onSelect(seriesIndex, next);
  };

  const isActive = isSelectedSeries && visibleIndex === selectedImageIndex;

  return (
    <div
      className={`rounded-lg border-2 transition-all overflow-hidden ${
        isActive
          ? 'border-blue-500 shadow-lg shadow-blue-500/20'
          : 'border-transparent hover:border-gray-600'
      }`}
    >
      <button
        onClick={() => onSelect(seriesIndex, visibleIndex)}
        className="w-full cursor-pointer"
      >
        <ThumbnailCanvas imageData={thumbnails.get(currentImageId)} />
      </button>

      {hasMultiple && (
        <div className="flex items-center justify-between bg-gray-800/80 px-1 py-0.5">
          <button
            onClick={goPrev}
            className="p-0.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[10px] text-gray-400 tabular-nums">
            {visibleIndex + 1}/{imageCount}
          </span>
          <button
            onClick={goNext}
            className="p-0.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function ThumbnailPanel({
  seriesGroups,
  selectedSeriesIndex,
  selectedImageIndex,
  thumbnails,
  onSelect,
}: ThumbnailPanelProps) {
  return (
    <div className="flex flex-col gap-2 p-2 overflow-y-auto bg-gray-900/50 border-r border-gray-800 w-[148px] shrink-0">
      {seriesGroups.map((group, sIdx) => (
        <SeriesCard
          key={group.seriesUID}
          group={group}
          seriesIndex={sIdx}
          isSelectedSeries={sIdx === selectedSeriesIndex}
          selectedImageIndex={selectedImageIndex}
          thumbnails={thumbnails}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
