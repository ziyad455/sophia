ALTER TABLE "user_preferences"
ADD COLUMN "pdf_fit_mode" VARCHAR(30) NOT NULL DEFAULT 'fit-width',
ADD COLUMN "pdf_zoom" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "reader_sidebar_open" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "user_preferences"
ADD CONSTRAINT "user_preferences_pdf_fit_mode_check"
CHECK ("pdf_fit_mode" IN ('fit-width', 'fit-page', 'custom')),
ADD CONSTRAINT "user_preferences_pdf_zoom_check"
CHECK ("pdf_zoom" BETWEEN 50 AND 200);
