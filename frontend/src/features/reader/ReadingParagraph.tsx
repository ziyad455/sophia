type ReadingParagraphProps = {
  text: string
  pageNumber: number
  chapterId: string | null
}

export function ReadingParagraph({
  text,
  pageNumber,
  chapterId,
}: ReadingParagraphProps) {
  return (
    <p
      className="m-0 text-pretty [&+&]:mt-[0.9em]"
      data-source-page={pageNumber}
      data-source-chapter={chapterId ?? undefined}
    >
      {text}
    </p>
  )
}
