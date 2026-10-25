'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { Bay, Tab } from '@/lib/useBay';
import { OBD, PARTS, money, partName } from '@/lib/api';
import { Icon, Silhouette } from './icons';
import Panels from './Panels';
import ClaimDialog from './ClaimDialog';
import ApiLog from './ApiLog';
import SensorReadings from './SensorReadings';
import { isLandCruiserProfile } from '@/lib/telemetry';
import { stepComplete } from '@/lib/repair';

const CarCanvas = dynamic(() => import('./CarCanvas'), { ssr: false });

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const q = matchMedia('(max-width: 900px)'); const f = () => setM(q.matches); f();
    q.addEventListener('change', f); return () => q.removeEventListener('change', f);
  }, []);
  return m;
}
function useNow(active: boolean, ms = 350) {
  const [t, setT] = useState(() => performance.now());
  useEffect(() => { if (!active) return; const i = setInterval(() => setT(performance.now()), ms); return () => clearInterval(i); }, [active, ms]);
  return t;
}

const AGENT_STEPS = ['Reading fault codes', 'Matching vehicle history', 'Checking policy coverage', 'Locating affected parts'];
function Agent({ start }: { start: number }) {
  const t = (useNow(true) - start) / 1000;
  const idx = t < 1.3 ? 0 : t < 2.8 ? 1 : t < 4.2 ? 2 : 3;
  return (
    <div className="agent">
      <header><b>Diagnostic agent</b><span className="note">Your car stays live while this runs</span></header>
      <div className="bar"><i style={{ width: Math.min(94, (t / 5.6) * 100) + '%' }} /></div>
      <ul>{AGENT_STEPS.map((x, i) => <li key={x} className={i < idx ? 'done' : i === idx ? 'on' : ''}><i />{x}</li>)}</ul>
    </div>
  );
}
function Tiles({ i }: { i: any }) {
  return (
    <div className="tiles">
      <div className="tile"><span>Estimated repair</span><b>{money(i.estimatedRepairCost)}</b></div>
      <div className="tile ins"><span>Insurance pays</span><b>{money(i.insurancePayment)}</b></div>
      <div className="tile"><span>Deductible</span><b>{money(i.deductible)}</b></div>
      <div className="tile pay"><span>You pay</span><b>{money(i.customerCost)}</b></div>
    </div>
  );
}

const NAV: [Tab, string, any][] = [['home', 'Home', Icon.car], ['diagnosis', 'Scan', Icon.pulse], ['insurance', 'Policy', Icon.shield], ['nearby', 'Nearby', Icon.pin], ['claim', 'Claim', Icon.doc]];

