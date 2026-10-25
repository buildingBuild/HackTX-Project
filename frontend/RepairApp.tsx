import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Activity, ArrowRight, ArrowUpRight, CarFront, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Copy, FileText, Headset, HelpCircle, Info, LayoutDashboard, Plus, Route, ShieldCheck, Wrench, X } from 'lucide-react';
import type { Profile } from './demo/agent-backend/engine';
import type { AppPage } from './demo/agent-backend/chat';
import ChatAssistant from './ChatAssistant';
import { AgentPanel, CoveragePanel, DiyPanel, PolicyGuide, type CoverageControls } from './RepairPanels';
import { calculateRepairCost, formatMoney, repairCases, repairLevels, type RepairCase, type RepairScreen } from './repair-data';
import camryPhoto from './assets/vehicles/camry-transparent.png';
import corollaPhoto from './assets/vehicles/corolla.avif';
import rav4Photo from './assets/vehicles/rav4-transparent.png';
import './repairs.css';

const photos: Record<string, string> = { james: camryPhoto, aisha: corollaPhoto, maria: rav4Photo };
const navigation = [
  { name: 'Overview' as const, Icon: LayoutDashboard },
  { name: 'Repair journey' as const, Icon: Route },
  { name: 'My vehicle' as const, Icon: CarFront },
  { name: 'Toyota coverage' as const, Icon: ShieldCheck },
  { name: 'Prepared requests' as const, Icon: ClipboardList },
];
type PreparedRequest = { id: string; key: string; level: number; repair: string; vehicle: string; body: string };
type Dialog = 'report' | 'brief' | 'help' | null;

function RepairDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); };
  }, []);
  return <dialog ref={ref} className="repair-dialog" aria-labelledby="repair-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <button type="button" className="repair-dialog-close" aria-label="Close dialog" onClick={onClose}><X size={20} /></button>
    <span className="repair-dialog-icon"><ClipboardList size={25} /></span><h2 id="repair-dialog-title">{title}</h2>{children}
  </dialog>;
}

function VehicleCard({ profile, repair, notes }: { profile?: Profile; repair: RepairCase; notes: string }) {
  return <section className="repair-vehicle-card" aria-labelledby="repair-vehicle-title"><div className="repair-vehicle-eyebrow"><CarFront size={17} /><span>YOUR REPAIR COMPANION</span><span>TOYOTA</span></div><h2 id="repair-vehicle-title">{profile?.vehicle ?? 'Loading your vehicle…'}</h2><p>{profile?.trim ?? 'Your vehicle workspace'}</p><figure><img src={photos[profile?.id ?? 'maria'] ?? rav4Photo} alt={profile?.vehicle ?? 'Toyota vehicle reference'} /><figcaption>Model reference · year and trim may differ</figcaption></figure><div className="repair-vehicle-metrics"><div><span>Odometer</span><strong>{profile?.mileage.toLocaleString() ?? '—'} <small>mi</small></strong></div><div><span>Insurance</span><strong>Toyota <small>assumed</small></strong></div></div><div className="repair-current-issue"><div><span className={`repair-level-mini repair-tone-${repair.level}`}>LEVEL {repair.level}</span><span>{repair.category}</span></div><h3>{repair.title}</h3><p>{notes || repair.description}</p><div><span>Illustrative repair range</span><strong>{formatMoney(repair.low)}–{formatMoney(repair.high)}</strong></div></div></section>;
}

