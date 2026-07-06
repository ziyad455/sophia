import { requireAuthContext } from "../auth/ownership";
import type { ApiRequest, ApiResponse } from "../http/types";
import { listUserLibrary, getUserLibraryBook } from "./books.service";

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
