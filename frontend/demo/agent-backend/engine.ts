export const profiles = [
 {id:'maria',name:'Maria',initials:'MR',vehicle:'2021 Toyota RAV4',trim:'XLE · Hybrid',mileage:58000,monthlyMiles:850,budget:200,service:'Brake inspection',part:'brake service',low:65000,high:95000,weeks:6,covered:false,history:'No brake service in the available records',color:'#e7ddd0'},
 {id:'james',name:'James',initials:'JC',vehicle:'2022 Toyota Camry',trim:'SE · Gas',mileage:32000,monthlyMiles:650,budget:500,service:'Routine maintenance',part:'routine maintenance',low:18000,high:26000,weeks:10,covered:true,history:'Oil and filter service recorded at 27,000 miles',color:'#d9e4ed'},
 {id:'aisha',name:'Aisha',initials:'AK',vehicle:'2020 Toyota Corolla',trim:'LE · Gas',mileage:76000,monthlyMiles:1100,budget:80,service:'Tire inspection',part:'tire replacement',low:48000,high:72000,weeks:3,covered:false,history:'Tire replacement date is missing',color:'#e6dcef'}
];
export type Profile = typeof profiles[number];
export function calculateOptions(estimate:number,covered:boolean) {
 if(!Number.isSafeInteger(estimate)||estimate<100||estimate>500000) throw new Error('Estimate must be between $1 and $5,000.');
 const fee=2400,total=estimate+fee,base=Math.floor(total/6);
 return [
 {id:'pay',title:'Pay at service',total:estimate,fee:0,schedule:[estimate],eligible:true,reason:'One payment after your service.'},
 {id:'spread',title:'Spread the cost',total,fee,schedule:Array.from({length:6},(_,i)=>base+(i<total%6?1:0)),eligible:true,reason:'6 monthly payments. $24 fixed fee, no additional interest.'},
 {id:'plan',title:'Prepaid care',total:24000,fee:0,schedule:[24000],eligible:covered,reason:covered?'Illustrative plan covers this routine service only.':'Wear items are excluded from this demo plan.'}
 ];
}
export function evaluate(id:string,mileage:number,budget:number,estimate?:number,symptoms=false) {
 const p=profiles.find(p=>p.id===id); if(!p) throw new Error('Unknown profile.');
 if(!Number.isInteger(mileage)||mileage<0||mileage>500000||!Number.isFinite(budget)||budget<0||budget>10000) throw new Error('Invalid mileage or budget.');
 const cost=estimate??Math.round((p.low+p.high)/2),options=calculateOptions(cost,p.covered);
 const weeks=Math.max(1,Math.min(26,Math.round(p.weeks-(mileage-p.mileage)/Math.max(p.monthlyMiles/4,1))));
 const recommended=symptoms?null:p.covered&&budget*100>=24000&&24000<cost?'plan':budget*100>=cost?'pay':options[1].schedule[0]<=budget*100?'spread':null;
 const spread=options[1];
 const explanation=symptoms?'Arrange a prompt professional inspection. Payment preference should not delay assessment of braking, tire, or other safety symptoms.':recommended==='plan'?'The illustrative prepaid plan covers this routine service and costs less than the current service estimate. Confirm coverage and eligibility with your service team.':recommended==='pay'?`Your monthly service budget covers the estimated cost. Paying at service avoids the fixed installment fee.`:`Spreading the estimated cost preserves cash up front. ${spread.schedule[0]>budget*100?'The monthly payment still exceeds your budget; talk to a service advisor before choosing.':'The illustrated monthly payments fit your stated budget.'} Paying at service would save the $24 fee.`;
 return {profile:p,mileage,budget,cost,weeks,options,recommended,explanation,symptoms,confidence:'Limited history',assumption:'Inspection timing is a synthetic mileage-based scenario, not a diagnosis. Actual work and price require a professional inspection.'};
}
