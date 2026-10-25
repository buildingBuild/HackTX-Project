import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRepairCost, repairCases } from './repair-data.ts';

test('assumed insurance and personal shares reconcile to the total', () => {
  assert.deepEqual(calculateRepairCost(360000, 50000, 100, 1000000), { total: 360000, eligibleAmount: 360000, insuranceShare: 310000, personalShare: 50000 });
  for (const total of [0, 20000, 360001, 440000]) for (const share of [0, 75, 100]) {
    const result = calculateRepairCost(total, 50000, share, 250000);
    assert.equal(result.insuranceShare + result.personalShare, total);
    assert.ok(result.insuranceShare >= 0 && result.personalShare >= 0);
    assert.ok(result.insuranceShare <= 250000);
  }
});

test('deductibles, excluded repairs, and payout limits affect personal cost', () => {
  assert.equal(calculateRepairCost(20000, 50000, 100, 1000000).insuranceShare, 0);
  assert.equal(calculateRepairCost(360000, 50000, 0, 1000000).personalShare, 360000);
  assert.equal(calculateRepairCost(360000, 50000, 75, 1000000).personalShare, 140000);
  assert.equal(calculateRepairCost(360000, 50000, 100, 100000).personalShare, 260000);
});

test('rejects invalid money and percentages rather than showing invalid estimates', () => {
  assert.throws(() => calculateRepairCost(-1, 50000, 100, 100000));
  assert.throws(() => calculateRepairCost(360000, NaN, 100, 100000));
  assert.throws(() => calculateRepairCost(360000, 50000, 101, 100000));
  assert.throws(() => calculateRepairCost(360000.5, 50000, 100, 100000));
});

test('repair examples cover all levels and their breakdowns match their estimates', () => {
  assert.deepEqual(repairCases.map(repair => repair.level), [1, 2, 3]);
  for (const repair of repairCases) {
    assert.equal(repair.parts + repair.labor + repair.assessment, repair.estimate);
    assert.ok(repair.low <= repair.estimate && repair.estimate <= repair.high);
  }
});
