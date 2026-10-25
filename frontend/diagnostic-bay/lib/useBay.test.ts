import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { api } from './api';
import { useBay, type Bay } from './useBay';

test('existing scan handlers automatically collect for c08, stop, cancel, reset, and leave other profiles alone', async () => {
  let now = Date.parse('2026-10-25T15:00:00Z'), serial = 0, uuid = 0;
  const tasks = new Map<number, { at: number; fn: () => void }>();
  const original = { setTimeout, clearTimeout, now: Date.now, window: globalThis.window, crypto: Object.getOwnPropertyDescriptor(globalThis, 'crypto'), actEnv: (globalThis as any).IS_REACT_ACT_ENVIRONMENT, getCustomers: api.getCustomers, getViz: api.getVehicleVisualization, post: api.postDiagnosticSession };
  globalThis.setTimeout = ((fn: () => void, delay: number) => { const id = ++serial; tasks.set(id, { at: now + delay, fn }); return id; }) as any;
  globalThis.clearTimeout = ((id: number) => { tasks.delete(id); }) as any;
  Date.now = () => now;
  globalThis.window = { addEventListener() {}, removeEventListener() {} } as any;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}` } });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const c08 = { id: 'c08', vehicle_model: '2022 Toyota Land Cruiser 300 VX.R' }, c01 = { id: 'c01', vehicle_model: '2016 Toyota Corolla LE' };
  api.getCustomers = async () => [c08, c01];
  api.getVehicleVisualization = async (customer: any) => ({ customerId: customer.id, label: customer.vehicle_model, modelUrl: undefined, openHoodModelUrl: undefined, spec: {} });
  let requests = 0;
  api.postDiagnosticSession = async () => { requests++; return { severity: 'low', guide: null } as any; };
  let bay: Bay, renderer: ReactTestRenderer;
  function Harness() { bay = useBay(); return null; }
  const advance = async (ms: number) => {
    const end = now + ms;
    while (true) {
      const next = [...tasks.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      now = next[1].at; tasks.delete(next[0]);
      await act(async () => { next[1].fn(); });
    }
    now = end;
  };
  try {
    await act(async () => { renderer = create(React.createElement(Harness)); });
    await act(async () => { bay.startSession('c08'); bay.startSession('c08'); });
    assert.equal(uuid, 1, 'double clicks must not create concurrent scans');
    assert.equal(bay.sensor.active, true);
    await advance(2000); assert.equal(bay.sensor.samples, 2);
    const firstId = bay.sensor.scanId;
    await advance(4000); assert.equal(bay.screen, 'work'); assert.equal(bay.diag.status, 'loading');
    assert.equal(bay.sensor.samples, 6);
    await advance(6000); assert.equal(bay.diag.status, 'done'); assert.equal(bay.sensor.active, false);
    const captured = bay.sensor.samples;
    await advance(3000); assert.equal(bay.sensor.samples, captured);
    assert.equal(requests, 1);

    await act(async () => { bay.newCustomer(); });
    await act(async () => { bay.startSession('c08'); });
    assert.notEqual(bay.sensor.scanId, firstId); assert.equal(bay.sensor.samples, 0);
    await advance(1000); assert.equal(bay.sensor.samples, 1);
    await act(async () => { bay.cancelScan(); });
    assert.equal(bay.sensor.reason, 'cancelled'); assert.equal(bay.screen, 'select');
    await advance(6000); assert.equal(bay.sensor.samples, 1); assert.equal(requests, 1);

    await act(async () => { bay.newCustomer(); bay.startSession('c01'); });
    await advance(5200); assert.equal(bay.screen, 'work'); assert.equal(bay.diag.status, 'done');
    assert.equal(bay.sensor.active, false); assert.equal(bay.sensor.samples, 0); assert.equal(requests, 2);
    await act(async () => { renderer.unmount(); });
    assert.equal(tasks.size, 0);
  } finally {
    globalThis.setTimeout = original.setTimeout; globalThis.clearTimeout = original.clearTimeout; Date.now = original.now;
    if (original.window) globalThis.window = original.window; else delete globalThis.window;
    if (original.crypto) Object.defineProperty(globalThis, 'crypto', original.crypto); else delete globalThis.crypto;
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = original.actEnv;
    api.getCustomers = original.getCustomers; api.getVehicleVisualization = original.getViz; api.postDiagnosticSession = original.post;
  }
});
