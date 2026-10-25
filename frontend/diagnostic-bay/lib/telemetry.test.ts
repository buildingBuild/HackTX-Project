import assert from 'node:assert/strict';
import test from 'node:test';
import { CAPTURE_WINDOW_MS, DemoSource, HardwareSource, ScanCollector, decodeObd, isLandCruiserProfile, readingWarnings, simulatedObdReading, validateReading, type Clock, type SourceCallbacks } from './telemetry';

class FakeClock implements Clock {
  time = Date.parse('2026-10-25T15:00:00Z');
  serial = 0; jobs = new Map<number, { due: number; fn: () => void }>();
  now = () => this.time;
  later = (fn: () => void, ms: number) => { const id = ++this.serial; this.jobs.set(id, { due: this.time + ms, fn }); return id; };
  clear = (id: unknown) => { this.jobs.delete(id as number); };
  advance(ms: number) {
    const end = this.time + ms;
    while (true) {
      const next = [...this.jobs.entries()].filter(([, job]) => job.due <= end).sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (!next) break;
      this.time = next[1].due; this.jobs.delete(next[0]); next[1].fn();
    }
    this.time = end;
  }
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('PID meanings decode coolant, engine RPM and module voltage with the proper units', () => {
  assert.deepEqual(decodeObd({ coolant: '41057B', rpm: '410C0D48', voltage: '414235E8' }), { temperature: 83, rpm: 850, voltage: 13.8 });
  assert.throws(() => decodeObd({ coolant: '410C7B', rpm: '410C0D48', voltage: '414235E8' }));
});

test('device collection is scoped to the Land Cruiser profile', () => {
  assert.ok(isLandCruiserProfile({ id: 'c08', vehicle_model: '2022 Toyota Land Cruiser 300 VX.R' }));
  assert.equal(isLandCruiserProfile({ id: 'c01', vehicle_model: '2016 Toyota Corolla LE' }), false);
  assert.equal(isLandCruiserProfile({ id: 'c08', vehicle_model: '2022 Toyota Camry' }), false);
});

test('scan start emits one simulated reading per second; completion and cancellation stop timers', () => {
  for (const reason of ['completed', 'cancelled'] as const) {
    const clock = new FakeClock();
    const collector = new ScanCollector(() => {}, (_, id) => new DemoSource(id, clock, () => 0.5), clock);
    collector.start('demo', 'scan-one');
    clock.advance(999); assert.equal(collector.snapshot.samples, 0);
    clock.advance(1); assert.equal(collector.snapshot.samples, 1);
    clock.advance(2000); assert.equal(collector.snapshot.samples, 3);
    assert.equal(collector.snapshot.latest.simulated, true);
    assert.equal(collector.snapshot.latest.scanId, 'scan-one');
    collector.stop(reason); clock.advance(5000);
    assert.equal(collector.snapshot.samples, 3); assert.equal(collector.snapshot.active, false);
    assert.equal(clock.jobs.size, 0);
  }
});

test('new scans discard previous samples and ignore late callbacks from old sessions', () => {
  const clock = new FakeClock(); const callbacks: SourceCallbacks[] = [];
  const collector = new ScanCollector(() => {}, () => ({ start: (c) => callbacks.push(c), stop: () => {} }), clock);
  collector.start('demo', 'old'); callbacks[0].reading(simulatedObdReading('old', clock.now(), 0));
  collector.start('demo', 'new');
  assert.equal(collector.snapshot.samples, 0); assert.equal(collector.snapshot.latest, null);
  callbacks[0].reading(simulatedObdReading('old', clock.now(), 1));
  assert.equal(collector.snapshot.samples, 0);
  callbacks[1].reading(simulatedObdReading('new', clock.now(), 0));
  assert.equal(collector.snapshot.samples, 1);
});

test('capture window is tied to the current scan and resolves on cancellation without leaking timers', async () => {
  const clock = new FakeClock(); const collector = new ScanCollector(() => {}, (_, id) => new DemoSource(id, clock), clock);
  collector.start('demo', 'window');
  let done = false; const wait = collector.waitForCaptureWindow().then(() => { done = true; });
  clock.advance(CAPTURE_WINDOW_MS - 1000); await flush(); assert.equal(done, false);
  clock.advance(1000); await wait; assert.equal(done, true);
  const cancelled = collector.waitForCaptureWindow(); collector.stop('cancelled'); await cancelled;
  assert.equal(clock.jobs.size, 0);
});

test('reject malformed, stale, duplicate, mismatched frames, mixed provenance, and wrong-session readings', () => {
  const now = Date.now(), valid = simulatedObdReading('scan', now, 0, () => 0.5);
  for (const change of [{ voltage: '13.8' }, { rpm: NaN }, { temperature: 300 }, { simulated: 'true' }, { scanId: 'other' }, { timestamp: 'not-a-date' }, { timestamp: new Date(now - 20_000).toISOString() }, { rpm: valid.rpm + 1 }]) {
    assert.throws(() => validateReading({ ...valid, ...change }, 'scan', now));
  }
  assert.throws(() => validateReading(valid, 'scan', now, valid));
  assert.throws(() => validateReading({ ...valid, timestamp: new Date(now + 1000).toISOString(), simulated: false, obd: undefined }, 'scan', now + 1000, valid));
  const measured = { ...valid, simulated: false, obd: undefined };
  assert.equal(validateReading(measured, 'scan', now).simulated, false);
});

test('warnings come only from configured rules; simulated thresholds do not imply an external sensor fault', () => {
  const normal = simulatedObdReading('scan', Date.now(), 0, () => 0.5);
  assert.deepEqual(readingWarnings(normal), []);
  const warning = simulatedObdReading('scan', Date.now(), 7, () => 0.5);
  assert.equal(readingWarnings(warning).length, 2);
  assert.deepEqual(readingWarnings({ ...warning, simulated: false, obd: undefined }), []);
});

test('hardware readings use the same pipeline and reconnect without starting a second session', async () => {
  const clock = new FakeClock(); let polls = 0, starts = 0, stops = 0;
  const fetcher = async (url: string, init?: RequestInit) => {
    if (url.endsWith('/sensor-scans')) { starts++; return json({ active: true }); }
    if (url.endsWith('/stop')) { stops++; return json({ active: false }); }
    polls++;
    if (polls === 2) throw new Error('device network lost');
    return json({ active: true, connection: 'connected', message: 'Device connected', readings: [{ sequence: polls, reading: simulatedObdReading('wifi', clock.now(), polls) }] });
  };
  const collector = new ScanCollector(() => {}, (_, id) => new HardwareSource(id, 'http://gateway', clock, fetcher as typeof fetch), clock);
  collector.start('hardware', 'wifi'); await flush(); await flush();
  assert.equal(collector.snapshot.samples, 1); assert.equal(collector.snapshot.latest.simulated, true);
  clock.advance(1000); await flush(); assert.equal(collector.snapshot.connection, 'disconnected');
  assert.match(collector.snapshot.message, /retrying/);
  clock.advance(1000); await flush(); assert.equal(collector.snapshot.connection, 'connected');
  assert.equal(collector.snapshot.samples, 2); assert.equal(starts, 1);
  collector.stop('completed'); await flush(); clock.advance(5000);
  assert.equal(stops, 1); assert.equal(polls, 3); assert.equal(clock.jobs.size, 0);
});

test('cancelling while hardware start is in flight closes the gateway session once it is created', async () => {
  const clock = new FakeClock(); let resolve: (r: Response) => void; let stops = 0;
  const fetcher = (url: string) => url.endsWith('/sensor-scans') ? new Promise<Response>((r) => { resolve = r; }) : (stops++, Promise.resolve(json({ active: false })));
  const collector = new ScanCollector(() => {}, (_, id) => new HardwareSource(id, 'http://gateway', clock, fetcher as typeof fetch), clock);
  collector.start('hardware', 'cancelled'); await flush(); collector.stop('cancelled'); resolve(json({ active: true })); await flush();
  assert.equal(stops, 1); assert.equal(collector.snapshot.samples, 0); assert.equal(clock.jobs.size, 0);
});

test('an immediate hardware rescan waits until its previous gateway session closes', async () => {
  const clock = new FakeClock(); let starts = 0; let finishStop: (r: Response) => void;
  const fetcher = async (url: string) => {
    if (url.endsWith('/sensor-scans')) { starts++; return json({ active: true }); }
    if (url.includes('/old/stop')) return new Promise<Response>((resolve) => { finishStop = resolve; });
    if (url.endsWith('/stop')) return json({ active: false });
    return json({ active: true, connection: 'connecting', message: 'Waiting', readings: [] });
  };
  const collector = new ScanCollector(() => {}, (_, id) => new HardwareSource(id, 'http://rescan-gateway', clock, fetcher as typeof fetch), clock);
  collector.start('hardware', 'old'); await flush();
  collector.start('hardware', 'new'); await flush(); assert.equal(starts, 1);
  finishStop(json({ active: false })); await flush(); assert.equal(starts, 2);
  collector.stop('cancelled'); await flush(); assert.equal(clock.jobs.size, 0);
});
