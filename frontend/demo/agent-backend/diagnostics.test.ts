import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createScan,parseScanInput,estimateCosts} from './diagnostics.ts';
import {parseOffers,parseManuals,parseGuidance,researchRepair,safeWebUrl} from './repair-agent.ts';
import {extractAgentText,extractAgentStream,formatAgentBrief} from './snowflake-agent.ts';
const input={scenario:'routine',year:2022,mileage:58240,engine:'Unverified',laborRate:150,safetyConcern:false};

test('all three scan routes derive severity from the scenario, not a client level',()=>{
 for(const [scenario,level]of [['routine',1],['evap',2],['misfire',3]] as const){const report=createScan({...input,scenario,level:1});assert.equal(report.level,level);assert.equal(report.modules.length,8);}
 assert.equal(createScan(input).code,null,'maintenance reminder is not a fabricated OBD trouble code');
});
test('safety symptoms override routine care and add assessment / towing allowances',()=>{
 const report=createScan({...input,safetyConcern:true});assert.equal(report.level,3);assert.equal(report.estimate.towing.low,10000);assert.equal(report.estimate.diagnostic.low,12000);assert.equal(report.parts.length,0);assert.match(report.action,/override/);
});
test('input validation rejects missing flags, unsupported engines and invalid amounts',()=>{
 for(const update of [{scenario:'unknown'},{mileage:-1},{mileage:NaN},{laborRate:Infinity},{safetyConcern:'false'},{engine:'V8'},{scenario:'misfire',engine:'3.3 V6 diesel'}])assert.throws(()=>parseScanInput({...input,...update}));
});
test('itemized integer-cent totals reconcile and quantities apply to parts',()=>{
 const costs=estimateCosts([{quantity:6,low:899,high:1200}],[1.5,2],150,[9500,16000],[0,0]);
 assert.equal(costs.parts.low,5394);assert.equal(costs.labor.low,22500);
 for(const side of ['low','high'] as const)assert.equal(costs.total[side],costs.parts[side]+costs.labor[side]+costs.diagnostic[side]+costs.towing[side]);
});
test('part listings exclude other models, package quantities, used items and non-USD prices',()=>{
 const row={title:'Toyota Land Cruiser 300 ignition coil',product_link:'https://parts.example/coil',source:'Parts store',price:'$80.25',extracted_price:80.25};
 const results=parseOffers({shopping_results:[row,{...row,title:'Toyota Highlander ignition coil'},{...row,title:'Toyota Land Cruiser 200 ignition coil'},{...row,title:'Toyota LC300 ignition coil pack of 6'},{...row,price:'€80.25'},{...row,second_hand_condition:'used'},{...row,product_link:'javascript:alert(1)'},{...row,installment:{price:'$10'}}]},['ignition','coil'],{year:2022,engine:'Unverified'});
 assert.equal(results.length,1);assert.equal(results[0].priceCents,8025);
});
test('manual search excludes lookalike domains and AI summaries keep provenance separate',()=>{
 const refs=[{title:'Toyota manual',link:'https://www.toyota.com/manual'},{title:'Lookalike',link:'https://toyota.com.evil.example/manual'},{title:'Forum',link:'https://forum.example/manual'}];
 assert.equal(parseManuals({organic_results:refs}).length,1);
 const guidance=parseGuidance({reconstructed_markdown:'Read the manual',references:refs});assert.equal(guidance.references.length,1);assert.equal(guidance.text,'Read the manual');
 assert.equal(safeWebUrl('https://user:password@example.com'),null);
});
test('agent parsing never includes thinking blocks or duplicates completed text',()=>{
 assert.equal(extractAgentText({content:[{type:'thinking',text:'private reasoning'},{type:'text',text:'Final answer'}]}),'Final answer');
 const sse='event: response.thinking.delta\ndata: {"text":"private reasoning"}\n\nevent: response.text.delta\ndata: {"content_index":0,"text":"Answer"}\n\nevent: response.text\ndata: {"content_index":0,"text":"Answer complete"}\n\n';
 assert.equal(extractAgentStream(sse),'Answer complete');
 const brief=formatAgentBrief('```json\n{"summary":"Verify the manual","recommendations":["Ask a technician"],"safe_to_drive":true,"coverage_status":"covered"}\n```');
 assert.match(brief,/Ask a technician/);assert.doesNotMatch(brief,/safe_to_drive|coverage_status|covered/);
});
test('search failures retain labeled demo ranges rather than fabricating live prices',async()=>{
 const result=await researchRepair({...input,scenario:'evap'},{apiKey:'test-only',fetcher:async()=>{throw Error('Offline');}});
 assert.equal(result.mode,'partial');assert.equal(result.liveParts,0);assert.equal(result.parts[0].source,'demo-range');assert.deepEqual(result.estimate.total,createScan({...input,scenario:'evap'}).estimate.total);
});
test('the GLB has a closed initial hood and one-shot opening to the supplied open pose',()=>{
 const file=readFileSync(new URL('../../public/models/land-cruiser-300-animated.glb',import.meta.url));
 assert.equal(file.toString('ascii',0,4),'glTF');
 const length=file.readUInt32LE(12),doc=JSON.parse(file.toString('utf8',20,20+length));
 const animation=doc.animations.find((a:{name:string})=>a.name==='HoodOpen');assert.ok(animation);assert.equal(animation.channels.length,8);
 const nodes=doc.nodes.filter((n:{name:string})=>n.name.startsWith('Hood_Open_'));assert.equal(nodes.length,4);for(const n of nodes){assert.deepEqual(n.translation,[0,0,0]);assert.deepEqual(n.rotation,[0,0,0,1]);}
 const times=doc.accessors[animation.samplers[0].input];assert.equal(times.max[0],2.4);
});
