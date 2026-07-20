import { badRequest } from "../http/errors";
import {
  READING_SESSION_MODES,
  type ReadingSessionMode,
} from "./reading-sessions.types";

const MAX_DURATION_SECONDS = 2_147_483_647;
const MAX_UPDATE_SEQUENCE = Number.MAX_SAFE_INTEGER;
const startFields = new Set(["startPage", "startChapterId", "readerMode"]);
const updateFields = new Set([
  "activeDurationSeconds",
  "endPage",
  "endChapterId",
  "readerMode",
  "sequence",
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StartReadingSessionDto = {
  startPage: number;
  startChapterId: string | null;
  readerMode: ReadingSessionMode;
};

export type UpdateReadingSessionDto = {
  activeDurationSeconds: number;
  endPage: number;
  endChapterId: string | null;
  readerMode: ReadingSessionMode;
  sequence: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function rejectUnknownFields(
  value: Record<string, unknown>,
  allowed: Set<string>,
): void {
  const unknownFields = Object.keys(value).filter((key) => !allowed.has(key));

  if (unknownFields.length > 0) {
    throw badRequest("Request body contains unsupported reading-session fields.", {
      fields: unknownFields,
    });
  }
}

function parsePage(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw badRequest(field + " must be an integer greater than or equal to 1.");
  }

  return value as number;
}

function parseNullableUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw badRequest(field + " must be a valid UUID or null.");
  }

  return value;
}

function parseReaderMode(value: unknown): ReadingSessionMode {
  if (
    typeof value !== "string" ||
    !READING_SESSION_MODES.includes(value as ReadingSessionMode)
  ) {
    throw badRequest("readerMode must be either pdf or reading.");
  }

  return value as ReadingSessionMode;
}

function parseDuration(value: unknown): number {
  if (
    !Number.isInteger(value) ||
    (value as number) < 0 ||
    (value as number) > MAX_DURATION_SECONDS
  ) {
    throw badRequest(
      "activeDurationSeconds must be an integer from 0 to " +
        MAX_DURATION_SECONDS +
        ".",
    );
  }

  return value as number;
}

function parseSequence(value: unknown): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 1 ||
    (value as number) > MAX_UPDATE_SEQUENCE
  ) {
    throw badRequest("sequence must be a positive safe integer.");
  }

  return value as number;
}

export function isReadingSessionUuid(value: string): boolean {
  return uuidPattern.test(value);
}

export function parseStartReadingSessionDto(
  value: unknown,
): StartReadingSessionDto {
  if (!isRecord(value)) {
    throw badRequest("Request body must be a JSON object.");
  }

  rejectUnknownFields(value, startFields);

  if (!hasOwn(value, "startPage") || !hasOwn(value, "readerMode")) {
    throw badRequest("startPage and readerMode are required.");
  }

  return {
    startPage: parsePage(value.startPage, "startPage"),
    startChapterId: parseNullableUuid(value.startChapterId, "startChapterId"),
    readerMode: parseReaderMode(value.readerMode),
  };
}

export function parseUpdateReadingSessionDto(
  value: unknown,
): UpdateReadingSessionDto {
  if (!isRecord(value)) {
    throw badRequest("Request body must be a JSON object.");
  }

  rejectUnknownFields(value, updateFields);

  for (const field of updateFields) {
    if (!hasOwn(value, field)) {
      throw badRequest(field + " is required.");
    }
  }

  return {
    activeDurationSeconds: parseDuration(value.activeDurationSeconds),
    endPage: parsePage(value.endPage, "endPage"),
    endChapterId: parseNullableUuid(value.endChapterId, "endChapterId"),
    readerMode: parseReaderMode(value.readerMode),
    sequence: parseSequence(value.sequence),
  };
}
