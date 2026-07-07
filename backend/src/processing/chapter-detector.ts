export type ChapterDetectionPage = {
  pageNumber: number;
  text: string | null;
};

export type DetectedChapter = {
  title: string;
  chapterIndex: number;
  pageStart: number;
  pageEnd: number;
  startOffset: number | null;
  endOffset: number | null;
};

type ChapterCandidate = {
  title: string;
  pageNumber: number;
  startOffset: number | null;
  lineIndex: number;
  score: number;
};

type PageLine = {
  value: string;
  offset: number;
};

const maxInspectedLines = 30;
const maxHeadingLength = 120;
const maxStandaloneMarkerLength = 16;
const minPagesBetweenSameTitle = 2;
const repeatedLineMinCount = 3;
const repeatedLinePageRatio = 0.2;
const wordNumberPattern =
  "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty";
const romanPattern = "[ivxlcdm]+";
const ordinalPattern = "\\d{1,3}";
const sectionNumberPattern = `(?:${ordinalPattern}|${romanPattern}|${wordNumberPattern})`;
const explicitChapterPattern = new RegExp(
  `^(chapter|part|book)\\s+(${sectionNumberPattern})(?:\\b|\\s*[:.\\-])`,
  "i",
);
const standaloneRomanPattern = /^(?:[ivxlcdm]{1,8})\.$/i;
const standaloneNumberPattern = /^\d{1,3}\.$/;
const namedSectionPattern =
  /^(introduction|preface|foreword|prologue|conclusion|epilogue|afterword|appendix|bibliography)$/i;

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeRepeatedLineKey(value: string): string {
  return normalizeLine(value).toLowerCase().replace(/\d+/g, "#");
}

function isMostlyUppercase(value: string): boolean {
  const letters = value.match(/[A-Za-z]/g) ?? [];

  if (letters.length < 3) {
    return false;
  }

  const uppercaseLetters = letters.filter((letter) => letter === letter.toUpperCase());

  return uppercaseLetters.length / letters.length >= 0.8;
}

function isTitleLike(value: string): boolean {
  const words = value.split(/\s+/).filter(Boolean);

  if (words.length < 1 || words.length > 12) {
    return false;
  }

  const titleCaseWords = words.filter((word) => {
    const firstLetter = word.match(/[A-Za-z]/)?.[0];

    return !firstLetter || firstLetter === firstLetter.toUpperCase();
  });

  return titleCaseWords.length / words.length >= 0.65;
}

function splitPageLines(text: string | null): PageLine[] {
  if (!text) {
    return [];
  }

  const lines: PageLine[] = [];
  let offset = 0;

  for (const rawLine of text.split("\n")) {
    const value = normalizeLine(rawLine);

    if (value) {
      lines.push({
        value,
        offset,
      });
    }

    offset += rawLine.length + 1;
  }

  return lines;
}

function buildRepeatedLineKeys(pages: ChapterDetectionPage[]): Set<string> {
  const counts = new Map<string, number>();

  for (const page of pages) {
    const seenOnPage = new Set<string>();

    for (const line of splitPageLines(page.text).slice(0, maxInspectedLines)) {
      if (line.value.length > maxHeadingLength) {
        continue;
      }

      seenOnPage.add(normalizeRepeatedLineKey(line.value));
    }

    for (const key of seenOnPage) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const repeatedKeys = new Set<string>();
  const threshold = Math.max(repeatedLineMinCount, Math.ceil(pages.length * repeatedLinePageRatio));

  for (const [key, count] of counts) {
    if (count >= threshold) {
      repeatedKeys.add(key);
    }
  }

  return repeatedKeys;
}

function titleFromStandaloneMarker(line: string, nextLine: PageLine | undefined): string {
  if (!nextLine || nextLine.value.length > maxHeadingLength || !isTitleLike(nextLine.value)) {
    return line;
  }

  return `${line} ${nextLine.value}`;
}

function scoreCandidate(line: string, lineIndex: number, nextLine: PageLine | undefined): number {
  let score = 0;

  if (lineIndex <= 4) {
    score += 3;
  } else if (lineIndex <= 12) {
    score += 2;
  } else {
    score += 1;
  }

  if (explicitChapterPattern.test(line)) {
    score += 7;
  }

  if (namedSectionPattern.test(line)) {
    score += 5;
  }

  if (
    lineIndex <= 10 &&
    line.length <= maxStandaloneMarkerLength &&
    (standaloneRomanPattern.test(line) || standaloneNumberPattern.test(line))
  ) {
    score += nextLine && isTitleLike(nextLine.value) ? 5 : 2;
  }

  if (isMostlyUppercase(line) || isTitleLike(line)) {
    score += 1;
  }

  return score;
}

function findPageCandidate(
  page: ChapterDetectionPage,
  repeatedLineKeys: Set<string>,
): ChapterCandidate | null {
  const lines = splitPageLines(page.text).slice(0, maxInspectedLines);
  let bestCandidate: ChapterCandidate | null = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    if (line.value.length > maxHeadingLength) {
      continue;
    }

    if (repeatedLineKeys.has(normalizeRepeatedLineKey(line.value))) {
      continue;
    }

    const nextLine = lines[lineIndex + 1];
    const score = scoreCandidate(line.value, lineIndex, nextLine);

    if (score < 7) {
      continue;
    }

    const title =
      standaloneRomanPattern.test(line.value) || standaloneNumberPattern.test(line.value)
        ? titleFromStandaloneMarker(line.value, nextLine)
        : line.value;
    const candidate: ChapterCandidate = {
      title,
      pageNumber: page.pageNumber,
      startOffset: line.offset,
      lineIndex,
      score,
    };

    if (
      !bestCandidate ||
      candidate.score > bestCandidate.score ||
      (candidate.score === bestCandidate.score && candidate.lineIndex < bestCandidate.lineIndex)
    ) {
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

function dedupeCandidates(candidates: ChapterCandidate[]): ChapterCandidate[] {
  const detected: ChapterCandidate[] = [];

  for (const candidate of candidates) {
    const previousWithSameTitle = detected.find(
      (existingCandidate) =>
        existingCandidate.title.toLowerCase() === candidate.title.toLowerCase() &&
        candidate.pageNumber - existingCandidate.pageNumber < minPagesBetweenSameTitle,
    );

    if (previousWithSameTitle) {
      continue;
    }

    detected.push(candidate);
  }

  return detected;
}

export function detectChaptersFromPages(pages: ChapterDetectionPage[]): DetectedChapter[] {
  const orderedPages = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  if (orderedPages.length === 0) {
    return [];
  }

  const repeatedLineKeys = buildRepeatedLineKeys(orderedPages);
  const candidates = dedupeCandidates(
    orderedPages
      .map((page) => findPageCandidate(page, repeatedLineKeys))
      .filter((candidate): candidate is ChapterCandidate => Boolean(candidate)),
  );
  const lastPageNumber = orderedPages.at(-1)?.pageNumber ?? 0;

  return candidates.map((candidate, index) => {
    const nextCandidate = candidates[index + 1];

    return {
      title: candidate.title,
      chapterIndex: index,
      pageStart: candidate.pageNumber,
      pageEnd: nextCandidate ? Math.max(candidate.pageNumber, nextCandidate.pageNumber - 1) : lastPageNumber,
      startOffset: candidate.startOffset,
      endOffset: null,
    };
  });
}

