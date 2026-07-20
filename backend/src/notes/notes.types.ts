export const SUPPORTED_NOTE_TYPES = ["margin_note"] as const;

export type PublicNoteType = (typeof SUPPORTED_NOTE_TYPES)[number];
export type NoteContext = "passage" | "highlight" | "page" | "chapter" | "book";
export type NoteSelectionMode = "pdf" | "reading";

export type NotePdfRect = {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NoteAnchor = {
  version: 1;
  source: "reader-selection-v1";
  mode: NoteSelectionMode;
  sourceBlockId: string | null;
  startOffset: number | null;
  endOffset: number | null;
  pdfRects: NotePdfRect[];
};

export type PublicNote = {
  id: string;
  type: PublicNoteType;
  context: NoteContext;
  content: string;
  quote: string | null;
  highlightId: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  chapterId: string | null;
  chapterTitle: string | null;
  createdAt: string;
  updatedAt: string;
};
