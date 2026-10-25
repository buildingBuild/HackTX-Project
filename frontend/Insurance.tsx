import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, ExternalLink, FileText, Info, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import type { insuranceCatalog } from './demo/insurance-data/catalog';
import type { compareQuotes, coverageLevels, InsuranceQuote } from './demo/agent-backend/insurance';
import './insurance.css';

type Catalog = typeof insuranceCatalog & { coverageLevels: typeof coverageLevels };
type Comparison = ReturnType<typeof compareQuotes>;
type QuoteEntry = { providerId: string; premium: string; term: string; coverage: keyof typeof coverageLevels };
const dollars = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
const initialEntries: QuoteEntry[] = [
  { providerId: 'geico', premium: '', term: '6', coverage: 'unknown' },
  { providerId: 'progressive', premium: '', term: '6', coverage: 'unknown' },
];

export default function Insurance() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [filter, setFilter] = useState<'all' | 'auto' | 'protection'>('all');
  const [entries, setEntries] = useState<QuoteEntry[]>(initialEntries);
  const [confirmed, setConfirmed] = useState(false);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError('');
    fetch('/api/insurance', { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Could not load insurance information.');
        return response.json();
      }).then(setCatalog)
      .catch(e => { if (e.name !== 'AbortError') setLoadError(e.message); });
    return () => controller.abort();
  }, [retry]);

  function updateEntry(index: number, changes: Partial<QuoteEntry>) {
    setEntries(current => current.map((entry, i) => i === index ? { ...entry, ...changes } : entry));
    setComparison(null); setError(''); setConfirmed(false);
  }

  async function compare(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setComparison(null);
    try {
      const quotes: InsuranceQuote[] = entries.map(entry => {
        if (!/^\d+(\.\d{1,2})?$/.test(entry.premium)) throw new Error('Enter each term premium in dollars, with up to two decimal places.');
        return { providerId: entry.providerId, premiumCents: Math.round(Number(entry.premium) * 100), termMonths: Number(entry.term) as 1 | 6 | 12, coverage: entry.coverage };
      });
      const response = await fetch('/api/insurance/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quotes, sameRiskConfirmed: confirmed }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not compare quotes.');
      setComparison(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not compare quotes.'); }
    finally { setBusy(false); }
  }

  if (loadError) return <div className="alert error" role="alert">{loadError}<button onClick={() => setRetry(value => value + 1)}>Try again</button></div>;
  if (!catalog) return <div className="loading" role="status">Loading protection sources…</div>;
  const autoProviders = catalog.providers.filter(provider => provider.kind === 'auto');

  return <div className="insurance-page">
    <section className="insurance-intro">
      <span className="insurance-hero-icon"><ShieldCheck size={30} /></span>
      <div><span className="eyebrow">KNOW WHAT PROTECTS YOU.</span><h2>Different products. Different jobs.</h2><p>Auto insurance covers policy-defined risks. Toyota’s protection products address specific repairs, maintenance or financial gaps. Keep both in view.</p></div>
      <span className="pill light">No invented premiums</span>
    </section>

    <div className="section-heading insurance-heading"><div><h2>Your protection landscape</h2><p>One source-backed Toyota guide. Three auto insurers to explore.</p></div><div className="insurance-filters" aria-label="Filter providers">{([['all', 'All providers'], ['auto', 'Auto insurance'], ['protection', 'Toyota protection']] as const).map(([value, label]) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'on' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
    <div className="provider-grid">{catalog.providers.filter(provider => filter === 'all' || provider.kind === filter).map(provider => <article className="provider-card" key={provider.id}>
      <div className="provider-top"><span className="provider-monogram" style={{ color: provider.color, background: `${provider.color}10` }}>{provider.initials}</span><span className={`pill ${provider.kind === 'auto' ? 'neutral' : 'recommended'}`}>{provider.status}</span></div>
      <span className="provider-kind">{provider.kind === 'auto' ? 'AUTO INSURANCE' : 'VEHICLE PROTECTION'}</span><h3>{provider.name}</h3><p>{provider.description}</p>
      <div className="provider-rate"><span>Premium / product price</span><strong>{provider.kind === 'auto' ? 'Get a personal quote' : 'Not in the document'}</strong></div>
      <p className="provider-status"><Info size={13} />{provider.coverageStatus}</p>
      <a href={provider.url} target="_blank" rel="noreferrer" className="external-link">{provider.kind === 'auto' ? 'Visit official insurer site' : 'Visit Toyota Financial Services'}<ArrowUpRight size={14} /></a>
    </article>)}</div>

    {filter !== 'auto' && <section className="toyota-section">
      <div className="section-heading"><div><span className="eyebrow">FROM YOUR UPLOADED DOCUMENT</span><h2>Toyota protection, unpacked.</h2><p>Read benefits alongside exclusions. Your signed agreement controls.</p></div><a className="button secondary" href={catalog.toyotaSource.url} target="_blank" rel="noreferrer"><FileText size={15} />Read source PDF<ExternalLink size={13} /></a></div>
      <div className="source-banner"><BookOpen size={20} /><div><strong>{catalog.toyotaSource.title}</strong><p>{catalog.toyotaSource.type} · compiled October 24, 2026 · 32 pages</p><p>{catalog.toyotaSource.note}</p></div></div>
      <div className="insurance-products">{catalog.toyotaProducts.map(product => <details className="protection-product" key={product.id}><summary><span className="product-mark"><ShieldCheck size={19} /></span><span><small>{product.category}</small><strong>{product.name}</strong></span><span className="source-page">pp. {product.pages.join(', ')}</span><ChevronDown size={16} /></summary><div className="product-content"><p>{product.summary}</p><div className="product-columns"><div><h4>What the extract says</h4><ul>{product.highlights.map(item => <li key={item}><Check size={14} />{item}</li>)}</ul></div><div><h4>Limits to know</h4><ul>{product.exclusions.map(item => <li key={item}><Info size={14} />{item}</li>)}</ul></div></div><div className="product-eligibility"><strong>Eligibility needs confirmation</strong><p>{product.eligibility}</p></div><a className="external-link" href={`${catalog.toyotaSource.url}#page=${product.pages[0]}`} target="_blank" rel="noreferrer">View cited pages in uploaded source<ExternalLink size={13} /></a></div></details>)}</div>
      <details className="source-conflicts"><summary><Info size={16} />Unresolved source differences<ChevronDown size={15} /></summary><p>The extract records disagreements; this app does not resolve them automatically.</p><ul>{catalog.conflicts.map(conflict => <li key={conflict}>{conflict}</li>)}</ul><a className="external-link" href={`${catalog.toyotaSource.url}#page=28`} target="_blank" rel="noreferrer">Read conflicts on page 28<ExternalLink size={13} /></a></details>
      <div className="maintenance-boundary"><Info size={18} /><p><strong>For your service plan:</strong> a brake or tire inspection does not establish replacement coverage. Standard VSA Platinum excludes listed brake wear items and tires; Tire & Wheel excludes normal wear. Separate VSA Lease Wear terms may differ. No uploaded document proves a persona has any active plan.</p></div>
    </section>}

    {filter !== 'protection' && <section className="quote-section">
      <div className="section-heading"><div><span className="eyebrow">COMPARE WHAT YOU ACTUALLY HAVE.</span><h2>Bring your quotes together.</h2><p>Enter insurer-provided quotes. No example prices are prefilled.</p></div><span className="pill neutral">Session only · not sent to insurers</span></div>
      <form className="quote-form panel" onSubmit={compare}>
        <div className="quote-explainer"><Info size={17} /><p>Use the total premium including all fees for the selected term. Annualized amounts assume the same rate repeats; future renewals may change. Other coverages, exclusions and payment discounts must also match for a meaningful comparison.</p></div>
        <fieldset disabled={busy} className="quote-fieldset"><legend className="sr-only">Insurer quotes</legend>{entries.map((entry, index) => <div className="quote-entry" key={index}><div className="quote-entry-header"><strong>Quote {index + 1}</strong>{entries.length > 2 && <button type="button" className="icon-button" aria-label={`Remove quote ${index + 1}`} onClick={() => { setEntries(entries.filter((_, i) => i !== index)); setComparison(null); setConfirmed(false); }}><Trash2 size={15} /></button>}</div><div className="quote-fields"><label>Insurer<select aria-label="Insurer" value={entry.providerId} onChange={e => updateEntry(index, { providerId: e.target.value })}>{autoProviders.map(provider => <option value={provider.id} key={provider.id}>{provider.name}</option>)}</select></label><label>Total term premium ($)<input type="number" inputMode="decimal" min="1" max="100000" step="0.01" required placeholder="Enter quoted amount" value={entry.premium} onChange={e => updateEntry(index, { premium: e.target.value })} /></label><label>Quote term<select aria-label="Quote term" value={entry.term} onChange={e => updateEntry(index, { term: e.target.value })}><option value="1">1 month</option><option value="6">6 months</option><option value="12">12 months</option></select></label><label className="coverage-field">Liability limits & deductibles<select aria-label="Liability limits & deductibles" value={entry.coverage} onChange={e => updateEntry(index, { coverage: e.target.value as QuoteEntry['coverage'] })}>{Object.entries(catalog.coverageLevels).map(([id, level]) => <option value={id} key={id}>{level.label}</option>)}</select></label></div><p className="coverage-description">{catalog.coverageLevels[entry.coverage].description}</p></div>)}</fieldset>
        <div className="quote-actions">{entries.length < 3 && <button className="button secondary" type="button" disabled={busy} onClick={() => { const available = autoProviders.find(provider => !entries.some(entry => entry.providerId === provider.id)); setEntries([...entries, { providerId: available?.id ?? 'statefarm', premium: '', term: '6', coverage: 'unknown' }]); setComparison(null); setConfirmed(false); }}><Plus size={15} />Add another insurer</button>}<span>Amounts you enter are not verified quotes.</span></div>
        <label className="quote-confirmation"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => { setConfirmed(e.target.checked); setComparison(null); }} /><span>I checked that these quotes use the same vehicle, drivers, state, effective date, fees and all other coverages. Selected limits and deductibles match the actual quotes.</span></label>
        {error && <div className="alert error" role="alert">{error}</div>}
        <button className="button primary" type="submit" disabled={busy}>{busy ? 'Comparing…' : 'Compare my quotes'}<ArrowRight size={16} /></button>
      </form>
      {comparison && <section className="comparison-results panel" aria-live="polite"><span className={`pill ${comparison.comparable ? 'recommended' : 'amber'}`}>{comparison.comparable ? 'Selected terms match' : 'Not an equivalent comparison'}</span><h3>{comparison.comparable ? 'Your annualized premium comparison' : 'Check the coverage before choosing'}</h3><p>{comparison.reason}</p><div className="comparison-table-wrap"><table><caption>User-entered amounts. Annualization is arithmetic, not a binding quote.</caption><thead><tr><th scope="col">Insurer</th><th scope="col">Quoted term total</th><th scope="col">Annualized</th><th scope="col">Difference from lowest</th></tr></thead><tbody>{comparison.quotes.map(quote => <tr key={quote.providerId}><th scope="row">{autoProviders.find(provider => provider.id === quote.providerId)?.name}{comparison.lowestProviderIds.includes(quote.providerId) && <span className="lowest-label">Lowest entered amount</span>}</th><td>{dollars(quote.premiumCents)} / {quote.termMonths} mo</td><td>{dollars(quote.annualizedCents)}</td><td>{quote.differenceCents === null ? 'Not comparable' : quote.differenceCents === 0 ? '—' : `+${dollars(quote.differenceCents)}`}</td></tr>)}</tbody></table></div><p className="comparison-source">{comparison.source}. No insurer is recommended and no purchase or application is submitted.</p></section>}
    </section>}
    <p className="insurance-footnote"><ShieldCheck size={15} />{catalog.boundary}</p>
  </div>;
}
