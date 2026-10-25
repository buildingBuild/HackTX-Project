import { providers } from '../insurance-data/catalog.ts';
export const coverageLevels = {
 standard: {label:'100/300/100 · $500 collision / $500 comprehensive',description:'Bodily injury $100,000/person and $300,000/accident; property damage $100,000; collision and comprehensive deductibles $500 each.'},
 higher: {label:'250/500/100 · $500 collision / $500 comprehensive',description:'Bodily injury $250,000/person and $500,000/accident; property damage $100,000; collision and comprehensive deductibles $500 each.'},
 unknown: {label:'Other or not confirmed',description:'Limits or deductibles have not been standardized.'},
};
export type InsuranceQuote = {providerId:string;premiumCents:number;termMonths:1|6|12;coverage:keyof typeof coverageLevels};
export function compareQuotes(input:unknown) {
 if(!input||typeof input!=='object')throw new Error('Comparison input is required.');
 const {quotes,sameRiskConfirmed}=input as {quotes:unknown;sameRiskConfirmed:unknown};
 if(!Array.isArray(quotes)||quotes.length<2||quotes.length>3)throw new Error('Enter two or three insurer quotes.');
 if(typeof sameRiskConfirmed!=='boolean')throw new Error('Confirm whether the quotes describe the same risk.');
 const ids=new Set<string>();
 const normalized=quotes.map((value:unknown)=>{
  if(!value||typeof value!=='object')throw new Error('Each quote must be an object.');
  const q=value as InsuranceQuote;
  if(!providers.some(p=>p.id===q.providerId&&p.kind==='auto')||ids.has(q.providerId))throw new Error('Use distinct supported auto insurers; Toyota protection is a separate product.');
  ids.add(q.providerId);
  if(!Number.isSafeInteger(q.premiumCents)||q.premiumCents<100||q.premiumCents>10000000)throw new Error('Term premium must be between $1 and $100,000 in integer cents.');
  if(![1,6,12].includes(q.termMonths))throw new Error('Quote term must be 1, 6 or 12 months.');
  if(!Object.hasOwn(coverageLevels,q.coverage))throw new Error('Choose a valid coverage level.');
  return {providerId:q.providerId,premiumCents:q.premiumCents,termMonths:q.termMonths,coverage:q.coverage,annualizedCents:q.premiumCents*(12/q.termMonths)};
 });
 const matching=normalized.every(q=>q.coverage===normalized[0].coverage&&q.coverage!=='unknown');
 const comparable=matching&&sameRiskConfirmed;
 const min=Math.min(...normalized.map(q=>q.annualizedCents));
 return {comparable,reason:!matching?'Coverage limits or deductibles differ or are unconfirmed. Annualized amounts alone do not establish comparable value.':!sameRiskConfirmed?'Confirm the same drivers, vehicle, state, effective date, fees and all other coverages before comparing.':'Amounts annualized from your entries with matching selected limits and your confirmation of the same risk. This is not a renewal guarantee or policy recommendation.',quotes:normalized.map(q=>({...q,differenceCents:comparable?q.annualizedCents-min:null})),lowestProviderIds:comparable?normalized.filter(q=>q.annualizedCents===min).map(q=>q.providerId):[],source:'User-entered quotes; not verified by an insurer'};
}
