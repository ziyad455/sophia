type ReadingParagraphProps = {
  text: string
  sourceBlockId: string
  pageNumber: number
  chapterId: string | null
}

export function ReadingParagraph({
  text,
  sourceBlockId,
  pageNumber,
  chapterId,
}: ReadingParagraphProps) {
  return (
    <p
      className="m-0 select-text text-pretty [&+&]:mt-[0.9em]"
      data-reader-source-block="true"
      data-source-block-id={sourceBlockId}
      data-source-page={pageNumber}
      data-source-chapter={chapterId ?? undefined}
    >
      {text}
    </p>
  )
}
