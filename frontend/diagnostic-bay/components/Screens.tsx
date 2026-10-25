'use client';
import { useState } from 'react';
import type { Bay } from '@/lib/useBay';
import { Icon } from './icons';

export function SelectScreen({ bay }: { bay: Bay }) {
  const [sel, setSel] = useState('');
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const selectedId = sel || bay.customers[0]?.id || '';
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
          {bay.customers.map((cu) => {
            const i = cu.id, cv = cu.vehicle;
            return (
              <li key={i}>
                <button type="button" role="radio" aria-checked={selectedId === i} className="ss-row" onClick={() => setSel(i)}>
                  <span className="sw" style={{ background: cv.hex }} />
                  <span className="ss-row-t"><b>{cu.name}</b><small>{cv.year} {cv.model} · {i}</small></span>
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
            <div className="full"><dt>Customer</dt><dd>{c.description}</dd></div>
          </dl>
        </article>}

        <button className="ss-go" type="button" disabled={!c} onClick={() => bay.startSession(selectedId)}>Connect OBD</button>
        </div>
      </div>
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
  return (
    <section className="screen" id="screen-wait">
      <div className="wait-top">{v.year} {v.make} {v.model} · {c.name}</div>
      <div className="wait-body">
        <div className={'radar' + (step === 1 ? ' connecting' : step === 2 ? ' connected' : '')} aria-hidden="true">
          <i className="ring" /><i className="ring" /><i className="ring" /><i className="ring" />
          <div className="core">{step === 2 ? Icon.check : Icon.obd}</div>
        </div>
        <div className="wait-text" aria-live="polite">
          <h2>{WAIT[step][0]}</h2>
          <p>{WAIT[step][1]}</p>
        </div>
        <div className="wait-prog" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
      </div>
    </section>
  );
}
