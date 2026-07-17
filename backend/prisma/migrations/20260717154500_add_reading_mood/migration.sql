ALTER TABLE "user_preferences"
ADD COLUMN "reading_mood" VARCHAR(30) NOT NULL DEFAULT 'warm-paper';

ALTER TABLE "user_preferences"
ADD CONSTRAINT "user_preferences_reading_mood_check"
CHECK ("reading_mood" IN ('printed-ink', 'warm-paper', 'night-study'));
