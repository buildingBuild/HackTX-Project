/** OBD emulation and device telemetry share this validation/processing pipeline.
 * Transport (demo/hardware) and measurement provenance (simulated/attached) are
 * separate: an ESP32 can transmit simulated OBD values over real Wi-Fi. */
export type SensorMode = 'demo' | 'hardware';
export type StopReason = 'completed' | 'cancelled' | 'error';
export type Connection = 'connecting' | 'connected' | 'disconnected' | 'error' | 'stopped';
export type Reading = {
  scanId: string; timestamp: string; simulated: boolean;
  temperature: number | null; vibration: number | null; voltage: number | null; rpm: number | null;
  obd?: { coolant: string; rpm: string; voltage: string };
};
export type SensorSnapshot = {
  scanId: string | null; mode: SensorMode; active: boolean; connection: Connection;
  message: string; samples: number; rejected: number; latest: Reading | null;
  history: Reading[]; warnings: string[]; startedAt: number; reason?: StopReason;
};
export type SensorConfig = { hardwareConfigured: boolean; deviceId: string | null };
export const isLandCruiserProfile = (customer: { id: string; vehicle_model: string } | null) =>
  customer?.id === 'c08' && /land cruiser 300/i.test(customer.vehicle_model);
export const CAPTURE_WINDOW_MS = 12_000;
export const SENSOR_RULES = { temperatureHigh: 105, voltageLow: 11.8, voltageHigh: 15.2, rpmHigh: 4500, vibrationHigh: 0.35 };
export type SensorRules = { [K in keyof typeof SENSOR_RULES]: number | null };
// External sensor placement/calibration is unknown. Enable thresholds here only
// after configuring them for the actual attached measurement, not an engine PID.
export const ATTACHED_SENSOR_RULES: SensorRules = { temperatureHigh: null, voltageLow: null, voltageHigh: null, rpmHigh: null, vibrationHigh: null };

export function emptySensorSnapshot(mode: SensorMode = 'demo'): SensorSnapshot {
  return { scanId: null, mode, active: false, connection: 'stopped', message: 'Ready for the next vehicle scan', samples: 0, rejected: 0, latest: null, history: [], warnings: [], startedAt: 0 };
}

export function decodeObd(frames: Reading['obd']) {
  const bytes = (frame: string, pid: string, count: number) => {
    if (typeof frame !== 'string' || !new RegExp(`^41${pid}[0-9a-f]{${count * 2}}$`, 'i').test(frame)) throw new Error(`Invalid OBD response for PID 01${pid}`);
    return frame.slice(4).match(/../g)!.map((byte) => parseInt(byte, 16));
  };
  const [temp] = bytes(frames.coolant, '05', 1), [ra, rb] = bytes(frames.rpm, '0C', 2), [va, vb] = bytes(frames.voltage, '42', 2);
  return { temperature: temp - 40, rpm: (ra * 256 + rb) / 4, voltage: (va * 256 + vb) / 1000 };
}

export function validateReading(value: unknown, scanId: string, now: number, previous?: Reading | null): Reading {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Device message must be a JSON object');
  const r = value as Reading;
  if (r.scanId !== scanId || typeof r.simulated !== 'boolean') throw new Error('Wrong scan session or missing simulated flag');
  if (typeof r.timestamp !== 'string' || !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(r.timestamp)) throw new Error('Timestamp must include its time zone');
  const time = Date.parse(r.timestamp);
  if (!Number.isFinite(time) || time < now - 15_000 || time > now + 5_000 || previous && time <= Date.parse(previous.timestamp)) throw new Error('Stale, duplicate, or out-of-order reading');
  const limits = { temperature: [-50, 200], vibration: [0, 3.3], voltage: [0, 60], rpm: [0, 15_000] };
  let measured = 0;
  for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
    const metric = r[key], [min, max] = limits[key];
    if (metric === null) continue;
    if (typeof metric !== 'number' || !Number.isFinite(metric) || metric < min || metric > max) throw new Error(`Invalid ${key} reading`);
    measured++;
  }
  if (!measured) throw new Error('No configured sensor measurements were supplied');
  if (previous && previous.simulated !== r.simulated) throw new Error('Measurement provenance cannot change within a scan');
  if (r.obd) {
    if (!r.simulated) throw new Error('This integration only supports emulated OBD frames, not a vehicle OBD interface');
    const decoded = decodeObd(r.obd);
    if (decoded.temperature !== r.temperature || decoded.rpm !== r.rpm || Math.abs(decoded.voltage - r.voltage) > 0.001) throw new Error('OBD frames do not match the decoded values');
  }
  return { scanId, timestamp: r.timestamp, simulated: r.simulated, temperature: r.temperature, vibration: r.vibration, voltage: r.voltage, rpm: r.rpm, ...(r.obd ? { obd: { ...r.obd } } : {}) };
}

