# Sprint 4 Processing Pipeline

## Scope

S4-T1 created the backend processing foundation for uploaded books. S4-T2 connects that foundation to embedded PDF text extraction for normal selectable-text PDFs. S4-T3 adds conservative heuristic chapter detection from extracted page text.

Sprint 4 processing intentionally does not perform OCR, generate chunks before S4-T4, build reader UI, or call AI providers.

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

- `POST /books/:userBookId/chapters/detect`
  - Requires authentication.
  - Verifies that `userBookId` belongs to `req.auth.userId`.
  - Loads extracted pages in reading order.
  - Detects likely chapter headings with conservative heuristics.
  - Replaces existing heuristic chapters for the book.
  - Links pages to detected chapter ranges.
  - Keeps `processingStatus` as `chunking`.
  - Returns `chapterCount`, including `0` when no headings are detected.

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

## Chapter Detection

S4-T3 uses a heuristic detector over already-extracted `pages.text`.

Supported heading patterns include:

- `Chapter 1`
- `CHAPTER I`
- `Chapter One`
- `Part I`
- `Book I`
- `I.`
- `1.`
- `Introduction`
- `Preface`
- `Conclusion`
- `Epilogue`

The detector:

- scans pages in `page_number` order
- inspects the first 30 non-empty lines of each page
- prefers short standalone heading lines
- scores explicit chapter/part/book headings higher than generic title-like lines
- skips repeated short lines that look like headers or footers
- treats false negatives as acceptable

If no chapter headings are found, Sophia returns success with `chapterCount = 0`. This is not a processing failure; S4-T4 can still generate page-based chunks.

For detected chapters, Sophia stores:

- `book_id`
- `title`
- `chapter_index`
- `page_start`
- `page_end`
- `start_offset` when available
- `end_offset = null`
- `detected_method = heuristic`

Pages are linked by updating `pages.chapter_id` for page ranges between detected chapter starts. Pages before the first detected chapter remain unlinked.

Chapter detection is retry-safe. Before regenerating heuristic chapters, Sophia clears `pages.chapter_id` for existing heuristic chapters and deletes only those heuristic chapter rows. It does not delete pages or chunks.

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

S4-T3 adds:

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
15. Call `POST /books/:userBookId/chapters/detect`.
16. Confirm the response is `200` and includes `chapterCount`.
17. Confirm any detected `chapters` rows use `detected_method = heuristic`.
18. Confirm `chapter_index`, `page_start`, and `page_end` follow reading order.
19. Confirm `pages.chapter_id` is populated inside detected page ranges.
20. Call `POST /books/:userBookId/chapters/detect` again.
21. Confirm chapters are not duplicated.
22. Log in as user B.
23. Try `GET /books/:userBookId/processing-status` for user A's book.
24. Confirm the response is `404`.
25. Try `POST /books/:userBookId/process` for user A's book.
26. Confirm the response is `404`.
27. Try `POST /books/:userBookId/chapters/detect` for user A's book.
28. Confirm the response is `404`.
29. Upload a scanned/image-only PDF if available.
30. Confirm processing fails with the OCR-not-supported message.
31. Run backend TypeScript and build checks.
