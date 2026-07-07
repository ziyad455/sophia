import { requireAuthContext } from "../auth/ownership";
import type { ApiRequest, ApiResponse } from "../http/types";
import {
  detectChaptersForBook,
  getBookProcessingStatus,
  startBookProcessing,
} from "./processing.service";

export async function getProcessingStatus(req: ApiRequest, res: ApiResponse): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const book = await getBookProcessingStatus(userId, userBookId);

  res.status(200).json({ book });
}

export async function startProcessing(req: ApiRequest, res: ApiResponse): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const result = await startBookProcessing(userId, userBookId);

  res.status(200).json(result);
}

export async function detectChapters(req: ApiRequest, res: ApiResponse): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const result = await detectChaptersForBook(userId, userBookId);

  res.status(200).json(result);
}
