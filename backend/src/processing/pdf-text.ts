import { createRequire } from "node:module";
import path from "node:path";

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

export type ExtractedPdfPage = {
  pageNumber: number;
  text: string;
  extractionSucceeded: boolean;
};

export type ExtractedPdfText = {
  pages: ExtractedPdfPage[];
  pageCount: number;
  totalTextCharacters: number;
  nonEmptyPageCount: number;
  failedPageCount: number;
};

type PdfTextItem = {
  str: string;
  hasEOL?: boolean;
};

const moduleRequire = createRequire(__filename);
const standardFontDataUrl = `${path.join(
  path.dirname(moduleRequire.resolve("pdfjs-dist/package.json")),
  "standard_fonts",
)}/`;
const wasmUrl = `${path.join(
  path.dirname(moduleRequire.resolve("pdfjs-dist/package.json")),
  "wasm",
)}/`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPdfTextItem(value: unknown): value is PdfTextItem {
  return isRecord(value) && typeof value.str === "string";
}

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n+ */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readTextItems(items: unknown[]): string {
  let text = "";

  for (const item of items) {
    if (!isPdfTextItem(item)) {
      continue;
    }

    text += item.str;
    text += item.hasEOL ? "\n" : " ";
  }

  return normalizeExtractedText(text);
}

async function loadPdfJs(): Promise<PdfJs> {
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<ExtractedPdfText> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    standardFontDataUrl,
    wasmUrl,
  });
  const pdfDocument = await loadingTask.promise;

  try {
    const pages: ExtractedPdfPage[] = [];
    let totalTextCharacters = 0;
    let nonEmptyPageCount = 0;
    let failedPageCount = 0;

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      let text = "";
      let extractionSucceeded = true;

      try {
        const page = await pdfDocument.getPage(pageNumber);
        const textContent = await page.getTextContent();
        text = readTextItems(textContent.items);
      } catch {
        extractionSucceeded = false;
        failedPageCount += 1;
      }

      if (text.length > 0) {
        nonEmptyPageCount += 1;
        totalTextCharacters += text.length;
      }

      pages.push({
        pageNumber,
        text,
        extractionSucceeded,
      });
    }

    return {
      pages,
      pageCount: pdfDocument.numPages,
      totalTextCharacters,
      nonEmptyPageCount,
      failedPageCount,
    };
  } finally {
    await loadingTask.destroy();
  }
}
