# Sophia Ownership Rules

Sophia stores personal reading state. Every query for personal data must be scoped to the authenticated user.

## Core Rules

- Use `requireAuth` on private routes before accessing personal resources.
- Use `req.auth.userId` from the authenticated access token/session.
- Do not trust `userId` from request bodies, route params, query strings, or frontend state.
- Never query personal data without `userId`.
- Query user-owned resources by both resource id and `userId`.
- Prefer `404 Not Found` when a resource does not belong to the current user. This avoids revealing that another user's resource exists.
- Controllers should stay thin. Services should enforce ownership in their Prisma queries.
- Shared source data, such as `books`, should be reached through a user-owned relationship when the result is user-specific.

## Helper Pattern

Use `backend/src/auth/ownership.ts` in future protected controllers or services.

```ts
import { requireAuthContext } from "../auth/ownership";

export async function handler(req: ApiRequest, res: ApiResponse) {
  const { userId } = requireAuthContext(req);

  // Pass userId into the service. Do not accept it from req.body.
  const result = await service.loadUserOwnedResource(userId, req.params.id);

  res.json(result);
}
```

## User Books

For library and reader features, start from `user_books`, not directly from `books`.

```ts
const userBook = await prisma.userBook.findFirst({
  where: {
    id: userBookId,
    userId,
  },
  include: {
    book: true,
  },
});
```

Do not allow a user to access another user's `user_book` by guessing its id.

## Notes And Highlights

Future notes and highlights must include `userId`, `userBookId`, and `bookId`.

Fetch or modify them with user scope:

```ts
const note = await prisma.note.findFirst({
  where: {
    id: noteId,
    userId,
  },
});
```

For updates, prefer a user-scoped mutation:

```ts
await prisma.note.updateMany({
  where: {
    id: noteId,
    userId,
  },
  data: {
    content,
  },
});
```

## Other User-Owned Models

Always include `userId` for:

- `user_books`
- `notes`
- `highlights`
- `chat_sessions`
- `chat_messages`
- `reading_progress`
- `reading_sessions`
- `user_preferences`
- `user_reading_profiles`
- `user_memory`

Do not use patterns like:

```ts
await prisma.note.findMany();
```

Use:

```ts
await prisma.note.findMany({
  where: {
    userId,
  },
});
```

## Global Resources

`books` can represent uploaded or source book metadata. User-specific library access should be mediated through `user_books` scoped by `userId`.
