'use client';

import { useEffect, useState } from 'react';
import type { Bay } from '@/lib/useBay';
import { checkKey, stepComplete } from '@/lib/repair';

function VoiceIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m11 5-6 4H2v6h3l6 4V5Z" /><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></svg>;
}

export function RepairIntro({ bay }: { bay: Bay }) {
  const guide = bay.guide;
  if (!guide) return null;
  return <section className="repair-intro">
    <div className="repair-eyebrow"><span className="repair-spark">✦</span> Your guided repair <span>{guide.duration}</span></div>
    <h3>{guide.title}</h3>
    <p>{guide.description} Follow animated arrows, listen to each step, and check off your progress.</p>
    <div className="repair-features"><span>3D guidance</span><span>Voice narration</span><span>{guide.steps.length} steps</span></div>
    <button className="btn primary repair-start" onClick={bay.startRepair}>{bay.repair.finished ? 'Start a new walkthrough' : bay.repair.checked && Object.keys(bay.repair.checked).length ? 'Resume guided repair' : 'Start guided repair'}<span aria-hidden="true">↗</span></button>
    <p className="repair-disclaimer">Illustrative engine layout. Use your exact vehicle’s manual to identify parts.</p>
  </section>;
}

export default function RepairGuide({ bay }: { bay: Bay }) {
  const guide = bay.guide!;
  const { repair } = bay;
  const step = guide.steps[repair.step];
  const [voice, setVoice] = useState(false);
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [readAgain, setReadAgain] = useState(0);

  useEffect(() => { setSupported('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window); }, []);
  useEffect(() => {
    if (!supported) return;
    window.speechSynthesis.cancel(); setSpeaking(false);
    if (!voice || repair.finished) return;
    const utterance = new SpeechSynthesisUtterance(`${step.title}. ${step.narration}${step.caution ? ` ${step.caution}` : ''}`);
    utterance.lang = 'en-US'; utterance.rate = 0.92;
    utterance.onstart = () => { setSpeaking(true); setVoiceError(''); };
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = (event) => {
      setSpeaking(false);
      if (event.error !== 'canceled' && event.error !== 'interrupted') setVoiceError('Voice is unavailable. Follow the written steps below.');
    };
    window.speechSynthesis.speak(utterance);
    return () => { utterance.onstart = utterance.onend = utterance.onerror = null; window.speechSynthesis.cancel(); };
  }, [supported, voice, step, readAgain, repair.finished]);

  const complete = stepComplete(step, repair.checked);
  const completedSteps = guide.steps.filter((item) => stepComplete(item, repair.checked)).length;

  if (repair.finished) return <section className="repair-guide repair-finished">
    <div className="repair-success" aria-hidden="true">✓</div>
    <span className="repair-eyebrow">{guide.steps.length} of {guide.steps.length} steps checked</span>
    <h2>A job well followed.</h2>
    <p>Your air-filter walkthrough is complete. All checklist items are recorded for this session.</p>
    <div className="repair-notice">A completed checklist does not verify a repair or clear a fault code. Arrange an inspection if a warning persists or the engine runs poorly.</div>
    <button className="btn primary" onClick={bay.pauseRepair}>Back to diagnosis</button>
    <button className="btn" onClick={bay.startRepair}>Run walkthrough again</button>
  </section>;

  return <section className="repair-guide" aria-label="Guided air-filter repair">
    <div className="repair-heading"><button className="back" onClick={bay.pauseRepair}>← Pause walkthrough</button><span className="pill ok">DIY guide</span></div>
    <div className="repair-progress-top"><span>Engine air-filter replacement</span><b>{completedSteps}/{guide.steps.length}</b></div>
    <div className="repair-progress" role="progressbar" aria-label="Completed repair steps" aria-valuemin={0} aria-valuemax={guide.steps.length} aria-valuenow={completedSteps}><i style={{ width: `${completedSteps / guide.steps.length * 100}%` }} /></div>
    <ol className="repair-dots" aria-label="Repair steps">{guide.steps.map((item, index) => <li key={item.id} aria-current={index === repair.step ? 'step' : undefined} className={stepComplete(item, repair.checked) ? 'done' : ''} title={item.title}><span>{stepComplete(item, repair.checked) ? '✓' : index + 1}</span><span className="sr-only">{item.title}</span></li>)}</ol>
    <div className="repair-voice">
      <button className="repair-voice-toggle" onClick={() => setVoice((enabled) => !enabled)} disabled={!supported} aria-pressed={voice}><VoiceIcon /><span><b>{voice ? speaking ? 'Reading this step…' : 'Voice guidance on' : 'Enable voice guidance'}</b><small>{supported ? 'Listen while you work' : 'Follow the written instructions'}</small></span><i className={voice ? 'on' : ''} aria-hidden="true" /></button>
      {voice && <button className="repair-read" aria-label="Read this step again" title="Read this step again" onClick={() => setReadAgain((n) => n + 1)}>↻</button>}
    </div>
    {voiceError && <p className="note" role="status">{voiceError}</p>}
    <div className="repair-step-copy" key={step.id}>
      <div className="repair-eyebrow">Step {repair.step + 1} of {guide.steps.length}</div>
      <h2>{step.title}</h2>
      <p>{step.instruction}</p>
      {step.caution && <div className="repair-notice">{step.caution}</div>}
    </div>
    {repair.step === 0 && <div className="repair-supplies"><h3>Have these ready</h3>{guide.supplies.map((item) => <span key={item}>{item}</span>)}</div>}
    <fieldset className="repair-checks"><legend>Before you continue</legend>{step.checks.map((check) => <label key={check.id} className={repair.checked[checkKey(step.id, check.id)] ? 'checked' : ''}><input type="checkbox" checked={!!repair.checked[checkKey(step.id, check.id)]} onChange={() => bay.toggleRepairCheck(check.id)} /><span>{check.label}</span></label>)}</fieldset>
    <div className="repair-actions"><button className="btn" onClick={bay.previousRepairStep} disabled={repair.step === 0}>Back</button><button className="btn primary" onClick={bay.nextRepairStep} disabled={!complete}>{repair.step === guide.steps.length - 1 ? 'Finish walkthrough' : 'Next step'} <span aria-hidden="true">→</span></button></div>
    {!complete && <p className="repair-disclaimer">Check both items to continue. Move at your own pace.</p>}
    <button className="repair-replay" onClick={bay.replayRepair}>↻ Replay animation &amp; recenter view</button>
  </section>;
}
