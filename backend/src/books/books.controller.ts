import { createReadStream } from "node:fs";
import { requireAuthContext } from "../auth/ownership";
import { config } from "../config";
import type { ApiRequest, ApiResponse } from "../http/types";
import { parseUpdateBookMetadataDto } from "./books.dto";
import {
  getUserLibraryBook,
  getUserLibraryBookCover,
  getUserLibraryBookPdf,
  getUserLibraryBookReaderData,
  listUserLibrary,
  updateUserLibraryBookMetadata,
  uploadPdfBook,
} from "./books.service";
import { parsePdfUpload } from "./upload";

type ByteRange =
  | { status: "none" }
  | { status: "valid"; start: number; end: number }
  | { status: "invalid" };

function parseByteRange(rangeHeader: string | string[] | undefined, sizeBytes: number): ByteRange {
  const range = Array.isArray(rangeHeader) ? rangeHeader[0] : rangeHeader;

  if (!range) {
    return { status: "none" };
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());

  if (!match) {
    return { status: "invalid" };
  }

  const [, rawStart, rawEnd] = match;

  if (!rawStart && !rawEnd) {
    return { status: "invalid" };
  }

  if (!rawStart) {
    const suffixLength = Number(rawEnd);

    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return { status: "invalid" };
    }

    const start = Math.max(sizeBytes - suffixLength, 0);

    return { status: "valid", start, end: sizeBytes - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : sizeBytes - 1;

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    start >= sizeBytes
  ) {
    return { status: "invalid" };
  }

  return {
    status: "valid",
    start,
    end: Math.min(end, sizeBytes - 1),
  };
}

export async function listLibrary(req: ApiRequest, res: ApiResponse): Promise<void> {
  const { userId } = requireAuthContext(req);
  const books = await listUserLibrary(userId);

  res.status(200).json({ books });
}

export async function getLibraryBook(req: ApiRequest, res: ApiResponse): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const book = await getUserLibraryBook(userId, userBookId);

  res.status(200).json({ book });
}

export async function getLibraryBookCover(req: ApiRequest, res: ApiResponse): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const cover = await getUserLibraryBookCover(userId, userBookId);

  res.setHeader("Cache-Control", "private, max-age=86400");
  res.setHeader("Content-Type", cover.contentType);
  res.end(cover.buffer);
}

export async function getLibraryBookPdf(req: ApiRequest, res: ApiResponse): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const pdf = await getUserLibraryBookPdf(userId, userBookId);
  const byteRange = parseByteRange(req.headers.range, pdf.sizeBytes);

  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Cache-Control", "private, no-store");

  if (byteRange.status === "invalid") {
    res.status(416);
    res.setHeader("Content-Range", `bytes */${pdf.sizeBytes}`);
    res.end();
    return;
  }

  if (byteRange.status === "valid") {
    const contentLength = byteRange.end - byteRange.start + 1;

    res.status(206);
    res.setHeader("Content-Range", `bytes ${byteRange.start}-${byteRange.end}/${pdf.sizeBytes}`);
    res.setHeader("Content-Length", String(contentLength));
    createReadStream(pdf.absolutePath, {
      start: byteRange.start,
      end: byteRange.end,
    })
      .on("error", () => res.destroy())
      .pipe(res);
    return;
  }

  res.status(200);
  res.setHeader("Content-Length", String(pdf.sizeBytes));
  createReadStream(pdf.absolutePath)
    .on("error", () => res.destroy())
    .pipe(res);
}

export async function getLibraryBookReaderData(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const readerData = await getUserLibraryBookReaderData(userId, userBookId);

  res.status(200).json(readerData);
}

export async function updateLibraryBookMetadata(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const dto = parseUpdateBookMetadataDto(req.body);
  const book = await updateUserLibraryBookMetadata(userId, userBookId, dto);

  res.status(200).json({ book });
}

export async function uploadBook(req: ApiRequest, res: ApiResponse): Promise<void> {
  const { userId } = requireAuthContext(req);
  const upload = await parsePdfUpload(req, config.upload.maxPdfUploadBytes);
  const book = await uploadPdfBook({
    userId,
    file: upload.file,
    title: upload.title,
    author: upload.author,
    language: upload.language,
  });

  res.status(201).json({ book });
}
