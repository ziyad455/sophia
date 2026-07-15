import { requireAuthContext } from "../auth/ownership";
import type { ApiRequest, ApiResponse } from "../http/types";
import { parseReaderPreferencesUpdate } from "./preferences.dto";
import {
  getReaderPreferences,
  updateReaderPreferences,
} from "./preferences.service";

export async function getAuthenticatedReaderPreferences(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const preferences = await getReaderPreferences(userId);

  res.status(200).json({ preferences });
}

export async function patchAuthenticatedReaderPreferences(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const update = parseReaderPreferencesUpdate(req.body);
  const preferences = await updateReaderPreferences(userId, update);

  res.status(200).json({ preferences });
}
