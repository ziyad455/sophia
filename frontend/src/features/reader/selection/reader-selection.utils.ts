import type { ReaderChapter } from '../../../books'
import { findChapterForPage, sortChapters } from '../reader.utils'
import type {
  PdfSelectionData,
  ReaderSelection,
  ReaderSelectionCaptureResult,
  SelectionRect,
} from './reader-selection.types'

export const MAX_READER_SELECTION_CHARACTERS = 5_000

const SOURCE_BLOCK_SELECTOR = '[data-reader-source-block="true"]'

type SelectionIdentity = {
  userBookId: string
  bookId: string
}

type ReadingSelectionInput = SelectionIdentity & {
  container: HTMLElement
  nativeSelection: Selection | null
  chapters: ReaderChapter[]
}

type PdfSelectionInput = SelectionIdentity & {
  data: PdfSelectionData | null
  chapters: ReaderChapter[]
}

export function normalizeReaderSelectionText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function validateSelectionText(text: string): ReaderSelectionCaptureResult | null {
  if (!text) {
    return { status: 'empty' }
  }

  if (text.length > MAX_READER_SELECTION_CHARACTERS) {
    return {
      status: 'invalid',
      message: `Select a shorter passage (up to ${MAX_READER_SELECTION_CHARACTERS.toLocaleString()} characters).`,
    }
  }

  return null
}

function elementForNode(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : node.parentElement
}

function getSourceBlock(node: Node, container: HTMLElement): HTMLElement | null {
  const block = elementForNode(node)?.closest<HTMLElement>(SOURCE_BLOCK_SELECTOR) ?? null

  return block && container.contains(block) ? block : null
}

function isVisibleSourceBlock(block: HTMLElement): boolean {
  const style = window.getComputedStyle(block)

  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    block.getClientRects().length > 0
  )
}

function getSelectedSourceBlocks(container: HTMLElement, range: Range): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(SOURCE_BLOCK_SELECTOR)].filter(
    (block) => {
      try {
        return isVisibleSourceBlock(block) && range.intersectsNode(block)
      } catch {
        return false
      }
    },
  )
}

function createBlockSelectionRange(block: HTMLElement, sourceRange: Range): Range {
  const blockRange = document.createRange()

  blockRange.selectNodeContents(block)

  if (block.contains(sourceRange.startContainer)) {
    blockRange.setStart(sourceRange.startContainer, sourceRange.startOffset)
  }

  if (block.contains(sourceRange.endContainer)) {
    blockRange.setEnd(sourceRange.endContainer, sourceRange.endOffset)
  }

  return blockRange
}

function getSelectedTextFromBlocks(blocks: HTMLElement[], range: Range): string {
  return normalizeReaderSelectionText(
    blocks
      .map((block) => createBlockSelectionRange(block, range).toString())
      .join(' '),
  )
}

function getPageNumber(block: HTMLElement): number | null {
  const pageNumber = Number(block.dataset.sourcePage)

  return Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : null
}

function getChapterMetadata(
  blocks: HTMLElement[],
  chapters: ReaderChapter[],
): Pick<ReaderSelection, 'chapterId' | 'chapterTitle'> {
  const chapterIds = new Set(
    blocks.map((block) => block.dataset.sourceChapter ?? null),
  )

  if (chapterIds.size !== 1) {
    return { chapterId: null, chapterTitle: null }
  }

  const [chapterId] = [...chapterIds]

  if (!chapterId) {
    return { chapterId: null, chapterTitle: null }
  }

  const chapter = chapters.find((candidate) => candidate.id === chapterId)

  return {
    chapterId,
    chapterTitle: chapter?.title ?? null,
  }
}

function getBlockOffsets(
  block: HTMLElement,
  range: Range,
): Pick<ReaderSelection, 'startOffset' | 'endOffset'> {
  if (!block.contains(range.startContainer) || !block.contains(range.endContainer)) {
    return { startOffset: null, endOffset: null }
  }

  const beforeStart = document.createRange()
  const beforeEnd = document.createRange()

  beforeStart.selectNodeContents(block)
  beforeStart.setEnd(range.startContainer, range.startOffset)
  beforeEnd.selectNodeContents(block)
  beforeEnd.setEnd(range.endContainer, range.endOffset)

  return {
    startOffset: beforeStart.toString().length,
    endOffset: beforeEnd.toString().length,
  }
}

