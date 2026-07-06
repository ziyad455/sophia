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

function normalizeTextField(value: Buffer): string | undefined {
  const text = value.toString("utf8").trim();

  return text || undefined;
}

function validatePdfFile(file: UploadedPdfFile): void {
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

export async function parsePdfUpload(req: ApiRequest, maxBytes: number): Promise<ParsedPdfUpload> {
  const boundary = parseContentTypeBoundary(req.headers["content-type"]);
  const body = await readRequestBody(req, maxBytes);
  const parts = parseMultipartParts(body, boundary);
  const fields: Record<string, string | undefined> = {};
  let file: UploadedPdfFile | undefined;

  for (const part of parts) {
    const disposition = getHeaderValue(part.headers, "contentDisposition");
    const name = readDispositionParameter(disposition, "name");

    if (!name) {
      continue;
    }

    if (name === "file") {
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

    if (name === "title" || name === "author" || name === "language") {
      fields[name] = normalizeTextField(part.body);
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
    language: fields.language,
  };
}
