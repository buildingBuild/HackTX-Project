'use client';

import { useState } from 'react';
import type { Bay, Tab } from '@/lib/useBay';
import { money, OBD, PARTS, partName } from '@/lib/api';
import { Icon } from './icons';

const TAB_TITLE: Record<string, string> = {
  diagnosis: 'Diagnosis', insurance: 'Insurance', nearby: 'Nearby help', claim: 'Claim', vehicle: 'Vehicle',
};

function Back({ bay, tab }: { bay: Bay; tab: Tab }) {
  return <button className="back" onClick={() => bay.setTab('home')}>{Icon.back}{TAB_TITLE[tab]}</button>;
}

function Row({ bay, go, icon, title, sub, cls }: { bay: Bay; go: Tab; icon: any; title: string; sub: string; cls?: string }) {
  return (
    <button className="rowbtn" onClick={() => bay.setTab(go)}>
      <span className="ic">{icon}</span>
      <span><b>{title}</b><small className={cls || ''}>{sub}</small></span>
      <span className="chev">{Icon.chev}</span>
    </button>
  );
}

function Home({ bay }: { bay: Bay }) {
  const session = bay.diag.data;
  const status = bay.diag.status;
  const high = session?.severity === 'high';
  const diagnosticSub = status === 'error' ? 'Did not finish' : status !== 'done' ? 'Scanning…' : high ? 'High severity' : 'Low severity';
  const insuranceSub = !session ? 'Waiting for diagnosis' : high ? `${money(session.insurance.customerCost)} estimated customer cost` : 'Skipped for low severity';
  const nearbySub = bay.loc.status === 'done' ? `${bay.loc.places.length} service locations` : bay.loc.status === 'loading' ? 'Searching…' : high ? 'Available after filing' : 'Not needed';
  const claimSub = !session ? 'Waiting for diagnosis' : !high ? 'Not needed' : bay.claim?.status === 'filed' ? 'Demo claim filed' : bay.claim ? 'Draft ready' : 'Ready to autofill';

  return (
    <>
      <div className="sec">
        <h2>{status === 'done' ? session.headline : 'Scanning your vehicle'}</h2>
        <p>{status === 'done' ? session.summary : 'The diagnostic agent is reading the OBD issue and preparing the next step.'}</p>
      </div>
      <div className="rows">
        <Row bay={bay} go="diagnosis" icon={Icon.pulse} title="Diagnosis" sub={diagnosticSub} cls={status === 'done' ? (high ? 'bad' : 'good') : ''} />
        {high && <Row bay={bay} go="insurance" icon={Icon.shield} title="Insurance" sub={insuranceSub} />}
        {high && <Row bay={bay} go="claim" icon={Icon.doc} title="Claim" sub={claimSub} />}
        {high && <Row bay={bay} go="nearby" icon={Icon.pin} title="Nearby service" sub={nearbySub} />}
        <Row bay={bay} go="vehicle" icon={Icon.car} title="Vehicle and OBD data" sub={`${bay.customer.mileage.toLocaleString('en-US')} mi · ${OBD[bay.customer.id].issueCode}`} />
      </div>
    </>
  );
}

