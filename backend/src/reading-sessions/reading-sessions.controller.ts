import { requireAuthContext } from "../auth/ownership";
import type { ApiRequest, ApiResponse } from "../http/types";
import {
  parseStartReadingSessionDto,
  parseUpdateReadingSessionDto,
} from "./reading-sessions.dto";
import {
  endUserReadingSession,
  startUserReadingSession,
  updateUserReadingSession,
} from "./reading-sessions.service";

export async function startReadingSession(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const dto = parseStartReadingSessionDto(req.body);
  const session = await startUserReadingSession(userId, userBookId, dto);

  res.status(201).json({ session });
}

export async function updateReadingSession(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const sessionId = req.params?.sessionId ?? "";
  const dto = parseUpdateReadingSessionDto(req.body);
  const session = await updateUserReadingSession(
    userId,
    userBookId,
    sessionId,
    dto,
  );

  res.status(200).json({ session });
}

export async function endReadingSession(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  const { userId } = requireAuthContext(req);
  const userBookId = req.params?.userBookId ?? "";
  const sessionId = req.params?.sessionId ?? "";
  const dto = parseUpdateReadingSessionDto(req.body);
  const session = await endUserReadingSession(
    userId,
    userBookId,
    sessionId,
    dto,
  );

  res.status(200).json({ session });
}
