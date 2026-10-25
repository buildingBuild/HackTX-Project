import assert from 'node:assert/strict';
import test from 'node:test';
import { comparePlanCost, moneyCents, planApplicability, TOYOTA_PLANS } from './protection';
const plan = (id: string) => TOYOTA_PLANS.find((item) => item.id === id)!;

test('no premium, coverage, or repair price is invented from a missing quote', () => {
  const result = comparePlanCost(plan('gold'), 'P0730', 420000, {});
  assert.equal(result.planCents, null); assert.equal(result.customerCents, null); assert.equal(result.combinedCents, null);
  assert.equal(comparePlanCost(plan('gold'), 'P0730', null, { assumeEligible: true, deductible: '0', price: '1200' }).customerCents, null);
});
test('VSA deductible and selling-dealer waiver affect only an assumed eligible visit', () => {
  const quote = { price: '1200', deductible: '100' as const, assumeEligible: true };
  const result = comparePlanCost(plan('gold'), 'P0730', 420000, quote);
  assert.equal(result.customerCents, 10000); assert.equal(result.benefitCents, 410000); assert.equal(result.combinedCents, 130000);
  assert.equal(comparePlanCost(plan('gold'), 'P0730', 420000, { ...quote, sellingDealer: true }).customerCents, 0);
  assert.equal(comparePlanCost(plan('gold'), 'P0730', 5000, quote).customerCents, 5000);
});
test('listed Platinum airbags do not imply collision coverage; battery/paint/filter exclusions remain explicit', () => {
  for (const issue of ['B1650', 'P0562', 'BODY-SCRATCH', 'MAINT-AIR-FILTER']) {
    assert.equal(planApplicability(plan('platinum'), issue).status, 'excluded');
    const result = comparePlanCost(plan('platinum'), issue, 22000, { price: '1000', deductible: '0', assumeEligible: true });
    assert.equal(result.customerCents, 22000); assert.equal(result.benefitCents, 0);
  }
});
test('tire hazards and scheduled maintenance are evaluated under their own product families', () => {
  assert.equal(planApplicability(plan('tire-gold'), 'TPMS-LOW-PRESSURE').status, 'potential');
  assert.equal(comparePlanCost(plan('tire-gold'), 'TPMS-LOW-PRESSURE', 26000, { price: '500', assumeEligible: true }).combinedCents, 50000);
  assert.equal(planApplicability(plan('service-care'), 'MAINT-OIL-LIFE').status, 'potential');
  assert.equal(planApplicability(plan('service-care'), 'MAINT-AIR-FILTER').status, 'uncertain');
  assert.equal(planApplicability(plan('powertrain'), 'C1391').status, 'excluded');
  assert.equal(planApplicability(plan('gold'), 'C1391').status, 'potential');
});
test('money inputs reject invalid/negative/oversized values and preserve cents', () => {
  assert.equal(moneyCents('13.25'), 1325); assert.equal(moneyCents('0'), 0);
  for (const input of ['', '-1', 'NaN', '1e3', '1.234', '1000001']) assert.equal(moneyCents(input), null);
  assert.throws(() => comparePlanCost(plan('gold'), 'P0730', -1, {}));
});
