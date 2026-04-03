import { useCallback, useRef, useEffect } from 'react';

interface ResizeHandleProps {
  side: 'left' | 'right';
  onResize: (delta: number) => void;
}

export default function ResizeHandle({ side, onResize }: ResizeHandleProps) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onResize(side === 'left' ? delta : -delta);
    };

    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [onResize, side]);

  return (
    <div className="relative w-1.5 shrink-0 group">
      {/* Visual bar */}
      <div className="absolute inset-y-0 left-0 w-1.5 bg-gray-800 group-hover:bg-blue-500 group-active:bg-blue-400 transition-colors pointer-events-none" />
      {/* Wider invisible hit area for easier targeting */}
      <div
        onMouseDown={onMouseDown}
        className="absolute inset-y-0 -left-2.5 w-7 cursor-col-resize"
      />
    </div>
  );
}
