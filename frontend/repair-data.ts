export type RepairLevel = 1 | 2 | 3;
export type RepairScreen = 'Overview' | 'Repair journey' | 'My vehicle' | 'Toyota coverage' | 'Prepared requests';
export type RepairCase = {
  id: string;
  level: RepairLevel;
  title: string;
  description: string;
  category: string;
  estimate: number;
  low: number;
  high: number;
  time: string;
  parts: number;
  labor: number;
  assessment: number;
};

export const repairLevels = [
  { level: 1 as const, title: 'Do it yourself', label: 'Minor repair', description: 'DIY guidance, with results from your existing SerpApi integration once connected.', action: 'Explore DIY guidance', support: 'SerpApi · integration pending' },
  { level: 2 as const, title: 'Bring in your agent', label: 'Agent-assisted repair', description: 'Agent-assisted repair information from your existing Snowflake integration once connected.', action: 'Explore agent assistance', support: 'Snowflake · integration pending' },
  { level: 3 as const, title: 'Plan with your coverage', label: 'Insurance & cost review', description: 'Bring Toyota insurance assumptions and repair costs together.', action: 'Explore insurance review', support: 'Policy & cost review' },
];

// Frontend examples for exploring the repair journey, not diagnostic results or quotes.
export const repairCases: RepairCase[] = [
  { id: 'wipers', level: 1, title: 'Worn wiper blades', description: 'The blades are leaving streaks. Explore a simple replacement using your vehicle’s owner instructions.', category: 'Visibility & upkeep', estimate: 4200, low: 2800, high: 5500, time: '20–30 min', parts: 4200, labor: 0, assessment: 0 },
  { id: 'mirror', level: 2, title: 'Damaged side mirror', description: 'The passenger-side mirror housing is damaged. An agent can help research a compatible part and repair options.', category: 'Exterior repair', estimate: 64000, low: 48000, high: 80000, time: 'Agent assessment', parts: 42000, labor: 19000, assessment: 3000 },
  { id: 'collision', level: 3, title: 'Front-end collision damage', description: 'Explore a professional repair assessment, policy review, and estimated personal cost under an assumed Toyota insurance policy.', category: 'Collision repair', estimate: 360000, low: 280000, high: 440000, time: 'Professional assessment', parts: 185000, labor: 150000, assessment: 25000 },
];

export const diySteps = [
  { title: 'Confirm the right replacement', detail: 'Check your owner’s manual for blade sizes, connector type, and the recommended replacement procedure.' },
  { title: 'Prepare your workspace', detail: 'Park securely, turn the vehicle off, and protect the windshield. Follow any model-specific service-position instructions.' },
  { title: 'Follow the owner instructions', detail: 'Use the specified release and fitting procedure. Avoid forcing the connector or letting a raised arm snap back.' },
  { title: 'Check the result', detail: 'Confirm the blades are secure and test as described in the manual. Stop and ask a professional if anything is unclear.' },
];

export const formatMoney = (cents: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0,
}).format(cents / 100);

export function calculateRepairCost(total: number, deductible: number, eligiblePercent: number, policyLimit: number) {
  if (![total, deductible, policyLimit].every(value => Number.isSafeInteger(value) && value >= 0)
    || !Number.isInteger(eligiblePercent) || eligiblePercent < 0 || eligiblePercent > 100) {
    throw new Error('Use nonnegative integer cents and a coverage percentage between 0 and 100.');
  }
  const eligibleAmount = Math.round(total * eligiblePercent / 100);
  const insuranceShare = Math.min(Math.max(eligibleAmount - deductible, 0), policyLimit);
  return { total, eligibleAmount, insuranceShare, personalShare: total - insuranceShare };
}
