-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "auth_provider" AS ENUM ('email', 'google');

-- CreateEnum
CREATE TYPE "book_source_type" AS ENUM ('upload', 'public_domain', 'imported');

-- CreateEnum
CREATE TYPE "book_processing_status" AS ENUM ('uploaded', 'extracting_text', 'chunking', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "user_book_status" AS ENUM ('active', 'reading', 'finished', 'archived');

-- CreateEnum
CREATE TYPE "chapter_detected_method" AS ENUM ('heuristic', 'manual', 'imported', 'ai_assisted');

-- CreateEnum
CREATE TYPE "page_extraction_status" AS ENUM ('pending', 'extracting', 'extracted', 'failed');

-- CreateEnum
CREATE TYPE "note_type" AS ENUM ('margin_note', 'reflection', 'question', 'summary');

-- CreateEnum
CREATE TYPE "chat_session_mode" AS ENUM ('passage_explanation', 'chapter_summary', 'reflection', 'book_question', 'general_reading_help');

-- CreateEnum
CREATE TYPE "chat_message_role" AS ENUM ('user', 'assistant', 'system', 'tool');

-- CreateEnum
CREATE TYPE "chapter_summary_type" AS ENUM ('short', 'detailed', 'philosophical_themes', 'study_notes');

-- CreateEnum
CREATE TYPE "user_memory_type" AS ENUM ('preferred_explanation_style', 'favorite_philosopher', 'difficult_concept', 'recurring_question', 'personal_reflection', 'finished_book', 'important_highlight');

-- CreateEnum
CREATE TYPE "memory_source_type" AS ENUM ('note', 'highlight', 'chat_message', 'reading_session', 'manual');

-- CreateEnum
CREATE TYPE "memory_status" AS ENUM ('active', 'archived', 'rejected');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "display_name" VARCHAR(255),
    "avatar_url" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "auth_provider" NOT NULL,
    "provider_user_id" VARCHAR(255) NOT NULL,
    "email" VARCHAR(320),
    "password_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "user_agent" TEXT,
    "ip_address" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "rotated_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "theme" VARCHAR(50) NOT NULL DEFAULT 'system',
    "font_size" INTEGER NOT NULL DEFAULT 18,
    "font_family" VARCHAR(120) NOT NULL DEFAULT 'serif',
    "line_height" DECIMAL(3,2) NOT NULL DEFAULT 1.6,
    "explanation_depth" VARCHAR(50) NOT NULL DEFAULT 'balanced',
    "preferred_tone" VARCHAR(80) NOT NULL DEFAULT 'calm',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reading_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "favorite_authors" JSONB,
    "favorite_themes" JSONB,
    "difficult_concepts" JSONB,
    "reading_goals" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_reading_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "language" VARCHAR(16) NOT NULL DEFAULT 'en',
    "source_type" "book_source_type" NOT NULL DEFAULT 'upload',
    "file_path" TEXT NOT NULL,
    "file_hash" VARCHAR(128) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL DEFAULT 'application/pdf',
    "page_count" INTEGER,
    "processing_status" "book_processing_status" NOT NULL DEFAULT 'uploaded',
    "processing_error" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_books" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "status" "user_book_status" NOT NULL DEFAULT 'active',
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_opened_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "user_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "title" TEXT,
    "chapter_index" INTEGER NOT NULL,
    "page_start" INTEGER,
    "page_end" INTEGER,
    "start_offset" INTEGER,
    "end_offset" INTEGER,
    "detected_method" "chapter_detected_method",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "chapter_id" UUID,
    "page_number" INTEGER NOT NULL,
    "text" TEXT,
    "text_hash" VARCHAR(128),
    "extraction_status" "page_extraction_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_chunks" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "chapter_id" UUID,
    "page_start" INTEGER NOT NULL,
    "page_end" INTEGER NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER,
    "text_hash" VARCHAR(128),
    "chunking_version" VARCHAR(80) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "highlights" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_book_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "chapter_id" UUID,
    "page_start" INTEGER NOT NULL,
    "page_end" INTEGER NOT NULL,
    "chunk_id" UUID,
    "selected_text" TEXT NOT NULL,
    "color" VARCHAR(40) NOT NULL DEFAULT 'yellow',
    "anchor" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_book_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "chapter_id" UUID,
    "page_number" INTEGER,
    "chunk_id" UUID,
    "highlight_id" UUID,
    "content" TEXT NOT NULL,
    "note_type" "note_type" NOT NULL DEFAULT 'margin_note',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_book_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "chapter_id" UUID,
    "title" TEXT,
    "mode" "chat_session_mode" NOT NULL DEFAULT 'general_reading_help',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "chat_message_role" NOT NULL,
    "content" TEXT NOT NULL,
    "selected_text" TEXT,
    "page_number" INTEGER,
    "chapter_id" UUID,
    "context_snapshot_id" UUID,
    "model_provider" VARCHAR(80),
    "model_name" VARCHAR(120),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_summaries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "summary_type" "chapter_summary_type" NOT NULL,
    "model_provider" VARCHAR(80),
    "model_name" VARCHAR(120),
    "prompt_version" VARCHAR(80),
    "source_chunk_ids" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapter_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_book_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "current_page" INTEGER NOT NULL DEFAULT 1,
    "current_chapter_id" UUID,
    "progress_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "last_read_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_book_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "chapter_id" UUID,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "start_page" INTEGER,
    "end_page" INTEGER,
    "duration_seconds" INTEGER,
    "pages_read" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "reading_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_memory" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "user_memory_type" NOT NULL,
    "content" TEXT NOT NULL,
    "source_type" "memory_source_type" NOT NULL,
    "source_id" UUID,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" "memory_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "user_memory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_provider_provider_user_id_key" ON "auth_accounts"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_hash_key" ON "sessions"("session_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_reading_profiles_user_id_key" ON "user_reading_profiles"("user_id");

-- CreateIndex
CREATE INDEX "books_file_hash_idx" ON "books"("file_hash");

-- CreateIndex
CREATE INDEX "books_created_by_user_id_idx" ON "books"("created_by_user_id");

-- CreateIndex
CREATE INDEX "user_books_user_id_status_idx" ON "user_books"("user_id", "status");

-- CreateIndex
CREATE INDEX "user_books_book_id_idx" ON "user_books"("book_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_books_user_id_book_id_key" ON "user_books"("user_id", "book_id");

-- CreateIndex
CREATE INDEX "chapters_book_id_idx" ON "chapters"("book_id");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_book_id_chapter_index_key" ON "chapters"("book_id", "chapter_index");

-- CreateIndex
CREATE INDEX "pages_book_id_page_number_idx" ON "pages"("book_id", "page_number");

-- CreateIndex
CREATE INDEX "pages_chapter_id_idx" ON "pages"("chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "pages_book_id_page_number_key" ON "pages"("book_id", "page_number");

-- CreateIndex
CREATE INDEX "book_chunks_book_id_chapter_id_idx" ON "book_chunks"("book_id", "chapter_id");

-- CreateIndex
CREATE INDEX "book_chunks_chapter_id_idx" ON "book_chunks"("chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "book_chunks_book_id_chunk_index_chunking_version_key" ON "book_chunks"("book_id", "chunk_index", "chunking_version");

-- CreateIndex
CREATE INDEX "highlights_user_id_user_book_id_created_at_idx" ON "highlights"("user_id", "user_book_id", "created_at");

-- CreateIndex
CREATE INDEX "highlights_book_id_idx" ON "highlights"("book_id");

-- CreateIndex
CREATE INDEX "highlights_chapter_id_idx" ON "highlights"("chapter_id");

-- CreateIndex
CREATE INDEX "highlights_chunk_id_idx" ON "highlights"("chunk_id");

-- CreateIndex
CREATE INDEX "notes_user_id_user_book_id_created_at_idx" ON "notes"("user_id", "user_book_id", "created_at");

-- CreateIndex
CREATE INDEX "notes_book_id_idx" ON "notes"("book_id");

-- CreateIndex
CREATE INDEX "notes_chapter_id_idx" ON "notes"("chapter_id");

-- CreateIndex
CREATE INDEX "notes_chunk_id_idx" ON "notes"("chunk_id");

-- CreateIndex
CREATE INDEX "notes_highlight_id_idx" ON "notes"("highlight_id");

-- CreateIndex
CREATE INDEX "chat_sessions_user_id_user_book_id_updated_at_idx" ON "chat_sessions"("user_id", "user_book_id", "updated_at");

-- CreateIndex
CREATE INDEX "chat_sessions_book_id_idx" ON "chat_sessions"("book_id");

-- CreateIndex
CREATE INDEX "chat_sessions_chapter_id_idx" ON "chat_sessions"("chapter_id");

-- CreateIndex
CREATE INDEX "chat_messages_session_id_created_at_idx" ON "chat_messages"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_user_id_idx" ON "chat_messages"("user_id");

-- CreateIndex
CREATE INDEX "chat_messages_chapter_id_idx" ON "chat_messages"("chapter_id");

-- CreateIndex
CREATE INDEX "chapter_summaries_user_id_book_id_chapter_id_idx" ON "chapter_summaries"("user_id", "book_id", "chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "reading_progress_user_book_id_key" ON "reading_progress"("user_book_id");

-- CreateIndex
CREATE INDEX "reading_progress_book_id_idx" ON "reading_progress"("book_id");

-- CreateIndex
CREATE INDEX "reading_progress_current_chapter_id_idx" ON "reading_progress"("current_chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "reading_progress_user_id_user_book_id_key" ON "reading_progress"("user_id", "user_book_id");

-- CreateIndex
CREATE INDEX "reading_sessions_user_id_user_book_id_started_at_idx" ON "reading_sessions"("user_id", "user_book_id", "started_at");

-- CreateIndex
CREATE INDEX "reading_sessions_book_id_idx" ON "reading_sessions"("book_id");

-- CreateIndex
CREATE INDEX "reading_sessions_chapter_id_idx" ON "reading_sessions"("chapter_id");

-- CreateIndex
CREATE INDEX "user_memory_user_id_type_status_idx" ON "user_memory"("user_id", "type", "status");

-- CreateIndex
CREATE INDEX "user_memory_source_type_source_id_idx" ON "user_memory"("source_type", "source_id");

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reading_profiles" ADD CONSTRAINT "user_reading_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_books" ADD CONSTRAINT "user_books_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_books" ADD CONSTRAINT "user_books_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_chunks" ADD CONSTRAINT "book_chunks_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_chunks" ADD CONSTRAINT "book_chunks_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_user_book_id_fkey" FOREIGN KEY ("user_book_id") REFERENCES "user_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "book_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_book_id_fkey" FOREIGN KEY ("user_book_id") REFERENCES "user_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "book_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_highlight_id_fkey" FOREIGN KEY ("highlight_id") REFERENCES "highlights"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_book_id_fkey" FOREIGN KEY ("user_book_id") REFERENCES "user_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_summaries" ADD CONSTRAINT "chapter_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_summaries" ADD CONSTRAINT "chapter_summaries_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_summaries" ADD CONSTRAINT "chapter_summaries_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_book_id_fkey" FOREIGN KEY ("user_book_id") REFERENCES "user_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_current_chapter_id_fkey" FOREIGN KEY ("current_chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_user_book_id_fkey" FOREIGN KEY ("user_book_id") REFERENCES "user_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_memory" ADD CONSTRAINT "user_memory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
