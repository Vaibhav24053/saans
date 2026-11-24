import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCommuteImpact } from '../shared/emissions.ts';

describe('calculateCommuteImpact', () => {
  it('handles zero baseline (Work From Home vs Metro) without calculating a percentage increase', () => {
    const calc = calculateCommuteImpact('wfh', 'metro_rail', 6, 3);
    assert.equal(calc.baselineWeeklyKg, 0);
    assert.equal(calc.alternativeWeeklyKg, 0.76);
    assert.equal(calc.weeklySavedKg, -0.76);
    assert.equal(calc.changeDirection, 'higher');
    assert.equal(calc.percentChange, null);
    assert.equal(
      calc.comparisonLabel,
      '+0.76 kg CO₂e/week vs Work From Home baseline',
    );
    assert.ok(!calc.comparisonLabel.includes('%'));
  });

  it('handles zero baseline compared with another zero-emission mode (WFH vs Walk/Cycle)', () => {
    const calc = calculateCommuteImpact('wfh', 'walk_cycle', 6, 3);
    assert.equal(calc.baselineWeeklyKg, 0);
    assert.equal(calc.alternativeWeeklyKg, 0);
    assert.equal(calc.weeklySavedKg, 0);
    assert.equal(calc.changeDirection, 'same');
    assert.equal(calc.percentChange, null);
    assert.equal(calc.comparisonLabel, 'No change vs Work From Home baseline');
    assert.ok(!calc.comparisonLabel.includes('%'));
  });

  it('handles equal positive emissions (Petrol Car vs Petrol Car)', () => {
    const calc = calculateCommuteImpact('petrol_car_solo', 'petrol_car_solo', 10, 3);
    assert.equal(calc.baselineWeeklyKg, calc.alternativeWeeklyKg);
    assert.equal(calc.weeklySavedKg, 0);
    assert.equal(calc.changeDirection, 'same');
    assert.equal(calc.percentChange, 0);
    assert.equal(calc.comparisonLabel, 'No change');
  });

  it('calculates percentage reduction for lower emissions when both baseline and alternative are positive', () => {
    const calc = calculateCommuteImpact('petrol_car_solo', 'metro_rail', 10, 3);
    assert.equal(calc.baselineWeeklyKg, 9.72);
    assert.equal(calc.alternativeWeeklyKg, 1.26);
    assert.equal(calc.weeklySavedKg, 8.46);
    assert.equal(calc.changeDirection, 'lower');
    assert.equal(calc.percentChange, 87);
    assert.equal(calc.comparisonLabel, '87% lower');
  });

  it('calculates 100% lower when moving from a positive baseline to a zero-emission alternative', () => {
    const calc = calculateCommuteImpact('petrol_car_solo', 'wfh', 10, 3);
    assert.equal(calc.baselineWeeklyKg, 9.72);
    assert.equal(calc.alternativeWeeklyKg, 0);
    assert.equal(calc.changeDirection, 'lower');
    assert.equal(calc.percentChange, 100);
    assert.equal(calc.comparisonLabel, '100% lower');
  });

  it('calculates percentage increase for higher emissions when both baseline and alternative are positive', () => {
    const calc = calculateCommuteImpact('metro_rail', 'petrol_car_solo', 10, 3);
    assert.equal(calc.baselineWeeklyKg, 1.26);
    assert.equal(calc.alternativeWeeklyKg, 9.72);
    assert.equal(calc.weeklySavedKg, -8.46);
    assert.equal(calc.changeDirection, 'higher');
    assert.equal(calc.percentChange, 671);
    assert.equal(calc.comparisonLabel, '671% higher');
  });
});
