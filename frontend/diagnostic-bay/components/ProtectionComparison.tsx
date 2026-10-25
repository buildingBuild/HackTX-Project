'use client';

import { useEffect, useRef, useState } from 'react';
import { comparePlanCost, moneyCents, PROTECTION_SOURCE, TOYOTA_PLANS, type PlanQuote } from '@/lib/protection';

type Props = { customer: any; quotes: Record<string, PlanQuote>; onQuote: (planId: string, changes: Partial<PlanQuote>) => void; compact?: boolean };
const amount = (cents: number | null) => cents == null ? 'Needs confirmation' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export default function ProtectionComparison({ customer, quotes, onQuote, compact = false }: Props) {
  const [repair, setRepair] = useState(customer.estimated_repair_cost == null ? '' : Number(customer.estimated_repair_cost).toFixed(2));
  const [family, setFamily] = useState('all');
  const repairCents = moneyCents(repair);
  return <section className={'plan-compare' + (compact ? ' compact' : '')} aria-label={`Toyota plan comparison for ${customer.name}`}>
    <div className="sec"><span className="pill">Toyota protection comparison</span><h2>{customer.name}&rsquo;s repair costs</h2><p>{customer.vehicle_model} · {customer.mileage.toLocaleString('en-US')} mi · {customer.issue_code}</p></div>
    <div className="plan-source-note">The supplied PDF describes protection products, not an auto-insurance policy. Its Gold/Platinum names do not replace this profile&rsquo;s separate demo {customer.insurance_level} policy. No enrollment or claim changes are made here.</div>
    <div className="plan-cost-input"><label>Repair/service estimate ($)<input inputMode="decimal" type="text" value={repair} placeholder="Enter an estimate" onChange={(event) => setRepair(event.target.value)} aria-invalid={!!repair && repairCents == null} /></label><small>{customer.estimated_repair_cost == null ? 'No price was prepared for this fixture. Enter a quote to model costs.' : 'Prefilled from this demo technician profile. Edit to model another estimate.'}</small>{repair && repairCents == null && <span role="alert">Use a nonnegative amount with up to two decimals, maximum $1,000,000.</span>}</div>
    <p className="note">The PDF supplies no plan prices (p. 28). Enter each dealer&rsquo;s total contract quote. The calculated total is that quote plus this one repair visit; it is not an annual premium or a prediction of future savings.</p>
    <div className="plan-filters" aria-label="Protection product type">{[['all', 'All plans'], ['vsa', 'Mechanical'], ['tire', 'Tire & wheel'], ['maintenance', 'Maintenance']].map(([id, label]) => <button className="chip" key={id} aria-pressed={family === id} onClick={() => setFamily(id)}>{label}</button>)}</div>
    <div className="plan-grid">{TOYOTA_PLANS.filter((plan) => family === 'all' || plan.family === family).map((plan) => {
      const quote = quotes[plan.id] || {};
      const result = comparePlanCost(plan, customer.issue_code, repairCents, quote);
      const excluded = result.applicability.status === 'excluded';
      return <article key={plan.id} className="plan-card">
        <header><h3>{plan.name}</h3><span className={'pill ' + (excluded ? '' : 'ok')}>{excluded ? 'Outside this benefit' : result.applicability.status === 'uncertain' ? 'Check agreement' : 'Potential fit'}</span></header>
        <p>{plan.summary}</p><p className="plan-fit">{result.applicability.reason}</p>
        <details><summary>Eligibility and source</summary><p>{plan.eligibility}</p><a href={`${PROTECTION_SOURCE}#page=${plan.pages[0]}`} target="_blank" rel="noopener noreferrer">Read supplied PDF · pp. {plan.pages.join(', ')}</a></details>
        <div className="plan-fields"><label>Total plan quote ($)<input type="text" inputMode="decimal" value={quote.price || ''} placeholder="Quote required" onChange={(event) => onQuote(plan.id, { price: event.target.value })} aria-invalid={!!quote.price && result.planCents == null} /></label>
        {plan.family === 'vsa' ? <label>Agreement deductible<select value={quote.deductible || ''} onChange={(event) => onQuote(plan.id, { deductible: event.target.value as PlanQuote['deductible'] })}><option value="">Confirm from agreement</option><option value="0">$0</option><option value="100">$100 disappearing</option></select></label> : <span className="note">{plan.family === 'tire' ? 'No deductible for an eligible covered tire/wheel claim.' : 'Model only a service confirmed as included in the active maintenance agreement.'}</span>}</div>
        {quote.price && result.planCents == null && <p className="plan-error" role="alert">Enter a valid plan quote with up to two decimals.</p>}
        {plan.family === 'vsa' && quote.deductible === '100' && <label className="plan-check"><input type="checkbox" checked={!!quote.sellingDealer} onChange={(event) => onQuote(plan.id, { sellingDealer: event.target.checked })} /><span>Covered repair performed by the selling dealer ($100 waived; p. 12)</span></label>}
        {!excluded && <label className="plan-check"><input type="checkbox" checked={!!quote.assumeEligible} onChange={(event) => onQuote(plan.id, { assumeEligible: event.target.checked })} /><span>Hypothetical: assume an active eligible agreement, this exact repair/service included, and required approval.</span></label>}
        <dl className="plan-results"><div><dt>You pay for this visit</dt><dd>{amount(result.customerCents)}</dd></div><div><dt>Modeled benefit</dt><dd>{amount(result.benefitCents)}</dd></div><div><dt>Plan quote + visit</dt><dd>{result.combinedCents == null ? 'Quote / coverage needed' : amount(result.combinedCents)}</dd></div></dl>
        <small>{excluded ? 'No benefit for this scenario is modeled under this product.' : 'Conditional arithmetic only. This is not confirmation of coverage or a claim payment.'}</small>
      </article>;
    })}</div>
    <p className="plan-source-note">Compiled October 24, 2026. The supplied extract is a summary, not a contract; page 28 records source conflicts. Actual agreement, eligibility, exclusions and approval control. <a href={PROTECTION_SOURCE} target="_blank" rel="noopener noreferrer">Read the supplied source PDF</a>.</p>
  </section>;
}

export function ProtectionDialog({ onClose, ...props }: Props & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  return <dialog className="protection-dialog" ref={dialog} aria-label="Compare Toyota protection plans" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="protection-dialog-body"><button className="btn protection-close" onClick={onClose}>Close comparison ×</button><ProtectionComparison {...props} /></div></dialog>;
}
