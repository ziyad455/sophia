import { requireAuthContext } from "../auth/ownership";
import type { ApiRequest, ApiResponse } from "../http/types";
import {
  parseCreateChatSessionDto,
  parseCreateUserMessageDto,
} from "./chat.dto";
import {
  createUserChatMessage,
  createUserChatSession,
  deleteUserChatSession,
  getUserChatSession,
  listUserChatSessions,
} from "./chat.service";

export async function createChatSession(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";

  parseCreateChatSessionDto(req.body);
  const session = await createUserChatSession(userId, userBookId);

  res.status(201).json({ session });
}

export async function listChatSessions(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const sessions = await listUserChatSessions(userId, userBookId);

  res.status(200).json({ sessions });
}

export async function getChatSession(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const sessionId = req.params?.sessionId ?? "";
  const session = await getUserChatSession(userId, userBookId, sessionId);

  res.status(200).json({ session });
}

export async function createChatMessage(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const sessionId = req.params?.sessionId ?? "";
  const dto = parseCreateUserMessageDto(req.body);
  const message = await createUserChatMessage(
    userId,
    userBookId,
    sessionId,
    dto,
  );

  res.status(201).json({ message });
}

export async function deleteChatSession(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const sessionId = req.params?.sessionId ?? "";

  await deleteUserChatSession(userId, userBookId, sessionId);
  res.status(204).end();
}
