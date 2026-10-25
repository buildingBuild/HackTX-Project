import {createScan,diagnosticScenarios,estimateCosts,type ScanInput} from './diagnostics.ts';
import {consultSnowflake} from './snowflake-agent.ts';

type SearchRecord={title:string;url:string;snippet?:string};
export type PartOffer={title:string;url:string;merchant:string;priceCents:number};
export function safeWebUrl(value:unknown):string|null {
  try {const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;} catch{return null;}
}
export function parseOffers(data:unknown,terms:readonly string[],vehicle?:{year:number;engine:string}):PartOffer[] {
  const rows=(data as {shopping_results?:unknown[]})?.shopping_results;
  if(!Array.isArray(rows)) return [];
  return rows.flatMap(item=>{
    if(!item||typeof item!=='object')return [];
    const x=item as Record<string,unknown>,title=String(x.title??''),url=safeWebUrl(x.product_link??x.link);
    const price=Number(x.extracted_price),display=String(x.price??'');
    if(vehicle&&!/\b(?:lc[ -]?300|vja300|fja300)\b|\bland[ -]?cruiser\b.*\b300\b/i.test(title))return [];
    if(!url||!terms.every(t=>title.toLowerCase().includes(t))||!Number.isFinite(price)||price<=0||price>5000||!/^\$[\d,.]+$/.test(display)||x.installment||x.second_hand_condition||/\b(set|pack|kit|bundle|used|refurbished)\b/i.test(title))return [];
    return [{title:title.slice(0,220),url,merchant:String(x.source??'Merchant').slice(0,100),priceCents:Math.round(price*100)}];
  }).slice(0,Math.min(8,Math.max(1,Number(process.env.SERP_RESULTS_PER_PART)||4)));
}
export function parseManuals(data:unknown):SearchRecord[] {
  const rows=(data as {organic_results?:unknown[]})?.organic_results;
  if(!Array.isArray(rows))return [];
  const domains=['toyota.com','toyota.com.au','toyota.co.uk','toyota-europe.com','toyota.jp','static.nhtsa.gov'];
  return rows.flatMap(item=>{
    const x=item as Record<string,unknown>,url=safeWebUrl(x?.link);
    if(!url||!domains.some(d=>new URL(url).hostname===d||new URL(url).hostname.endsWith('.'+d)))return [];
    return [{title:String(x.title??'Manufacturer reference').slice(0,220),url,snippet:String(x.snippet??'').slice(0,450)}];
  }).slice(0,5);
}
// Adapted from Advaith_serp_api/serpAPI.py: google_ai_mode guidance and
// reconstructed_markdown / text_blocks extraction. Keep source verification
// separate from the generated summary; never label references as verified.
export function parseGuidance(data:unknown) {
  const value=data as {reconstructed_markdown?:unknown;text_blocks?:{snippet?:string}[];references?:{title?:string;link?:string;snippet?:string}[]};
  const text=typeof value?.reconstructed_markdown==='string'?value.reconstructed_markdown:Array.isArray(value?.text_blocks)?value.text_blocks.map(b=>b.snippet??'').join('\n'):'';
  return {text:text.slice(0,10000),references:parseManuals({organic_results:value?.references??[]})};
}
export async function researchRepair(input:unknown, options:{apiKey?:string;fetcher?:typeof fetch}={}) {
  const report=createScan(input),config=report.config,scenario=diagnosticScenarios.find(s=>s.id===config.scenario)!;
  const apiKey=options.apiKey??process.env.SERPAPI_API_KEY??process.env.SERPAPI_KEY;
  const fetcher=options.fetcher??fetch;
  const search=async(engine:string,q:string)=>{
    const url=new URL('https://serpapi.com/search.json');
    for(const [key,value]of Object.entries({engine,q,gl:'us',hl:'en',api_key:apiKey!}))url.searchParams.set(key,value);
    const response=await fetcher(url,{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Search provider unavailable.');
    const body=await response.json();
    if(body.error)throw Error('Search provider returned an error.');
    return body;
  };
  const fallbackManuals:SearchRecord[]=[{title:'Toyota owner’s manual finder — match year, market and engine',url:'https://www.toyota.com/owners/resources/warranty-owners-manuals/'},{title:'Toyota Technical Information System — workshop procedures / subscription may apply',url:'https://techinfo.toyota.com/'}];
  const tasks=apiKey?await Promise.allSettled([
    search('google',`Toyota Land Cruiser 300 ${config.year} ${config.engine==='Unverified'?'':config.engine} ${report.code??'engine oil level'} manual site:toyota.com.au OR site:toyota.com OR site:static.nhtsa.gov`),
    ...report.parts.map(p=>search('google_shopping',`"Toyota Land Cruiser 300" ${config.year} ${config.engine==='Unverified'?'':config.engine} ${p.name}`)),
    ...(report.level===1?[search('google_ai_mode',`Toyota Land Cruiser 300 ${config.year} ${config.engine==='Unverified'?'':config.engine} engine oil level check owner manual site:toyota.com.au OR site:toyota.com` )]:[]),
  ]):[];
  const manualTask=tasks[0],manualResults=manualTask?.status==='fulfilled'?parseManuals(manualTask.value):[];
  const parts=report.parts.map((part,i)=>{
    const task=tasks[i+1],offers=task?.status==='fulfilled'?parseOffers(task.value,part.terms,config):[];
    const prices=offers.map(o=>o.priceCents);
    return {...part,offers,low:prices.length?Math.min(...prices):part.low,high:prices.length?Math.max(...prices):part.high,source:prices.length?'search-listings' as const:'demo-range' as const,fitment:'Unverified — match VIN, engine, part number and package quantity before purchase.'};
  });
  const liveParts=parts.filter(p=>p.source==='search-listings').length;
  const guidanceTask=tasks[report.parts.length+1];
  return {scenario:config.scenario,level:report.level,researchedAt:new Date().toISOString(),
    mode:!apiKey?'demo':tasks.some(t=>t.status==='rejected')?'partial':'live-search',
    status:!apiKey?'SerpApi is not configured. Showing reference links and labeled demo prices.':tasks.some(t=>t.status==='rejected')?'Some searches failed; affected prices retain their demo range.':'Search completed. Listings are candidates; applicability still requires verification.',
    manuals:manualResults.length?manualResults:fallbackManuals,manualSource:manualResults.length?'search-results':'reference-links',parts,
    estimate:estimateCosts(parts,report.estimate.labor.hours,config.laborRate,[report.estimate.diagnostic.low,report.estimate.diagnostic.high],[report.estimate.towing.low,report.estimate.towing.high]),
    guidance:guidanceTask?.status==='fulfilled'?parseGuidance(guidanceTask.value):null,
    liveParts,agent:await consultSnowflake(report,fetcher,{manuals:manualResults,parts:parts.map(p=>({name:p.name,offers:p.offers}))}),steps:report.level===3?[report.action,...scenario.nextSteps]:[...scenario.nextSteps],
    boundary:'Research gathers manufacturer references and candidate part listings. It does not read a complete workshop manual, prove a failed part, verify fitment, or replace technician diagnosis. Labor, diagnostics and towing remain user-adjustable demo assumptions.'};
}
export type RepairResearch=Awaited<ReturnType<typeof researchRepair>>;
