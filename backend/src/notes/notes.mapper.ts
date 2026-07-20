import type { Note, NoteType } from "@prisma/client";
import type { NoteContext, PublicNote, PublicNoteType } from "./notes.types";

export type NoteWithChapter = Note & {
  chapter: {
    title: string | null;
    chapterIndex: number;
    pageStart: number | null;
    pageEnd: number | null;
  } | null;
};

function serializeNoteType(noteType: NoteType): PublicNoteType {
  return noteType.toLowerCase() as PublicNoteType;
}

function noteContext(note: NoteWithChapter): NoteContext {
  if (note.highlightId) {
    return "highlight";
  }

  if (note.quote) {
    return "passage";
  }

  if (note.pageNumber !== null) {
    return "page";
  }

  if (note.chapterId) {
    return "chapter";
  }

  return "book";
}

export function mapNote(note: NoteWithChapter): PublicNote {
  const context = noteContext(note);
  const chapterPageStart = context === "chapter"
    ? note.chapter?.pageStart ?? null
    : null;
  const chapterPageEnd = context === "chapter"
    ? note.chapter?.pageEnd ?? chapterPageStart
    : null;

  return {
    id: note.id,
    type: serializeNoteType(note.noteType),
    context,
    content: note.content,
    quote: note.quote,
    highlightId: note.highlightId,
    pageStart: note.pageNumber ?? chapterPageStart,
    pageEnd: note.pageEnd ?? chapterPageEnd ?? note.pageNumber,
    chapterId: note.chapterId,
    chapterTitle: note.chapter?.title ?? null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

export function sortNotes(notes: PublicNote[]): PublicNote[] {
  return [...notes].sort((left, right) => {
    const leftPage = left.pageStart ?? Number.MAX_SAFE_INTEGER;
    const rightPage = right.pageStart ?? Number.MAX_SAFE_INTEGER;

    return leftPage - rightPage ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id);
  });
}