export default function RepairApp() {
  const [people, setPeople] = useState<Profile[]>([]);
  const [person, setPerson] = useState('maria');
  const [screen, setScreen] = useState<RepairScreen>('Overview');
  const [repair, setRepair] = useState(repairCases[1]);
  const [notes, setNotes] = useState('');
  const [completed, setCompleted] = useState<number[]>([]);
  const [cost, setCost] = useState(repairCases[1].estimate);
  const [deductible, setDeductible] = useState(50000);
  const [eligiblePercent, setEligiblePercent] = useState(100);
  const [policyLimit, setPolicyLimit] = useState(1000000);
  const [requests, setRequests] = useState<PreparedRequest[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [viewedBrief, setViewedBrief] = useState<PreparedRequest | null>(null);
  const [reportCase, setReportCase] = useState(repair.id);
  const [reportNotes, setReportNotes] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError('');
    fetch('/api/profiles', { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Vehicle information could not load.');
      return response.json();
    }).then(data => {
      if (!Array.isArray(data) || !data.length) throw new Error('Vehicle information is unavailable.');
      setPeople(data);
    }).catch(error => { if (error.name !== 'AbortError') setLoadError(error.message); });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [screen]);

  const profile = people.find(item => item.id === person);
  const controls: CoverageControls = { total: cost, deductible, eligiblePercent, policyLimit, onTotal: setCost, onDeductible: setDeductible, onEligiblePercent: setEligiblePercent, onPolicyLimit: setPolicyLimit };
  const currentKey = JSON.stringify({ person, repair: repair.id, notes, cost, deductible, eligiblePercent, policyLimit });
  const prepared = requests.find(request => request.key === currentKey);
  const title = screen === 'Overview' ? `The right repair. The right support${profile ? `, ${profile.name}` : ''}.` : screen === 'My vehicle' ? 'Your Toyota. Your repair workspace.' : screen === 'Toyota coverage' ? 'Make room for fewer surprises.' : screen === 'Prepared requests' ? 'Your next steps, ready to review.' : 'A clear path from issue to repair.';
  const subtitle = screen === 'Toyota coverage' ? 'Explore repair costs with an assumed Toyota insurance policy before an agent reviews the details.' : screen === 'Prepared requests' ? 'Repair and insurance briefs prepared in this session. Review them before any agent handoff.' : 'Start with the severity. Handle a simple fix yourself, or bring an agent into the bigger decisions.';

  function selectRepair(next: RepairCase) {
    if (next.id === repair.id) return;
    setRepair(next); setCost(next.estimate); setNotes(''); setCompleted([]);
  }
  function navigate(next: RepairScreen) {
    if (next === 'Toyota coverage') selectRepair(repairCases[2]);
    setScreen(next);
  }
  function openReport() { setReportCase(repair.id); setReportNotes(notes); setDialog('report'); }
  function submitReport(event: FormEvent) {
    event.preventDefault();
    const next = repairCases.find(item => item.id === reportCase)!;
    selectRepair(next); setNotes(reportNotes.trim()); setScreen('Repair journey'); setDialog(null);
  }
  function prepareBrief() {
    if (!profile) return;
    if (prepared) { setViewedBrief(prepared); setCopyStatus(''); setDialog('brief'); return; }
    const forecast = calculateRepairCost(cost, deductible, eligiblePercent, policyLimit);
    const body = [
      `HEADS UP · LEVEL ${repair.level} ${repair.level === 3 ? 'INSURANCE REVIEW' : 'REPAIR AGENT HANDOFF'}`,
      `Vehicle: ${profile.vehicle} · ${profile.trim}`,
      `Odometer: ${profile.mileage.toLocaleString()} mi`,
      `Issue: ${repair.title}`,
      `Notes: ${notes || repair.description}`,
      `Illustrative repair range: ${formatMoney(repair.low)}–${formatMoney(repair.high)}`,
      ...(repair.level === 3 ? [
        'Insurance provider: Toyota insurance (assumed, not verified)',
        `Planning repair estimate: ${formatMoney(cost)}`,
        `Assumptions: deductible ${formatMoney(deductible)} · eligible share ${eligiblePercent}% · payout limit ${formatMoney(policyLimit)}`,
        `Illustrative insurance contribution: ${formatMoney(forecast.insuranceShare)}`,
        `Illustrative personal cost: ${formatMoney(forecast.personalShare)}`,
        'Agent tasks: assess repair, review actual policy, confirm eligibility, obtain repair pricing.',
      ] : ['Agent tasks: research compatible parts, gather repair information, prepare service options.']),
      'Status: Prepared in this session only. Not submitted to an agent or insurer. No live research, quote, booking, or claim approval.',
    ].join('\n\n');
    const next = { id: `HU-${String(requests.length + 1).padStart(3, '0')}`, key: currentKey, level: repair.level, repair: repair.title, vehicle: profile.vehicle, body };
    setRequests(current => [...current, next]); setViewedBrief(next); setCopyStatus(''); setDialog('brief');
  }
  function chatNavigate(page: AppPage) {
    if (page === 'Insurance') navigate('Toyota coverage');
    else if (page === 'My vehicle') navigate('My vehicle');
    else if (page === 'Payment options') { selectRepair(repairCases[2]); setScreen('Repair journey'); }
    else if (page === 'Service centers') { selectRepair(repairCases[1]); setScreen('Repair journey'); }
    else navigate('Overview');
  }
  const chatPage: AppPage = screen === 'Toyota coverage' ? 'Insurance' : screen === 'My vehicle' ? 'My vehicle' : 'Overview';
  const levelPicker = <section className="repair-levels-section" aria-labelledby="repair-levels-title"><div className="repair-section-heading"><div><span className="repair-kicker">ONE ISSUE. THE RIGHT LEVEL OF CARE.</span><h2 id="repair-levels-title">How much support do you need?</h2></div><span className="repair-example-label"><Info size={14} />Choose a demo repair to explore</span></div><div className="repair-level-grid">{repairLevels.map(({ level, title: levelTitle, label, description, action, support }) => {
    const Icon = level === 1 ? Wrench : level === 2 ? Headset : ShieldCheck;
    return <button type="button" key={level} className={`repair-level-card repair-tone-${level}${repair.level === level ? ' is-selected' : ''}`} aria-pressed={repair.level === level} onClick={() => selectRepair(repairCases.find(item => item.level === level)!)}><div className="repair-level-card-top"><span className="repair-level-number">0{level}</span><span className="repair-level-card-icon"><Icon size={28} strokeWidth={1.7} /></span></div><span className="repair-level-category">{label}</span><h3>{levelTitle}</h3><p>{description}</p><div className="repair-level-card-bottom"><span>{repair.level === level ? <><CheckCircle2 size={14} />Selected route</> : support}</span><span className="repair-level-card-arrow" aria-label={action}><ArrowUpRight size={19} /></span></div></button>;
  })}</div></section>;
  const repairPanel = repair.level === 1 ? <DiyPanel repair={repair} completed={completed} onToggle={index => setCompleted(current => current.includes(index) ? current.filter(item => item !== index) : [...current, index])} /> : repair.level === 2 ? <AgentPanel repair={repair} onPrepare={prepareBrief} prepared={Boolean(prepared)} disabled={!profile} /> : <CoveragePanel repair={repair} controls={controls} onPrepare={prepareBrief} prepared={Boolean(prepared)} disabled={!profile} />;

  return <div className="app-shell repair-app"><a className="skip-link" href="#main-content">Skip to main content</a><aside className="sidebar"><a className="brand" href="#" onClick={event => { event.preventDefault(); navigate('Overview'); }}><span className="brand-icon"><Activity size={24} /></span>heads up<span className="brand-dot">.</span></a><div className="workspace-label">YOUR REPAIR WORKSPACE</div><nav aria-label="Main navigation">{navigation.map(({ name, Icon }) => <button type="button" key={name} aria-current={screen === name ? 'page' : undefined} className={`nav-item${screen === name ? ' active' : ''}`} onClick={() => navigate(name)}><Icon size={21} /><span>{name}</span>{name === 'Prepared requests' && requests.length > 0 && <span className="repair-request-count">{requests.length}</span>}{screen === name && <i className="active-dot" />}</button>)}</nav><div className="sidebar-bottom"><div className="peace-card"><span className="small-icon"><Wrench size={23} /></span><h3>From a small fix<br />to a bigger plan.</h3><p>The right support for every repair.</p><span className="peace-line" /></div><button type="button" className="nav-item" onClick={() => setDialog('help')}><HelpCircle size={20} /><span>How it works</span><ArrowUpRight size={15} /></button><div className="sidebar-footer"><ShieldCheck size={16} />Built for your next mile</div></div></aside>
    <div className="main-shell"><header><div className="breadcrumb">My workspace<ChevronRight size={14} /><span>{screen}</span></div><div className="header-right"><span className="repair-insurance-pill"><ShieldCheck size={15} />Toyota insurance <small>assumed</small></span><div className="header-divider" /><label className="profile-select"><span className="avatar">{profile?.initials ?? 'MR'}</span><select aria-label="Choose demo vehicle owner" value={person} disabled={!people.length} onChange={event => { setPerson(event.target.value); setCompleted([]); setNotes(''); }}>{people.length ? people.map(item => <option key={item.id} value={item.id}>{item.name}’s workspace</option>) : <option value="maria">Loading vehicle…</option>}</select><ChevronDown size={14} /></label></div></header>
      <main id="main-content" className="repair-main" tabIndex={-1}><div className="repair-page-title"><div><span className="repair-kicker">A LITTLE CLARITY. A BETTER NEXT STEP.</span><h1>{title}</h1><p>{subtitle}</p></div><button type="button" className="button primary" onClick={openReport}><Plus size={18} />Report an issue</button></div>
        {loadError && <div className="repair-load-error" role="alert">{loadError}<button type="button" onClick={() => setReload(current => current + 1)}>Try again</button></div>}
        {(screen === 'Overview' || screen === 'Repair journey') && <>{levelPicker}<div className="repair-workspace-heading"><div><span className={`repair-level-mini repair-tone-${repair.level}`}>LEVEL {repair.level}</span><h2>{repair.title}</h2></div><button type="button" onClick={openReport}>Change issue<ArrowUpRight size={16} /></button></div><div className="repair-workspace-grid"><VehicleCard profile={profile} repair={repair} notes={notes} />{repairPanel}</div><section className="repair-process-strip" aria-label="Repair journey stages">{[{ title: 'Understand the issue', detail: 'Your vehicle. Your repair brief.' }, { title: 'Choose the right support', detail: 'DIY, repair agent, or insurance review.' }, { title: 'Move forward with a plan', detail: 'Clear next steps and estimated costs.' }].map((step, index) => <div key={step.title}><span>0{index + 1}</span><div><strong>{step.title}</strong><p>{step.detail}</p></div>{index < 2 && <ChevronRight size={18} />}</div>)}</section></>}
        {screen === 'Toyota coverage' && <><div className="repair-workspace-grid"><VehicleCard profile={profile} repair={repair} notes={notes} /><CoveragePanel repair={repair} controls={controls} onPrepare={prepareBrief} prepared={Boolean(prepared)} disabled={!profile} /></div><PolicyGuide /></>}
        {screen === 'My vehicle' && <><section className="repair-garage" aria-labelledby="repair-garage-title"><div className="repair-section-heading"><div><span className="repair-kicker">YOUR DEMO GARAGE</span><h2 id="repair-garage-title">Choose your Toyota.</h2></div></div><div>{people.map(item => <button type="button" aria-pressed={person === item.id} className={person === item.id ? 'is-selected' : ''} key={item.id} onClick={() => { setPerson(item.id); setCompleted([]); setNotes(''); }}><img src={photos[item.id] ?? rav4Photo} alt={item.vehicle} /><strong>{item.vehicle}</strong><span>{item.name} · {item.mileage.toLocaleString()} mi</span>{person === item.id && <CheckCircle2 size={18} />}</button>)}</div></section><div className="repair-workspace-grid"><VehicleCard profile={profile} repair={repair} notes={notes} /><section className="repair-detail-panel repair-vehicle-summary"><span className="repair-kicker"><ClipboardList size={16} />YOUR CURRENT REPAIR</span><h2>{repair.title}</h2><p className="repair-panel-description">{notes || repair.description}</p><dl><div><dt>Support level</dt><dd>Level {repair.level} · {repairLevels[repair.level - 1].label}</dd></div><div><dt>Repair range</dt><dd>{formatMoney(repair.low)}–{formatMoney(repair.high)} <small>illustrative</small></dd></div><div><dt>Insurance assumption</dt><dd>Toyota insurance · policy review pending</dd></div><div><dt>Current status</dt><dd>{prepared ? 'Brief prepared · not submitted' : 'Explore your next step'}</dd></div></dl><button type="button" className="button primary" onClick={() => navigate('Repair journey')}>Continue repair journey<ArrowRight size={18} /></button></section></div></>}
        {screen === 'Prepared requests' && <section className="repair-prepared-section">{requests.length ? <div className="repair-prepared-list">{requests.map(item => <article key={item.id}><span className={`repair-level-mini repair-tone-${item.level}`}>LEVEL {item.level}</span><span className="repair-brief-id">{item.id}</span><h2>{item.repair}</h2><p>{item.vehicle}</p><span className="repair-prepared-status"><CheckCircle2 size={15} />Prepared · not submitted</span><button type="button" className="button secondary" onClick={() => { setViewedBrief(item); setCopyStatus(''); setDialog('brief'); }}>Review brief<ArrowUpRight size={16} /></button></article>)}</div> : <div className="repair-empty-state"><span><ClipboardList size={36} /></span><h2>A little preparation goes a long way.</h2><p>Prepare a Level 2 repair request or a Level 3 insurance review. Your briefs will appear here for this session.</p><button type="button" className="button primary" onClick={() => navigate('Repair journey')}>Explore repair support<ArrowRight size={18} /></button></div>}</section>}
        <footer className="repair-footer"><span className="footer-logo"><Activity size={17} />heads up.</span><span>The right care for every repair.</span><span>Demo scenarios · Insurance assumed, not verified</span></footer>
      </main>
    </div>
    <ChatAssistant context={{ id: person, mileage: profile?.mileage ?? 58000, budget: profile?.budget ?? 200, estimate: cost, symptoms: false, page: chatPage }} profile={profile} onNavigate={chatNavigate} hidden={Boolean(dialog)} />
    {dialog === 'report' && <RepairDialog title="Tell us what needs attention." onClose={() => setDialog(null)}><p>Choose an example repair route and add your notes. A professional or agent will need to confirm the actual severity and price.</p><form onSubmit={submitReport}><label htmlFor="repair-report-case">Repair example<select id="repair-report-case" value={reportCase} onChange={event => setReportCase(event.target.value)}>{repairCases.map(item => <option key={item.id} value={item.id}>Level {item.level} · {item.title}</option>)}</select></label><label htmlFor="repair-report-notes">What are you noticing? <small>Optional</small><textarea id="repair-report-notes" maxLength={600} rows={4} placeholder="Add details you’d like included in your repair brief…" value={reportNotes} onChange={event => setReportNotes(event.target.value)} /></label><span className="repair-form-note">Saved in this session only. No assessment or agent request is submitted.</span><button type="submit" className="button primary repair-wide-button">Build my repair brief<ArrowRight size={18} /></button></form></RepairDialog>}
    {dialog === 'brief' && viewedBrief && <RepairDialog title={viewedBrief.level === 3 ? 'Your insurance review brief.' : 'Your repair agent brief.'} onClose={() => setDialog(null)}><span className="repair-prepared-status"><CheckCircle2 size={16} />{viewedBrief.id} · Prepared, not submitted</span><p>Review or copy this brief for your next step. No agent, insurer, or service center has been contacted.</p><textarea className="repair-brief-text" aria-label="Prepared repair brief" readOnly rows={10} value={viewedBrief.body} /><button type="button" className="button primary repair-wide-button" onClick={async () => { try { await navigator.clipboard.writeText(viewedBrief.body); setCopyStatus('Brief copied.'); } catch { setCopyStatus('Copy is unavailable. You can select and copy the brief above.'); } }}><Copy size={17} />Copy brief</button><p className="repair-copy-status" role="status">{copyStatus}</p></RepairDialog>}
    {dialog === 'help' && <RepairDialog title="Three levels. One clear next step." onClose={() => setDialog(null)}><p>Heads Up organizes repairs by the kind of support they need.</p><div className="repair-help-levels">{repairLevels.map(item => <div key={item.level}><span className={`repair-level-mini repair-tone-${item.level}`}>LEVEL {item.level}</span><strong>{item.title}</strong><p>{item.description}</p></div>)}</div><p>Levels 2 and 3 prepare an agent handoff. The current preview does not run live research or submit claims. Toyota insurance is a planning assumption; confirm your actual policy before relying on coverage.</p><div className="repair-inline-note"><Info size={17} /><p>If a vehicle feels unsafe, arrange professional assessment rather than relying on a DIY route or a demo severity level.</p></div></RepairDialog>}
  </div>;
}
