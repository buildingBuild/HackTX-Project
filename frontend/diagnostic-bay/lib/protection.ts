/** Terms transcribed from the supplied Toyota extract, not the app's separate
 * fictional Silver/Gold/Platinum auto-insurance policy or a current price quote. */
export const PROTECTION_SOURCE = '/docs/toyota-protection-source.pdf';
export type Plan = { id: string; name: string; family: 'vsa' | 'tire' | 'maintenance'; summary: string; pages: number[]; eligibility: string };
const vsaEligibility = 'New enrollment requires less than 3 years from first use and up to 36,000 miles; used plans have separate purchase-time rules. Current active coverage, state terms, and authorization must be confirmed.';
export const TOYOTA_PLANS: Plan[] = [
  { id: 'powertrain', name: 'VSA Powertrain', family: 'vsa', summary: 'Specified engine, transmission, axle and related components for eligible mechanical breakdowns.', pages: [11, 12, 27], eligibility: vsaEligibility },
  { id: 'gold', name: 'VSA Gold', family: 'vsa', summary: 'Mechanical breakdown protection covering more systems than Powertrain, including listed brake components.', pages: [11, 12, 25], eligibility: vsaEligibility },
  { id: 'platinum', name: 'VSA Platinum', family: 'vsa', summary: 'Broadest VSA component list. Batteries, filters, paint, tires and specified wear items remain excluded.', pages: [11, 12, 25, 26], eligibility: vsaEligibility },
  { id: 'tire-gold', name: 'Tire & Wheel Gold', family: 'tire', summary: 'Eligible tire road-hazard damage and associated wheel replacement. No deductible; wear and low-tread exclusions apply.', pages: [3, 4, 5], eligibility: 'Purchase/lease-time product. Confirm an active agreement, road-hazard cause, tread requirements and prior authorization.' },
  { id: 'tire-platinum', name: 'Tire & Wheel Platinum', family: 'tire', summary: 'Gold benefits plus eligible paintless dent and windshield repair. Paint repair and windshield replacement are not established by these benefits.', pages: [3, 6, 7], eligibility: 'Purchase/lease-time product, subject to state availability, qualifying damage, exclusions and authorization.' },
  { id: 'service-care', name: 'Toyota Service Care', family: 'maintenance', summary: 'Specified scheduled maintenance, including oil/filter service and inspections. Inspection is not replacement coverage.', pages: [15, 16, 17, 27], eligibility: 'Confirm the exact service schedule, expired ToyotaCare and no active prepaid maintenance plan. No age or mileage maximum is stated for Service Care.' },
];

export type Applicability = { status: 'potential' | 'excluded' | 'uncertain'; reason: string };
export function planApplicability(plan: Plan, issueCode: string): Applicability {
  if (issueCode === 'B1650') return { status: 'excluded', reason: 'This profile has collision-related SRS damage. The listed VSA mechanical-breakdown benefits, tire products and scheduled maintenance do not establish collision coverage; use its separate auto-insurance claim flow.' };
  if (plan.family === 'vsa') {
    if (issueCode === 'P0730') return { status: 'potential', reason: 'Transmission components are listed. An active eligible agreement, exact failed component, cause, warranty priority and approval still need confirmation.' };
    if (issueCode === 'C1391' && plan.id !== 'powertrain') return { status: 'potential', reason: 'Gold lists brake/traction actuator, pump and motor components; Platinum includes Gold. Match the exact failed assembly and agreement before assuming payment.' };
    return { status: 'excluded', reason: issueCode === 'C1391' ? 'Brake actuator repair is outside the listed Powertrain categories.' : 'Replacement batteries, paint/body finish, tires, filters and routine maintenance are not covered by the VSA benefits used here (pp. 25–27).' };
  }
  if (plan.family === 'tire') {
    if (issueCode === 'TPMS-LOW-PRESSURE') return { status: 'potential', reason: 'This fixture confirms a road-hazard puncture. Coverage still depends on the active agreement, tread depth, damage and authorization; a low-pressure code alone would not prove coverage.' };
    return { status: 'excluded', reason: issueCode === 'BODY-SCRATCH' ? 'Paintless dent repair does not establish paint/scratch repair. Optional cosmetic wheel repair applies to wheels, not this passenger door.' : 'This issue is not an eligible tire/wheel road-hazard repair or the listed Platinum dent/windshield benefit.' };
  }
  if (issueCode === 'MAINT-OIL-LIFE') return { status: 'potential', reason: 'Oil and filter service may be included when due under the vehicle maintenance guide and the active agreement.' };
  if (issueCode === 'MAINT-AIR-FILTER') return { status: 'uncertain', reason: 'The extract lists air-filter inspection and certain product/model-year replacement benefits. It does not establish that this 2022 Land Cruiser’s engine-filter replacement is included in Service Care.' };
  return { status: 'excluded', reason: 'Scheduled maintenance/inspection does not establish payment for this replacement or repair.' };
}

export type PlanQuote = { price?: string; deductible?: '' | '0' | '100'; sellingDealer?: boolean; assumeEligible?: boolean };
export function moneyCents(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const n = Math.round(Number(value) * 100);
  return Number.isSafeInteger(n) && n >= 0 && n <= 100_000_000 ? n : null;
}

export function comparePlanCost(plan: Plan, issueCode: string, repairCents: number | null, quote: PlanQuote) {
  const applicability = planApplicability(plan, issueCode);
  const planCents = quote.price ? moneyCents(quote.price) : null;
  if (repairCents != null && (!Number.isSafeInteger(repairCents) || repairCents < 0 || repairCents > 100_000_000)) throw new Error('Invalid repair amount');
  let customerCents: number | null = null, benefitCents: number | null = null;
  if (repairCents != null) {
    if (applicability.status === 'excluded') { customerCents = repairCents; benefitCents = 0; }
    else if (quote.assumeEligible && (plan.family !== 'vsa' || quote.deductible === '0' || quote.deductible === '100')) {
      const deductible = plan.family === 'vsa' && quote.deductible === '100' && !quote.sellingDealer ? 10_000 : 0;
      customerCents = Math.min(repairCents, deductible);
      benefitCents = repairCents - customerCents;
    }
  }
  return { applicability, planCents, customerCents, benefitCents, combinedCents: planCents != null && customerCents != null ? planCents + customerCents : null };
}
