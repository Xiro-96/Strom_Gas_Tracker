import { useCallback, useState } from 'react';

/** Breite eines Elements (ResizeObserver), für SVG-Diagramme mit echter Pixelbreite. */
export function useElementWidth(fallback = 360) {
  const [width, setWidth] = useState(fallback);
  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (!node) return;
      const update = () => {
        setWidth(node.getBoundingClientRect().width || fallback);
      };
      update();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(update);
      observer.observe(node);
      return () => {
        observer.disconnect();
      };
    },
    [fallback],
  );
  return [ref, width] as const;
}
