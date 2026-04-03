import { ChevronUp, ChevronDown, ChevronsUp, ChevronsDown } from 'lucide-react';

interface ImageScrollbarProps {
  imageIndex: number;
  imageCount: number;
  onNavigate: (index: number) => void;
}

export default function ImageScrollbar({ imageIndex, imageCount, onNavigate }: ImageScrollbarProps) {
  const isFirst = imageIndex === 0;
  const isLast = imageIndex >= imageCount - 1;

  return (
    <div className="flex flex-col items-center w-8 shrink-0 bg-gray-900/60 border-l border-gray-700/50 select-none py-1 gap-0.5">
      <button
        onClick={() => onNavigate(0)}
        disabled={isFirst}
        title="First image (Home)"
        aria-label="First image"
        className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:text-gray-600 disabled:hover:bg-transparent transition-colors"
      >
        <ChevronsUp size={14} />
      </button>
      <button
        onClick={() => onNavigate(imageIndex - 1)}
        disabled={isFirst}
        title="Previous image (↑)"
        aria-label="Previous image"
        className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:text-gray-600 disabled:hover:bg-transparent transition-colors"
      >
        <ChevronUp size={14} />
      </button>
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full px-0.5">
        <input
          type="range"
          min={0}
          max={imageCount - 1}
          value={imageIndex}
          onChange={(e) => onNavigate(Number(e.target.value))}
          title={`Image ${imageIndex + 1} / ${imageCount}`}
          aria-label={`Image ${imageIndex + 1} of ${imageCount}`}
          style={{
            writingMode: 'vertical-lr',
            height: '100%',
            width: '18px',
            accentColor: '#3b82f6',
            cursor: 'pointer',
          }}
        />
      </div>
      <button
        onClick={() => onNavigate(imageIndex + 1)}
        disabled={isLast}
        title="Next image (↓)"
        aria-label="Next image"
        className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:text-gray-600 disabled:hover:bg-transparent transition-colors"
      >
        <ChevronDown size={14} />
      </button>
      <button
        onClick={() => onNavigate(imageCount - 1)}
        disabled={isLast}
        title="Last image (End)"
        aria-label="Last image"
        className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:text-gray-600 disabled:hover:bg-transparent transition-colors"
      >
        <ChevronsDown size={14} />
      </button>
      <span className="text-[11px] text-gray-500 tabular-nums leading-none mt-0.5">
        {imageIndex + 1}/{imageCount}
      </span>
    </div>
  );
}
