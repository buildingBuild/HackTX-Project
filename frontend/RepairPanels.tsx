import { ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, ClipboardCheck, FileCheck2, FileText, Headset, Info, Search, ShieldCheck, Sparkles, Timer, Wrench } from 'lucide-react';
import { calculateRepairCost, diySteps, formatMoney, type RepairCase } from './repair-data';

type Handoff = () => void;

export function DiyPanel({ repair, completed, onToggle }: { repair: RepairCase; completed: number[]; onToggle: (index: number) => void }) {
  const done = completed.length === diySteps.length;
  return <section className="repair-detail-panel" aria-labelledby="diy-title">
    <div className="repair-panel-topline"><span className="repair-kicker"><Wrench size={16} />LEVEL 1 · SELF-GUIDED</span><span className="repair-soft-tag"><Timer size={13} />{repair.time}</span></div>
    <h2 id="diy-title">A small fix. A good place to start.</h2>
    <p className="repair-panel-description">A guided checklist for {repair.title.toLowerCase()}. Use the exact procedure for your vehicle.</p>
    <div className="agent-result-placeholder"><Search size={18} /><div><strong>Guidance source: SerpApi</strong><p>Your existing integration will supply results here once connected. The checklist below is a frontend example, not a fetched result.</p></div></div>
    <div className="diy-progress"><span>{done ? 'Checklist complete' : 'Your DIY checklist'}<strong>{completed.length} / {diySteps.length}</strong></span><div><i style={{ width: `${completed.length / diySteps.length * 100}%` }} /></div></div>
    <ol className="diy-checklist">{diySteps.map((step, index) => <li key={step.title} className={completed.includes(index) ? 'is-complete' : ''}><label><input type="checkbox" checked={completed.includes(index)} onChange={() => onToggle(index)} /><span className="diy-step-number" aria-hidden="true">{completed.includes(index) ? <Check size={15} /> : index + 1}</span><span><strong>{step.title}</strong><small>{step.detail}</small></span></label></li>)}</ol>
    <div className="repair-inline-note"><Info size={16} /><p>Only continue if you’re comfortable and the task is suitable for DIY. The owner’s manual is your reference; professional help is always an option.</p></div>
    {done && <div className="repair-success" role="status"><CheckCircle2 size={19} /><span>Nice work. Your checklist is complete for this session.</span></div>}
  </section>;
}

export function AgentPanel({ repair, onPrepare, prepared, disabled }: { repair: RepairCase; onPrepare: Handoff; prepared: boolean; disabled?: boolean }) {
  return <section className="repair-detail-panel" aria-labelledby="agent-title">
    <div className="repair-panel-topline"><span className="repair-kicker"><Headset size={16} />LEVEL 2 · AGENT ASSISTANCE</span><span className="repair-soft-tag">Handoff preview</span></div>
    <h2 id="agent-title">The right help for a bigger fix.</h2>
    <p className="repair-panel-description">Your agent’s workspace for researching {repair.title.toLowerCase()}, compatible parts, and repair options.</p>
    <div className="agent-brief-banner"><span className="agent-brief-avatar"><Headset size={26} /></span><div><strong>Repair information source: Snowflake</strong><p>Existing integration · frontend connection pending.</p></div><span className="agent-pending-dot" title="Snowflake integration pending" /></div>
    <div className="agent-task-list">{[
      { Icon: Search, title: 'Review relevant repair data', detail: 'Use information supplied by your existing Snowflake integration.' },
      { Icon: FileText, title: 'Understand your repair options', detail: 'Present the returned repair information for your vehicle and issue.' },
      { Icon: ClipboardCheck, title: 'Prepare your repair options', detail: 'Review the findings before deciding how to proceed.' },
    ].map(({ Icon, title, detail }, index) => <div key={title}><span className="agent-task-icon"><Icon size={19} /></span><div><strong>{title}</strong><p>{detail}</p></div><span className="agent-task-index">0{index + 1}</span></div>)}</div>
    <div className="agent-result-placeholder"><Sparkles size={18} /><div><strong>Snowflake results will appear here</strong><p>This is a frontend preview. Your existing integration will be connected later; this view does not fetch data.</p></div></div>
    <button type="button" className="button primary repair-wide-button" onClick={onPrepare} disabled={disabled}>{prepared ? 'Review prepared brief' : 'Prepare agent handoff'}<ArrowRight size={18} /></button>
  </section>;
}

export type CoverageControls = {
  total: number;
  deductible: number;
  eligiblePercent: number;
  policyLimit: number;
  onTotal: (value: number) => void;
  onDeductible: (value: number) => void;
  onEligiblePercent: (value: number) => void;
  onPolicyLimit: (value: number) => void;
};

