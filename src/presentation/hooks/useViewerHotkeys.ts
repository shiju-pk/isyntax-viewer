import { useEffect } from 'react';
import type { InteractionMode } from '../../core/types';

export interface ViewerHotkeyHandlers {
  setMode: (mode: InteractionMode) => void;
  navigateImage: (targetIndex: number) => void;
  selectedImageIndex: number;
  maxImageIndex: number;
  onReset: () => void;
  onFlipHorizontal?: () => void;
  onFlipVertical?: () => void;
  onRotateRight90?: () => void;
  onToggleMetadata?: () => void;
  onDownload?: () => void;
}

/**
 * Keyboard shortcuts for the medical image viewer.
 * Binds hotkeys only when no input/textarea is focused.
 */
export function useViewerHotkeys(handlers: ViewerHotkeyHandlers) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        return; // reserved for future undo/redo
      }

      switch (e.key) {
        // --- Tool mode shortcuts ---
        case 'p':
        case 'P':
          e.preventDefault();
          handlers.setMode('pan');
          break;
        case 'z':
        case 'Z':
          e.preventDefault();
          handlers.setMode('zoom');
          break;
        case 'w':
        case 'W':
          e.preventDefault();
          handlers.setMode('windowLevel');
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          handlers.setMode('rotate');
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          handlers.setMode('length');
          break;
        case 'a':
        case 'A':
          e.preventDefault();
          handlers.setMode('angle');
          break;

        // --- Image navigation ---
        case 'ArrowUp':
          e.preventDefault();
          handlers.navigateImage(handlers.selectedImageIndex - 1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          handlers.navigateImage(handlers.selectedImageIndex + 1);
          break;
        case 'Home':
          e.preventDefault();
          handlers.navigateImage(0);
          break;
        case 'End':
          e.preventDefault();
          handlers.navigateImage(handlers.maxImageIndex);
          break;

        // --- Viewport actions ---
        case 'Escape':
          e.preventDefault();
          handlers.onReset();
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          handlers.onFlipHorizontal?.();
          break;
        case 'v':
        case 'V':
          e.preventDefault();
          handlers.onFlipVertical?.();
          break;
        case 'i':
        case 'I':
          e.preventDefault();
          handlers.onToggleMetadata?.();
          break;

        default:
          break;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
