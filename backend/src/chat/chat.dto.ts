import { badRequest } from "../http/errors";

export const MAX_CHAT_MESSAGE_CONTENT_LENGTH = 10_000;

export type CreateChatSessionDto = Record<string, never>;

export type CreateUserMessageDto = {
  content: string;
};

const createSessionFields = new Set<string>();
const createMessageFields = new Set(["content"]);
const htmlMarkupPattern = /<\s*\/?\s*[a-z][^>]*>/i;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rejectUnknownFields(
  value: Record<string, unknown>,
  allowed: Set<string>,
  message: string,
): void {
  const unknownFields = Object.keys(value).filter((key) => !allowed.has(key));

  if (unknownFields.length > 0) {
    throw badRequest(message, { fields: unknownFields });
  }
}

export function isChatUuid(value: string): boolean {
  return uuidPattern.test(value);
}

export function parseCreateChatSessionDto(
  value: unknown,
): CreateChatSessionDto {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    throw badRequest("Request body must be a JSON object.");
  }

  rejectUnknownFields(
    value,
    createSessionFields,
    "Request body contains unsupported chat-session fields.",
  );

  return {};
}

export function parseCreateUserMessageDto(
  value: unknown,
): CreateUserMessageDto {
  if (!isRecord(value)) {
    throw badRequest("Request body must be a JSON object.");
  }

  rejectUnknownFields(
    value,
    createMessageFields,
    "Request body contains unsupported chat-message fields.",
  );

  if (typeof value.content !== "string") {
    throw badRequest("content must be a string.");
  }

  const content = value.content.trim();

  if (!content) {
    throw badRequest("content cannot be empty.");
  }

  if (content.length > MAX_CHAT_MESSAGE_CONTENT_LENGTH) {
    throw badRequest(
      "content must be " +
        MAX_CHAT_MESSAGE_CONTENT_LENGTH.toLocaleString("en-US") +
        " characters or fewer.",
    );
  }

  if (content.includes("\u0000") || htmlMarkupPattern.test(content)) {
    throw badRequest("content must be plain text without HTML markup.");
  }

  return { content };
}
