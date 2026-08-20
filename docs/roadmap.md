# Roadmap

Sophia should be built in dependency order: foundation first, ownership before personal data, reading before AI, AI context before memory, and memory before MVP hardening.

Each sprint should leave the product in a runnable, reviewable state.

## Sprint 1: Project Foundation

Approximate duration: 1 week

Main goal:
Establish the technical base for a serious React + Express + TypeScript product.

Completed by the end:
- Frontend and backend structure stabilized
- Environment configuration pattern established
- Basic Express app and React app shell working
- PostgreSQL and Prisma connected
- Health checks in place
- Build, lint, and verification commands identified

Why this comes first:
Sophia needs a clean foundation before authentication, ownership, uploads, reading, or AI are added.

## Sprint 2: Authentication And User Ownership

Approximate duration: 1-2 weeks

Main goal:
Create authenticated users and the ownership model for all future personal data.

Completed by the end:
- User model
- Email authentication foundation
- Google Auth account linking
- Sessions or refresh-token flow
- Protected backend routes
- Protected frontend routes
- Current user context available in frontend and backend

Why this comes here:
Notes, highlights, memory, progress, chat history, and personal libraries cannot be modeled correctly until user identity and ownership are clear.

## Sprint 3: Personal Library And Book Upload

Approximate duration: 1-2 weeks

Main goal:
Let authenticated users add philosophy books to their personal Sophia library.

Completed by the end:
- `books` and `user_books` flow
- PDF upload endpoint
- Local file storage for MVP
- Library page
- Upload page
- Book metadata and processing status

Why this comes here:
Sophia is a reading companion. The first real product object is a user-owned book in a personal library.

## Sprint 4: Book Processing And Reading Structure

Approximate duration: 1-2 weeks

Main goal:
Convert uploaded PDFs into structured reading data.

Completed by the end:
- Page text extraction
- `pages` records populated
- Basic chapter detection
- `chapters` records populated where possible
- Initial `book_chunks` generation with page and chapter metadata
- Processing status updates

Why this comes here:
AI context, chapter summaries, highlights, and future RAG all depend on reliable book structure.

## Sprint 5: Core Reader Experience

Approximate duration: 2 weeks

Main goal:
Build the calm reading surface.

Completed by the end:
- Reader page
- PDF viewer
- Page navigation
- Current page and chapter state
- Reading theme controls
- Basic reading progress save/resume
- Comfortable reading layout

Why this comes here:
Sophia must first be a good reading environment. AI should enhance the reader, not replace it.

## Sprint 6: Notes, Highlights, And Reading Sessions

Approximate duration: 2 weeks

Main goal:
Add user-owned reflection and annotation.

Completed by the end:
- Text selection controller
- Highlight creation and display
- Notes attached to book, page, chapter, or highlight
- Reading progress tracking
- Reading session history
- Notes and highlights synced with the backend

Why this comes here:
Reflection is core to Sophia. Notes and highlights also become future AI context and memory sources.

## Sprint 7: AI Runtime Foundation

Status: Complete.

Approximate duration: 1-2 weeks

Main goal:
Build the AI architecture without locking Sophia to one provider.

Completed by the end:
- AI provider adapter abstraction
- AI orchestrator
- Context builder
- Prompt composer
- Response streamer foundation
- Basic task modes for passage explanation, chapter summary, and reflection prompt
- No provider-specific logic inside product services

Why this comes here:
The app now has users, books, selected text, chunks, notes, and highlights. The AI layer can finally receive meaningful structured context.

## Sprint 8: AI Companion Chat

Status: In progress. S8-T1 backend implementation is present; completion is
pending the repository-required user-run build verification.

Approximate duration: 2 weeks

Main goal:
Make Sophia useful beside the reading experience.

Completed by the end:
- Chat panel in the reader
- Streaming assistant responses
- `chat_sessions`
- `chat_messages`
- Passage explanation using selected text
- Chapter summary using chapter/chunk context
- Chat tied to current user, book, and chapter

Why this comes here:
This is the first complete Sophia loop: read, select, ask, understand, and continue reading.

## Sprint 9: Interpretive Knowledge Layer

Approximate duration: 1-2 weeks

Main goal:
Make Sophia answer like a philosophy companion, not a quote retriever.

Completed by the end:
- Interpretive lens rules
- Philosophy concept knowledge files
- Religious and theological context files
- Psychology and literary comparison context
- Interpretive context selector
- Answers distinguish textual evidence from background interpretation

Why this comes here:
Basic AI chat should work first. Then Sophia becomes specifically good at philosophy by adding routed interpretive background.

## Sprint 10: User-Specific Memory

Approximate duration: 1-2 weeks

Main goal:
Add long-term personalized philosophical memory.

Completed by the end:
- `user_memory` model
- Memory types, confidence, and status rules
- Memory extraction from notes, highlights, and chat
- Memory context selector
- Basic memory review/update behavior
- Memory used carefully in AI context

Why this comes here:
Memory needs real user activity to learn from. By this point, Sophia has notes, highlights, chats, and reading sessions to distill.

## Sprint 11: MVP Verification And Product Hardening

Approximate duration: 2 weeks

Main goal:
Turn the system into a usable MVP rather than a set of disconnected features.

Completed by the end:
- End-to-end flow verified: register/login, upload book, read, highlight, note, ask Sophia, resume later
- API and service tests for critical backend flows
- Manual reader comfort checks
- AI evals for passage explanation, grounding, and refusal to invent unsupported content
- Basic error states and empty states
- MVP deployment readiness

Why this comes here:
All core systems exist. This sprint proves they work together as a coherent reading companion.

## Post-MVP: Embeddings And pgvector

Approximate duration: 2+ weeks when needed

Main goal:
Improve retrieval quality once the MVP proves the reading loop.

Completed by the end:
- `embeddings` table
- pgvector integration
- Chunk embedding pipeline
- Semantic retrieval over book chunks
- Optional retrieval over notes, highlights, and memory
- Ranking and context budget improvements

Why this comes after MVP:
The MVP can use selected passage, page, chapter, and simple chunk retrieval first. Full embeddings are valuable, but they should not delay the core reading companion experience.

## MVP Outcome

By the end of Sprint 11, Sophia should let a user:
- authenticate with email or Google
- upload a philosophy PDF
- read it comfortably
- save highlights and notes
- track progress
- ask Sophia about a selected passage
- receive grounded philosophical explanations
- get chapter summaries
- build early user-specific memory
- return later with their library, progress, notes, chats, and memory intact
