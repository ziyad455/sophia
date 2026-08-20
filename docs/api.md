# API

## Chat Sessions

S8-T1 exposes private conversation persistence only. Every route requires
authentication and derives identity from the authenticated request context.
The `userBookId` path identifies the user's library entry; a shared underlying
`Book` does not grant access to another owner's conversations.

Unowned, malformed, missing, or mismatched chat resources return the standard
`404 not_found` response so session enumeration does not reveal private data.

### Create a session

`POST /books/:userBookId/chat-sessions`

- Request body: omitted or `{}`. Any field, including `userId`, title, mode,
  provider, or model, is rejected.
- Success: `201 { "session": ChatSession }`.
- The server derives `userId` and `bookId` from the owned `UserBook`.

### List sessions

`GET /books/:userBookId/chat-sessions`

- Success: `200 { "sessions": ChatSession[] }`.
- Sessions are ordered by `createdAt DESC, id DESC`.
- Messages are not loaded by this endpoint.
- S8-T1 follows the existing unpaginated nested-resource convention. Pagination
  can be added when the product defines volume and UX requirements.

### Get a session and messages

`GET /books/:userBookId/chat-sessions/:sessionId`

- Success: `200 { "session": ChatSessionWithMessages }`.
- The session must match both path IDs and the authenticated user.
- Messages are ordered by `createdAt ASC, id ASC`.

### Create a user message

`POST /books/:userBookId/chat-sessions/:sessionId/messages`

Request:

```json
{
  "content": "What does this passage mean?"
}
```

- Success: `201 { "message": ChatMessage }`.
- `content` is trimmed plain text from 1 through 10,000 characters. The limit
  supports quoted passages and developed philosophical questions while
  bounding private storage and future model input.
- All other fields are rejected. The server always persists the public write
  as role `user`; browsers cannot create assistant, system, tool, or developer
  messages or control identity, order, provider, model, prompt, or AI settings.
- No assistant response or AI call occurs.

### Delete a session

`DELETE /books/:userBookId/chat-sessions/:sessionId`

- Success: `204` with no response body.
- The ownership-scoped session delete uses the existing database cascade, so
  its messages are removed atomically.

## Chat DTOs

```ts
type ChatSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type ChatSessionWithMessages = ChatSession & {
  messages: ChatMessage[];
};
```

Foreign keys, user IDs, provider metadata, trace data, context snapshots, and
other database fields are not part of these public contracts.
