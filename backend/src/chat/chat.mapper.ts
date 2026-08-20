import {
  ChatMessageRole,
  type ChatMessage,
  type ChatSession,
} from "@prisma/client";
import type {
  PublicChatMessage,
  PublicChatMessageRole,
  PublicChatSession,
  PublicChatSessionWithMessages,
} from "./chat.types";

type ChatSessionRecord = Pick<ChatSession, "id" | "createdAt" | "updatedAt">;
type ChatMessageRecord = Pick<
  ChatMessage,
  "id" | "role" | "content" | "createdAt"
>;

export function mapChatSession(session: ChatSessionRecord): PublicChatSession {
  return {
    id: session.id,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

function mapChatMessageRole(role: ChatMessageRole): PublicChatMessageRole {
  if (role === ChatMessageRole.USER) {
    return "user";
  }

  if (role === ChatMessageRole.ASSISTANT) {
    return "assistant";
  }

  throw new Error("Unsupported persisted chat message role.");
}

export function mapChatMessage(message: ChatMessageRecord): PublicChatMessage {
  return {
    id: message.id,
    role: mapChatMessageRole(message.role),
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

export function mapChatSessionWithMessages(
  session: ChatSessionRecord & { messages: ChatMessageRecord[] },
): PublicChatSessionWithMessages {
  return {
    ...mapChatSession(session),
    messages: session.messages.map(mapChatMessage),
  };
}