function Vehicle({ bay }: { bay: Bay }) {
  const customer = bay.customer;
  const vehicle = customer.vehicle;
  const obd = OBD[customer.id];
  const affected: string[] = bay.diag.data?.affectedParts || [];
  const spec = bay.viz.data?.spec;
  const groups: Record<string, string[]> = {};
  Object.keys(PARTS).forEach((id) => { (groups[PARTS[id][1]] ||= []).push(id); });

  return (
    <>
      <Back bay={bay} tab="vehicle" />
      <div className="sec"><h2>{customer.vehicle_model}</h2><p>{customer.name} · {customer.location}</p></div>
      <div className="sec"><h3>Customer</h3><dl className="kv card2"><dt>Name</dt><dd>{customer.name}</dd><dt>ID</dt><dd className="mono">{customer.id}</dd><dt>Insurance</dt><dd>{customer.insurance_level}</dd></dl></div>
      <div className="sec"><h3>OBD data</h3><dl className="kv card2"><dt>Issue code</dt><dd className="mono">{obd.issueCode}</dd><dt>Vehicle model</dt><dd>{obd.vehicleModel}</dd><dt>Mileage</dt><dd>{obd.mileage.toLocaleString('en-US')} mi</dd></dl></div>
      <div className="sec">
        <h3>Interactive vehicle <small>{spec ? 'Tap a part to highlight it' : 'Model loading'}</small></h3>
        {Object.keys(groups).map((group) => (
          <div className="sec" key={group}>
            <span className="note">{group}</span>
            <div className="partlist">
              {groups[group].map((id) => (
                <button key={id} className={affected.includes(id) ? 'aff' : ''} onClick={() => bay.setSelected(id === bay.selected ? null : id)} onMouseEnter={() => bay.setHover(id)} onMouseLeave={() => bay.setHover(null)}>{partName(id, spec)}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="note">The closest available body style is used when an exact model is unavailable.</p>
    </>
  );
}

function LocCard({ place }: { place: any }) {
  const [copyLabel, setCopyLabel] = useState('Copy');
  const directions = `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  const copy = () => {
    const text = `${place.name} · ${place.address}${place.phone ? ` · ${place.phone}` : ''}`;
    navigator.clipboard.writeText(text).then(() => setCopyLabel('Copied')).catch(() => setCopyLabel('Unavailable'));
  };

  return (
    <article className="loc">
      <div className="r1"><b>{place.name}</b><span className="mono" style={{ color: 'var(--muted)' }}>{place.distanceMi.toFixed(1)} mi</span></div>
      <div className="r2"><span className="pill">Toyota service</span><span>{place.address}</span></div>
      <div className="r2">
        {place.phone && <span className="mono">{place.phone}</span>}
        <button className="chip" style={{ marginLeft: 'auto' }} onClick={copy}>{copyLabel}</button>
        <a className="chip" href={directions} target="_blank" rel="noopener noreferrer">Directions</a>
      </div>
    </article>
  );
}

function Diagnosis({ bay }: { bay: Bay }) {
  const session = bay.diag.data;
  const status = bay.diag.status;
  const spec = bay.viz.data?.spec;
  const back = <Back bay={bay} tab="diagnosis" />;

  if (status === 'loading' || status === 'idle') return <>{back}<div className="sec"><h2>Scanning the vehicle</h2><p>The diagnostic result will appear here.</p></div><div className="skel" /><div className="skel" /><div className="skel" /></>;
  if (status === 'error') return <>{back}<div className="warn"><b>Diagnostic did not finish</b><p>{bay.diag.error || 'The backend did not respond.'}</p></div><button className="btn primary" onClick={bay.retryDiag}>Retry diagnostic</button></>;

  const findings = session.findings.map((finding: any) => (
    <button key={`${finding.partId}-${finding.title}`} className="finding" aria-pressed={bay.selected === finding.partId} onClick={() => bay.setSelected(finding.partId === bay.selected ? null : finding.partId)} onMouseEnter={() => bay.setHover(finding.partId)} onMouseLeave={() => bay.setHover(null)}>
      <i className="sq" /><span><b>{finding.title}</b><span>{partName(finding.partId, spec)} · {finding.detail}</span></span>
    </button>
  ));
  const faultCodes = <div className="sec"><h3>OBD issue</h3><div className="card2"><table className="table"><tbody>{session.dtcs.map((item: any) => <tr key={item.code}><td className="mono" style={{ width: 120, color: 'var(--yellow)' }}>{item.code}</td><td style={{ textAlign: 'left', color: '#c3cad8' }}>{item.status}</td></tr>)}</tbody></table></div></div>;

  if (session.severity === 'low') {
    return (
      <>
        {back}
        <div className="sec"><span className="pill ok">Low severity</span><h2>{session.headline}</h2><p>{session.summary}</p></div>
        <div className="sec"><h3>Helpful videos</h3>{session.resources.videos.length ? session.resources.videos.map((item: any) => <a className="vid" key={item.link} href={item.url} target="_blank" rel="noopener noreferrer"><div className="th">{item.thumbnail ? <img src={item.thumbnail} alt="" /> : Icon.play}</div><div><b>{item.title}</b><small>{item.source || 'Video'}</small></div></a>) : <p className="note">No videos were returned.</p>}</div>
        <div className="sec"><h3>Helpful articles</h3>{session.resources.articles.length ? session.resources.articles.map((item: any) => <a className="art" key={item.link} href={item.url} target="_blank" rel="noopener noreferrer"><b>{item.title}</b><small>{item.source || item.snippet || 'Article'}</small></a>) : <p className="note">No articles were returned.</p>}</div>
        <div className="sec"><h3>Affected area</h3>{findings}</div>
        {faultCodes}
      </>
    );
  }

  const insurance = session.insurance;
  return (
    <>
      {back}
      <div className="warn"><b>{session.safetyWarning.title}</b><p>{session.safetyWarning.body}</p></div>
      <div className="sec"><h2>{session.headline}</h2><p>{session.summary}</p></div>
      <div className="sec"><h3>Coverage</h3><div className="card2"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><b>{insurance.plan}</b><span className="pill ok">{insurance.coverageStatus.replace('_', ' ')}</span></div><p className="note" style={{ marginTop: 8 }}>{insurance.coverageNote}</p></div></div>
      <div className="sec"><h3>Affected area</h3>{findings}</div>
      <div className="sec"><h3>Next steps</h3><ol className="todo">{session.nextSteps.map((step: string) => <li key={step}>{step}</li>)}</ol></div>
      <button className="btn primary" disabled={bay.claimBusy} onClick={bay.prepareClaim}>{bay.claimBusy ? 'Autofilling claim…' : bay.claim ? 'Review claim' : 'Autofill insurance claim'}</button>
      {faultCodes}
    </>
  );
}

function Insurance({ bay }: { bay: Bay }) {
  const session = bay.diag.data;
  const back = <Back bay={bay} tab="insurance" />;
  if (!session) return <>{back}<div className="sec"><h2>Insurance</h2><p>Coverage details appear after diagnosis.</p></div></>;
  if (session.severity === 'low') return <>{back}<div className="sec"><h2>Insurance skipped</h2><p>The low-severity flow provides useful resources without starting a claim.</p></div></>;
  const insurance = session.insurance;
  return (
    <>
      {back}
      <div className="sec"><h2>Coverage and cost</h2><p>{insurance.coverageNote}</p></div>
      <dl className="kv card2"><dt>Plan</dt><dd>{insurance.plan}</dd><dt>Status</dt><dd>{insurance.coverageStatus.replace('_', ' ')}</dd></dl>
      <div className="sec"><h3>Estimated costs</h3><div className="card2"><table className="table"><tbody><tr><td>Repair</td><td>{money(insurance.estimatedRepairCost)}</td></tr><tr><td>Insurance pays</td><td style={{ color: 'var(--good)' }}>{money(insurance.insurancePayment)}</td></tr><tr><td>Deductible</td><td>{money(insurance.deductible)}</td></tr><tr className="tot"><td>You pay</td><td>{money(insurance.customerCost)}</td></tr></tbody></table></div><p className="note">{insurance.calculation}</p></div>
      <button className="btn primary" disabled={bay.claimBusy} onClick={bay.prepareClaim}>{bay.claimBusy ? 'Autofilling claim…' : 'Continue to claim'}</button>
    </>
  );
}

function Nearby({ bay }: { bay: Bay }) {
  const back = <Back bay={bay} tab="nearby" />;
  if (bay.diag.data?.severity !== 'high') return <>{back}<div className="sec"><h2>Nearby service</h2><p>This step follows a high-severity insurance claim.</p></div></>;
  if (bay.claim?.status !== 'filed') return <>{back}<div className="sec"><h2>Nearby service</h2><p>File the demo claim first. We will then search around {bay.customer.location}.</p></div><button className="btn primary" onClick={bay.prepareClaim}>Open claim</button></>;
  if (bay.loc.status === 'loading' || bay.loc.status === 'idle') return <>{back}<div className="sec"><h2>Finding nearby service</h2><p>Searching around {bay.customer.location}.</p></div><div className="skel" /><div className="skel" /></>;
  if (bay.loc.status === 'error') return <>{back}<div className="warn"><b>Could not load service locations</b><p>Your diagnosis and claim are still saved.</p></div><button className="btn" onClick={bay.retryLoc}>Retry</button></>;
  return <>{back}<div className="sec"><h2>Where to take the vehicle</h2><p>Nearby Toyota service locations around {bay.customer.location}.</p></div><div className="sec">{bay.loc.places.map((place) => <LocCard key={place.id} place={place} />)}</div></>;
}

function ClaimTab({ bay }: { bay: Bay }) {
  const session = bay.diag.data;
  const back = <Back bay={bay} tab="claim" />;
  if (!session) return <>{back}<div className="sec"><h2>Claim</h2><p>Available after diagnosis.</p></div></>;
  if (session.severity === 'low') return <>{back}<div className="sec"><h2>No claim needed</h2><p>The low-severity flow provides articles and videos instead.</p></div></>;
  if (!bay.claim) return <>{back}<div className="sec"><h2>Insurance claim</h2><p>Autofill a demo claim using the customer, vehicle, OBD code, coverage, and cost information already available.</p></div><button className="btn primary" disabled={bay.claimBusy} onClick={bay.prepareClaim}>{bay.claimBusy ? 'Autofilling claim…' : 'Autofill claim'}</button></>;
  return <>{back}<div className="sec"><h2>{bay.claim.status === 'filed' ? 'Claim filed' : 'Claim ready'}</h2><p><span className="mono">{bay.claim.draftId}</span> · {bay.claim.status === 'filed' ? 'Demo confirmation created' : 'Review before filing'}</p></div><button className="btn primary" onClick={() => bay.setClaimOpen(true)}>Review claim</button>{bay.claim.status === 'filed' && <button className="btn" onClick={() => bay.setTab('nearby')}>View service locations</button>}</>;
}

export default function Panels({ bay }: { bay: Bay }) {
  switch (bay.tab) {
    case 'vehicle': return <Vehicle bay={bay} />;
    case 'diagnosis': return <Diagnosis bay={bay} />;
    case 'insurance': return <Insurance bay={bay} />;
    case 'nearby': return <Nearby bay={bay} />;
    case 'claim': return <ClaimTab bay={bay} />;
    default: return <Home bay={bay} />;
  }
}
