'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ViewRequest } from '@/components/CarCanvas';
import { api, API_BASE, money, OBD, partName, type Flags } from './api';
import { advanceRepair, checkKey, emptyRepairProgress, type RepairGuide } from './repair';
import { DemoSource, emptySensorSnapshot, HardwareSource, isLandCruiserProfile, ScanCollector, type SensorConfig, type SensorMode } from './telemetry';
import type { PlanQuote } from './protection';

export type Tab = 'home' | 'vehicle' | 'diagnosis' | 'insurance' | 'nearby' | 'claim' | 'comparison';
type Load<T> = { status: 'idle' | 'loading' | 'done' | 'error'; data: T | null; error?: string };

export function buildClaimForm(customer: any, session: any, spec: any, draft: any) {
  const obd = OBD[customer.id];
  const insurance = session.insurance;
  const parts = session.findings.map((finding: any) => partName(finding.partId, spec)).join(', ');
  return {
    customerId: customer.id,
    name: customer.name,
    location: customer.location,
    vehicle: customer.vehicle_model,
    odometer: `${customer.mileage.toLocaleString('en-US')} mi`,
    plan: `${customer.insurance_level[0].toUpperCase()}${customer.insurance_level.slice(1)}`,
    issueCode: obd.issueCode,
    summary: session.summary,
    damage: parts || 'Pending technician inspection',
    est: money(insurance.estimatedRepairCost),
    ded: money(insurance.deductible),
    ins: money(insurance.insurancePayment),
    cust: money(insurance.customerCost),
    draftId: draft.draftId,
  };
}

export function claimText(form: any) {
  return [
    `CLAIM ${form.draftId}`,
    `Customer: ${form.name} (${form.customerId})`,
    `Location: ${form.location}`,
    `Vehicle: ${form.vehicle} · ${form.odometer}`,
    `Coverage: ${form.plan}`,
    `Issue: ${form.issueCode}`,
    `Affected area: ${form.damage}`,
    `Estimated repair: ${form.est}`,
    `Deductible: ${form.ded}`,
    `Estimated insurance payment: ${form.ins}`,
    `Estimated customer cost: ${form.cust}`,
    '',
    form.summary,
  ].join('\n');
}

