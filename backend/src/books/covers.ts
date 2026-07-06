import { createRequire } from "node:module";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { mkdir, writeFile } from "node:fs/promises";
import { config } from "../config";

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

const moduleRequire = createRequire(__filename);
const COVER_WIDTH = 420;
const WEBP_QUALITY = 82;
const standardFontDataUrl = `${path.join(
  path.dirname(moduleRequire.resolve("pdfjs-dist/package.json")),
  "standard_fonts",
)}/`;
const wasmUrl = `${path.join(
  path.dirname(moduleRequire.resolve("pdfjs-dist/package.json")),
  "wasm",
)}/`;

function buildCoverStoragePath(bookId: string): {
  absolutePath: string;
  relativePath: string;
} {
  const relativePath = path.join("books", "covers", `${bookId}.webp`);

  return {
    relativePath,
    absolutePath: path.join(config.upload.uploadDir, relativePath),
  };
}

async function loadPdfJs(): Promise<PdfJs> {
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

export async function generatePdfCoverThumbnail(
  bookId: string,
  pdfBuffer: Buffer,
): Promise<string> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    standardFontDataUrl,
    wasmUrl,
  });
  const pdfDocument = await loadingTask.promise;

  try {
    const firstPage = await pdfDocument.getPage(1);
    const baseViewport = firstPage.getViewport({ scale: 1 });
    const scale = COVER_WIDTH / baseViewport.width;
    const viewport = firstPage.getViewport({ scale });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);
    const canvas = createCanvas(width, height);
    const canvasContext = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

    canvasContext.fillStyle = "#ffffff";
    canvasContext.fillRect(0, 0, width, height);

    await firstPage.render({
      canvasContext,
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport,
      background: "#ffffff",
    }).promise;

    const imageBuffer = canvas.toBuffer("image/webp", WEBP_QUALITY);
    const { absolutePath, relativePath } = buildCoverStoragePath(bookId);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, imageBuffer);

    return relativePath;
  } finally {
    await loadingTask.destroy();
  }
}
