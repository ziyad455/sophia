import type { ReaderChapter } from './reader.types'

/**
 * Find the chapter that contains a given page number.
 * Returns null if no chapter matches or chapters is empty.
 *
 * Chapters are expected to be sorted by chapterIndex (ascending).
 * If a chapter has no pageEnd, we use the next chapter's pageStart - 1
 * as the implicit end.
 */
export function findChapterForPage(
  chapters: ReaderChapter[],
  currentPage: number,
): ReaderChapter | null {
  if (chapters.length === 0 || currentPage < 1) {
    return null
  }

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i]
    const pageStart = chapter.pageStart

    if (pageStart === null) {
      continue
    }

    // Determine the effective end page
    let effectiveEnd = chapter.pageEnd

    if (effectiveEnd === null) {
      // Use the next chapter's pageStart - 1, or treat this as the last chapter
      const nextChapter = chapters[i + 1]
      const nextStart = nextChapter?.pageStart

      if (nextStart !== null && nextStart !== undefined && nextStart > pageStart) {
        effectiveEnd = nextStart - 1
      } else {
        // Last chapter or no next pageStart — match from pageStart onward
        effectiveEnd = Number.MAX_SAFE_INTEGER
      }
    }

    if (currentPage >= pageStart && currentPage <= effectiveEnd) {
      return chapter
    }
  }

  return null
}

/**
 * Format a page range string for a chapter.
 * Example: "Pages 1–12" or "Page 1" if start === end.
 */
export function formatPageRange(chapter: ReaderChapter): string | null {
  if (chapter.pageStart === null) {
    return null
  }

  if (chapter.pageEnd === null || chapter.pageEnd === chapter.pageStart) {
    return `Page ${chapter.pageStart}`
  }

  return `Pages ${chapter.pageStart}–${chapter.pageEnd}`
}

/**
 * Sort chapters by chapterIndex in ascending order.
 * Returns a new array — does not mutate the input.
 */
export function sortChapters(chapters: ReaderChapter[]): ReaderChapter[] {
  return [...chapters].sort((a, b) => a.chapterIndex - b.chapterIndex)
}
