# RAG Strategy

Sophia uses RAG to answer questions about books.

## Retrieval Priority

1. Selected passage
2. Current page
3. Current chapter
4. Related chunks from the same book
5. Relevant interpretive background
6. User highlights
7. User notes
8. Long-term memory

## Chunk Metadata

Each chunk should include:

- bookId
- chapterId
- pageStart
- pageEnd
- chunkIndex
- content

## Rules

- Selected passage is always included.
- Current chapter has priority over random book chunks.
- Retrieved chunks must be relevant to the question.
- Interpretive background should be routed by the user's question, not added by default.
- Do not send the entire PDF to the model.
- If context is missing, Sophia should say that clearly.
- Sophia should distinguish retrieved book text from background explanation.
