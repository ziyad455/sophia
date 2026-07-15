ALTER TABLE "user_preferences"
ADD COLUMN "reader_mode" VARCHAR(20) NOT NULL DEFAULT 'pdf',
ADD COLUMN "reading_content_width" INTEGER NOT NULL DEFAULT 720;

ALTER TABLE "user_preferences"
ADD CONSTRAINT "user_preferences_reader_mode_check"
CHECK ("reader_mode" IN ('pdf', 'reading')),
ADD CONSTRAINT "user_preferences_font_size_check"
CHECK ("font_size" BETWEEN 16 AND 24),
ADD CONSTRAINT "user_preferences_font_family_check"
CHECK ("font_family" IN ('serif', 'sans')),
ADD CONSTRAINT "user_preferences_line_height_check"
CHECK ("line_height" BETWEEN 1.5 AND 1.9),
ADD CONSTRAINT "user_preferences_reading_content_width_check"
CHECK ("reading_content_width" BETWEEN 640 AND 800);
