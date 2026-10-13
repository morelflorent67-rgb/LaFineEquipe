import type { CrosshairPreview as Preview } from '@/lib/domain/schemas';
import { previewRects } from '@/lib/crosshairs';

/** Aperçu INDICATIF d'un réticule, dessiné d'après les réglages saisis (pas le rendu du jeu). */
export function CrosshairPreview({ preview, size = 120, label }: { preview: Preview; size?: number; label: string }) {
  const { outline, fill } = previewRects(preview, size);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      {outline.map((r, i) => (
        <rect key={`o${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill="#000" />
      ))}
      {fill.map((r, i) => (
        <rect key={`f${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill={preview.color} />
      ))}
    </svg>
  );
}
