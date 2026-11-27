import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateFallbackDailyPlan } from '../server/lib/fallbackEngine.ts';
import {
  buildDemoAirQualityData,
  DEMO_PERSONAS,
} from '../shared/demoScenarios.ts';
import {
  DailyPlanPayloadSchema,
  type CommuteType,
  type HouseholdProfile,
} from '../shared/types.ts';

function makeProfile(overrides: Partial<HouseholdProfile> = {}): HouseholdProfile {
  const baseAir = buildDemoAirQualityData('severe_winter_smog');
  return {
    ...DEMO_PERSONAS[0].profile,
    location: baseAir.location,
    onboardingCompleted: true,
    ...overrides,
  };
}

describe('personalisation on identical air-quality data', () => {
  it('generates distinctly tailored plans for different household personas on the exact same air data', () => {
    const air = buildDemoAirQualityData('severe_winter_smog');
    const plans = DEMO_PERSONAS.map((persona) =>
      generateFallbackDailyPlan(
        {
          ...persona.profile,
          location: air.location,
          onboardingCompleted: true,
        },
        air,
        'Test fallback',
        'missing_key',
      ),
    );

    for (const plan of plans) {
      const check = DailyPlanPayloadSchema.safeParse(plan);
      assert.equal(check.success, true, 'Generated plan must pass DailyPlanPayloadSchema');
    }

    const [youngFamily, commuterSenior, wfhCyclist] = plans;

    // Distinct morning commute recommendations
    assert.notEqual(youngFamily.blocks.morning[0].action, commuterSenior.blocks.morning[0].action);
    assert.notEqual(commuterSenior.blocks.morning[0].action, wfhCyclist.blocks.morning[0].action);

    // Distinct evening indoor recommendations (purifier vs no purifier)
    assert.notEqual(youngFamily.blocks.evening[1].title, commuterSenior.blocks.evening[1].title);
    assert.notEqual(youngFamily.blocks.evening[0].title, wfhCyclist.blocks.evening[0].title);
  });

  it('adapts guidance differently for households with children versus older adults', () => {
    const air = buildDemoAirQualityData('severe_winter_smog');

    const withChildren = makeProfile({
      adults: 2,
      children: 2,
      olderAdults: 0,
      hasAirPurifier: false,
      respiratorySensitivity: 'none',
    });
    const withOlderAdults = makeProfile({
      adults: 1,
      children: 0,
      olderAdults: 2,
      hasAirPurifier: false,
      respiratorySensitivity: 'none',
    });

    const childPlan = generateFallbackDailyPlan(withChildren, air, 'Test', 'missing_key');
    const seniorPlan = generateFallbackDailyPlan(withOlderAdults, air, 'Test', 'missing_key');

    assert.ok(
      childPlan.heroSummary.avoidToday.some((b) => /children/i.test(b)),
      'Children profile should highlight avoiding vigorous outdoor play for children',
    );
    assert.ok(
      seniorPlan.heroSummary.avoidToday.some((b) => /older adults/i.test(b)),
      'Older-adult profile should highlight avoiding extended outdoor walks for older adults',
    );
    assert.ok(
      !seniorPlan.heroSummary.avoidToday.some((b) => /children/i.test(b)),
      'Older-adult profile without children must not mention children play',
    );

    assert.match(childPlan.blocks.morning[1].action, /children/i);
    assert.match(seniorPlan.blocks.morning[1].action, /older adults/i);
    assert.match(childPlan.blocks.evening[1].action, /storytime|board games/i);
    assert.match(seniorPlan.blocks.evening[1].action, /older adults/i);
  });

  it('adapts indoor actions based on air purifier availability without pushing hardware', () => {
    const air = buildDemoAirQualityData('severe_winter_smog');

    const withPurifier = makeProfile({ hasAirPurifier: true, budgetPreference: 'moderate' });
    const withoutPurifier = makeProfile({ hasAirPurifier: false, budgetPreference: 'zero_cost' });

    const purifierPlan = generateFallbackDailyPlan(withPurifier, air, 'Test', 'missing_key');
    const noPurifierPlan = generateFallbackDailyPlan(withoutPurifier, air, 'Test', 'missing_key');

    // Purifier household gets HEPA guidance
    assert.match(purifierPlan.heroSummary.immediateAction, /air purifier/i);
    assert.ok(purifierPlan.heroSummary.prioritiseToday.some((b) => /HEPA/i.test(b)));
    assert.match(purifierPlan.blocks.evening[1].title, /HEPA/i);
    assert.ok(purifierPlan.blocks.evening[1].triggers.some((t) => /Air purifier available/i.test(t)));

    // Non-purifier household gets zero-cost practical steps
    assert.match(noPurifierPlan.heroSummary.immediateAction, /towel|windows/i);
    assert.ok(noPurifierPlan.heroSummary.prioritiseToday.some((b) => /damp-mop|windows/i.test(b)));
    assert.match(noPurifierPlan.blocks.evening[1].title, /Zero-cost/i);
    assert.ok(noPurifierPlan.blocks.evening[1].triggers.some((t) => /No air purifier/i.test(t)));
  });

  it('adapts commute recommendations and impact categories across all commute types', () => {
    const air = buildDemoAirQualityData('severe_winter_smog');
    const commuteTypes: CommuteType[] = [
      'car',
      'two_wheeler',
      'public_transport',
      'walking',
      'cycling',
      'wfh',
    ];

    const byCommute = new Map(
      commuteTypes.map((commuteType) => [
        commuteType,
        generateFallbackDailyPlan(
          makeProfile({ commuteType, commuteDistanceKm: 11 }),
          air,
          'Test',
          'missing_key',
        ),
      ]),
    );

    const carPlan = byCommute.get('car')!;
    const twoWheelerPlan = byCommute.get('two_wheeler')!;
    const publicTransitPlan = byCommute.get('public_transport')!;
    const cyclingPlan = byCommute.get('cycling')!;
    const walkingPlan = byCommute.get('walking')!;
    const wfhPlan = byCommute.get('wfh')!;

    assert.match(carPlan.blocks.morning[0].action, /recirculate/i);
    assert.equal(carPlan.blocks.morning[0].impactCategory, 'both');

    assert.match(twoWheelerPlan.blocks.morning[0].action, /N95/i);
    assert.equal(twoWheelerPlan.blocks.morning[0].impactCategory, 'both');

    assert.match(publicTransitPlan.blocks.morning[0].action, /metro|AC bus/i);
    assert.equal(publicTransitPlan.blocks.morning[0].impactCategory, 'personal_exposure');

    assert.match(cyclingPlan.blocks.morning[0].action, /Pause brisk outdoor/i);
    assert.match(walkingPlan.blocks.morning[0].action, /Pause brisk outdoor/i);

    assert.match(wfhPlan.blocks.morning[0].title, /workspace/i);
    assert.ok(
      wfhPlan.heroSummary.prioritiseToday.some((b) => /Batch essential outdoor errands/i.test(b)),
    );
  });

  it('adapts cooking guidance for LPG gas versus induction electric setups', () => {
    const air = buildDemoAirQualityData('moderate_haze');
    const gasPlan = generateFallbackDailyPlan(
      makeProfile({ cookingFuel: 'lpg_gas' }),
      air,
      'Test',
      'missing_key',
    );
    const inductionPlan = generateFallbackDailyPlan(
      makeProfile({ cookingFuel: 'induction_electric' }),
      air,
      'Test',
      'missing_key',
    );

    assert.match(gasPlan.blocks.evening[0].action, /exhaust fan|gas cooking/i);
    assert.match(inductionPlan.blocks.evening[0].action, /Close outside windows|pot lids/i);
    assert.notEqual(gasPlan.blocks.evening[0].title, inductionPlan.blocks.evening[0].title);
  });
});