export function useBay() {
  const [screen, setScreen] = useState<'select' | 'wait' | 'work'>('select');
  const [customers, setCustomers] = useState<any[]>([]);
  const [customersStatus, setCustomersStatus] = useState<Load<any>['status']>('loading');
  const [customer, setCustomer] = useState<any>(null);
  const [waitStep, setWaitStep] = useState(0);
  const [flags, setFlags] = useState<Flags>({ viz: false, loc: false, diag: false });
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const [diag, setDiag] = useState<Load<any> & { start: number }>({ status: 'idle', data: null, start: 0 });
  const [viz, setViz] = useState<Load<any>>({ status: 'idle', data: null });
  const [loc, setLoc] = useState<{ status: Load<any>['status']; places: any[] }>({ status: 'idle', places: [] });
  const [locFilter, setLocFilter] = useState('all');
  const [tab, setTab] = useState<Tab>('home');
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [claim, setClaim] = useState<any>(null);
  const [claimForm, setClaimForm] = useState<any>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [view, setView] = useState<ViewRequest>(null);
  const [curView, setCurView] = useState<'orbit' | 'front' | 'side' | 'top' | ''>('orbit');
  const [auto, setAuto] = useState(true);
  const [repair, setRepair] = useState(emptyRepairProgress);
  const guide: RepairGuide | null = diag.data?.severity === 'low' ? diag.data.guide ?? null : null;
  const token = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [sensorMode, setSensorMode] = useState<SensorMode>('demo');
  const sensorModeRef = useRef(sensorMode); sensorModeRef.current = sensorMode;
  const [sensor, setSensor] = useState(emptySensorSnapshot);
  const [sensorConfig, setSensorConfig] = useState<SensorConfig>({ hardwareConfigured: false, deviceId: null });
  const collector = useRef<ScanCollector | null>(null);
  if (!collector.current) collector.current = new ScanCollector(setSensor, (mode, id) => mode === 'demo' ? new DemoSource(id) : new HardwareSource(id, API_BASE));
  const diagnosticAbort = useRef<AbortController | null>(null);
  const sessionBusy = useRef(false);
  const diagnosticPending = useRef(false);
  const configLoaded = useRef(false);
  const [planQuotes, setPlanQuotes] = useState<Record<string, Record<string, PlanQuote>>>({});
  const updatePlanQuote = (customerId: string, planId: string, changes: Partial<PlanQuote>) => {
    setPlanQuotes((previous) => ({ ...previous, [customerId]: { ...previous[customerId], [planId]: { ...previous[customerId]?.[planId], ...changes } } }));
  };

  const loadSensorConfig = useCallback(async () => {
    if (configLoaded.current) return;
    configLoaded.current = true;
    try {
      const response = await fetch(`${API_BASE}/sensor-config`);
      if (!response.ok) throw new Error('Device configuration unavailable');
      const config: SensorConfig = await response.json();
      setSensorConfig(config);
      if (!config.hardwareConfigured) setSensorMode('demo');
    } catch { configLoaded.current = false; setSensorMode('demo'); }
  }, []);

  const loadCustomers = useCallback(() => {
    setCustomersStatus('loading');
    api.getCustomers().then((items) => {
      setCustomers(items);
      setCustomersStatus(items.length ? 'done' : 'error');
    }).catch(() => setCustomersStatus('error'));
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clearTimers, []);
  useEffect(() => {
    const stop = () => { collector.current?.stop('cancelled'); diagnosticAbort.current?.abort(); };
    window.addEventListener('pagehide', stop);
    return () => { window.removeEventListener('pagehide', stop); token.current += 1; stop(); };
  }, []);

  const reset = () => {
    clearTimers();
    diagnosticAbort.current?.abort();
    collector.current.reset();
    sessionBusy.current = false;
    diagnosticPending.current = false;
    token.current += 1;
    setDiag({ status: 'idle', data: null, start: 0 });
    setViz({ status: 'idle', data: null });
    setLoc({ status: 'idle', places: [] });
    setLocFilter('all');
    setTab('home');
    setSelected(null);
    setHover(null);
    setClaim(null);
    setClaimForm(null);
    setClaimBusy(false);
    setClaimOpen(false);
    setView(null);
    setCurView('orbit');
    setAuto(true);
    setRepair(emptyRepairProgress());
  };

  const loadLocations = useCallback((currentToken: number, selectedCustomer: any) => {
    setLoc({ status: 'loading', places: [] });
    api.getServiceLocations(selectedCustomer.location, flagsRef.current).then((places) => {
      if (token.current !== currentToken) return;
      setLoc({ status: 'done', places });
    }).catch(() => {
      if (token.current !== currentToken) return;
      setLoc({ status: 'error', places: [] });
    });
  }, []);

  const runDiagnostic = useCallback(async (currentToken: number, selectedCustomer: any) => {
    if (diagnosticPending.current) return;
    diagnosticPending.current = true;
    const landCruiser = isLandCruiserProfile(selectedCustomer);
    if (landCruiser && !collector.current.snapshot.active) {
      collector.current.start(sensorModeRef.current, crypto.randomUUID());
      sessionBusy.current = true;
    }
    const scanId = collector.current.snapshot.scanId;
    diagnosticAbort.current?.abort();
    const abort = new AbortController(); diagnosticAbort.current = abort;
    setRepair(emptyRepairProgress());
    setDiag({ status: 'loading', data: null, start: performance.now() });
    try {
      const [data] = await Promise.all([
        api.postDiagnosticSession(selectedCustomer, flagsRef.current, landCruiser ? abort.signal : undefined),
        landCruiser ? collector.current.waitForCaptureWindow() : Promise.resolve(),
      ]);
      if (token.current !== currentToken) return;
      if (landCruiser && collector.current.snapshot.scanId === scanId) { collector.current.stop('completed'); sessionBusy.current = false; }
      setDiag({ status: 'done', data, start: 0 });
      setTab('diagnosis');
    } catch (error) {
      if (token.current !== currentToken) return;
      if (landCruiser && collector.current.snapshot.scanId === scanId) { collector.current.stop('error'); sessionBusy.current = false; }
      setDiag((previous) => ({ ...previous, status: 'error', error: error.message }));
    } finally {
      if (token.current === currentToken) diagnosticPending.current = false;
    }
  }, []);

  const loadViz = useCallback((currentToken: number, selectedCustomer: any) => {
    setViz({ status: 'loading', data: null });
    api.getVehicleVisualization(selectedCustomer, flagsRef.current).then((data) => {
      if (token.current !== currentToken) return;
      setViz({ status: 'done', data });
    }).catch((error) => {
      if (token.current !== currentToken) return;
      setViz({ status: 'error', data: null, error: error.message });
    });
  }, []);

  const startSession = (id: string) => {
    if (sessionBusy.current) return;
    const selectedCustomer = customers.find((item) => item.id === id);
    if (!selectedCustomer) return;
    reset();
    const currentToken = token.current;
    setCustomer(selectedCustomer);
    setScreen('wait');
    setWaitStep(0);
    if (isLandCruiserProfile(selectedCustomer)) {
      sessionBusy.current = true;
      collector.current.start(sensorModeRef.current, crypto.randomUUID());
    }
    timers.current = [
      setTimeout(() => setWaitStep(1), 1700),
      setTimeout(() => {
        setWaitStep(2);
        runDiagnostic(currentToken, selectedCustomer);
        loadViz(currentToken, selectedCustomer);
      }, 3700),
      setTimeout(() => setScreen('work'), 5200),
    ];
  };

  const newCustomer = () => { reset(); setScreen('select'); };
  const cancelScan = () => {
    if (!isLandCruiserProfile(customer)) return;
    clearTimers(); token.current += 1; diagnosticAbort.current?.abort();
    collector.current.stop('cancelled'); sessionBusy.current = false;
    diagnosticPending.current = false;
    setDiag({ status: 'error', data: null, start: 0, error: 'Vehicle scan cancelled. Sensor collection has stopped.' });
    if (screen === 'wait') setScreen('select');
  };
  const retryDiag = () => runDiagnostic(token.current, customer);
  const retryViz = () => loadViz(token.current, customer);
  const retryLoc = () => loadLocations(token.current, customer);

  const prepareClaim = () => {
    if (!diag.data || claimBusy) return;
    if (claim) { setClaimOpen(true); return; }
    setClaimBusy(true);
    const draft = { draftId: `CLM-${Date.now().toString().slice(-6)}`, status: 'draft' };
    timers.current.push(setTimeout(() => {
      setClaim(draft);
      setClaimForm(buildClaimForm(customer, diag.data, viz.data?.spec, draft));
      setClaimBusy(false);
      setClaimOpen(true);
    }, 700));
  };

  const fileClaim = () => {
    if (!claim || claim.status !== 'draft') return;
    setClaim({ ...claim, status: 'filing' });
    timers.current.push(setTimeout(() => {
      setClaim({ ...claim, status: 'filed', claimNumber: `TX-${Math.floor(100000 + Math.random() * 899999)}` });
      loadLocations(token.current, customer);
    }, 1400));
  };

  const pickView = (key: 'orbit' | 'front' | 'side' | 'top') => {
    if (key === 'orbit') {
      const next = !auto;
      setAuto(next);
      setCurView(next ? 'orbit' : '');
      return;
    }
    setAuto(false);
    setCurView(key);
    setView({ k: key, n: Date.now() });
  };
  const userMoved = useCallback(() => { setAuto(false); setCurView(''); }, []);

  const startRepair = () => {
    if (!guide) return;
    setAuto(false); setCurView(''); setSelected(null); setHover(null); setTab('diagnosis');
    setRepair((previous) => previous.finished
      ? { active: true, step: 0, checked: {}, finished: false, replay: previous.replay + 1 }
      : { ...previous, active: true, replay: previous.replay + 1 });
  };
  const pauseRepair = () => setRepair((previous) => ({ ...previous, active: false }));
  const toggleRepairCheck = (checkId: string) => {
    if (!guide || repair.finished) return;
    const step = guide.steps[repair.step];
    if (!step.checks.some((check) => check.id === checkId)) return;
    const key = checkKey(step.id, checkId);
    setRepair((previous) => ({ ...previous, checked: { ...previous.checked, [key]: !previous.checked[key] } }));
  };
  const nextRepairStep = () => {
    if (guide) setRepair((previous) => advanceRepair(guide, previous));
  };
  const previousRepairStep = () => setRepair((previous) => ({ ...previous, step: Math.max(0, previous.step - 1), finished: false }));
  const replayRepair = () => setRepair((previous) => ({ ...previous, replay: previous.replay + 1 }));

  return {
    screen, customers, customersStatus, loadCustomers, customer, waitStep, flags, setFlags,
    diag, viz, loc, locFilter, setLocFilter, tab, setTab, selected, setSelected,
    hover, setHover, claim, claimForm, setClaimForm, claimBusy, claimOpen, setClaimOpen,
    view, curView, auto, startSession, newCustomer, retryDiag, retryViz, retryLoc,
    prepareClaim, fileClaim, pickView, userMoved,
    guide, repair, startRepair, pauseRepair, toggleRepairCheck, nextRepairStep, previousRepairStep, replayRepair,
    sensor, sensorMode, setSensorMode, sensorConfig, loadSensorConfig, cancelScan,
    planQuotes, updatePlanQuote,
  };
}

export type Bay = ReturnType<typeof useBay>;
