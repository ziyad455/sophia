import { badRequest } from "../http/errors";

export type UpdateBookMetadataDto = {
  title?: string;
  author?: string | null;
  language?: string;
};

export type UpdateReadingProgressDto = {
  currentPage?: number;
  currentChapterId?: string | null;
  progressPercent?: number;
};

const TITLE_MAX_LENGTH = 300;
const AUTHOR_MAX_LENGTH = 255;
const LANGUAGE_MAX_LENGTH = 16;
const editableMetadataFields = new Set(["title", "author", "language"]);
const languagePattern = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const editableProgressFields = new Set([
  "currentPage",
  "currentChapterId",
  "progressPercent",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function parseTitle(value: unknown): string {
  if (typeof value !== "string") {
    throw badRequest("title must be a string.");
  }

  const title = value.trim();

  if (!title) {
    throw badRequest("title cannot be empty.");
  }

  if (title.length > TITLE_MAX_LENGTH) {
    throw badRequest(`title must be ${TITLE_MAX_LENGTH} characters or fewer.`);
  }

  return title;
}

function parseAuthor(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw badRequest("author must be a string or null.");
  }

  const author = value.trim();

  if (!author) {
    return null;
  }

  if (author.length > AUTHOR_MAX_LENGTH) {
    throw badRequest(`author must be ${AUTHOR_MAX_LENGTH} characters or fewer.`);
  }

  return author;
}

function parseLanguage(value: unknown): string {
  if (typeof value !== "string") {
    throw badRequest("language must be a string.");
  }

  const language = value.trim().toLowerCase();

  if (!language || language.length > LANGUAGE_MAX_LENGTH || !languagePattern.test(language)) {
    throw badRequest("language must be a short language code.");
  }

  return language;
}

export function parseUpdateBookMetadataDto(value: unknown): UpdateBookMetadataDto {
  if (!isRecord(value)) {
    throw badRequest("Request body must be a JSON object.");
  }

  const unknownFields = Object.keys(value).filter((key) => !editableMetadataFields.has(key));

  if (unknownFields.length > 0) {
    throw badRequest("Request body contains unsupported book metadata fields.", {
      fields: unknownFields,
    });
  }

  const dto: UpdateBookMetadataDto = {};

  if (hasOwn(value, "title")) {
    dto.title = parseTitle(value.title);
  }

  if (hasOwn(value, "author")) {
    dto.author = parseAuthor(value.author);
  }

  if (hasOwn(value, "language")) {
    dto.language = parseLanguage(value.language);
  }

  if (!hasOwn(dto, "title") && !hasOwn(dto, "author") && !hasOwn(dto, "language")) {
    throw badRequest("At least one editable metadata field is required.");
  }

  return dto;
}

export function parseUpdateReadingProgressDto(value: unknown): UpdateReadingProgressDto {
  if (!isRecord(value)) {
    throw badRequest("Request body must be a JSON object.");
  }

  const unknownFields = Object.keys(value).filter((key) => !editableProgressFields.has(key));

  if (unknownFields.length > 0) {
    throw badRequest("Request body contains unsupported reading progress fields.", {
      fields: unknownFields,
    });
  }

  const dto: UpdateReadingProgressDto = {};

  if (hasOwn(value, "currentPage")) {
    if (!Number.isInteger(value.currentPage) || (value.currentPage as number) < 1) {
      throw badRequest("currentPage must be an integer greater than or equal to 1.");
    }

    dto.currentPage = value.currentPage as number;
  }

  if (hasOwn(value, "currentChapterId")) {
    if (
      value.currentChapterId !== null &&
      (typeof value.currentChapterId !== "string" || !uuidPattern.test(value.currentChapterId))
    ) {
      throw badRequest("currentChapterId must be a valid UUID or null.");
    }

    dto.currentChapterId = value.currentChapterId as string | null;
  }

  if (hasOwn(value, "progressPercent")) {
    if (
      typeof value.progressPercent !== "number" ||
      !Number.isFinite(value.progressPercent) ||
      value.progressPercent < 0 ||
      value.progressPercent > 100
    ) {
      throw badRequest("progressPercent must be a finite number from 0 to 100.");
    }

    dto.progressPercent = Math.round(value.progressPercent * 10) / 10;
  }

  if (Object.keys(dto).length === 0) {
    throw badRequest("At least one reading progress field is required.");
  }

  return dto;
}
