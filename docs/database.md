# Database Architecture

Sophia's database should be designed as a user-owned reading memory system, not as a generic PDF store or chatbot log.

The database must support:
- authenticated users
- Google and email authentication
- personal libraries
- uploaded philosophy books
- extracted book structure
- notes and highlights
- reading progress
- reading sessions
- chat history tied to reading context
- user-specific philosophical memory
- chapter summaries
- future retrieval with embeddings and pgvector

## Design Philosophy

PostgreSQL is the source of truth. Prisma should model the core relational data clearly, with JSONB used only where the data is naturally flexible.

The main design rule:

Personal reading data belongs to the user. Book structure belongs to the book.

This means Sophia should separate:
- the uploaded book asset
- the user's relationship to that book
- the user's notes, highlights, chats, progress, and memory
- AI-generated derived data
- future retrieval indexes

The MVP should stay simple, but the schema should not block the long-term product vision.

## Core Entity Groups

Authentication:
- users
- auth_accounts
- sessions
- refresh_tokens

User profile:
- user_preferences
- user_reading_profiles

Book structure:
- books
- user_books
- chapters
- pages
- book_chunks

Reflection:
- notes
- highlights

AI companion:
- chat_sessions
- chat_messages
- chapter_summaries
- ai_context_snapshots later
- ai_runs later

Reading activity:
- reading_progress
- reading_sessions

Memory:
- user_memory
- memory_review_events later

Retrieval:
- embeddings later

## Ownership Model

Every personal object must include `userId`.

User-owned tables:
- user_books
- user_preferences
- user_reading_profiles
- notes
- highlights
- chat_sessions
- chat_messages
- reading_progress
- reading_sessions
- user_memory
- memory_review_events

Book-owned tables:
- chapters
- pages
- book_chunks

Mixed ownership:
- chapter_summaries can be global or user-owned.
- For the MVP, prefer user-owned summaries if summaries may reflect user preferences or chat context.
- If summaries are purely generated from chapter text, they can later become shared per book/chapter/model/version.

Authorization should be simple:

Before reading or changing user-owned data, check that the record's `userId` matches the authenticated user.

## Authentication Model

Sophia should not treat Google as the user. Google is only one authentication provider for a Sophia user.

### users

Stores Sophia's internal user identity.

Recommended fields:
- id
- email
- displayName
- avatarUrl
- emailVerifiedAt
- createdAt
- updatedAt
- deletedAt

### auth_accounts

Stores login methods attached to a user.

Recommended fields:
- id
- userId
- provider
- providerUserId
- email
- passwordHash
- createdAt
- updatedAt

Provider examples:
- email
- google

Rules:
- `provider + providerUserId` should be unique.
- `passwordHash` is only used for email auth.
- Google auth should use Google's stable `sub` as `providerUserId`.

### sessions

Stores active login sessions.

Recommended fields:
- id
- userId
- sessionTokenHash
- expiresAt
- userAgent
- ipAddress
- createdAt
- revokedAt

### refresh_tokens

Use this if Sophia uses refresh-token rotation.

Recommended fields:
- id
- userId
- sessionId
- tokenHash
- expiresAt
- rotatedAt
- revokedAt
- createdAt

## Books And Reading Structure

Sophia should model books as structured reading objects.

### books

Represents an uploaded or imported book asset.

Recommended fields:
- id
- title
- author
- language
- sourceType
- filePath
- fileHash
- mimeType
- pageCount
- processingStatus
- processingError
- createdByUserId
- createdAt
- updatedAt

Source type examples:
- upload
- public_domain
- imported

Processing status examples:
- uploaded
- extracting_text
- chunking
- ready
- failed

Important decision:
- Keep `filePath` in the database.
- Store the actual PDF in local file storage during the MVP.
- Add object storage later without changing the book relationship model.

### user_books

Represents a user's library entry for a book.

