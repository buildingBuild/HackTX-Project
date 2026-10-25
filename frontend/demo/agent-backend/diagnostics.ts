import {randomUUID} from 'node:crypto';

export type Severity = 1 | 2 | 3;
export type ScanInput = {scenario: string; year: number; mileage: number; engine: string; laborRate: number; safetyConcern: boolean};
export const scanModules = [
  {id:'engine',name:'Engine & powertrain',source:'OBD simulation'},
  {id:'emissions',name:'Emissions & fuel',source:'OBD simulation'},
  {id:'transmission',name:'Transmission',source:'Extended module simulation'},
  {id:'electrical',name:'Electrical system',source:'Extended module simulation'},
  {id:'brakes',name:'Brakes & stability',source:'Extended module simulation'},
  {id:'safety',name:'Safety systems',source:'Extended module simulation'},
  {id:'body',name:'Body electronics',source:'Extended module simulation'},
  {id:'maintenance',name:'Maintenance reminders',source:'Service-history simulation'},
] as const;
export type Part = {id:string;name:string;quantity:number;low:number;high:number;terms:string[]};
export const diagnosticScenarios = [
  {id:'routine',label:'Routine-care reminder',level:1 as Severity,code:null,module:'maintenance',title:'Check the engine oil level',
    explanation:'No powertrain trouble code is stored in this scenario. A service-history reminder calls for a manual oil-level check; OBD does not measure the dipstick level.',
    action:'Follow the five-step oil-level walkthrough.',laborHours:[0,0.25],diagnostic:[0,0],tow:[0,0],
    parts:[] as Part[],nextSteps:['Match the owner’s manual to your vehicle and engine.','Check the oil level with the engine off and after the manual’s waiting time.','Use the guided model for orientation; verify the real dipstick location.'],
  },
  {id:'evap',label:'Steady check-engine light',level:2 as Severity,code:'P0442',module:'emissions',title:'EVAP small-leak fault',
    explanation:'The simulated code indicates an evaporative-emissions leak. A code identifies a diagnostic path; it does not prove which component failed.',
    action:'Arrange technician diagnosis before ordering parts.',laborHours:[1,2],diagnostic:[9500,16000],tow:[0,0],
    parts:[{id:'purge-valve',name:'EVAP purge valve',quantity:1,low:4500,high:18000,terms:['purge','valve']}],
    nextSteps:['Inspect the fuel cap, sealing surfaces and EVAP hoses using the matching manual.','Have a technician perform the prescribed leak / smoke test and circuit checks.','Replace a valve only if testing confirms it is the cause, then verify the repair.'],
  },
  {id:'misfire',label:'Flashing check-engine light',level:3 as Severity,code:'P0300',module:'engine',title:'Urgent misfire assessment',
    explanation:'A flashing check-engine light with a simulated random / multiple-cylinder misfire calls for urgent assessment. Coil and plug prices below are conditional planning items, not a confirmed diagnosis.',
    action:'Stop driving when safe. Arrange roadside assistance and professional diagnosis.',laborHours:[2,4],diagnostic:[12000,20000],tow:[10000,20000],
    parts:[{id:'ignition-coil',name:'Ignition coil',quantity:1,low:6000,high:16000,terms:['ignition','coil']},{id:'spark-plugs',name:'Spark plug (individual)',quantity:6,low:800,high:2000,terms:['spark','plug']}],
    nextSteps:['Stop the vehicle safely; avoid continuing with a flashing check-engine light.','Arrange a tow and obtain a written diagnostic report.','Check any active service agreement and obtain required authorization before repairs.'],
  },
] as const;

