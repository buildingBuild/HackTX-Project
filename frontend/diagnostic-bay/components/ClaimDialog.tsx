'use client';

import { useEffect, useRef, useState } from 'react';
import { claimText, type Bay } from '@/lib/useBay';

function Value({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return <div className={`cf ${full ? 'full' : ''}`}><label><span>{label}</span><span className="pill ok">Autofilled</span></label><div className="input">{value}</div></div>;
}

export default function ClaimDialog({ bay }: { bay: Bay }) {
  const form = bay.claimForm;
  const [copy, setCopy] = useState('Copy summary');
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = () => { bay.setClaimOpen(false); bay.setTab('claim'); };

  useEffect(() => {
    if (!bay.claimOpen) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bay.claimOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!bay.claimOpen || !form) return null;
  const filed = bay.claim?.status === 'filed';

  return (
    <div id="claim" onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="claimbox" role="dialog" aria-modal="true" aria-labelledby="claim-title">
        <header>
          <div><h2 id="claim-title">{filed ? 'Claim filed' : 'Autofilled insurance claim'}</h2><p className="note" style={{ marginTop: 6 }}><span className="mono">{form.draftId}</span> · Demo workflow</p></div>
          <span className="pill ok">{filed ? 'Filed' : 'Ready to file'}</span>
        </header>

        {filed ? (
          <div className="claimbody">
            <div className="warn" style={{ borderColor: 'rgba(55,214,160,.45)', background: 'rgba(55,214,160,.08)' }}><b>Demo claim filed successfully</b><p>Claim number <span className="mono">{bay.claim?.claimNumber}</span>. Nearby Toyota service locations are now loading for {form.location}.</p></div>
          </div>
        ) : (
          <div className="claimbody">
            <section><h3>Customer</h3><div className="cgrid"><Value label="Name" value={form.name} /><Value label="Customer ID" value={form.customerId} /><Value label="Location" value={form.location} full /></div></section>
            <section><h3>Vehicle and diagnosis</h3><div className="cgrid"><Value label="Vehicle" value={form.vehicle} /><Value label="Mileage" value={form.odometer} /><Value label="OBD issue code" value={form.issueCode} /><Value label="Insurance level" value={form.plan} /><Value label="Affected area" value={form.damage} full /><Value label="Diagnostic summary" value={form.summary} full /></div></section>
            <section><h3>Estimated costs</h3><div className="cgrid"><Value label="Repair" value={form.est} /><Value label="Deductible" value={form.ded} /><Value label="Insurance payment" value={form.ins} /><Value label="Customer cost" value={form.cust} /></div></section>
          </div>
        )}

        <div className="claimfoot">
          <div className="note">This is a demo filing. No information is sent to an insurer.</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {!filed && <button className="btn" onClick={() => navigator.clipboard.writeText(claimText(form)).then(() => setCopy('Copied')).catch(() => setCopy('Unavailable'))}>{copy}</button>}
            <button className="btn" ref={closeRef} onClick={close}>{filed ? 'Close' : 'Back to car'}</button>
            {filed
              ? <button className="btn primary" onClick={() => { bay.setClaimOpen(false); bay.setTab('nearby'); }}>View service locations</button>
              : <button className="btn primary" disabled={bay.claim?.status === 'filing'} onClick={bay.fileClaim}>{bay.claim?.status === 'filing' ? 'Filing claim…' : 'File demo claim'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
