export type PublicChatSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicChatMessageRole = "user" | "assistant";

export type PublicChatMessage = {
  id: string;
  role: PublicChatMessageRole;
  content: string;
  createdAt: string;
};

export type PublicChatSessionWithMessages = PublicChatSession & {
  messages: PublicChatMessage[];
};
