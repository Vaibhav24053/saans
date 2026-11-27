import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIndoorActions,
  formatCookingFuelLabel,
  getWindowGuidance,
} from '../shared/indoorCoach.ts';
import {
  buildDemoAirQualityData,
  DEMO_PERSONAS,
} from '../shared/demoScenarios.ts';
import type { AirQualityData, HouseholdProfile } from '../shared/types.ts';

function makeAirWithAqi(usAqi: number | null): AirQualityData {
  const base = buildDemoAirQualityData('moderate_haze');
  return {
    ...base,
    current: { ...base.current, usAqi },
  };
}

function makeProfile(overrides: Partial<HouseholdProfile> = {}): HouseholdProfile {
  const air = buildDemoAirQualityData('severe_winter_smog');
  return {
    ...DEMO_PERSONAS[0].profile,
    location: air.location,
    onboardingCompleted: true,
    ...overrides,
  };
}

describe('shared indoor coach domain logic', () => {
  it('formats all cooking fuel labels consistently', () => {
    assert.equal(formatCookingFuelLabel('lpg_gas'), 'LPG / gas');
    assert.equal(
      formatCookingFuelLabel('induction_electric'),
      'induction / electric',
    );
    assert.equal(formatCookingFuelLabel('mixed'), 'mixed');
  });

  it('computes accurate window guidance across US AQI severity boundaries and unavailable readings', () => {
    const good = getWindowGuidance(makeAirWithAqi(100));
    assert.equal(good.isElevated, false);
    assert.equal(good.isHigh, false);
    assert.match(good.headline, /15-minute indoor air refresh/i);

    const elevated = getWindowGuidance(makeAirWithAqi(101));
    assert.equal(elevated.isElevated, true);
    assert.equal(elevated.isHigh, false);
    assert.match(elevated.headline, /ventilate briefly/i);

    const stillElevated = getWindowGuidance(makeAirWithAqi(150));
    assert.equal(stillElevated.isHigh, false);

    const unhealthy = getWindowGuidance(makeAirWithAqi(151));
    assert.equal(unhealthy.isHigh, true);
    assert.match(unhealthy.headline, /Keep exterior windows closed/i);

    const unavailable = getWindowGuidance(makeAirWithAqi(null));
    assert.equal(unavailable.aqiAvailable, false);
    assert.equal(unavailable.isHigh, false);
    assert.equal(unavailable.categoryLabel, 'Unavailable');
  });

  it('adapts indoor recommendations for purifier availability, budget, cooking fuel, and children', () => {
    const highAir = makeAirWithAqi(220);

    const purifierProfile = makeProfile({
      hasAirPurifier: true,
      cookingFuel: 'induction_electric',
      children: 0,
    });
    const purifierActions = buildIndoorActions(purifierProfile, highAir);
    assert.equal(purifierActions.length, 6);
    assert.ok(purifierActions.some((a) => a.id === 'purifier' && a.costTag === 'Uses your gear'));
    const inductionCooking = purifierActions.find((a) => a.id === 'cooking');
    assert.ok(inductionCooking);
    assert.match(inductionCooking.title, /aerosols/i);

    const zeroCostFamily = makeProfile({
      hasAirPurifier: false,
      budgetPreference: 'zero_cost',
      cookingFuel: 'lpg_gas',
      children: 2,
    });
    const familyActions = buildIndoorActions(zeroCostFamily, highAir);
    const noPurifier = familyActions.find((a) => a.id === 'no_purifier');
    assert.ok(noPurifier);
    assert.equal(noPurifier.costTag, 'Zero cost');
    assert.match(noPurifier.guidance, /towel/i);

    const gasCooking = familyActions.find((a) => a.id === 'cooking');
    assert.ok(gasCooking);
    assert.match(gasCooking.title, /LPG\/gas/i);

    const kidsActivities = familyActions.find((a) => a.id === 'activities');
    assert.ok(kidsActivities);
    assert.match(kidsActivities.title, /children/i);
    assert.match(kidsActivities.relevance, /2 children/);
  });
});
