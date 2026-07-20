import { requireAuthContext } from "../auth/ownership";
import type { ApiRequest, ApiResponse } from "../http/types";
import { parseCreateNoteDto, parseUpdateNoteDto } from "./notes.dto";
import {
  createUserNote,
  deleteUserNote,
  getUserNote,
  listUserNotes,
  updateUserNote,
} from "./notes.service";

export async function createNote(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const dto = parseCreateNoteDto(req.body);
  const note = await createUserNote(userId, userBookId, dto);

  res.status(201).json({ note });
}

export async function listNotes(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const notes = await listUserNotes(userId, userBookId);

  res.status(200).json({ notes });
}

export async function getNote(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const noteId = req.params?.noteId ?? "";
  const note = await getUserNote(userId, userBookId, noteId);

  res.status(200).json({ note });
}

export async function updateNote(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const noteId = req.params?.noteId ?? "";
  const dto = parseUpdateNoteDto(req.body);
  const note = await updateUserNote(userId, userBookId, noteId, dto);

  res.status(200).json({ note });
}

export async function deleteNote(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const noteId = req.params?.noteId ?? "";

  await deleteUserNote(userId, userBookId, noteId);
  res.status(204).end();
}
