# Sprint 4 Processing Pipeline

## Scope

S4-T1 creates the backend processing foundation for uploaded books. It prepares protected routes, ownership checks, status transitions, retry behavior, and a safe entrypoint for later PDF processing work.

This task intentionally does not extract PDF text, create pages, detect chapters, generate chunks, build reader UI, or call AI providers.

## Routes

Processing routes are mounted under the existing `/books` route group.

- `GET /books/:userBookId/processing-status`
  - Requires authentication.
  - Verifies that `userBookId` belongs to `req.auth.userId`.
  - Returns safe processing fields only.

- `POST /books/:userBookId/process`
  - Requires authentication.
  - Verifies that `userBookId` belongs to `req.auth.userId`.
  - Starts the processing pipeline by moving an uploaded or failed book to `extracting_text`.
  - Returns `409` when the book is already processing or already ready.

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

The start operation uses an atomic status update so repeated requests do not duplicate pages, chapters, or chunks.

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

S4-T2 should add:

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
8. Confirm the response is `202` and `processingStatus` is `extracting_text`.
9. Call `POST /books/:userBookId/process` again.
10. Confirm the response is `409`.
11. Log in as user B.
12. Try `GET /books/:userBookId/processing-status` for user A's book.
13. Confirm the response is `404`.
14. Try `POST /books/:userBookId/process` for user A's book.
15. Confirm the response is `404`.
16. Run backend TypeScript and build checks.

