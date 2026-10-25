import type { ChatContext, ChatReply } from './demo/agent-backend/chat';

export type ChatRequest = {
  message: string;
  context: ChatContext;
  history: { role: 'user'; content: string }[];
};

export type ChatStreamEvent =
  | { type: 'thinking' }
  | { type: 'delta'; text: string }
  | { type: 'done'; reply: ChatReply }
  | { type: 'error'; message: string };
