import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAirCacheMatchingLocation,
  parseStoredAirCache,
  parseStoredChallengeProgress,
  parseStoredDemoState,
  parseStoredProfile,
  parseStoredStringArray,
  readStorageJson,
  writeStorageJson,
  type StorageLike,
} from '../src/utils/storage.ts';
import {
  buildDemoAirQualityData,
  DEMO_PERSONAS,
} from '../shared/demoScenarios.ts';
import type { HouseholdProfile } from '../shared/types.ts';

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
}

const DEFAULT_TEST_PROFILE: HouseholdProfile = {
  ...DEMO_PERSONAS[0].profile,
  location: {
    name: 'New Delhi',
    admin1: 'Delhi',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.209,
    timezone: 'Asia/Kolkata',
    source: 'geocoding',
  },
  onboardingCompleted: false,
};

describe('validated localStorage utility', () => {
  it('recovers safely from corrupted JSON, null values, and throwing storage', () => {
    const store = createMemoryStorage({
      corrupt: '{bad json',
      nullVal: 'null',
      wrongShape: '{"not":"an array"}',
    });

    assert.deepEqual(
      readStorageJson('corrupt', ['fallback'], parseStoredStringArray, store),
      ['fallback'],
    );
    assert.deepEqual(
      readStorageJson('nullVal', ['fallback'], parseStoredStringArray, store),
      ['fallback'],
    );
    assert.deepEqual(
      readStorageJson('wrongShape', ['fallback'], parseStoredStringArray, store),
      ['fallback'],
    );

    const throwingStore: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    assert.deepEqual(
      readStorageJson('k', ['safe'], parseStoredStringArray, throwingStore),
      ['safe'],
    );
    assert.equal(writeStorageJson('k', ['x'], throwingStore), false);
  });

  it('validates stored household profiles and rejects malformed or outdated fields', () => {
    const validMerged = parseStoredProfile(
      { householdName: 'Sharma Home', children: 2, onboardingCompleted: true },
      DEFAULT_TEST_PROFILE,
    );
    assert.ok(validMerged);
    assert.equal(validMerged.householdName, 'Sharma Home');
    assert.equal(validMerged.children, 2);
    assert.equal(validMerged.location.name, 'New Delhi');

    // Corrupted primitive, invalid enum, or wrong types must be rejected safely
    assert.equal(parseStoredProfile('not-an-object', DEFAULT_TEST_PROFILE), null);
    assert.equal(
      parseStoredProfile({ commuteType: 'teleportation' }, DEFAULT_TEST_PROFILE),
      null,
    );
    assert.equal(
      parseStoredProfile({ adults: 'two' }, DEFAULT_TEST_PROFILE),
      null,
    );
    assert.equal(
      parseStoredProfile({ location: { latitude: 999 } }, DEFAULT_TEST_PROFILE),
      null,
    );
  });

  it('validates demo state, indoor checklist arrays, and challenge progress safely', () => {
    assert.deepEqual(
      parseStoredDemoState({
        enabled: true,
        scenarioId: 'worsening_inversion',
        personaId: 'commuter_senior',
      }),
      {
        enabled: true,
        scenarioId: 'worsening_inversion',
        personaId: 'commuter_senior',
      },
    );
    assert.deepEqual(
      parseStoredDemoState({
        enabled: 1,
        scenarioId: 'removed_scenario',
        personaId: 'unknown',
      }),
      {
        enabled: true,
        scenarioId: 'severe_winter_smog',
        personaId: null,
      },
    );
    assert.equal(parseStoredDemoState(null), null);

    assert.deepEqual(parseStoredStringArray(['windows', 42, 'cooking']), [
      'windows',
      'cooking',
    ]);
    assert.equal(parseStoredStringArray({ a: 1 }), null);

    assert.deepEqual(
      parseStoredChallengeProgress({
        counts: { cleaner_commute: 2.9, bad: -5, nanVal: Number.NaN },
        streakWeeks: 3,
        lastLoggedDate: '2026-11-27',
      }),
      {
        counts: { cleaner_commute: 2 },
        streakWeeks: 3,
        lastLoggedDate: '2026-11-27',
      },
    );
    assert.equal(parseStoredChallengeProgress({ streakWeeks: 1 }), null);
  });

  it('validates offline air cache and verifies cached location matches active household location', () => {
    const delhiAir = buildDemoAirQualityData('severe_winter_smog');
    const parsed = parseStoredAirCache(delhiAir);
    assert.ok(parsed);
    assert.equal(parseStoredAirCache({ broken: true }), null);

    // Same city (within 0.1 deg) matches
    assert.equal(
      isAirCacheMatchingLocation(parsed, {
        ...delhiAir.location,
        latitude: delhiAir.location.latitude + 0.02,
        longitude: delhiAir.location.longitude - 0.02,
      }),
      true,
    );

    // Different city (Mumbai vs New Delhi) MUST NOT match
    assert.equal(
      isAirCacheMatchingLocation(parsed, {
        name: 'Mumbai',
        country: 'India',
        latitude: 19.076,
        longitude: 72.8777,
        timezone: 'Asia/Kolkata',
        source: 'geocoding',
      }),
      false,
    );
  });
});
