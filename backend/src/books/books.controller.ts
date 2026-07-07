import { requireAuthContext } from "../auth/ownership";
import { config } from "../config";
import type { ApiRequest, ApiResponse } from "../http/types";
import { parseUpdateBookMetadataDto } from "./books.dto";
import {
  getUserLibraryBook,
  getUserLibraryBookCover,
  listUserLibrary,
  updateUserLibraryBookMetadata,
  uploadPdfBook,
} from "./books.service";
import { parsePdfUpload } from "./upload";

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