export function CoveragePanel({ repair, onPrepare, prepared, controls, disabled }: { repair: RepairCase; onPrepare: Handoff; prepared: boolean; controls: CoverageControls; disabled?: boolean }) {
  const forecast = calculateRepairCost(controls.total, controls.deductible, controls.eligiblePercent, controls.policyLimit);
  return <section className="repair-detail-panel coverage-detail-panel" aria-labelledby="coverage-title">
    <div className="repair-panel-topline"><span className="repair-kicker"><ShieldCheck size={16} />LEVEL 3 · INSURANCE & COSTS</span><span className="repair-soft-tag">Planning estimate</span></div>
    <h2 id="coverage-title">A clearer picture of what you may pay.</h2>
    <p className="repair-panel-description">Explore {repair.title.toLowerCase()} assuming Toyota insurance. Adjust the assumptions before preparing an agent review.</p>
    <div className="toyota-policy-card"><span className="toyota-policy-mark"><ShieldCheck size={25} /></span><div><strong>Toyota insurance</strong><p>Collision coverage · assumed for this demo</p></div><span className="repair-assumed-tag">ASSUMED</span></div>
    <div className="repair-estimate-slider"><label htmlFor="repair-estimate">Repair cost estimate<strong>{formatMoney(controls.total)}</strong></label><input id="repair-estimate" type="range" min={repair.low} max={repair.high} step={5000} value={controls.total} onChange={event => controls.onTotal(Number(event.target.value))} /><div><span>{formatMoney(repair.low)}</span><span>{formatMoney(repair.high)}</span></div></div>
    <div className="coverage-assumptions"><label>Deductible<select value={controls.deductible} onChange={event => controls.onDeductible(Number(event.target.value))}>{[0, 25000, 50000, 100000].map(value => <option key={value} value={value}>{formatMoney(value)}</option>)}</select></label><label>Assumed eligible share<select value={controls.eligiblePercent} onChange={event => controls.onEligiblePercent(Number(event.target.value))}><option value={100}>100% eligible</option><option value={75}>75% eligible</option><option value={0}>Not covered</option></select></label><label>Assumed payout limit<select value={controls.policyLimit} onChange={event => controls.onPolicyLimit(Number(event.target.value))}>{[100000, 250000, 500000, 1000000].map(value => <option key={value} value={value}>{formatMoney(value)}</option>)}</select></label></div>
    <div className="coverage-cost-split"><div><span>Assumed insurance contribution</span><strong>{formatMoney(forecast.insuranceShare)}</strong><small>After deductible and payout limit</small></div><div><span>Estimated personal cost</span><strong>{formatMoney(forecast.personalShare)}</strong><small>Based on the assumptions above</small></div></div>
    <p className="coverage-math-note">Repair estimate {formatMoney(forecast.total)} = insurance {formatMoney(forecast.insuranceShare)} + personal cost {formatMoney(forecast.personalShare)}.</p>
    <div className="repair-inline-note"><Info size={16} /><p>This is an illustrative calculation, not a verified policy, repair quote, or claim approval. Your actual policy and professional assessment determine coverage and cost.</p></div>
    <button type="button" className="button primary repair-wide-button" onClick={onPrepare} disabled={disabled}>{prepared ? 'Review prepared insurance brief' : 'Prepare insurance agent review'}<ArrowRight size={18} /></button>
  </section>;
}

export function PolicyGuide() {
  return <section className="repair-policy-guide" aria-labelledby="policy-guide-title"><div><span className="repair-kicker"><FileCheck2 size={16} />BEFORE YOUR AGENT REVIEW</span><h2 id="policy-guide-title">Bring the policy into the conversation.</h2><p>A Toyota insurance assumption starts the estimate. Your documents complete the picture.</p></div><div className="repair-policy-accordions">{[
    { title: 'Coverage to confirm', description: 'Check the actual policy for collision coverage, exclusions, applicable deductibles, payout limits, and any repair-network requirements. The assumed figures above are editable planning inputs.' },
    { title: 'Information to prepare', description: 'Have your policy document, vehicle details, photos of the damage, incident information, and any professional repair assessment ready for the agent. No claim is submitted from this preview.' },
    { title: 'Toyota protection reference', description: 'The existing Toyota Financial Services document covers separate vehicle protection products. It does not establish an auto insurance policy or prove that this repair is covered.' },
  ].map(item => <details key={item.title}><summary>{item.title}<ChevronDown size={18} /></summary><p>{item.description}</p>{item.title === 'Toyota protection reference' && <a href="/api/insurance/source/toyota" target="_blank" rel="noreferrer">Open existing protection reference<ArrowUpRight size={15} /></a>}</details>)}</div></section>;
}
