import type { PDFViewerPageOverlayProps } from '../../../components/ui/pdf-viewer'
import type { HighlightPreview, ReaderHighlight } from './highlight.types'
import { highlightOverlayColor } from './highlight.utils'

type PdfHighlightsOverlayProps = PDFViewerPageOverlayProps & {
  highlights: ReaderHighlight[]
  preview: HighlightPreview | null
  activeHighlightId: string | null
  onActivate: (highlightId: string) => void
}

export function PdfHighlightsOverlay({
  pageNumber,
  pageWidth,
  pageHeight,
  scale,
  highlights,
  preview,
  activeHighlightId,
  onActivate,
}: PdfHighlightsOverlayProps) {
  const pageHighlights = highlights.flatMap((highlight) => {
    if (highlight.mode !== 'pdf') {
      return []
    }

    const rects = highlight.pdfRects.filter((rect) =>
      rect.pageNumber === pageNumber &&
      rect.x < pageWidth &&
      rect.y < pageHeight,
    )

    return rects.length > 0 ? [{ highlight, rects }] : []
  })
  const previewRects = preview?.selection.mode === 'pdf'
    ? preview.selection.boundingRects.filter(
        (rect) =>
          rect.coordinateSpace === 'pdf-page' &&
          rect.pageNumber === pageNumber &&
          rect.x < pageWidth &&
          rect.y < pageHeight,
      )
    : []

  if (pageHighlights.length === 0 && previewRects.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-label="Highlights">
      {pageHighlights.flatMap(({ highlight, rects }) =>
        rects.map((rect, index) => {
          const style = {
            left: rect.x * scale,
            top: rect.y * scale,
            width: rect.width * scale,
            height: rect.height * scale,
            backgroundColor: highlightOverlayColor[highlight.color],
            boxShadow: activeHighlightId === highlight.id
              ? '0 0 0 2px var(--sophia-primary)'
              : undefined,
          }

          if (index > 0) {
            return (
              <span
                key={`${highlight.id}-${pageNumber}-${index}`}
                className="absolute mix-blend-multiply"
                style={style}
                aria-hidden="true"
              />
            )
          }

          return (
            <button
              key={`${highlight.id}-${pageNumber}-${index}`}
              type="button"
              className="pointer-events-auto absolute cursor-pointer border-0 p-0 mix-blend-multiply outline-offset-2 focus-visible:outline-2 focus-visible:outline-sophia-primary"
              style={style}
              aria-label={`Highlighted passage: ${highlight.text}`}
              aria-pressed={activeHighlightId === highlight.id}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onActivate(highlight.id)}
            />
          )
        }),
      )}
      {previewRects.map((rect, index) => (
        <span
          key={`preview-${pageNumber}-${index}`}
          className="absolute mix-blend-multiply"
          data-highlight-preview="true"
          style={{
            left: rect.x * scale,
            top: rect.y * scale,
            width: rect.width * scale,
            height: rect.height * scale,
            backgroundColor: highlightOverlayColor[preview?.color ?? 'gold'],
          }}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}
