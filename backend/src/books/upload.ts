import { extname } from "node:path";
import { badRequest } from "../http/errors";
import type { ApiRequest } from "../http/types";

type ParsedPartHeaders = {
  contentDisposition?: string;
  contentType?: string;
};

type MultipartPart = {
  headers: ParsedPartHeaders;
  body: Buffer;
};

export type UploadedPdfFile = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
};

export type ParsedPdfUpload = {
  file: UploadedPdfFile;
  title?: string;
  author?: string;
  language?: string;
};

const pdfMagicBytes = Buffer.from("%PDF-");
const maxMultipartParts = 4;
const maxFilenameLength = 255;
const maxTitleLength = 300;
const maxAuthorLength = 255;
const maxLanguageLength = 16;
const editableUploadFields = new Set(["file", "title", "author", "language"]);
const languagePattern = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i;

function getHeaderValue(headers: ParsedPartHeaders, name: keyof ParsedPartHeaders): string {
  return headers[name] ?? "";
}

function parseContentTypeBoundary(contentType: string | string[] | undefined): string {
  const value = Array.isArray(contentType) ? contentType[0] : contentType;

  if (!value?.toLowerCase().startsWith("multipart/form-data")) {
    throw badRequest("Upload must use multipart/form-data.");
  }

  const boundary = value
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("boundary="))
    ?.slice("boundary=".length)
    .replace(/^"|"$/g, "");

  if (!boundary) {
    throw badRequest("Multipart upload boundary is missing.");
  }

  return boundary;
}

async function readRequestBody(req: ApiRequest, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;

    if (totalBytes > maxBytes) {
      throw badRequest("PDF file is too large.");
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks, totalBytes);
}

function trimPartBody(body: Buffer): Buffer {
  let end = body.length;

  if (end >= 2 && body[end - 2] === 13 && body[end - 1] === 10) {
    end -= 2;
  }

  return body.subarray(0, end);
}

function splitBuffer(buffer: Buffer, delimiter: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;
  let index = buffer.indexOf(delimiter, start);

  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + delimiter.length;
    index = buffer.indexOf(delimiter, start);
  }

  parts.push(buffer.subarray(start));
  return parts;
}

function parsePartHeaders(headerBuffer: Buffer): ParsedPartHeaders {
  const lines = headerBuffer.toString("latin1").split("\r\n");
  const headers: ParsedPartHeaders = {};

  for (const line of lines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const name = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (name === "content-disposition") {
      headers.contentDisposition = value;
    }

    if (name === "content-type") {
      headers.contentType = value;
    }
  }

  return headers;
}

function parseMultipartParts(body: Buffer, boundary: string): MultipartPart[] {
  const delimiter = Buffer.from(`--${boundary}`);
  const rawParts = splitBuffer(body, delimiter);
  const parts: MultipartPart[] = [];

  for (const rawPart of rawParts) {
    let part = rawPart;

    if (part.length === 0 || part.equals(Buffer.from("--\r\n")) || part.equals(Buffer.from("--"))) {
      continue;
    }

    if (part.subarray(0, 2).equals(Buffer.from("\r\n"))) {
      part = part.subarray(2);
    }

    if (part.subarray(0, 2).equals(Buffer.from("--"))) {
      continue;
    }

    const headerSeparator = Buffer.from("\r\n\r\n");
    const separatorIndex = part.indexOf(headerSeparator);
    if (separatorIndex === -1) {
      continue;
    }

    parts.push({
      headers: parsePartHeaders(part.subarray(0, separatorIndex)),
      body: trimPartBody(part.subarray(separatorIndex + headerSeparator.length)),
    });
  }

  return parts;
}

function readDispositionParameter(disposition: string, parameterName: string): string | undefined {
  const pattern = new RegExp(`${parameterName}="([^"]*)"`);
  const match = disposition.match(pattern);

  return match?.[1];
}

function normalizeTextField(value: Buffer, fieldName: string, maxLength: number): string | undefined {
  const text = value.toString("utf8").trim();

  if (text.length > maxLength) {
    throw badRequest(`${fieldName} must be ${maxLength} characters or fewer.`);
  }

  return text || undefined;
}

function validatePdfFile(file: UploadedPdfFile): void {
  if (file.originalName.length > maxFilenameLength) {
    throw badRequest("Uploaded filename is too long.");
  }

  if (file.mimeType.toLowerCase() !== "application/pdf") {
    throw badRequest("Only PDF uploads are supported.");
  }

  if (extname(file.originalName).toLowerCase() !== ".pdf") {
    throw badRequest("Uploaded file must use a .pdf extension.");
  }

  if (!file.buffer.subarray(0, pdfMagicBytes.length).equals(pdfMagicBytes)) {
    throw badRequest("Uploaded file is not a valid PDF.");
  }
}

function validateUploadLanguage(language: string | undefined): string | undefined {
  if (!language) {
    return undefined;
  }

  const normalizedLanguage = language.toLowerCase();

  if (
    normalizedLanguage.length > maxLanguageLength ||
    !languagePattern.test(normalizedLanguage)
  ) {
    throw badRequest("language must be a short language code.");
  }

  return normalizedLanguage;
}

export async function parsePdfUpload(req: ApiRequest, maxBytes: number): Promise<ParsedPdfUpload> {
  const boundary = parseContentTypeBoundary(req.headers["content-type"]);
  const body = await readRequestBody(req, maxBytes);
  const parts = parseMultipartParts(body, boundary);
  const fields: Record<string, string | undefined> = {};
  const seenFieldNames = new Set<string>();
  let file: UploadedPdfFile | undefined;

  if (parts.length > maxMultipartParts) {
    throw badRequest("Upload contains too many fields.");
  }

  for (const part of parts) {
    const disposition = getHeaderValue(part.headers, "contentDisposition");
    const name = readDispositionParameter(disposition, "name");

    if (!name) {
      continue;
    }

    if (!editableUploadFields.has(name)) {
      throw badRequest("Upload contains unsupported fields.");
    }

    if (name === "file") {
      if (file) {
        throw badRequest("Only one PDF file can be uploaded at a time.");
      }

      const originalName = readDispositionParameter(disposition, "filename");
      if (!originalName) {
        throw badRequest("Uploaded file is missing a filename.");
      }

      file = {
        buffer: part.body,
        originalName,
        mimeType: getHeaderValue(part.headers, "contentType"),
        size: part.body.byteLength,
      };
      continue;
    }

    if (seenFieldNames.has(name)) {
      throw badRequest("Upload contains duplicate fields.");
    }

    seenFieldNames.add(name);

    if (name === "title") {
      fields.title = normalizeTextField(part.body, "title", maxTitleLength);
      continue;
    }

    if (name === "author") {
      fields.author = normalizeTextField(part.body, "author", maxAuthorLength);
      continue;
    }

    if (name === "language") {
      fields.language = normalizeTextField(part.body, "language", maxLanguageLength);
    }
  }

  if (!file) {
    throw badRequest("A PDF file is required.");
  }

  validatePdfFile(file);

  return {
    file,
    title: fields.title,
    author: fields.author,
    language: validateUploadLanguage(fields.language),
  };
}
