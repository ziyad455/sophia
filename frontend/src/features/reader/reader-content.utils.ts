import type {
  ReadingContentChapter,
  ReadingContentPage,
  ReadingContentResponse,
} from '../../books'

export type ReflowedReadingPage = ReadingContentPage & {
  chapter: ReadingContentChapter | null
  chapterNumber: number | null
  isChapterStart: boolean
  paragraphs: string[]
}

const listMarkerPattern = /^(?:[-*\u2022]|\d{1,3}[.)]|[a-zA-Z][.)])\s+/
const sentenceEndingPattern = /[.!?]["'\u2019\u201d)]?$/
const brokenWordPattern = /\p{L}-$/u
const lowercaseStartPattern = /^\p{Ll}/u

function median(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)

  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle]
}

function shouldEndParagraph(line: string, nextLine: string | undefined, typicalLineLength: number) {
  if (!nextLine) {
    return true
  }

  if (listMarkerPattern.test(nextLine)) {
    return true
  }

  if (typicalLineLength === 0) {
    return false
  }

  return sentenceEndingPattern.test(line) && line.length <= typicalLineLength * 0.72
}

export function reconstructReadingParagraphs(text: string): string[] {
  const rawLines = text
    .split('\u0000')
    .join('')
    .replace(/\r\n?/g, '\n')
    .split('\n')
  const lines = rawLines.map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
  const typicalLineLength = median(lines.filter(Boolean).map((line) => line.length))
  const paragraphs: string[] = []
  let paragraph = ''

  function finishParagraph() {
    const normalized = paragraph.replace(/\s+/g, ' ').trim()

    if (normalized) {
      paragraphs.push(normalized)
    }

    paragraph = ''
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]

    if (!line) {
      finishParagraph()
      continue
    }

    const nextLine = lines.slice(index + 1).find(Boolean)
    const joinsBrokenWord =
      brokenWordPattern.test(paragraph) && lowercaseStartPattern.test(line)

    if (!paragraph) {
      paragraph = line
    } else if (joinsBrokenWord) {
      paragraph = `${paragraph.slice(0, -1)}${line}`
    } else {
      paragraph = `${paragraph} ${line}`
    }

    if (shouldEndParagraph(line, nextLine, typicalLineLength)) {
      finishParagraph()
    }
  }

  finishParagraph()

  return paragraphs
}

export function buildReflowedReadingPages(
  content: ReadingContentResponse,
): ReflowedReadingPage[] {
  const pagesByNumber = new Map<
    number,
    { page: ReadingContentPage; chapter: ReadingContentChapter | null }
  >()

  for (const chapter of content.chapters) {
    for (const page of chapter.pages) {
      pagesByNumber.set(page.pageNumber, { page, chapter })
    }
  }

  for (const page of content.unassignedPages) {
    if (!pagesByNumber.has(page.pageNumber)) {
      pagesByNumber.set(page.pageNumber, { page, chapter: null })
    }
  }

  const seenChapterIds = new Set<string>()
  const chapterNumbers = new Map(
    content.chapters.map((chapter, index) => [chapter.id, index + 1]),
  )

  return [...pagesByNumber.values()]
    .sort((left, right) => left.page.pageNumber - right.page.pageNumber)
    .map(({ page, chapter }) => {
      const isChapterStart = Boolean(chapter && !seenChapterIds.has(chapter.id))

      if (chapter) {
        seenChapterIds.add(chapter.id)
      }

      return {
        ...page,
        chapter,
        chapterNumber: chapter ? chapterNumbers.get(chapter.id) ?? null : null,
        isChapterStart,
        paragraphs: reconstructReadingParagraphs(page.text),
      }
    })
}
