'use client';
import { useState } from 'react';
import type { Bay } from '@/lib/useBay';
import { Icon } from './icons';
import SensorReadings, { SensorModeSetting } from './SensorReadings';
import { isLandCruiserProfile } from '@/lib/telemetry';
import { ProtectionDialog } from './ProtectionComparison';

const DEMO_LABELS: Record<string, string> = { c08: 'Low · 3D + OBD demo', c01: 'Low · SerpAPI guides', c04: 'High · insurance agent' };
const DEMO_ORDER = ['c08', 'c01', 'c04'];

export function SelectScreen({ bay }: { bay: Bay }) {
  const [sel, setSel] = useState('');
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const [compareOpen, setCompareOpen] = useState(false);
  const selectedId = sel || bay.customers.find((customer) => customer.id === 'c08')?.id || bay.customers[0]?.id || '';
  const c = bay.customers.find((customer) => customer.id === selectedId);
  const v = c?.vehicle;

  const lookup = (e: React.FormEvent) => {
    e.preventDefault();
    const id = val.trim().toLowerCase();
    if (!id) return;
    if (!bay.customers.some((customer) => customer.id === id)) {
      setErr(`No customer found for ${id}`);
      return;
    }
    setSel(id); setErr(''); setVal('');
  };

  return (
    <section className="screen" id="screen-select">
      <div className="ss">
        <div className="ss-left">
        <div className="brand ss-brand"><div className="brand-mark" aria-hidden="true">{Icon.mark}</div><span>Drivn</span></div>

        <div className="ss-head">
          <h1>Who&rsquo;s in the bay?</h1>
          <form onSubmit={lookup} autoComplete="off" className="ss-find">
            <input id="cust-id" className="ss-input" placeholder="Search customer ID" spellCheck={false} value={val} onChange={(e) => { setVal(e.target.value); setErr(''); }} aria-label="Customer ID" />
          </form>
          {err && <p className="ss-err" role="alert">{err}</p>}
        </div>

        {bay.customersStatus === 'loading' && <div className="skel" aria-label="Loading customers" />}
        {bay.customersStatus === 'error' && (
          <div className="warn"><b>Could not load customers</b><p>Make sure the FastAPI backend is running.</p><button className="btn" onClick={bay.loadCustomers}>Retry</button></div>
        )}

        <ul className="ss-list" role="radiogroup" aria-label="Customer">
          {[...bay.customers].sort((a, b) => (DEMO_ORDER.indexOf(a.id) < 0 ? 99 : DEMO_ORDER.indexOf(a.id)) - (DEMO_ORDER.indexOf(b.id) < 0 ? 99 : DEMO_ORDER.indexOf(b.id))).map((cu) => {
            const i = cu.id, cv = cu.vehicle;
            return (
              <li key={i}>
                <button type="button" role="radio" aria-checked={selectedId === i} className="ss-row" onClick={() => setSel(i)}>
                  <span className="sw" style={{ background: cv.hex }} />
                  <span className="ss-row-t"><b>{cu.name}<em className={'repair-profile-tag ' + (cu.severity === 'high' ? 'severity-high' : '')}>{DEMO_LABELS[i] || (cu.severity === 'high' ? 'High severity' : 'Low severity')}</em></b><small>{cv.year} {cv.model} · {i}</small></span>
                  <span className="ss-dot" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
        </div>

        <div className="ss-right">
        {c && v && <article className="ss-card" aria-live="polite">
          <p className="ss-eyebrow">{c.name}</p>
          <h2>{v.year} {v.make} {v.model}</h2>
          <p className="ss-sub"><span className="sw sm" style={{ background: v.hex }} />{v.trim || 'Standard trim'} · {c.location}</p>
          <dl className="ss-specs">
            <div><dt>Odometer</dt><dd>{v.odometerMi.toLocaleString('en-US')} mi</dd></div>
            <div><dt>Coverage</dt><dd>{c.insurance_level}</dd></div>
            {c.id === 'c08' && <><div><dt>Trim</dt><dd>{v.trim}</dd></div><div><dt>Service</dt><dd>Engine air filter</dd></div></>}
            <div className="full"><dt>Customer</dt><dd>{c.description}</dd></div>
            <div className="full"><dt>Scan path</dt><dd>{DEMO_LABELS[c.id] || `${c.severity} severity`}</dd></div>
          </dl>
          <button className="btn profile-compare" onClick={() => setCompareOpen(true)}>{Icon.shield} Compare Toyota protection</button>
        </article>}

        {isLandCruiserProfile(c) && <SensorModeSetting bay={bay} />}
        <button className="ss-go" type="button" disabled={!c || bay.sensor.active} onClick={() => bay.startSession(selectedId)}>{isLandCruiserProfile(c) ? 'Start Vehicle Scan' : 'Connect OBD'}</button>
        </div>
      </div>
      {compareOpen && c && <ProtectionDialog key={c.id} customer={c} quotes={bay.planQuotes[c.id] || {}} onQuote={(planId, changes) => bay.updatePlanQuote(c.id, planId, changes)} onClose={() => setCompareOpen(false)} />}
    </section>
  );
}

const WAIT = [
  ['Waiting for OBD device', 'Plug the adapter into the port under the dashboard.'],
  ['Connecting…', 'Pairing with the adapter and reading the vehicle bus.'],
  ['Connected', 'Adapter linked. Reading fault codes and live data.'],
];

export function WaitScreen({ bay }: { bay: Bay }) {
  const step = bay.waitStep, c = bay.customer, v = c.vehicle;
  const landCruiser = isLandCruiserProfile(c);
  const scanText = landCruiser ? [
    ['Starting vehicle scan', 'Data collection starts automatically for this Land Cruiser.'],
    ['Collecting readings…', bay.sensorMode === 'demo' ? 'Simulating decoded OBD values once per second.' : 'Waiting for the ESP32 Wi-Fi gateway and attached sensors or emulator.'],
    ['Scan in progress', 'Collecting a 12-second sample window and preparing the demo diagnosis.'],
  ] : WAIT;
  return (
    <section className="screen" id="screen-wait">
      <div className="wait-top">{v.year} {v.make} {v.model} · {c.name}</div>
      <div className="wait-body">
        <div className={'radar' + (step === 1 ? ' connecting' : step === 2 ? ' connected' : '')} aria-hidden="true">
          <i className="ring" /><i className="ring" /><i className="ring" /><i className="ring" />
          <div className="core">{step === 2 ? Icon.check : Icon.obd}</div>
        </div>
        <div className="wait-text" aria-live="polite">
          <h2>{scanText[step][0]}</h2>
          <p>{scanText[step][1]}</p>
        </div>
        <div className="wait-prog" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
        {landCruiser && <SensorReadings bay={bay} compact />}
      </div>
    </section>
  );
}
