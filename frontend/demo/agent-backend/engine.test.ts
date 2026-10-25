import {test} from 'node:test';import assert from 'node:assert/strict';import{calculateOptions,evaluate}from './engine.ts';
test('installments reconcile including rounding',()=>{for(const amount of [100,80000,80101,500000]){for(const o of calculateOptions(amount,false))assert.equal(o.schedule.reduce((a,b)=>a+b,0),o.total);}});
test('wear items cannot use prepaid plan',()=>{assert.equal(evaluate('maria',58000,200).options[2].eligible,false);assert.equal(evaluate('james',32000,500).options[2].eligible,true);});
test('budget and mileage change the decision',()=>{assert.equal(evaluate('maria',58000,900).recommended,'pay');assert.equal(evaluate('maria',58000,200).recommended,'spread');assert.ok(evaluate('maria',60000,200).weeks<evaluate('maria',58000,200).weeks);});
test('symptoms override financing recommendations',()=>assert.equal(evaluate('maria',58000,900,undefined,true).recommended,null));
test('invalid inputs are rejected',()=>{assert.throws(()=>evaluate('unknown',1,1));assert.throws(()=>evaluate('maria',-1,200));assert.throws(()=>calculateOptions(NaN,false));});
test('covered plan recommendation uses coverage and price',()=>{const r=evaluate('james',32000,500,30000);assert.equal(r.recommended,'plan');assert.match(r.explanation,/prepaid plan/);assert.equal(evaluate('maria',58000,500,30000).recommended,'pay');});
test('low-budget scenario discloses shortfall',()=>{const r=evaluate('aisha',76000,80);assert.match(r.explanation,/exceeds your budget/);assert.equal(r.recommended,null);});
