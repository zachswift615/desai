import { useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';

export function useKeyboardShortcuts() {
  const {
    selection,
    deleteElement,
    duplicateElement,
    undo,
    redo,
    clearSelection,
    setSelection,
    updateElement,
    project,
  } = useProjectStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Detect modifier keys (Cmd on Mac, Ctrl on Windows/Linux)
      const isMod = e.metaKey || e.ctrlKey;

      // Delete selected element(s)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length > 0) {
        e.preventDefault();
        selection.forEach((id) => deleteElement(id));
        return;
      }

      // Undo: Cmd/Ctrl + Z (without Shift)
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
      if ((isMod && e.key === 'z' && e.shiftKey) || (isMod && e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }

      // Duplicate: Cmd/Ctrl + D
      if (isMod && e.key === 'd' && selection.length > 0) {
        e.preventDefault();
        // Duplicate the first selected element
        const firstSelected = selection[0];
        duplicateElement(firstSelected);
        return;
      }

      // Select All: Cmd/Ctrl + A
      if (isMod && e.key === 'a') {
        e.preventDefault();
        // Get all element IDs from all layers
        const allElementIds = project.layers.flatMap((layer) =>
          layer.elements.map((el) => el.id)
        );
        setSelection(allElementIds);
        return;
      }

      // Deselect: Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelection();
        return;
      }

      // Arrow keys: Nudge selected element(s)
      if (
        (e.key === 'ArrowUp' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight') &&
        selection.length > 0
      ) {
        e.preventDefault();

        // Nudge distance: 10px with Shift, 1px without
        const nudgeAmount = e.shiftKey ? 10 : 1;

        // Calculate offset based on arrow key
        let deltaX = 0;
        let deltaY = 0;

        switch (e.key) {
          case 'ArrowUp':
            deltaY = -nudgeAmount;
            break;
          case 'ArrowDown':
            deltaY = nudgeAmount;
            break;
          case 'ArrowLeft':
            deltaX = -nudgeAmount;
            break;
          case 'ArrowRight':
            deltaX = nudgeAmount;
            break;
        }

        // Find and update each selected element
        for (const elementId of selection) {
          // Find the element in any layer
          for (const layer of project.layers) {
            const element = layer.elements.find((el) => el.id === elementId);
            if (element) {
              updateElement(elementId, {
                x: element.x + deltaX,
                y: element.y + deltaY,
              });
              break;
            }
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    selection,
    deleteElement,
    duplicateElement,
    undo,
    redo,
    clearSelection,
    setSelection,
    updateElement,
    project,
  ]);
}