export function readingWarnings(r: Reading, rules: SensorRules = r.simulated ? SENSOR_RULES : ATTACHED_SENSOR_RULES): string[] {
  const w: string[] = [];
  if (r.temperature != null && rules.temperatureHigh != null && r.temperature > rules.temperatureHigh) w.push(`Temperature above ${rules.temperatureHigh} °C`);
  if (r.voltage != null && rules.voltageLow != null && r.voltage < rules.voltageLow) w.push(`Voltage below ${rules.voltageLow} V`);
  if (r.voltage != null && rules.voltageHigh != null && r.voltage > rules.voltageHigh) w.push(`Voltage above ${rules.voltageHigh} V`);
  if (r.rpm != null && rules.rpmHigh != null && r.rpm > rules.rpmHigh) w.push(`RPM above ${rules.rpmHigh}`);
  if (r.vibration != null && rules.vibrationHigh != null && r.vibration > rules.vibrationHigh) w.push(`Vibration signal above ${rules.vibrationHigh} V RMS`);
  return w;
}

export type SourceCallbacks = { reading: (value: unknown) => void; state: (connection: Connection, message: string) => void };
export interface DataSource { start(callbacks: SourceCallbacks): void; stop(reason: StopReason): void }
export type Clock = { now(): number; later(callback: () => void, ms: number): unknown; clear(handle: unknown): void };
export const systemClock: Clock = { now: () => Date.now(), later: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) };

export function simulatedObdReading(scanId: string, timestamp: number, index: number, random = Math.random): Reading {
  const warning = index % 10 === 7;
  const temperature = Math.round(warning ? 107 + random() * 2 : 86 + random() * 7);
  const rpm = Math.round((800 + random() * 140 + (index % 5 === 3 ? 1000 : 0)) * 4);
  const millivolts = Math.round((warning ? 11.5 : 13.6 + random() * 0.7) * 1000);
  const hex = (n: number, digits: number) => n.toString(16).padStart(digits, '0').toUpperCase();
  const obd = { coolant: `4105${hex(temperature + 40, 2)}`, rpm: `410C${hex(rpm, 4)}`, voltage: `4142${hex(millivolts, 4)}` };
  return { scanId, timestamp: new Date(timestamp).toISOString(), simulated: true, ...decodeObd(obd), vibration: Math.round((0.04 + random() * 0.1) * 1000) / 1000, obd };
}

export class DemoSource implements DataSource {
  private handle: unknown; private running = false; private index = 0;
  constructor(private scanId: string, private clock = systemClock, private random = Math.random) {}
  start(callbacks: SourceCallbacks) {
    this.stop(); this.running = true; this.index = 0;
    callbacks.state('connected', 'OBD emulator running · all values simulated');
    const tick = () => {
      if (!this.running) return;
      callbacks.reading(simulatedObdReading(this.scanId, this.clock.now(), this.index++, this.random));
      if (this.running) this.handle = this.clock.later(tick, 1000);
    };
    this.handle = this.clock.later(tick, 1000);
  }
  stop() { this.running = false; this.clock.clear(this.handle); }
}

const gatewayTransitions = new Map<string, Promise<unknown>>();

