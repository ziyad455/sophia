import { BookProcessingStatus } from "@prisma/client";

const allowedTransitions = new Map<BookProcessingStatus, Set<BookProcessingStatus>>([
  [
    BookProcessingStatus.UPLOADED,
    new Set([BookProcessingStatus.EXTRACTING_TEXT]),
  ],
  [
    BookProcessingStatus.EXTRACTING_TEXT,
    new Set([BookProcessingStatus.CHUNKING, BookProcessingStatus.FAILED]),
  ],
  [
    BookProcessingStatus.CHUNKING,
    new Set([BookProcessingStatus.READY, BookProcessingStatus.FAILED]),
  ],
  [
    BookProcessingStatus.FAILED,
    new Set([BookProcessingStatus.EXTRACTING_TEXT]),
  ],
  [BookProcessingStatus.READY, new Set()],
]);

const activeProcessingStatuses = new Set<BookProcessingStatus>([
  BookProcessingStatus.EXTRACTING_TEXT,
  BookProcessingStatus.CHUNKING,
]);

export function serializeProcessingStatus(status: BookProcessingStatus): string {
  return status.toLowerCase();
}

export function isProcessingActive(status: BookProcessingStatus): boolean {
  return activeProcessingStatuses.has(status);
}

export function canStartProcessing(status: BookProcessingStatus): boolean {
  return status === BookProcessingStatus.UPLOADED || status === BookProcessingStatus.FAILED;
}

export function canMoveToStatus(
  currentStatus: BookProcessingStatus,
  nextStatus: BookProcessingStatus,
): boolean {
  return allowedTransitions.get(currentStatus)?.has(nextStatus) ?? false;
}

export function getStartProcessingConflictMessage(status: BookProcessingStatus): string {
  if (isProcessingActive(status)) {
    return "This book is already being processed.";
  }

  if (status === BookProcessingStatus.READY) {
    return "This book is already ready to read.";
  }

  return "This book cannot be processed from its current status.";
}