export function parseScanInput(input: unknown): ScanInput {
  if(!input || typeof input!=='object' || Array.isArray(input)) throw Error('A scan configuration is required.');
  const x=input as Record<string,unknown>;
  if(!diagnosticScenarios.some(s=>s.id===x.scenario)) throw Error('Choose a supported demo condition.');
  if(!Number.isInteger(x.year)||Number(x.year)<2008||Number(x.year)>2027) throw Error('Vehicle year must be between 2008 and 2027.');
  if(!Number.isInteger(x.mileage)||Number(x.mileage)<0||Number(x.mileage)>500000) throw Error('Mileage must be between 0 and 500,000.');
  if(!['Unverified','3.5 V6 petrol','3.3 V6 diesel'].includes(String(x.engine))) throw Error('Choose a supported engine.');
  if(x.engine==='3.3 V6 diesel'&&x.scenario!=='routine')throw Error('These powertrain demo codes model a petrol engine. Select a petrol / unverified engine, or use the routine-care scenario.');
  if(typeof x.laborRate!=='number'||!Number.isFinite(x.laborRate)||x.laborRate<50||x.laborRate>350) throw Error('Hourly labor rate must be between $50 and $350.');
  if(typeof x.safetyConcern!=='boolean') throw Error('Safety concern must be true or false.');
  return {scenario:String(x.scenario),year:Number(x.year),mileage:Number(x.mileage),engine:String(x.engine),laborRate:x.laborRate as number,safetyConcern:x.safetyConcern as boolean};
}

export function estimateCosts(parts: {quantity:number;low:number;high:number}[], hours:readonly number[], rate:number, diagnostic:readonly number[], tow:readonly number[]) {
  const partLow=parts.reduce((sum,p)=>sum+p.low*p.quantity,0),partHigh=parts.reduce((sum,p)=>sum+p.high*p.quantity,0);
  const laborLow=Math.round(hours[0]*rate*100),laborHigh=Math.round(hours[1]*rate*100);
  return {parts:{low:partLow,high:partHigh},labor:{low:laborLow,high:laborHigh,hours:[...hours],rate},diagnostic:{low:diagnostic[0],high:diagnostic[1]},towing:{low:tow[0],high:tow[1]},
    total:{low:partLow+laborLow+diagnostic[0]+tow[0],high:partHigh+laborHigh+diagnostic[1]+tow[1]},currency:'USD' as const,
    note:'Planning range for this demo scope, before tax and shipping. Parts and labor are conditional; diagnosis, fitment, local rates and final work can change the price. This is not a quote or a cost cap.'};
}

export function createScan(input:unknown) {
  const config=parseScanInput(input);
  const scenario=diagnosticScenarios.find(s=>s.id===config.scenario)!;
  const level:Severity=config.safetyConcern?3:scenario.level;
  const assessment=config.safetyConcern?diagnosticScenarios[2]:scenario;
  return {id:randomUUID(),createdAt:new Date().toISOString(),mode:'simulation' as const,config,vehicle:`${config.year} Toyota Land Cruiser 300`,
    level,title:config.safetyConcern?'Safety concern: professional assessment':scenario.title,
    code:scenario.code,explanation:scenario.explanation,
    action:config.safetyConcern?'Reported safety symptoms override the demo condition. Stop driving if unsafe and seek professional help.':scenario.action,
    modules:scanModules.map(m=>({...m,status:m.id===scenario.module?(level===3?'critical':'attention'):config.safetyConcern&&m.id==='safety'?'critical':'demo-clear'})),
    parts:scenario.parts.map(p=>({...p})),nextSteps:[...scenario.nextSteps],
    estimate:estimateCosts([...scenario.parts],config.safetyConcern?[0,0]:scenario.laborHours,config.laborRate,assessment.diagnostic,level===3?diagnosticScenarios[2].tow:scenario.tow),
    source:'Synthetic OBD and extended-module fixtures. No dongle, camera diagnosis, or live vehicle data is connected. Repair levels are app-defined, not OBD standards.'};
}
export type ScanReport=ReturnType<typeof createScan>;

export const claimsGuide={
  source:'/api/insurance/source/toyota',sourcePages:[11,12,14,26,31,32],
  officialUrl:'https://www.toyotafinancial.com/us/en/vehicle_protection_plan/how_to_file_a_claim.html',
  phone:'1-800-228-8559',phoneHref:'tel:+18002288559',
  note:'The uploaded document is an unofficial product summary, not your policy or proof of enrollment. Severity alone does not establish coverage.',
  steps:['Obtain a technician’s diagnosis and itemized estimate.','Confirm your active agreement, covered component, exclusions and deductible.','Ask your Toyota dealer / administrator for prior repair authorization.','Keep authorization, service records, estimates and receipts. Your dealer can submit eligible VSA repair claims.'],
  exclusions:'Routine wear and maintenance are generally outside standard VSA coverage. GAP addresses an eligible theft / accidental total-loss finance deficiency, not an ordinary engine repair.',
};
