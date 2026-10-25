import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { attachChatSocket } from './chat-socket.ts';
import { answerChat } from './chat.ts';
import { streamChat } from '../../chat-stream.ts';
import type { ChatRequest, ChatStreamEvent } from '../../chat-protocol';

const payload: ChatRequest = {
  message: 'What does GAP cover?',
  context: { id: 'maria', mileage: 58000, budget: 200, estimate: 80000, symptoms: false, page: 'Overview' },
  history: [],
};

async function fixture(t: TestContext) {
  const server = createServer();
  const sockets = attachChatSocket(server, { thinkingDelayMs: 40, chunkDelayMs: 3 });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  t.after(async () => {
    for (const client of sockets.clients) client.terminate();
    await new Promise<void>(resolve => sockets.close(() => resolve()));
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  const url = `ws://127.0.0.1:${address.port}/api/chat/ws`;
  return { url, sockets };
}

async function connect(url: string) {
  const client = new WebSocket(url);
  client.on('error', () => {});
  await once(client, 'open');
  return client;
}

function collect(client: WebSocket, data: string) {
  return new Promise<{ event: ChatStreamEvent; at: number }[]>((resolve, reject) => {
    const frames: { event: ChatStreamEvent; at: number }[] = [];
    const start = performance.now();
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Chat stream did not finish.')); }, 3000);
    function cleanup() { clearTimeout(timeout); client.off('message', onMessage); client.off('close', onClose); }
    function onClose() { cleanup(); reject(new Error('Unexpected connection close.')); }
    function onMessage(raw: WebSocket.RawData) {
      const event = JSON.parse(raw.toString()) as ChatStreamEvent;
      frames.push({ event, at: performance.now() - start });
      if (event.type === 'done' || event.type === 'error') { cleanup(); resolve(frames); }
    }
    client.on('message', onMessage);
    client.on('close', onClose);
    client.send(data);
  });
}

test('WebSocket sends thinking, paced chunks, and the complete reply with source metadata', async t => {
  const { url } = await fixture(t);
  const client = await connect(url);
  t.after(() => client.terminate());
  const frames = await collect(client, JSON.stringify(payload));
  assert.equal(frames[0].event.type, 'thinking');
  const deltas = frames.filter(frame => frame.event.type === 'delta');
  assert.ok(deltas.length > 3);
  assert.ok(deltas[0].at >= 30, 'The thinking state must remain visible before the first chunk.');
  assert.ok(deltas[deltas.length - 1].at - deltas[0].at >= 20, 'Chunks must arrive over time.');
  assert.equal(deltas.map(({ event }) => event.type === 'delta' ? event.text : '').join(''), answerChat(payload).message);
  const final = frames[frames.length - 1].event;
  assert.equal(final.type, 'done');
  if (final.type === 'done') assert.deepEqual(final.reply, answerChat(payload));
  // The same connection supports another question without mixing either answer.
  const next = await collect(client, JSON.stringify({ ...payload, message: 'Explain my payment options' }));
  const done = next[next.length - 1].event;
  assert.ok(done.type === 'done' && done.reply.action?.page === 'Payment options');
});

test('invalid JSON and invalid questions return errors without starting a reply', async t => {
  const { url } = await fixture(t);
  const client = await connect(url);
  t.after(() => client.terminate());
  for (const input of ['{invalid', JSON.stringify({ ...payload, message: 'x'.repeat(601) })]) {
    const frames = await collect(client, input);
    assert.equal(frames.length, 1);
    assert.equal(frames[0].event.type, 'error');
  }
});

test('oversized WebSocket messages are closed with the payload limit code', async t => {
  const { url } = await fixture(t);
  const client = await connect(url);
  const closed = once(client, 'close');
  client.send('x'.repeat(17 * 1024));
  const [code] = await closed;
  assert.equal(code, 1009);
});

function browserSocket(t: TestContext) {
  const original = globalThis.WebSocket;
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
  t.after(() => { globalThis.WebSocket = original; });
}

test('the frontend stream helper progressively updates text and returns the exact answer', async t => {
  browserSocket(t);
  const { url } = await fixture(t);
  const updates: string[] = [];
  const reply = await streamChat(url, payload, new AbortController().signal, text => updates.push(text));
  assert.ok(updates.length > 3);
  assert.ok(updates[0].length < reply.message.length);
  assert.ok(updates.every((text, index) => index === 0 || text.startsWith(updates[index - 1])));
  assert.equal(updates[updates.length - 1], reply.message);
  assert.deepEqual(reply, answerChat(payload));
});

test('resetting mid-reply cancels the socket and stops further text updates', async t => {
  browserSocket(t);
  const { url } = await fixture(t);
  const controller = new AbortController();
  let updates = 0;
  await assert.rejects(streamChat(url, payload, controller.signal, () => { updates++; controller.abort(); }), { name: 'AbortError' });
  assert.equal(updates, 1);
});

test('an interrupted reply produces a retryable error and the next attempt succeeds', async t => {
  browserSocket(t);
  const { url, sockets } = await fixture(t);
  let disconnected = false;
  await assert.rejects(streamChat(url, payload, new AbortController().signal, () => {
    if (!disconnected) {
      disconnected = true;
      for (const socket of sockets.clients) socket.close(1011, 'Test interruption');
    }
  }), /disconnected before the reply finished/);
  const reply = await streamChat(url, payload, new AbortController().signal, () => {});
  assert.equal(reply.message, answerChat(payload).message);
});
