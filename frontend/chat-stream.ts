import type { ChatReply } from './demo/agent-backend/chat';
import type { ChatRequest, ChatStreamEvent } from './chat-protocol';

export function streamChat(url: string | URL, payload: ChatRequest, signal: AbortSignal, onDelta: (text: string) => void): Promise<ChatReply> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Chat cancelled.', 'AbortError')); return; }
    const socket = new WebSocket(url);
    let text = '';
    let finished = false;
    let timeout: ReturnType<typeof setTimeout>;

    function finish(error?: Error, reply?: ChatReply) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      socket.onopen = socket.onmessage = socket.onclose = null;
      // Swallow a possible handshake error when cancelling a connecting socket.
      socket.onerror = () => {};
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
      if (error) reject(error);
      else resolve(reply!);
    }
    function abort() { finish(new DOMException('Chat cancelled.', 'AbortError')); }
    function keepAlive() {
      clearTimeout(timeout);
      timeout = setTimeout(() => finish(new Error('The reply took too long. Please try again.')), 20000);
    }

    signal.addEventListener('abort', abort, { once: true });
    keepAlive();
    socket.onopen = () => { socket.send(JSON.stringify(payload)); };
    socket.onerror = () => finish(new Error('Could not connect to the app guide. Please try again.'));
    socket.onclose = () => finish(new Error('Chat disconnected before the reply finished. Please try again.'));
    socket.onmessage = message => {
      try {
        const event = JSON.parse(message.data) as ChatStreamEvent;
        if (!event || typeof event !== 'object') throw new Error('Invalid chat response.');
        keepAlive();
        switch (event.type) {
          case 'thinking': break;
          case 'delta':
            if (typeof event.text !== 'string') throw new Error('Invalid reply text.');
            text += event.text;
            onDelta(text);
            break;
          case 'done':
            if (!event.reply || typeof event.reply.message !== 'string' || event.reply.message !== text) throw new Error('The reply was incomplete. Please try again.');
            finish(undefined, event.reply);
            break;
          case 'error':
            finish(new Error(typeof event.message === 'string' ? event.message : 'Chat could not answer this question.'));
            break;
          default: throw new Error('Unexpected chat response. Please try again.');
        }
      } catch (error) {
        finish(error instanceof Error ? error : new Error('Chat is unavailable. Please try again.'));
      }
    };
  });
}
