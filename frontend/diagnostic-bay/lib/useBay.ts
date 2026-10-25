'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ViewRequest } from '@/components/CarCanvas';
import { api, money, OBD, partName, type Flags } from './api';

export type Tab = 'home' | 'vehicle' | 'diagnosis' | 'insurance' | 'nearby' | 'claim';
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
  const token = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  const reset = () => {
    clearTimers();
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

  const runDiagnostic = useCallback((currentToken: number, selectedCustomer: any) => {
    setDiag({ status: 'loading', data: null, start: performance.now() });
    api.postDiagnosticSession(selectedCustomer, flagsRef.current).then((data) => {
      if (token.current !== currentToken) return;
      setDiag({ status: 'done', data, start: 0 });
      setTab('diagnosis');
    }).catch((error) => {
      if (token.current !== currentToken) return;
      setDiag((previous) => ({ ...previous, status: 'error', error: error.message }));
    });
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
    const selectedCustomer = customers.find((item) => item.id === id);
    if (!selectedCustomer) return;
    reset();
    const currentToken = token.current;
    setCustomer(selectedCustomer);
    setScreen('wait');
    setWaitStep(0);
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

  return {
    screen, customers, customersStatus, loadCustomers, customer, waitStep, flags, setFlags,
    diag, viz, loc, locFilter, setLocFilter, tab, setTab, selected, setSelected,
    hover, setHover, claim, claimForm, setClaimForm, claimBusy, claimOpen, setClaimOpen,
    view, curView, auto, startSession, newCustomer, retryDiag, retryViz, retryLoc,
    prepareClaim, fileClaim, pickView, userMoved,
  };
}

export type Bay = ReturnType<typeof useBay>;
