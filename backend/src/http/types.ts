import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";

export type ApiRequest<TBody = unknown> = IncomingMessage & {
  body?: TBody;
  headers: IncomingHttpHeaders;
  ip?: string;
  auth?: AuthContext;
};

export type ApiResponse = ServerResponse & {
  json: (body: unknown) => void;
  sendStatus: (statusCode: number) => void;
  status: (statusCode: number) => ApiResponse;
};

export type ApiNext = (error?: unknown) => void;

export type AuthContext = {
  userId: string;
  sessionId: string;
};

export type AuthenticatedApiRequest<TBody = unknown> = ApiRequest<TBody> & {
  auth: AuthContext;
};

export type ApiHandler<TBody = unknown> = (
  req: ApiRequest<TBody>,
  res: ApiResponse,
  next: ApiNext,
) => void | Promise<void>;
