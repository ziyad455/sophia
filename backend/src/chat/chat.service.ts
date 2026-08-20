import { ChatMessageRole } from "@prisma/client";
import { prisma } from "../db/prisma";
import { notFound } from "../http/errors";
import { isChatUuid, type CreateUserMessageDto } from "./chat.dto";
import {
  mapChatMessage,
  mapChatSession,
  mapChatSessionWithMessages,
} from "./chat.mapper";
import type {
  PublicChatMessage,
  PublicChatSession,
  PublicChatSessionWithMessages,
} from "./chat.types";

type OwnedUserBook = {
  id: string;
  bookId: string;
};

const chatSessionSelection = {
  id: true,
  createdAt: true,
  updatedAt: true,
} as const;

const chatMessageSelection = {
  id: true,
  role: true,
  content: true,
  createdAt: true,
} as const;

async function requireOwnedUserBook(
  userId: string,
  userBookId: string,
): Promise<OwnedUserBook> {
  if (!isChatUuid(userBookId)) {
    throw notFound("Library entry not found.");
  }

  const userBook = await prisma.userBook.findFirst({
    where: {
      id: userBookId,
      userId,
    },
    select: {
      id: true,
      bookId: true,
    },
  });

  if (!userBook) {
    throw notFound("Library entry not found.");
  }

  return userBook;
}

async function requireOwnedChatSession(
  userId: string,
  userBookId: string,
  sessionId: string,
): Promise<{ id: string }> {
  if (!isChatUuid(userBookId) || !isChatUuid(sessionId)) {
    throw notFound("Chat session not found.");
  }

  const session = await prisma.chatSession.findFirst({
    where: {
      id: sessionId,
      userId,
      userBookId,
      userBook: { userId },
    },
    select: { id: true },
  });

  if (!session) {
    throw notFound("Chat session not found.");
  }

  return session;
}

export async function createUserChatSession(
  userId: string,
  userBookId: string,
): Promise<PublicChatSession> {
  const userBook = await requireOwnedUserBook(userId, userBookId);
  const session = await prisma.chatSession.create({
    data: {
      userId,
      userBookId: userBook.id,
      bookId: userBook.bookId,
    },
    select: chatSessionSelection,
  });

  return mapChatSession(session);
}

export async function listUserChatSessions(
  userId: string,
  userBookId: string,
): Promise<PublicChatSession[]> {
  await requireOwnedUserBook(userId, userBookId);

  const sessions = await prisma.chatSession.findMany({
    where: {
      userId,
      userBookId,
      userBook: { userId },
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    select: chatSessionSelection,
  });

  return sessions.map(mapChatSession);
}

export async function getUserChatSession(
  userId: string,
  userBookId: string,
  sessionId: string,
): Promise<PublicChatSessionWithMessages> {
  if (!isChatUuid(userBookId) || !isChatUuid(sessionId)) {
    throw notFound("Chat session not found.");
  }

  const session = await prisma.chatSession.findFirst({
    where: {
      id: sessionId,
      userId,
      userBookId,
      userBook: { userId },
    },
    select: {
      ...chatSessionSelection,
      messages: {
        where: {
          role: {
            in: [ChatMessageRole.USER, ChatMessageRole.ASSISTANT],
          },
        },
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" },
        ],
        select: chatMessageSelection,
      },
    },
  });

  if (!session) {
    throw notFound("Chat session not found.");
  }

  return mapChatSessionWithMessages(session);
}

export async function createUserChatMessage(
  userId: string,
  userBookId: string,
  sessionId: string,
  dto: CreateUserMessageDto,
): Promise<PublicChatMessage> {
  const session = await requireOwnedChatSession(
    userId,
    userBookId,
    sessionId,
  );
  const message = await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      userId,
      role: ChatMessageRole.USER,
      content: dto.content,
    },
    select: chatMessageSelection,
  });

  return mapChatMessage(message);
}

export async function deleteUserChatSession(
  userId: string,
  userBookId: string,
  sessionId: string,
): Promise<void> {
  if (!isChatUuid(userBookId) || !isChatUuid(sessionId)) {
    throw notFound("Chat session not found.");
  }

  const result = await prisma.chatSession.deleteMany({
    where: {
      id: sessionId,
      userId,
      userBookId,
      userBook: { userId },
    },
  });

  if (result.count !== 1) {
    throw notFound("Chat session not found.");
  }
}
