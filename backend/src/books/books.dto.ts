import { badRequest } from "../http/errors";

export type UpdateBookMetadataDto = {
  title?: string;
  author?: string | null;
  language?: string;
};

const TITLE_MAX_LENGTH = 300;
const AUTHOR_MAX_LENGTH = 255;
const LANGUAGE_MAX_LENGTH = 16;
const editableMetadataFields = new Set(["title", "author", "language"]);
const languagePattern = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i;

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
