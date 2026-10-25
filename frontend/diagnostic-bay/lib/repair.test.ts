import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceRepair, checkKey, emptyRepairProgress, LAND_CRUISER_MODELS, repairGuideFor, repairPointerFor, stepComplete } from './repair';

const vehicle = '2022 Toyota Land Cruiser 300 VX.R';
const guide = repairGuideFor(vehicle, 'MAINT-AIR-FILTER', 'low')!;

test('preparation and completion have no arrows; only a specific repair action gets a target', () => {
  assert.equal(repairPointerFor('prepare'), null);
  assert.equal(repairPointerFor('finish'), null);
  for (const action of ['open-hood', 'open-box', 'remove-filter', 'fit-filter'] as const) assert.ok(repairPointerFor(action));
});

test('only the known, low-severity maintenance issue gets the bundled walkthrough', () => {
  assert.ok(guide);
  assert.equal(repairGuideFor(vehicle, 'MAINT-AIR-FILTER', 'high'), null);
  assert.equal(repairGuideFor(vehicle, 'P0730', 'low'), null);
  assert.equal(repairGuideFor('2022 Toyota Camry LE', 'MAINT-AIR-FILTER', 'low'), null);
});

test('closed car comes first and last; only engine steps use the open-hood asset', () => {
  assert.equal(guide.steps[0].model, 'base');
  assert.equal(guide.steps.at(-1)!.model, 'base');
  assert.ok(guide.steps.slice(1, -1).every((step) => step.model === 'engine'));
  assert.notEqual(LAND_CRUISER_MODELS.base, LAND_CRUISER_MODELS.engine);
  assert.equal(guide.steps[1].action, 'open-hood');
});

test('unchecked or partially checked steps cannot advance, including rapid double advance', () => {
  let progress = { ...emptyRepairProgress(), active: true };
  assert.equal(advanceRepair(guide, progress), progress);
  const step = guide.steps[0];
  progress.checked[checkKey(step.id, step.checks[0].id)] = true;
  assert.equal(stepComplete(step, progress.checked), false);
  assert.equal(advanceRepair(guide, progress), progress);
  progress.checked[checkKey(step.id, step.checks[1].id)] = true;
  const next = advanceRepair(guide, progress);
  assert.equal(next.step, 1);
  assert.equal(advanceRepair(guide, next), next);
  assert.equal(progress.step, 0);
});

test('completion requires every check, and a finished walkthrough cannot advance', () => {
  let progress = { ...emptyRepairProgress(), active: true };
  for (const [index, step] of guide.steps.entries()) {
    assert.equal(progress.step, index);
    for (const check of step.checks) progress.checked[checkKey(step.id, check.id)] = true;
    progress = advanceRepair(guide, progress);
  }
  assert.equal(progress.finished, true);
  assert.equal(advanceRepair(guide, progress), progress);
  const missingFirstCheck = { ...progress, finished: false, checked: { ...progress.checked, [checkKey(guide.steps[0].id, guide.steps[0].checks[0].id)]: false } };
  assert.equal(advanceRepair(guide, missingFirstCheck).finished, false);
});

test('paused sessions cannot advance and new sessions get fresh checklists', () => {
  const first = emptyRepairProgress(), second = emptyRepairProgress();
  for (const check of guide.steps[0].checks) first.checked[checkKey(guide.steps[0].id, check.id)] = true;
  assert.equal(advanceRepair(guide, first), first);
  assert.deepEqual(second.checked, {});
});