Recommended fields:
- id
- userId
- bookId
- status
- addedAt
- lastOpenedAt
- archivedAt

Status examples:
- active
- reading
- finished
- archived

Constraints:
- unique `userId + bookId`

This table is important even if each MVP upload belongs to one user. It keeps the long-term model ready for public-domain books, shared texts, and imported catalogs.

### chapters

Represents detected or manually created book chapters.

Recommended fields:
- id
- bookId
- title
- chapterIndex
- pageStart
- pageEnd
- startOffset
- endOffset
- detectedMethod
- createdAt
- updatedAt

Detected method examples:
- heuristic
- manual
- imported
- ai_assisted

### pages

Represents extracted page text.

Recommended fields:
- id
- bookId
- pageNumber
- text
- textHash
- extractionStatus
- createdAt
- updatedAt

This helps Sophia answer page-local questions and makes highlights easier to anchor.

### book_chunks

Represents retrieval-ready text chunks.

Recommended fields:
- id
- bookId
- chapterId
- pageStart
- pageEnd
- chunkIndex
- content
- tokenCount
- textHash
- chunkingVersion
- metadata
- createdAt
- updatedAt

Rules:
- chunks should include page and chapter metadata
- chunks should be regenerated when the chunking strategy changes
- do not store embeddings directly on this table for the MVP

## Notes And Highlights

Notes and highlights are user-owned philosophical reflection data.

### highlights

Recommended fields:
- id
- userId
- userBookId
- bookId
- chapterId
- pageStart
- pageEnd
- chunkId
- selectedText
- color
- anchor
- createdAt
- updatedAt
- deletedAt

`anchor` should be JSONB because PDF selection coordinates vary by viewer.

Good anchor data can include:
- startOffset
- endOffset
- quote
- prefix
- suffix
- pageCoordinates
- viewerScale
- textLayerVersion

Do not rely only on PDF coordinates. Store the selected text and text anchors too.

### notes

Recommended fields:
- id
- userId
- userBookId
- bookId
- chapterId
- pageNumber
- chunkId
- highlightId
- content
- noteType
- createdAt
- updatedAt
- deletedAt

Note type examples:
- margin_note
- reflection
- question
- summary

A note can be:
- attached to a highlight
- attached to a page
- attached to a chapter
- attached to the book generally

## Chat Sessions And Messages

Sophia chat is reading-contextual. It should not be modeled as a generic chatbot transcript.

### chat_sessions

Recommended fields:
- id
- userId
- userBookId
- bookId
- chapterId
- title
- mode
- createdAt
- updatedAt
- archivedAt

Mode examples:
- passage_explanation
- chapter_summary
- reflection
- book_question
- general_reading_help

### chat_messages

Recommended fields:
- id
- sessionId
- userId
- role
- content
- selectedText
- pageNumber
- chapterId
- contextSnapshotId
- modelProvider
- modelName
- metadata
- createdAt

Role examples:
- user
- assistant
- system
- tool

For MVP, `metadata` can store:
- selected passage
- selected page range
- retrieved chunk IDs
- notes used
- highlights used
- memory IDs used
- interpretive lens used
- response mode

Later, move this into `ai_context_snapshots` when debugging, evals, or reproducibility become important.

## Chapter Summaries

### chapter_summaries

Recommended fields:
- id
- userId
- bookId
- chapterId
- summary
- summaryType
- modelProvider
- modelName
- promptVersion
- sourceChunkIds
- createdAt
- updatedAt

Summary type examples:
- short
- detailed
- philosophical_themes
- study_notes

Decision:
- Keep summaries user-owned in the MVP.
- If Sophia later builds canonical summaries per public-domain book, add shared summaries separately.

## User-Specific Memory

Sophia memory should be distilled from reading activity. It should not be raw chat history.

### user_memory

Recommended fields:
- id
- userId
- type
- content
- sourceType
- sourceId
- confidence
- status
- createdAt
- updatedAt
- lastUsedAt