function getReadingSelectionRects(
  blocks: HTMLElement[],
  range: Range,
): SelectionRect[] {
  return blocks.flatMap((block) => {
    const pageNumber = getPageNumber(block)
    const blockRange = createBlockSelectionRange(block, range)

    return [...blockRange.getClientRects()]
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        pageNumber,
        coordinateSpace: 'viewport' as const,
      }))
  })
}

export function createReadingSelection({
  container,
  nativeSelection,
  userBookId,
  bookId,
  chapters,
}: ReadingSelectionInput): ReaderSelectionCaptureResult {
  if (!nativeSelection || nativeSelection.isCollapsed || nativeSelection.rangeCount !== 1) {
    return { status: 'empty' }
  }

  const range = nativeSelection.getRangeAt(0)
  const startBlock = getSourceBlock(range.startContainer, container)
  const endBlock = getSourceBlock(range.endContainer, container)

  if (!startBlock || !endBlock) {
    return { status: 'empty' }
  }

  const blocks = getSelectedSourceBlocks(container, range)

  if (blocks.length === 0) {
    return { status: 'empty' }
  }

  const text = getSelectedTextFromBlocks(blocks, range)
  const invalidResult = validateSelectionText(text)

  if (invalidResult) {
    return invalidResult
  }

  const pageNumbers = blocks
    .map(getPageNumber)
    .filter((pageNumber): pageNumber is number => pageNumber !== null)
  const chapter = getChapterMetadata(blocks, chapters)
  const sourceBlockId = blocks.length === 1
    ? blocks[0].dataset.sourceBlockId ?? null
    : null
  const offsets = blocks.length === 1
    ? getBlockOffsets(blocks[0], range)
    : { startOffset: null, endOffset: null }

  return {
    status: 'valid',
    selection: {
      text,
      mode: 'reading',
      userBookId,
      bookId,
      pageStart: pageNumbers.length > 0 ? Math.min(...pageNumbers) : null,
      pageEnd: pageNumbers.length > 0 ? Math.max(...pageNumbers) : null,
      ...chapter,
      ...offsets,
      sourceBlockId,
      boundingRects: getReadingSelectionRects(blocks, range),
      createdAt: new Date().toISOString(),
    },
  }
}

function findChapterForRange(
  chapters: ReaderChapter[],
  pageStart: number,
  pageEnd: number,
): ReaderChapter | null {
  const sortedChapters = sortChapters(chapters)
  const startChapter = findChapterForPage(sortedChapters, pageStart)
  const endChapter = findChapterForPage(sortedChapters, pageEnd)

  return startChapter && endChapter && startChapter.id === endChapter.id
    ? startChapter
    : null
}

export function createPdfSelection({
  data,
  userBookId,
  bookId,
  chapters,
}: PdfSelectionInput): ReaderSelectionCaptureResult {
  if (!data) {
    return { status: 'empty' }
  }

  const text = normalizeReaderSelectionText(data.text)
  const invalidResult = validateSelectionText(text)

  if (invalidResult) {
    return invalidResult
  }

  const chapter = findChapterForRange(chapters, data.pageStart, data.pageEnd)

  return {
    status: 'valid',
    selection: {
      text,
      mode: 'pdf',
      userBookId,
      bookId,
      pageStart: data.pageStart,
      pageEnd: data.pageEnd,
      chapterId: chapter?.id ?? null,
      chapterTitle: chapter?.title ?? null,
      startOffset: data.startOffset,
      endOffset: data.endOffset,
      sourceBlockId: null,
      boundingRects: data.boundingRects.map((rect) => ({
        ...rect,
        coordinateSpace: 'pdf-page' as const,
      })),
      createdAt: new Date().toISOString(),
    },
  }
}