export default function Workspace({ bay }: { bay: Bay }) {
  const c = bay.customer, v = c.vehicle, o = OBD[c.id], s = bay.diag.data, st = bay.diag.status, mobile = useIsMobile();
  const [logOpen, setLogOpen] = useState(false);
  const [animationPaused, setAnimationPaused] = useState(false);
  const spec = bay.viz.data?.spec, vizUrl = bay.viz.data?.modelUrl;
  const repairStep = bay.guide && bay.repair.active && !bay.repair.finished && bay.tab === 'diagnosis' ? bay.guide.steps[bay.repair.step] : undefined;
  const modelUrl = repairStep?.model === 'engine' ? bay.viz.data?.openHoodModelUrl || vizUrl : vizUrl;
  useEffect(() => { setAnimationPaused(false); }, [repairStep?.id, bay.repair.replay]);
  const high = s && s.severity === 'high', moveBelow = mobile && high && st === 'done';
  const rid = bay.selected || bay.hover, finding = rid && s ? s.findings.find((x: any) => x.partId === rid) : null;
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const views = bay.viz.status === 'done' ? (
    <div className="vbtns">
      {([['orbit', 'Auto rotate'], ['front', 'Front view'], ['side', 'Side view'], ['top', 'Top view']] as const).map(([k, label]) => (
        <button key={k} className="vbtn" aria-label={label} title={label} aria-pressed={bay.curView === k} onClick={() => bay.pickView(k)}>{Icon[k]}</button>
      ))}
    </div>
  ) : null;

  const bottom = repairStep ? <div className="repair-stage-caption"><span className="repair-stage-number">{String(bay.repair.step + 1).padStart(2, '0')}</span><span><small>Follow along · step {bay.repair.step + 1}/{bay.guide!.steps.length}</small><b>{repairStep.cue}</b></span><button aria-label={animationPaused ? 'Play animation' : 'Pause animation'} title={animationPaused ? 'Play animation' : 'Pause animation'} onClick={() => setAnimationPaused((paused) => !paused)}>{animationPaused ? '▶' : 'Ⅱ'}</button></div> : st === 'loading' ? <Agent start={bay.diag.start} /> : high ? (moveBelow ? null : <Tiles i={s.insurance} />) : s ? <div className="tip">{bay.repair.finished ? 'Walkthrough complete · review the final checks' : 'The affected area is highlighted in yellow'}</div> : null;

  return (
    <section className="screen" id="screen-work">
      <nav className="rail" aria-label="Workspace">
        <div className="brand-mark" aria-hidden="true">{Icon.mark}</div>
        <div style={{ display: 'contents' }}>
          {NAV.filter(([k]) => high || k === 'home' || k === 'diagnosis').map(([k, label, icon]) => (
            <button key={k} className="nav" title={label} aria-current={bay.tab === k ? 'true' : undefined}
              onClick={() => { bay.setTab(k); if (mobile) document.getElementById('panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              {icon}<span>{label}</span>
              {k === 'nearby' && bay.loc.status === 'done' && bay.tab !== 'nearby' && <i className="dot" />}
              {k === 'claim' && high && !bay.claim && bay.tab !== 'claim' && <i className="dot" />}
            </button>
          ))}
        </div>
        <div className="sp" />
        <button className="nav" title="API requests" onClick={() => setLogOpen((x) => !x)}>{Icon.log}<span>API</span></button>
        <button className="nav" title="New customer" onClick={bay.newCustomer}>{Icon.restart}<span>New</span></button>
      </nav>

      <div className="stage-col">
        <div className="topbar">
          <div className="who"><h2>{v.year} {v.make} {v.model}</h2><small>Parked · {isLandCruiserProfile(c) ? 'Land Cruiser demo profile' : 'OBD connected'} · {c.name} · {c.id}</small></div>
          <div className="telem">
            {[['Mileage', `${o.mileage.toLocaleString('en-US')} mi`], ['Issue code', o.issueCode]].map(([k, val]) => <span className="tchip" key={k}>{k} <b>{val}</b></span>)}
          </div>
        </div>

        <div className={'stage' + (repairStep ? ' repair-stage' : '')} id="stage">
          {spec && (
            <CarCanvas
              key={bay.viz.data.customerId}
              spec={spec}
              modelUrl={modelUrl}
              preloadUrl={bay.viz.data?.openHoodModelUrl}
              repairStep={repairStep}
              showRepairPointer={repairStep ? !stepComplete(repairStep, bay.repair.checked) : false}
              replay={bay.repair.replay}
              animationPaused={animationPaused}
              affected={repairStep ? repairStep.model === 'engine' ? [] : ['hood'] : s ? s.affectedParts : []}
              selected={repairStep ? null : bay.selected}
              hover={repairStep ? null : bay.hover}
              view={bay.view}
              auto={bay.auto && !reduced}
              onSelect={bay.setSelected}
              onHover={bay.setHover}
              onUserMove={bay.userMoved}
            />
          )}
          <div className={'scan' + (st === 'loading' && !reduced ? ' on' : '')} />
          <div className="hud-left">
            <div>
              {st === 'loading' && <span className="sevtag busy">Diagnostic running</span>}
              {st === 'error' && <span className="sevtag busy" style={{ background: 'var(--crit-soft)', color: '#ff9a93', borderColor: 'rgba(255,90,79,.5)' }}>Diagnostic failed</span>}
              {st === 'done' && <span className={'sevtag ' + s.severity}>{high ? 'High severity' : 'Low severity'}</span>}
            </div>
            <div className="readout">
              {rid && (
                <>
                  <div className={'t' + (bay.selected ? ' sel' : '')}>{partName(rid, spec)}</div>
                  <div className="s">{bay.selected ? `${PARTS[rid]?.[1] || ''} · ${finding ? finding.title + '. ' + finding.detail : s ? 'No fault found on this part.' : 'Waiting for diagnostic results.'}` : finding ? finding.title : 'Tap to select'}</div>
                </>
              )}
            </div>
          </div>
          <div className="hint">Drag to rotate<br />{repairStep ? 'Scroll to get closer' : 'Tap a part to inspect'}</div>
          {repairStep?.model === 'engine' && <div className="repair-layout-note">Engine layout is illustrative</div>}

          <div className="vstate">
            {(bay.viz.status === 'loading' || bay.viz.status === 'idle') && <div className="card"><div className="spin" /><b>Loading your {v.year} {v.make} {v.model}</b><span className="note">Fetching the 3D model</span></div>}
            {bay.viz.status === 'error' && (
              <div className="card">
                <Silhouette body={v.body} hex={v.hex} className="sil" />
                <b>3D model unavailable</b><span className="note">The diagnosis is not affected. Retry to load the model.</span>
                <button className="btn" onClick={bay.retryViz}>Retry model</button>
              </div>
            )}
          </div>

          <div className="hud-bottom in">{views}{bottom}</div>
        </div>
        {moveBelow && <div className="hud-bottom"><Tiles i={s.insurance} /></div>}
      </div>

      <aside className="panel" id="panel" aria-live="polite"><div className="pbody"><SensorReadings bay={bay} /><Panels bay={bay} /></div></aside>
      {logOpen && <ApiLog />}
      <ClaimDialog bay={bay} />
    </section>
  );
}
