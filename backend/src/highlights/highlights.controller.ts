import { requireAuthContext } from "../auth/ownership";
import type { ApiRequest, ApiResponse } from "../http/types";
import { parseCreateHighlightDto } from "./highlights.dto";
import {
  createUserHighlight,
  deleteUserHighlight,
  listUserHighlights,
} from "./highlights.service";

export async function createHighlight(req: ApiRequest, res: ApiResponse): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const dto = parseCreateHighlightDto(req.body);
  const result = await createUserHighlight(userId, userBookId, dto);

  res.status(result.created ? 201 : 200).json({ highlight: result.highlight });
}

export async function listHighlights(req: ApiRequest, res: ApiResponse): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const highlights = await listUserHighlights(userId, userBookId);

  res.status(200).json({ highlights });
}

export async function deleteHighlight(req: ApiRequest, res: ApiResponse): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const highlightId = req.params?.highlightId ?? "";

  await deleteUserHighlight(userId, userBookId, highlightId);
  res.status(204).end();
}
