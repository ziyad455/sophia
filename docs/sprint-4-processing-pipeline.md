# Sprint 4 Processing Pipeline

## Scope

S4-T1 created the backend processing foundation for uploaded books. S4-T2 connects that foundation to embedded PDF text extraction for normal selectable-text PDFs.

Sprint 4 processing intentionally does not perform OCR, detect chapters in S4-T2, generate chunks in S4-T2, build reader UI, or call AI providers.

## Routes

Processing routes are mounted under the existing `/books` route group.

- `GET /books/:userBookId/processing-status`
  - Requires authentication.
  - Verifies that `userBookId` belongs to `req.auth.userId`.
  - Returns safe processing fields only.

- `POST /books/:userBookId/process`
  - Requires authentication.
  - Verifies that `userBookId` belongs to `req.auth.userId`.
  - Moves an uploaded or failed book to `extracting_text`.
  - Extracts embedded text page by page from the stored PDF.
  - Stores one `pages` row per PDF page.
  - Moves the book to `chunking` after successful extraction.
  - Returns `409` when the book is already processing or already ready.
  - Returns `400` for PDFs without selectable text.

Example status response:

```json
{
  "book": {
    "userBookId": "user-book-id",
    "bookId": "book-id",
    "processingStatus": "uploaded",
    "processingError": null,
    "pageCount": null
  }
}
```

No endpoint returns `file_path`, `cover_path`, or local storage paths.

## Ownership Rule

Processing always starts from the authenticated request context:

```ts
req.auth.userId
```

The service verifies ownership with `user_books`:

```ts
where: {
  id: userBookId,
  userId: req.auth.userId
}
```

If the row is missing, malformed, or owned by another user, the API returns `404`.

## Processing Statuses

Sophia uses the existing `book_processing_status` enum:

- `uploaded`
- `extracting_text`
- `chunking`
- `ready`
- `failed`

## Allowed Transitions

- `uploaded -> extracting_text`
- `extracting_text -> chunking`
- `extracting_text -> failed`
- `chunking -> ready`
- `chunking -> failed`
- `failed -> extracting_text`

Unsupported transitions are rejected. In particular, `ready -> extracting_text` is not allowed because forced reprocessing is not part of S4-T1.

## Retry Behavior

- `uploaded` books can start processing.
- `failed` books can retry by moving back to `extracting_text`.
- `extracting_text` and `chunking` books are considered already processing and return `409`.
- `ready` books return `409` until a future forced reprocess mode exists.

The start operation uses an atomic status update and page upserts so repeated requests do not duplicate pages, chapters, or chunks.

## Text Extraction

S4-T2 uses `pdfjs-dist` to extract embedded text from the stored PDF.

For each page, Sophia stores:

- `book_id`
- `chapter_id = null`
- `page_number`
- `text`
- `text_hash`
- `extraction_status`

Page numbers start at `1`. Page rows are upserted by the existing unique key on `book_id + page_number`, so retries update existing rows instead of creating duplicates.

After extraction succeeds:

- `books.page_count` is updated.
- `books.processing_status` moves from `extracting_text` to `chunking`.
- `books.processing_error` is cleared.

If the PDF has no selectable embedded text, Sophia marks the book `failed` and stores this public-safe message:

```text
This PDF does not contain selectable text. OCR support will be added later.
```

OCR is intentionally not implemented.

## Error Storage

Processing failures should use `markProcessingFailed(bookId, currentStatus, errorMessage)`.

Stored public error messages must be clean:

- no stack traces
- no secrets
- no full filesystem paths
- short enough to display in UI

The default public-safe message is:

```text
This PDF could not be processed.
```

## Sprint Boundaries

S4-T1 adds:

- processing module structure
- processing routes
- ownership checks
- status endpoint
- start-processing endpoint
- transition helpers
- retry-safe status updates
- clean failure helper

S4-T2 adds:

- actual PDF text extraction
- page creation in `pages`
- page count updates

S4-T3 should add:

- chapter detection
- `chapters` rows
- page-to-chapter relationships where appropriate

S4-T4 should add:

- `book_chunks`
- chunk hashes
- chunk metadata
- transition from `chunking` to `ready`

Sprint 5 should evaluate Extend UI for the reader surface, PDF viewer, thumbnails, search, text selection, and annotations. Extend UI should not be integrated during Sprint 4 processing work.

## Manual Verification

1. Log in as user A.
2. Upload a PDF if the library is empty.
3. Copy a `userBookId` from `GET /books`.
4. Call `GET /books/:userBookId/processing-status`.
5. Confirm the response includes `userBookId`, `bookId`, `processingStatus`, `processingError`, and `pageCount`.
6. Confirm the response does not include `filePath`, `coverPath`, or storage paths.
7. Call `POST /books/:userBookId/process`.
8. Confirm the response is `200` and `processingStatus` is `chunking`.
9. Confirm `pages` rows exist for the book.
10. Confirm `page_number` starts at `1`.
11. Confirm page rows include `text`, `text_hash`, and `extraction_status`.
12. Confirm `books.page_count` matches the PDF page count.
13. Call `POST /books/:userBookId/process` again.
14. Confirm the response is `409`.
15. Log in as user B.
16. Try `GET /books/:userBookId/processing-status` for user A's book.
17. Confirm the response is `404`.
18. Try `POST /books/:userBookId/process` for user A's book.
19. Confirm the response is `404`.
20. Upload a scanned/image-only PDF if available.
21. Confirm processing fails with the OCR-not-supported message.
22. Run backend TypeScript and build checks.
