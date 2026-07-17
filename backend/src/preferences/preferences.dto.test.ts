import assert from "node:assert/strict";
import { parseReaderPreferencesUpdate } from "./preferences.dto";

for (const readingMood of ["printed-ink", "warm-paper", "night-study"] as const) {
  assert.deepEqual(parseReaderPreferencesUpdate({ readingMood }), { readingMood });
}

assert.throws(
  () => parseReaderPreferencesUpdate({ readingMood: "sepia" }),
  /readingMood must be printed-ink, warm-paper, or night-study/,
);

assert.throws(
  () => parseReaderPreferencesUpdate({ readingMood: "night-study", pageColor: "#000" }),
  /unsupported reader preference fields/,
);