export class HardwareSource implements DataSource {
  private running = false; private timer: unknown; private pollAbort: AbortController | null = null;
  private created = false; private stopReason: StopReason = 'cancelled'; private lastSequence = 0;
  constructor(private scanId: string, private base: string, private clock = systemClock, private fetcher: typeof fetch = fetch) {}
  private async request(path: string, init?: RequestInit) {
    const response = await this.fetcher(`${this.base}${path}`, init);
    if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.detail || `Device gateway returned ${response.status}`); }
    return response.json();
  }
  start(callbacks: SourceCallbacks) {
    if (this.running) return;
    this.running = true;
    callbacks.state('connecting', 'Waiting for the ESP32 device gateway');
    // Await the previous scan's close, including a cancelled in-flight start.
    // This avoids a quick rescan racing its own previous stop at the gateway.
    const previous = gatewayTransitions.get(this.base) || Promise.resolve();
    const transition = previous.catch(() => {}).then(async () => {
      if (!this.running) return;
      const timeout = new AbortController();
      const timer = this.clock.later(() => timeout.abort(), 5000);
      try {
        await this.request('/sensor-scans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scanId: this.scanId, customerId: 'c08' }), signal: timeout.signal });
        this.created = true;
        if (this.running) void this.poll(callbacks); else { this.created = false; await this.close(); }
      } catch (error) {
        if (this.running) callbacks.state('error', `Device gateway: ${error.message}`);
        this.running = false; await this.close();
      } finally { this.clock.clear(timer); }
    });
    gatewayTransitions.set(this.base, transition);
    void transition.finally(() => { if (gatewayTransitions.get(this.base) === transition) gatewayTransitions.delete(this.base); });
  }
  private async poll(callbacks: SourceCallbacks) {
    if (!this.running) return;
    this.pollAbort = new AbortController();
    const timeout = this.clock.later(() => this.pollAbort?.abort(), 3500);
    try {
      const result = await this.request(`/sensor-scans/${this.scanId}?after=${this.lastSequence}`, { signal: this.pollAbort.signal });
      if (!this.running) return;
      if (!result.active) { callbacks.state('error', 'Device scan expired or was stopped at the gateway'); this.stop('error'); return; }
      for (const item of result.readings) {
        if (item.sequence <= this.lastSequence) continue;
        callbacks.reading(item.reading); this.lastSequence = item.sequence;
      }
      callbacks.state(result.connection, result.message);
    } catch (error) {
      if (this.running) callbacks.state('disconnected', `Gateway disconnected; retrying automatically. ${error.message}`);
    } finally {
      this.clock.clear(timeout);
      if (this.running) this.timer = this.clock.later(() => void this.poll(callbacks), 1000);
    }
  }
  private close() {
    // Session leases also expire if the tab or network disappears before this arrives.
    const abort = new AbortController();
    const timer = this.clock.later(() => abort.abort(), 2500);
    const request = this.request(`/sensor-scans/${this.scanId}/stop`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: this.stopReason }), keepalive: true, signal: abort.signal }).catch(() => {}).finally(() => this.clock.clear(timer));
    gatewayTransitions.set(this.base, request);
    void request.finally(() => { if (gatewayTransitions.get(this.base) === request) gatewayTransitions.delete(this.base); });
    return request;
  }
  stop(reason: StopReason) {
    this.running = false; this.stopReason = reason; this.clock.clear(this.timer); this.pollAbort?.abort();
    if (this.created) { this.created = false; this.close(); }
  }
}

export class ScanCollector {
  snapshot = emptySensorSnapshot();
  private source: DataSource | null = null; private generation = 0;
  private windowTimer: unknown; private resolveWindow: (() => void) | null = null;
  constructor(private changed: (snapshot: SensorSnapshot) => void, private factory: (mode: SensorMode, scanId: string) => DataSource, private clock = systemClock) {}
  private publish(update: Partial<SensorSnapshot>) { this.snapshot = { ...this.snapshot, ...update }; this.changed(this.snapshot); }
  start(mode: SensorMode, scanId: string) {
    this.stop('cancelled');
    const generation = ++this.generation;
    this.snapshot = { ...emptySensorSnapshot(mode), scanId, active: true, connection: 'connecting', startedAt: this.clock.now(), message: 'Starting sensor collection' };
    this.changed(this.snapshot);
    this.source = this.factory(mode, scanId);
    this.source.start({
      state: (connection, message) => { if (generation === this.generation && this.snapshot.active) this.publish({ connection, message }); },
      reading: (value) => {
        if (generation !== this.generation || !this.snapshot.active) return;
        try {
          const reading = validateReading(value, scanId, this.clock.now(), this.snapshot.latest);
          if (mode === 'demo' && !reading.simulated) throw new Error('Demo readings must be marked simulated');
          this.publish({ latest: reading, samples: this.snapshot.samples + 1, history: [...this.snapshot.history.slice(-119), reading], warnings: readingWarnings(reading), connection: 'connected' });
        } catch (error) { this.publish({ rejected: this.snapshot.rejected + 1, message: `Rejected device reading: ${error.message}` }); }
      },
    });
  }
  waitForCaptureWindow() {
    if (!this.snapshot.active) return Promise.resolve();
    const remaining = Math.max(0, CAPTURE_WINDOW_MS - (this.clock.now() - this.snapshot.startedAt));
    if (!remaining) return Promise.resolve();
    return new Promise<void>((resolve) => { this.resolveWindow?.(); this.resolveWindow = resolve; this.clock.clear(this.windowTimer); this.windowTimer = this.clock.later(() => { this.resolveWindow = null; resolve(); }, remaining); });
  }
  stop(reason: StopReason) {
    this.generation++; this.source?.stop(reason); this.source = null;
    this.clock.clear(this.windowTimer); this.resolveWindow?.(); this.resolveWindow = null;
    if (this.snapshot.active) this.publish({ active: false, reason, connection: 'stopped', message: `Collection ${reason}${this.snapshot.samples ? '' : ' · no sensor samples received'}${['disconnected', 'error'].includes(this.snapshot.connection) ? ` · ${this.snapshot.message}` : ''}` });
  }
  reset() { this.stop('cancelled'); this.snapshot = emptySensorSnapshot(this.snapshot.mode); this.changed(this.snapshot); }
}
