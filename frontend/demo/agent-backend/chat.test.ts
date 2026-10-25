import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerChat, type ChatContext } from './chat.ts';
import { evaluate } from './engine.ts';

const context: ChatContext = { id: 'maria', mileage: 58000, budget: 200, estimate: 80000, symptoms: false, page: 'Overview' };
const ask = (message: string, overrides: Partial<ChatContext> = {}) => answerChat({ message, context: { ...context, ...overrides } });

test('payment answers reconcile to the live scenario engine including cents', () => {
  const scenario = { ...context, estimate: 80101, budget: 900 };
  const expected = evaluate(scenario.id, scenario.mileage, scenario.budget, scenario.estimate);
  const reply = answerChat({ message: 'Explain my payment options', context: scenario });
  assert.ok(reply.message.includes('$801.01'));
  assert.ok(reply.message.includes('$825.01'));
  assert.ok(reply.message.includes('$900'));
  assert.ok(reply.message.includes(expected.explanation));
  assert.equal(reply.action?.page, 'Payment options');
});

test('vehicle and service answers use current persona and adjusted mileage', () => {
  const reply = ask('When is my service due?', { id: 'james', mileage: 33000, budget: 500, estimate: 22000 });
  assert.match(reply.message, /James.*Camry/);
  assert.match(reply.message, /33,000/);
  assert.match(reply.message, /about 4 weeks/);
  assert.match(ask('Tell me about my car', { id: 'aisha' }).message, /Aisha.*Corolla/);
});

test('short follow-ups retain the last question topic', () => {
  const reply = answerChat({ message: 'Tell me more', context, history: [{ role: 'user', content: 'Compare insurance quotes' }] });
  assert.equal(reply.action?.page, 'Insurance');
  const onPayments = ask('Why?', { page: 'Payment options' });
  assert.equal(onPayments.action?.page, 'Payment options');
});

test('safety symptoms override payment explanations', () => {
  assert.match(ask('Can I spread the cost?', { symptoms: true }).message, /professional assessment/);
  assert.match(ask('My brakes are failing').message, /stop driving/);
  assert.match(ask('I hear grinding').message, /cannot diagnose/);
});

test('protection answers cite catalog pages without inventing active coverage', () => {
  const reply = ask('What does GAP cover?');
  assert.match(reply.message, /Guaranteed Auto Protection/);
  assert.match(reply.message, /does not establish.*active plan/);
  assert.equal(reply.source?.href, '/api/insurance/source/toyota#page=14');
  assert.match(ask('Does my warranty cover brakes?').message, /excludes brake pads, rotors, tires/);
});

test('quote and handoff answers describe actual demo boundaries', () => {
  assert.match(ask('Which insurance quote is cheapest?').message, /does not retrieve live quotes/);
  assert.match(ask('Book an appointment near me').message, /does not book an appointment/);
  assert.match(ask('What is the weather?').message, /app guide/);
});

test('rejects malformed messages, invalid scenario inputs, and oversized history', () => {
  for (const message of ['', '   ', 'x'.repeat(601), 123]) {
    assert.throws(() => answerChat({ message, context }));
  }
  assert.throws(() => ask('Hi', { mileage: -1 }));
  assert.throws(() => ask('Hi', { symptoms: 'yes' as unknown as boolean }));
  assert.throws(() => answerChat({ message: 'Hi', context, history: Array(7).fill({ role: 'user', content: 'Hi' }) }));
  assert.throws(() => answerChat({ message: 'Hi', context, history: [{ role: 'assistant', content: 'Hi' }] }));
});
