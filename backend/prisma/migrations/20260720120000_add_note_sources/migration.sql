-- Passage notes need to retain their quotation and full page range without
-- depending on extracted Reading Mode text. The structured anchor stores only
-- validated selection metadata already produced by Sophia's reader.
ALTER TABLE "notes"
ADD COLUMN "page_end" INTEGER,
ADD COLUMN "quote" TEXT,
ADD COLUMN "anchor" JSONB;

ALTER TABLE "notes"
ADD CONSTRAINT "notes_page_number_positive_check"
CHECK ("page_number" IS NULL OR "page_number" >= 1),
ADD CONSTRAINT "notes_page_end_positive_check"
CHECK ("page_end" IS NULL OR "page_end" >= 1),
ADD CONSTRAINT "notes_page_range_check"
CHECK (
  "page_number" IS NULL
  OR "page_end" IS NULL
  OR "page_number" <= "page_end"
);