Memory type examples:
- preferred_explanation_style
- favorite_philosopher
- difficult_concept
- recurring_question
- personal_reflection
- finished_book
- important_highlight

Source type examples:
- note
- highlight
- chat_message
- reading_session
- manual

Status examples:
- active
- archived
- rejected

Rules:
- do not remember every chat message
- do not store private details unrelated to reading
- memory should be reviewable and removable
- memory context selection should be based on relevance to the current reading task

Future table:

### memory_review_events

Recommended fields:
- id
- userId
- memoryId
- action
- reason
- createdAt

Actions:
- created
- updated
- archived
- rejected
- manually_confirmed

## Reading Progress And Sessions

Sophia should separate current progress from historical reading sessions.

### reading_progress

Stores the latest reading position.

Recommended fields:
- id
- userId
- userBookId
- bookId
- currentPage
- currentChapterId
- progressPercent
- lastReadAt
- updatedAt

Constraints:
- unique `userId + userBookId`

### reading_sessions

Stores private, active-reading history. Reading progress remains the source of
the resume position; a session is one historical reading period.

Recommended fields:
- id
- userId
- userBookId
- bookId
- chapterId
- startedAt
- endedAt
- startPage
- endPage
- durationSeconds
- pagesRead
- metadata

S6-T4 runtime policy:
- The client sends total accumulated active seconds, never wall-clock duration.
- Duration is monotonic, and a sequence number prevents older requests from
  replacing a newer final page, chapter, or reader mode.
- The current schema's metadata stores a versioned reader mode, start/end
  chapter IDs, server update time, and update sequence. Raw activity events are
  never stored.
- pagesRead remains null because start/end page deltas do not reliably
  represent pages read.
- A fresh unfinished session is reused. After 30 minutes without a stored
  update, it is ended at its last recorded update time and a new session starts.
- Ending is idempotent and cannot move an already-ended session's final
  position or reduce its duration.

This supports:
- reading streaks later
- session-based reflection
- long-term memory extraction
- "you spent time with this idea" insights

## User Preferences And Reading Profile

### user_preferences

Recommended fields:
- id
- userId
- theme
- fontSize
- fontFamily
- lineHeight
- explanationDepth
- preferredTone
- createdAt
- updatedAt

### user_reading_profiles

Recommended fields:
- id
- userId
- favoriteAuthors
- favoriteThemes
- difficultConcepts
- readingGoals
- metadata
- createdAt
- updatedAt

This table can start small. Some of this may later be replaced by `user_memory`, but preferences and memory should not be collapsed together.

Preferences are explicit settings.

Memory is inferred or saved understanding.

## Future Embeddings And pgvector

Do not force embeddings into the MVP schema.

Add embeddings later as a separate table.

### embeddings

Recommended fields:
- id
- targetType
- targetId
- modelProvider
- modelName
- dimensions
- vector
- contentHash
- createdAt

Target type examples:
- book_chunk
- note
- highlight
- chapter_summary
- user_memory

With pgvector, `vector` can become a pgvector column, for example `vector(1536)` depending on the embedding model.

Why separate embeddings from source tables:
- embedding dimensions vary by model
- embeddings may need to be regenerated
- one source object may have embeddings from multiple models
- retrieval should not pollute the core reading schema

## AI Runtime Audit Tables Later

These are not required for the MVP, but they are useful once Sophia needs evals, debugging, and reproducibility.

### ai_context_snapshots

Recommended fields:
- id
- userId
- chatMessageId
- taskType
- selectedText
- bookId
- chapterId
- chunkIds
- noteIds
- highlightIds
- memoryIds
- interpretiveContextKeys
- promptVersion
- createdAt

### ai_runs

Recommended fields:
- id
- userId
- contextSnapshotId
- provider
- model
- inputTokenCount
- outputTokenCount
- latencyMs
- status
- errorMessage
- createdAt

