export type ChunkingPage = {
  pageNumber: number;
  chapterId: string | null;
  text: string | null;
};

export type GeneratedBookChunk = {
  chapterId: string | null;
  pageStart: number;
  pageEnd: number;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: {
    strategy: string;
    targetTokens: number;
    overlapTokens: number;
    source: string;
  };
};

type ChunkSegment = {
  pageNumber: number;
  chapterId: string | null;
  text: string;
  tokenCount: number;
};

const chunkingStrategy = "page_paragraph_overlap";
export const chunkingVersion = "mvp-v1-page-paragraph-overlap";
export const targetChunkTokens = 1000;
export const overlapChunkTokens = 150;
const maxChunkTokens = 1200;
const minChunkTokens = 250;

export function estimateTokenCount(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  return Math.max(1, Math.ceil(wordCount * 1.3));
}

function normalizeParagraphText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function splitIntoParagraphs(text: string | null): string[] {
  if (!text) {
    return [];
  }

  return text
    .split(/\n{2,}|\r?\n/)
    .map(normalizeParagraphText)
    .filter(Boolean);
}

function buildSegments(pages: ChunkingPage[]): ChunkSegment[] {
  return pages.flatMap((page) =>
    splitIntoParagraphs(page.text).map((text) => ({
      pageNumber: page.pageNumber,
      chapterId: page.chapterId,
      text,
      tokenCount: estimateTokenCount(text),
    })),
  );
}

function buildOverlapSegments(segments: ChunkSegment[]): ChunkSegment[] {
  const overlapSegments: ChunkSegment[] = [];
  let overlapTokens = 0;

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];

    overlapSegments.unshift(segment);
    overlapTokens += segment.tokenCount;

    if (overlapTokens >= overlapChunkTokens) {
      break;
    }
  }

  return overlapSegments;
}

function createChunk(segments: ChunkSegment[], chunkIndex: number): GeneratedBookChunk | null {
  if (segments.length === 0) {
    return null;
  }

  const chapterIds = new Set(segments.map((segment) => segment.chapterId).filter(Boolean));
  const content = segments.map((segment) => segment.text).join("\n\n").trim();

  if (!content) {
    return null;
  }

  return {
    chapterId: chapterIds.size === 1 ? [...chapterIds][0] ?? null : null,
    pageStart: segments[0].pageNumber,
    pageEnd: segments[segments.length - 1].pageNumber,
    chunkIndex,
    content,
    tokenCount: estimateTokenCount(content),
    metadata: {
      strategy: chunkingStrategy,
      targetTokens: targetChunkTokens,
      overlapTokens: overlapChunkTokens,
      source: "pdf_text_extraction_v1",
    },
  };
}

export function generateBookChunksFromPages(pages: ChunkingPage[]): GeneratedBookChunk[] {
  const orderedSegments = buildSegments([...pages].sort((a, b) => a.pageNumber - b.pageNumber));
  const chunks: GeneratedBookChunk[] = [];
  let currentSegments: ChunkSegment[] = [];
  let currentTokenCount = 0;
  let currentChapterId: string | null | undefined;

  function flushChunk() {
    const chunk = createChunk(currentSegments, chunks.length);

    if (chunk) {
      chunks.push(chunk);
    }

    currentSegments = buildOverlapSegments(currentSegments);
    currentTokenCount = currentSegments.reduce((total, segment) => total + segment.tokenCount, 0);
    currentChapterId = currentSegments.at(-1)?.chapterId;
  }

  for (const segment of orderedSegments) {
    const chapterChanged =
      currentSegments.length > 0 &&
      currentChapterId &&
      segment.chapterId &&
      segment.chapterId !== currentChapterId;

    if (chapterChanged) {
      flushChunk();
      currentSegments = [];
      currentTokenCount = 0;
    }

    const wouldExceedMax = currentTokenCount + segment.tokenCount > maxChunkTokens;

    if (wouldExceedMax && currentTokenCount >= minChunkTokens) {
      flushChunk();

      if (currentTokenCount + segment.tokenCount > maxChunkTokens) {
        currentSegments = [];
        currentTokenCount = 0;
      }
    }

    currentSegments.push(segment);
    currentTokenCount += segment.tokenCount;
    currentChapterId = segment.chapterId;

    if (currentTokenCount >= targetChunkTokens) {
      flushChunk();
    }
  }

  if (currentSegments.length > 0) {
    const chunk = createChunk(currentSegments, chunks.length);

    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
}
