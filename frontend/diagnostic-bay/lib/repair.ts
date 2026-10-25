export type RepairAction = 'prepare' | 'open-hood' | 'open-box' | 'remove-filter' | 'fit-filter' | 'finish';
export function repairPointerFor(action: RepairAction): [number, number, number] | null {
  if (action === 'open-hood') return [1.18, 2.05, 0];
  if (action === 'open-box') return [2.65, 1.65, 0.1];
  if (action === 'remove-filter' || action === 'fit-filter') return [2.65, 1.5, 0.1];
  return null;
}
export type RepairStep = {
  id: string;
  title: string;
  instruction: string;
  narration: string;
  cue: string;
  caution?: string;
  model: 'base' | 'engine';
  action: RepairAction;
  checks: { id: string; label: string }[];
};
export type RepairGuide = {
  id: string;
  title: string;
  description: string;
  duration: string;
  supplies: string[];
  steps: RepairStep[];
};

export const LAND_CRUISER_MODELS = {
  base: '/models/land-cruiser-300.glb',
  engine: '/models/land-cruiser-300-open-hood.glb',
};

const AIR_FILTER_GUIDE: RepairGuide = {
  id: 'lc300-air-filter',
  title: 'A little care. A clearer intake.',
  description: 'Replace the engine air filter, one guided step at a time.',
  duration: 'About 15–20 min',
  supplies: ['Correct replacement filter', 'Clean, lint-free cloth', 'Your vehicle’s owner manual'],
  steps: [
    {
      id: 'prepare', title: 'Make the car ready', action: 'prepare', model: 'base',
      instruction: 'Park on level ground, select Park, set the parking brake, and switch off the engine. Let the engine cool. Confirm the replacement filter and procedure for your exact engine in the owner manual.',
      narration: 'First, make the car ready. Park on level ground, set the parking brake, switch the engine off, and let it cool. Have the correct replacement filter and your owner manual ready.',
      cue: 'Start with the engine off and cool',
      checks: [{ id: 'parked', label: 'Parked safely; engine off and cool' }, { id: 'supplies', label: 'Correct filter and owner manual ready' }],
    },
    {
      id: 'hood', title: 'Open and secure the hood', action: 'open-hood', model: 'engine',
      instruction: 'Use the hood release and secondary latch as described in your manual. Raise the hood and make sure it is securely supported before reaching into the engine bay.',
      narration: 'Release the hood, operate the secondary latch, and raise it. Make sure the hood is securely supported. The model now reveals the engine bay.',
      cue: 'Follow the arrow to the hood',
      caution: 'This supplied engine scan is illustrative. Confirm the real layout in your manual.',
      checks: [{ id: 'supported', label: 'Hood open and securely supported' }, { id: 'matched', label: 'Actual engine layout checked against my manual' }],
    },
    {
      id: 'housing', title: 'Find the air-cleaner housing', action: 'open-box', model: 'engine',
      instruction: 'Locate the air-cleaner housing using your manual. Gently release its clips or fasteners as specified and lift the cover only as far as the attached intake allows. Do not force the cover or disconnect sensors.',
      narration: 'Use your manual to find the air-cleaner housing. The floating animation shows the principle of opening the cover. Release the specified clips or fasteners gently. Do not force any connected hose or sensor.',
      cue: 'Air-cleaner cover · illustrative animation',
      caution: 'If the housing or fasteners differ, stop and follow the vehicle-specific procedure.',
      checks: [{ id: 'located', label: 'Correct air-cleaner housing identified' }, { id: 'released', label: 'Cover released without straining hoses or wiring' }],
    },
    {
      id: 'remove', title: 'Lift out the old filter', action: 'remove-filter', model: 'engine',
      instruction: 'Note how the filter is seated, then carefully lift it out. Keep loose dirt out of the intake. Remove loose debris from the housing with a clean cloth without pushing it into the intake.',
      narration: 'Note the filter orientation, then lift the old filter out as shown. Keep all loose dirt out of the intake. Carefully wipe loose debris from the housing. Never run the engine with the filter removed.',
      cue: 'Lift straight up · keep debris out',
      caution: 'Never start the engine while the air filter or housing cover is removed.',
      checks: [{ id: 'removed', label: 'Old filter removed; orientation noted' }, { id: 'clean', label: 'Housing clear of debris; intake protected' }],
    },
    {
      id: 'replace', title: 'Seat the new filter', action: 'fit-filter', model: 'engine',
      instruction: 'Compare the new filter with the old one. Install it in the specified orientation with its seal fully seated. Refit the cover and secure every clip or fastener according to the manual.',
      narration: 'Compare the replacement with the old filter. Lower the new filter into the housing and make sure its seal is seated all the way around. Refit the cover and secure all clips or fasteners.',
      cue: 'Lower into place · seat the entire seal',
      checks: [{ id: 'seated', label: 'Correct new filter seated evenly' }, { id: 'secured', label: 'Cover refitted; all clips or fasteners secured' }],
    },
    {
      id: 'finish', title: 'Close up and check', action: 'finish', model: 'base',
      instruction: 'Remove tools and cloths from the bay. Close and latch the hood using the manual’s procedure, then confirm it is secure. If the engine runs poorly or a warning persists afterward, arrange a technician inspection.',
      narration: 'Remove all tools and cloths. Close the hood as described in your manual and confirm that it is latched. Your checklist records the work you completed. If a warning persists or the engine runs poorly, have a technician inspect the vehicle.',
      cue: 'Tools out. Cover secure. Hood latched.',
      checks: [{ id: 'tools', label: 'All tools removed; hood securely latched' }, { id: 'reviewed', label: 'Final checks complete; I know when to seek service' }],
    },
  ],
};

export function repairGuideFor(vehicleModel: string, issueCode: string, severity: string): RepairGuide | null {
  return severity === 'low' && /land cruiser 300/i.test(vehicleModel) && issueCode === 'MAINT-AIR-FILTER'
    ? AIR_FILTER_GUIDE : null;
}

export const checkKey = (stepId: string, checkId: string) => `${stepId}:${checkId}`;
export const stepComplete = (step: RepairStep, checked: Record<string, boolean>) =>
  step.checks.every((check) => checked[checkKey(step.id, check.id)] === true);

export type RepairProgress = { active: boolean; step: number; checked: Record<string, boolean>; finished: boolean; replay: number };
export const emptyRepairProgress = (): RepairProgress => ({ active: false, step: 0, checked: {}, finished: false, replay: 0 });

export function advanceRepair(guide: RepairGuide, previous: RepairProgress): RepairProgress {
  if (!previous.active || previous.finished || !stepComplete(guide.steps[previous.step], previous.checked)) return previous;
  if (previous.step === guide.steps.length - 1) {
    return guide.steps.every((step) => stepComplete(step, previous.checked)) ? { ...previous, finished: true } : previous;
  }
  return { ...previous, step: previous.step + 1 };
}