These tables should be introduced when needed, not before.

## Interpretive Knowledge

For the MVP, interpretive knowledge should start as versioned knowledge files rather than database tables.

Examples:
- interpretive lenses
- philosophy concepts
- theological context
- psychology context
- literary comparisons
- historical context
- author context

Move this into database tables only if Sophia needs:
- admin editing
- user-visible browsing
- citations per concept
- versioned releases
- concept-level retrieval

Possible future tables:
- interpretive_concepts
- interpretive_lenses
- author_profiles
- historical_context_entries
- concept_relationships

## ERD-Style Relationship Summary

```txt
User 1--many AuthAccount
User 1--many Session
User 1--many RefreshToken
User 1--1 UserPreference
User 1--1 UserReadingProfile

User many--many Book through UserBook

Book 1--many Chapter
Book 1--many Page
Book 1--many BookChunk

Chapter 1--many Page
Chapter 1--many BookChunk
Chapter 1--many ChapterSummary

UserBook 1--1 ReadingProgress
UserBook 1--many ReadingSession
UserBook 1--many Highlight
UserBook 1--many Note
UserBook 1--many ChatSession

Highlight 1--many Note

ChatSession 1--many ChatMessage

User 1--many UserMemory

BookChunk 1--many Embedding later
Note 1--many Embedding later
Highlight 1--many Embedding later
ChapterSummary 1--many Embedding later
UserMemory 1--many Embedding later
```

## Recommended MVP Schema

Build these first:

```txt
users
auth_accounts
sessions
refresh_tokens

user_preferences
user_reading_profiles

books
user_books
chapters
pages
book_chunks

notes
highlights

chat_sessions
chat_messages

chapter_summaries

reading_progress
reading_sessions

user_memory
```

Add these later:

```txt
embeddings
ai_context_snapshots
ai_runs
memory_review_events
book_processing_jobs
interpretive_concepts
interpretive_lenses
author_profiles
historical_context_entries
concept_relationships
```

## Important Tradeoffs

Use `user_books` even if MVP uploads are private to one user. It keeps the product ready for public-domain catalogs and shared book records later.

Use JSONB for PDF anchors. PDF coordinates, text-layer positions, and viewer-specific selection data are too variable for a rigid relational model.

Keep notes and highlights user-owned even when attached to shared book structure.

Keep memory separate from chat history. Memory should be distilled, typed, confidence-scored, and reviewable.

Keep embeddings separate from source tables. This makes model changes and re-indexing easier.

Keep interpretive knowledge out of the database during the MVP. Knowledge files are simpler until Sophia needs admin workflows or concept-level retrieval.

## Indexing And Constraints

Recommended unique constraints:
- `auth_accounts(provider, providerUserId)`
- `user_books(userId, bookId)`
- `reading_progress(userId, userBookId)`
- `chapters(bookId, chapterIndex)`
- `pages(bookId, pageNumber)`
- `book_chunks(bookId, chunkIndex, chunkingVersion)`

Recommended indexes:
- `books(fileHash)`
- `user_books(userId, status)`
- `chapters(bookId)`
- `pages(bookId, pageNumber)`
- `book_chunks(bookId, chapterId)`
- `notes(userId, userBookId, createdAt)`
- `highlights(userId, userBookId, createdAt)`
- `chat_sessions(userId, userBookId, updatedAt)`
- `chat_messages(sessionId, createdAt)`
- `user_memory(userId, type, status)`
- `reading_sessions(userId, userBookId, startedAt)`

## Final Recommendation

Sophia's database should make one thing easy: reconstruct the user's reading context.

For any AI request, Sophia should be able to gather:
- authenticated user
- current book
- current chapter
- selected passage
- relevant chunks
- user's notes
- user's highlights
- recent chat session
- relevant long-term memory
- reading preferences

That is the foundation for a serious philosophy reading companion.
