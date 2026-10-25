import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { answerChat } from './chat.ts';
import type { ChatStreamEvent } from '../../chat-protocol';

type Timing = { thinkingDelayMs?: number; chunkDelayMs?: number };

export function attachChatSocket(server: Server, { thinkingDelayMs = 1000, chunkDelayMs = 65 }: Timing = {}) {
  const sockets = new WebSocketServer({ server, path: '/api/chat/ws', maxPayload: 16 * 1024, perMessageDeflate: false });

  sockets.on('connection', socket => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;

    function cancel() { clearTimeout(timer); timer = undefined; busy = false; }
    function send(event: ChatStreamEvent) {
      if (socket.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(event));
      return true;
    }

    socket.on('message', (data, isBinary) => {
      if (busy) {
        send({ type: 'error', message: 'Please wait for the current reply to finish.' });
        return;
      }
      try {
        if (isBinary) throw new Error('Send your question as a JSON text message.');
        const reply = answerChat(JSON.parse(data.toString()));
        // Preserve whitespace and paragraph breaks while revealing three words at a time.
        const chunks = reply.message.match(/(?:\S+\s*){1,3}/gu) ?? [];
        let index = 0;
        busy = true;
        send({ type: 'thinking' });

        function writeNext() {
          if (socket.readyState !== WebSocket.OPEN) { cancel(); return; }
          if (index < chunks.length) send({ type: 'delta', text: chunks[index++] });
          if (index < chunks.length) {
            timer = setTimeout(writeNext, chunkDelayMs);
          } else {
            cancel();
            send({ type: 'done', reply });
          }
        }
        timer = setTimeout(writeNext, thinkingDelayMs);
      } catch (error) {
        send({ type: 'error', message: error instanceof SyntaxError ? 'Send a valid JSON chat message.' : error instanceof Error ? error.message : 'Could not answer this question.' });
      }
    });
    socket.on('close', cancel);
    socket.on('error', cancel);
  });

  return sockets;
}
