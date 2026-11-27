import {
  formatTimeRange,
  getUsAqiCategory,
  isValidAqiValue,
  POLLUTANT_META,
  US_AQI_THRESHOLDS,
  type AqiCategory,
  type PollutantMetadata,
} from '../../shared/aqi.js';
import type {
  AirQualityData,
  AskSaansResponse,
  CommuteType,
  DailyPlanResponse,
  FallbackCode,
  HouseholdProfile,
  PlanItem,
} from '../../shared/types.js';

interface FallbackContext {
  rawAqi: number | null;
  aqiAvailable: boolean;
  aqiDisplay: string;
  aqiTrigger: string;
  pm25: number | null;
  category: AqiCategory;
  locationName: string;
  dominantMeta: PollutantMetadata;
  trendDirection: 'improving' | 'stable' | 'worsening';
  trendNote: string;
  hasSensitiveGroup: boolean;
  severe: boolean;
  high: boolean;
  elevated: boolean;
  lowerWinText: string | null;
  lowerWinCompact: string | null;
  peakWinText: string | null;
  householdDesc: string;
  commuteLabel: string;
}

const COMMUTE_LABELS: Record<CommuteType, string> = {
  public_transport: 'public transport',
  car: 'private car',
  two_wheeler: 'two-wheeler',
  walking: 'walking commute',
  cycling: 'cycling commute',
  wfh: 'work-from-home routine',
};

function sanitizeNumericReading(val: number | null | undefined): number | null {
  return isValidAqiValue(val) ? val : null;
}

function describeHouseholdShort(profile: HouseholdProfile): string {
  const parts: string[] = [];
  if (profile.adults > 0) {
    parts.push(`${profile.adults} adult${profile.adults > 1 ? 's' : ''}`);
  }
  if (profile.children > 0) {
    parts.push(`${profile.children} child${profile.children > 1 ? 'ren' : ''}`);
  }
  if (profile.olderAdults > 0) {
    parts.push(
      `${profile.olderAdults} older adult${profile.olderAdults > 1 ? 's' : ''}`,
    );
  }
  return parts.length > 0 ? parts.join(', ') : 'your household';
}

function buildFallbackContext(
  profile: HouseholdProfile,
  air: AirQualityData,
): FallbackContext {
  const rawAqi = sanitizeNumericReading(air.current?.usAqi);
  const aqiAvailable = rawAqi !== null;
  const aqi = rawAqi ?? 0;
  const pm25 = sanitizeNumericReading(air.current?.pm25);
  const dominantKey = air.summary?.dominantPollutant;
  const dominantMeta =
    (dominantKey && POLLUTANT_META[dominantKey]) || POLLUTANT_META.pm25;

  const lowerWindow = air.summary?.lowerWindow ?? null;
  const peakWindow = air.summary?.peakWindow ?? null;

  return {
    rawAqi,
    aqiAvailable,
    aqiDisplay: aqiAvailable ? `${rawAqi} US AQI` : 'AQI currently unavailable',
    aqiTrigger: aqiAvailable
      ? `Current US AQI: ${rawAqi}`
      : 'Current US AQI: Unavailable',
    pm25,
    category: getUsAqiCategory(rawAqi),
    locationName: air.location?.name?.trim() || 'your area',
    dominantMeta,
    trendDirection: air.summary?.trendDirection ?? 'stable',
    trendNote:
      air.summary?.trendNote?.trim() ||
      'Modelled levels are expected to remain broadly steady over the next 6 hours.',
    hasSensitiveGroup:
      profile.children > 0 ||
      profile.olderAdults > 0 ||
      profile.respiratorySensitivity !== 'none',
    severe: aqiAvailable && aqi >= US_AQI_THRESHOLDS.VERY_UNHEALTHY,
    high: aqiAvailable && aqi >= US_AQI_THRESHOLDS.UNHEALTHY,
    elevated: aqiAvailable && aqi >= US_AQI_THRESHOLDS.ELEVATED,
    lowerWinText: lowerWindow
      ? `${formatTimeRange(lowerWindow.startTime, lowerWindow.endTime)} (forecast ~${lowerWindow.avgUsAqi} US AQI)`
      : null,
    lowerWinCompact: lowerWindow
      ? `${formatTimeRange(lowerWindow.startTime, lowerWindow.endTime)} (~${lowerWindow.avgUsAqi} US AQI)`
      : null,
    peakWinText: peakWindow
      ? `${formatTimeRange(peakWindow.startTime, peakWindow.endTime)} (forecast up to ~${peakWindow.peakUsAqi} US AQI)`
      : null,
    householdDesc: describeHouseholdShort(profile),
    commuteLabel: COMMUTE_LABELS[profile.commuteType],
  };
}

function buildPlanHeadline(ctx: FallbackContext): string {
  if (!ctx.aqiAvailable) {
    return `Live AQI is currently unavailable for ${ctx.locationName}: follow precautionary indoor habits until readings refresh.`;
  }
  if (ctx.severe) {
    return `Heavy ${ctx.dominantMeta.symbol} smog day in ${ctx.locationName}: protect indoor air and shift ${ctx.householdDesc}'s routines indoors.`;
  }
  if (ctx.high) {
    return `Unhealthy modelled air (${ctx.aqiDisplay}): adjust ${ctx.commuteLabel} timing and keep strenuous activity indoors.`;
  }
  if (ctx.elevated) {
    return `${ctx.category.shortLabel} air (${ctx.aqiDisplay}): plan outdoor time around lower-pollution windows for ${ctx.householdDesc}.`;
  }
  return `${ctx.category.label} modelled air (${ctx.aqiDisplay}): good opportunity for planned ventilation and cleaner commute habits.`;
}

function buildCurrentConditions(
  profile: HouseholdProfile,
  ctx: FallbackContext,
): string {
  if (!ctx.aqiAvailable) {
    return `Live modelled AQI readings for ${ctx.locationName} are temporarily unavailable, so SAANS is not estimating a numeric index. Until fresh environmental data loads, favour cautious indoor ventilation and lower-emission errands for ${ctx.householdDesc}.`;
  }

  const pm25Clause = ctx.pm25 !== null ? `, PM2.5 at ${ctx.pm25} µg/m³` : '';
  const sensitivityClause =
    profile.respiratorySensitivity !== 'none'
      ? ` with ${profile.respiratorySensitivity} respiratory sensitivity preference`
      : '';

  let adviceClause =
    'routine outdoor activities are broadly feasible while still avoiding heavy roadside traffic pockets.';
  if (ctx.high) {
    adviceClause =
      'keeping high-exertion activity indoors and sealing street-facing air leaks are the highest-leverage steps right now.';
  } else if (ctx.elevated) {
    adviceClause =
      'moderating prolonged outdoor exertion and choosing cleaner windows helps keep daily exposure lower.';
  }

  return `Modelled air quality in ${ctx.locationName} is ${ctx.category.label} (${ctx.aqiDisplay}${pm25Clause}), driven primarily by ${ctx.dominantMeta.symbol}. ${ctx.trendNote} For ${ctx.householdDesc}${sensitivityClause}, ${adviceClause}`;
}

function buildAvoidTodayList(
  profile: HouseholdProfile,
  ctx: FallbackContext,
): string[] {
  const avoidToday: string[] = [];

  if (ctx.high || (ctx.elevated && ctx.hasSensitiveGroup)) {
    if (profile.children > 0) {
      avoidToday.push(
        'Vigorous outdoor play or sports for children during peak pollution hours',
      );
    } else if (profile.olderAdults > 0) {
      avoidToday.push(
        'Extended early-morning or evening outdoor walks for older adults during peak pollution hours',
      );
    } else {
      avoidToday.push('High-exertion outdoor exercise near busy roads');
    }
  }

  const isOpenAirCommute =
    profile.commuteType === 'two_wheeler' ||
    profile.commuteType === 'cycling' ||
    profile.commuteType === 'walking';

  if (isOpenAirCommute) {
    avoidToday.push(
      ctx.high
        ? `Unmasked ${ctx.commuteLabel} along arterial traffic corridors`
        : 'Idling behind diesel buses or heavy traffic junctions during your commute',
    );
  } else if (profile.commuteType === 'car') {
    avoidToday.push(
      'Leaving car ventilation on fresh-air intake or idling in slow traffic queues',
    );
  }

  if (ctx.trendDirection === 'worsening' && ctx.peakWinText) {
    avoidToday.push(
      `Keeping windows open into the worsening ${ctx.peakWinText} window`,
    );
  } else if (ctx.high) {
    avoidToday.push(
      'Indoor smoke sources such as incense, dhoop, or unvented high-heat frying',
    );
  } else {
    avoidToday.push(
      'Unnecessary short vehicle trips that can be combined into one errand',
    );
  }

  return avoidToday.slice(0, 3);
}

function buildPrioritiseTodayList(
  profile: HouseholdProfile,
  ctx: FallbackContext,
): string[] {
  const prioritiseToday: string[] = [];

  if (profile.hasAirPurifier && ctx.elevated) {
    prioritiseToday.push(
      'Run your HEPA air purifier continuously in the main occupied room with doors and windows closed during high-AQI hours.',
    );
  } else if (!profile.hasAirPurifier && ctx.elevated) {
    prioritiseToday.push(
      'Keep street-facing windows shut during peak hours, damp-mop settled dust, and run kitchen exhaust while cooking.',
    );
  } else {
    prioritiseToday.push(
      'Refresh indoor rooms briefly during the relatively cleaner forecast window to clear stale indoor air.',
    );
  }

  if (profile.commuteType === 'car' || profile.commuteType === 'two_wheeler') {
    if (profile.sustainabilityFocus === 'low_emission_priority' || !ctx.severe) {
      prioritiseToday.push(
        `Swap today's ${profile.commuteDistanceKm} km ${ctx.commuteLabel} for metro/public transit or carpool if practical, or combine errands into one trip.`,
      );
    } else {
      const windowSuffix = ctx.lowerWinText ? ` closer to ${ctx.lowerWinText}` : '';
      prioritiseToday.push(
        `Plan a single consolidated trip${windowSuffix} and avoid engine idling.`,
      );
    }
  } else if (profile.commuteType === 'wfh') {
    prioritiseToday.push(
      'Batch essential outdoor errands into the relatively lower-pollution daytime window.',
    );
  } else {
    prioritiseToday.push(
      'Use quieter side streets or enclosed metro/AC transit coaches when available.',
    );
  }

  return prioritiseToday.slice(0, 3);
}

function buildImmediateAction(
  profile: HouseholdProfile,
  ctx: FallbackContext,
): string {
  if (ctx.severe) {
    return profile.hasAirPurifier
      ? 'Close outside windows now and switch your air purifier to medium-high in the primary family room.'
      : 'Close street-facing windows now, seal obvious door drafts with a rolled towel, and move planned outdoor activity indoors.';
  }
  if (ctx.trendDirection === 'worsening') {
    return 'Air quality is forecast to worsen later — complete any quick ventilation and essential outdoor errands earlier while levels are comparatively lower.';
  }
  if (ctx.elevated) {
    if (profile.commuteType === 'two_wheeler' || profile.commuteType === 'cycling') {
      return 'Pack a well-fitted N95 mask before heading out and switch high-effort workouts indoors.';
    }
    return 'Switch car AC to cabin recirculation or plan outdoor walks for the relatively lower forecast window.';
  }
  if (!ctx.aqiAvailable) {
    return 'Keep street-facing windows closed until fresh readings load, and avoid unnecessary indoor smoke sources.';
  }
  return 'Take advantage of moderate conditions for a 15-minute cross-ventilation refresh and plan one lower-emission errand or commute swap.';
}

function buildHeroSummary(
  profile: HouseholdProfile,
  ctx: FallbackContext,
): DailyPlanResponse['heroSummary'] {
  let bestLowerWindowNote =
    'Forecast hourly window data is limited; check updated readings before planning outdoor errands or ventilation.';
  if (ctx.lowerWinText) {
    bestLowerWindowNote = ctx.high
      ? `Forecast indicates a relatively lower-pollution window around ${ctx.lowerWinText}, though air remains elevated — not completely safe. Recheck live estimates before stepping out.`
      : `Forecast suggests a relatively lower-pollution period around ${ctx.lowerWinText}. Even during lower windows, conditions are modelled estimates rather than guaranteed safe.`;
  }

  return {
    currentConditions: buildCurrentConditions(profile, ctx),
    avoidToday: buildAvoidTodayList(profile, ctx),
    prioritiseToday: buildPrioritiseTodayList(profile, ctx),
    bestLowerWindowNote,
    immediateAction: buildImmediateAction(profile, ctx),
  };
}

function resolveMorningCommuteAction(
  commuteType: CommuteType,
  high: boolean,
): string {
  switch (commuteType) {
    case 'two_wheeler':
      return high
        ? 'Wear a snug-fitting N95 mask for your ride, or shift today’s trip to enclosed metro/bus or WFH if your schedule permits.'
        : 'Take less congested parallel lanes and keep an N95 mask handy for traffic bottlenecks.';
    case 'car':
      return high
        ? 'Keep car windows closed with cabin AC on recirculate (cracking briefly only on open stretches to prevent stuffiness), and carpool or take metro if available.'
        : 'Consider metro, bus, or carpooling for today’s commute and turn off the engine at long red lights.';
    case 'cycling':
    case 'walking':
      return high
        ? 'Pause brisk outdoor commuting during heavy pollution; use enclosed public transit or delay departure to a lower-AQI window.'
        : 'Choose tree-lined inner streets away from main arterial exhaust and pace exertion lightly.';
    case 'public_transport':
      return 'Prefer enclosed metro or AC bus coaches over open waiting stops along busy junctions, and wear an N95 mask if AQI exceeds 150.';
    case 'wfh':
      return 'Keep windows closed if early-morning inversion haze is visible outside, and check the midday forecast before airing out your room.';
  }
}

function resolveMorningActivityAction(
  profile: HouseholdProfile,
  ctx: FallbackContext,
): string {
  if (ctx.trendDirection === 'worsening' && !ctx.high) {
    return `Because air is forecast to worsen later (${ctx.trendNote.toLowerCase()}), do a brief 15-minute window refresh and finish quick outdoor errands before noon.`;
  }
  if (ctx.high || (ctx.elevated && ctx.hasSensitiveGroup)) {
    if (profile.children > 0) {
      return 'Move morning children’s play and family workouts indoors (stretching, indoor games) rather than exercising in early-morning smog.';
    }
    if (profile.olderAdults > 0) {
      return 'Swap early-morning outdoor walks for gentle indoor stretching or hallway mobility for older adults until midday air disperses.';
    }
    return 'Move morning workouts indoors (stretching, yoga, home cardio) rather than exercising in early-morning smog.';
  }
  return 'Light morning outdoor movement is reasonable; keep high-intensity cardio away from busy main roads.';
}

function buildMorningBlock(
  profile: HouseholdProfile,
  ctx: FallbackContext,
): PlanItem[] {
  const isPrivateMotor =
    profile.commuteType === 'car' || profile.commuteType === 'two_wheeler';
  const prefersMorning =
    profile.outdoorWindow === 'early_morning' ||
    profile.outdoorWindow === 'mid_morning';

  return [
    {
      id: 'm-commute',
      title:
        profile.commuteType === 'wfh'
          ? 'Morning indoor workspace setup'
          : `Adapt your morning ${ctx.commuteLabel}`,
      action: resolveMorningCommuteAction(profile.commuteType, ctx.high),
      whyRecommended: ctx.high
        ? `Morning traffic and cool boundary-layer air trap ${ctx.dominantMeta.symbol} near street level (currently ${ctx.aqiDisplay}).`
        : `Morning rush hour elevates roadside NO₂ and particulates even when regional AQI is ${ctx.category.shortLabel.toLowerCase()}.`,
      triggers: [
        `Commute: ${ctx.commuteLabel} (${profile.commuteDistanceKm} km)`,
        ctx.aqiTrigger,
        `Dominant pollutant: ${ctx.dominantMeta.symbol}`,
      ],
      expectedBenefit: isPrivateMotor
        ? 'Reduces personal rush-hour particulate inhalation and lowers tailpipe emissions when opting for shared or rail transit.'
        : 'Limits direct inhalation of fresh roadway exhaust during morning rush hours.',
      impactCategory: isPrivateMotor ? 'both' : 'personal_exposure',
      priority: ctx.high ? 'high' : 'medium',
      timeframe: '07:00 – 10:30',
    },
    {
      id: 'm-activity',
      title: prefersMorning
        ? 'Adjust your preferred morning outdoor time'
        : 'Morning home prep & ventilation check',
      action: resolveMorningActivityAction(profile, ctx),
      whyRecommended:
        ctx.trendDirection === 'worsening'
          ? 'Hourly forecast shows cleaner air earlier in the day before evening buildup.'
          : `Early morning temperatures often trap overnight ${ctx.dominantMeta.symbol} close to the ground.`,
      triggers: [
        `Preferred window: ${profile.outdoorWindow.replace('_', ' ')}`,
        `Household: ${ctx.householdDesc}`,
        `6h trend: ${ctx.trendDirection}`,
      ],
      expectedBenefit:
        'Prevents deep lung deposition of fine particles during elevated breathing rates.',
      impactCategory: 'personal_exposure',
      priority: ctx.high || ctx.trendDirection === 'worsening' ? 'high' : 'medium',
      timeframe: '06:30 – 10:00',
    },
  ];
}

function buildAfternoonBlock(
  profile: HouseholdProfile,
  ctx: FallbackContext,
): PlanItem[] {
  let windowAction =
    'Keep outdoor errands consolidated and brief while checking hourly updates before heading out.';
  if (ctx.lowerWinText) {
    windowAction = ctx.high
      ? `If essential outdoor errands cannot wait, schedule them near ${ctx.lowerWinText} and keep trips short; remember elevated air is still not completely safe.`
      : `Target ${ctx.lowerWinText} for errands, school pickup coordination, or a short 15–20 minute indoor air exchange.`;
  }

  const isPrivateMotor =
    profile.commuteType === 'car' || profile.commuteType === 'two_wheeler';

  return [
    {
      id: 'a-window',
      title: 'Use the forecast window thoughtfully',
      action: windowAction,
      whyRecommended:
        'Midday warming typically lifts the urban atmospheric boundary layer slightly, dispersing trapped morning particulates.',
      triggers: [
        ctx.lowerWinText ? `Relatively lower window: ${ctx.lowerWinText}` : ctx.aqiTrigger,
        `Home ventilation: ${profile.ventilationOption.replace('_', ' ')}`,
      ],
      expectedBenefit:
        'Shifts necessary outdoor exposure and indoor airing to comparatively cleaner hours of the day.',
      impactCategory: 'personal_exposure',
      priority: 'high',
      timeframe: '12:30 – 16:30',
    },
    {
      id: 'a-sustain',
      title: 'Batch errands into a single low-emission loop',
      action: isPrivateMotor
        ? 'Combine grocery, pharmacy, and household pickups into one planned loop — or walk locally only if AQI is moderate.'
        : 'Support local deliveries on consolidated schedules and avoid on-demand single-item vehicle trips when not urgent.',
      whyRecommended:
        'Short cold-start motor trips emit disproportionately more pollutants per kilometre and add unnecessary urban traffic.',
      triggers: [
        `Sustainability goal: ${profile.sustainabilityFocus.replace(/_/g, ' ')}`,
        `Budget preference: ${profile.budgetPreference.replace('_', ' ')}`,
      ],
      expectedBenefit:
        'Cuts avoidable transport emissions (note: individual actions reduce cumulative emissions rather than immediately changing city AQI).',
      impactCategory: 'wider_emissions',
      priority:
        profile.sustainabilityFocus === 'low_emission_priority' ? 'high' : 'medium',
      timeframe: '13:00 – 17:00',
    },
  ];
}

function buildEveningIndoorAction(profile: HouseholdProfile): string {
  if (profile.hasAirPurifier) {
    const priorityRoom =
      profile.olderAdults > 0 || profile.children > 0
        ? ' — prioritising rooms used by children or older adults.'
        : '.';
    return `Close bedroom doors and windows at least 45 minutes before bedtime and run your HEPA purifier on medium, then switch to sleep mode overnight${priorityRoom}`;
  }

  let eveningActivity = 'indoor mobility or reading';
  if (profile.children > 0) {
    eveningActivity = 'indoor storytime or board games';
  } else if (profile.olderAdults > 0) {
    eveningActivity = 'quiet indoor reading and low-draft bedroom prep for older adults';
  }
  return `Wet-wipe dusty sills and damp-mop floors instead of dry sweeping, seal noticeable window gaps before nightfall, and plan ${eveningActivity} instead of late-evening outdoor walks.`;
}

function buildEveningBlock(
  profile: HouseholdProfile,
  ctx: FallbackContext,
): PlanItem[] {
  const isInduction = profile.cookingFuel === 'induction_electric';
  const peakAhead = ctx.peakWinText ? ` ahead of ${ctx.peakWinText}` : '';

  return [
    {
      id: 'e-cooking',
      title: isInduction
        ? 'Keep evening indoor air sealed and low-particle'
        : 'Manage evening cooking emissions indoors',
      action: isInduction
        ? `Close outside windows before dusk${peakAhead}, use pot lids when simmering, and avoid burning candles or incense.`
        : 'Run the kitchen exhaust fan or chimney on medium-high throughout gas cooking, keep the kitchen door closed from bedrooms, and prefer steaming or lidded cooking over heavy frying.',
      whyRecommended: isInduction
        ? 'Evening inversions raise outdoor particulates while high-heat oil cooking can quickly spike indoor PM2.5.'
        : 'LPG/gas stoves generate indoor NO₂ and cooking oil aerosols that get trapped indoors when windows are shut against evening smog.',
      triggers: [
        `Cooking setup: ${profile.cookingFuel.replace('_', ' ')}`,
        `Home: ${profile.homeType.replace('_', ' ')}`,
        ctx.peakWinText ? `Peak window: ${ctx.peakWinText}` : ctx.aqiTrigger,
      ],
      expectedBenefit:
        'Prevents indoor PM2.5 and NO₂ spikes during dinner preparation while keeping outdoor smog outside.',
      impactCategory: 'personal_exposure',
      priority: 'high',
      timeframe: '18:00 – 21:30',
    },
    {
      id: 'e-indoor',
      title: profile.hasAirPurifier
        ? 'Overnight HEPA filtration & bedroom prep'
        : 'Zero-cost evening indoor air protection',
      action: buildEveningIndoorAction(profile),
      whyRecommended:
        'Overnight cooling often concentrates fine particulates outdoors; reducing indoor dust resuspension keeps sleeping air cleaner.',
      triggers: [
        profile.hasAirPurifier
          ? 'Air purifier available'
          : 'No air purifier (zero-cost focus)',
        `Household: ${ctx.householdDesc}`,
      ],
      expectedBenefit:
        'Lowers overnight particulate exposure in sleeping spaces without requiring unnecessary new purchases.',
      impactCategory: 'personal_exposure',
      priority: ctx.high || ctx.hasSensitiveGroup ? 'high' : 'medium',
      timeframe: '19:30 – 22:30',
    },
  ];
}

function buildTomorrowBlock(
  profile: HouseholdProfile,
  air: AirQualityData,
  ctx: FallbackContext,
): PlanItem[] {
  const tOutlook = air.summary?.tomorrowOutlook ?? null;

  let outlookTitle = 'Check updated morning forecast before stepping out';
  let outlookAction =
    'Review SAANS tomorrow morning before opening windows or departing for your commute.';

  if (tOutlook) {
    const dirLabel =
      tOutlook.directionVsToday === 'better'
        ? 'slightly easing'
        : tOutlook.directionVsToday === 'worse'
          ? 'heavier'
          : 'similar';
    outlookTitle = `Prepare for ${dirLabel} air tomorrow`;

    let prepStep =
      'Keep N95 masks by the door and confirm morning commute alternatives tonight.';
    if (tOutlook.avgUsAqi >= US_AQI_THRESHOLDS.UNHEALTHY) {
      prepStep =
        'Coordinate remote work, enclosed transit, or indoor school/play backup plans tonight.';
    } else if (tOutlook.directionVsToday === 'better') {
      prepStep =
        'Plan laundry airing, short home ventilation, or lighter outdoor activity for tomorrow’s relatively lower afternoon hours.';
    }
    outlookAction = `Tomorrow’s modelled US AQI ranges from ~${tOutlook.minUsAqi} to ~${tOutlook.maxUsAqi} (average ~${tOutlook.avgUsAqi}). ${prepStep}`;
  }

  let habitAction =
    'Pre-batch tomorrow’s errands and reduce standby appliance load overnight.';
  if (profile.commuteType === 'car') {
    habitAction =
      'Message a colleague or neighbour tonight to carpool tomorrow, or map a metro/bus route for at least one leg.';
  } else if (profile.commuteType === 'two_wheeler') {
    habitAction =
      'Check if tomorrow’s errands can be grouped with your main trip or shifted to public transit.';
  }

  return [
    {
      id: 't-outlook',
      title: outlookTitle,
      action: outlookAction,
      whyRecommended:
        'Preparing commute and family logistics the evening before makes lower-exposure and lower-emission choices much easier to follow.',
      triggers: [
        tOutlook
          ? `Tomorrow forecast: ${tOutlook.minUsAqi}–${tOutlook.maxUsAqi} US AQI`
          : 'Forecast horizon',
        `Commute: ${ctx.commuteLabel}`,
      ],
      expectedBenefit:
        'Helps your household avoid last-minute high-exposure rush trips and plan cleaner transport options ahead of time.',
      impactCategory: 'both',
      priority:
        tOutlook && tOutlook.avgUsAqi >= US_AQI_THRESHOLDS.UNHEALTHY
          ? 'high'
          : 'medium',
      timeframe: 'Tomorrow',
    },
    {
      id: 't-habit',
      title: 'Pre-commit one low-emission swap for tomorrow',
      action: habitAction,
      whyRecommended:
        'Pre-committing a cleaner routine the night before significantly increases follow-through compared to deciding in morning rush hour.',
      triggers: [
        `Sustainability preference: ${profile.sustainabilityFocus.replace(/_/g, ' ')}`,
      ],
      expectedBenefit:
        'Builds repeatable lower-emission household habits over weeks and months.',
      impactCategory: 'wider_emissions',
      priority: 'low',
      timeframe: 'Tonight → Tomorrow',
    },
  ];
}

export function generateFallbackDailyPlan(
  profile: HouseholdProfile,
  air: AirQualityData,
  fallbackReason: string,
  fallbackCode: FallbackCode = 'missing_key',
): DailyPlanResponse {
  const ctx = buildFallbackContext(profile, air);

  return {
    source: 'fallback',
    fallbackReason,
    fallbackCode,
    generatedAt: new Date().toISOString(),
    headline: buildPlanHeadline(ctx),
    heroSummary: buildHeroSummary(profile, ctx),
    blocks: {
      morning: buildMorningBlock(profile, ctx),
      afternoon: buildAfternoonBlock(profile, ctx),
      evening: buildEveningBlock(profile, ctx),
      tomorrow: buildTomorrowBlock(profile, air, ctx),
    },
    transparencyNote:
      'Generated by SAANS’s transparent rules-based engine from supplied modelled environmental data and your household preferences. Configure GEMINI_API_KEY on the server to enable generative Gemini 3.5 Flash-Lite planning.',
  };
}

type AskIntent =
  | 'outdoor_activity'
  | 'indoor_home'
  | 'commute'
  | 'forecast'
  | 'emissions'
  | 'general';

interface AskAnswerResult {
  answer: string;
  keyTakeaway: string;
  impactFraming: AskSaansResponse['impactFraming'];
}

const ASK_INTENT_KEYWORDS: ReadonlyArray<{
  intent: Exclude<AskIntent, 'general'>;
  keywords: readonly string[];
}> = [
  {
    intent: 'outdoor_activity',
    keywords: ['walk', 'run', 'exercise', 'park', 'child', 'outside'],
  },
  {
    intent: 'indoor_home',
    keywords: ['home', 'window', 'indoor', 'purifier', 'cook'],
  },
  {
    intent: 'commute',
    keywords: ['commute', 'office', 'drive', 'car', 'bike', 'bus', 'metro'],
  },
  {
    intent: 'forecast',
    keywords: ['tomorrow', 'forecast', 'later'],
  },
  {
    intent: 'emissions',
    keywords: ['footprint', 'emission', 'sustain', 'reduce', 'impact'],
  },
];

function detectAskIntent(question: string): AskIntent {
  const lower = question.toLowerCase();
  for (const rule of ASK_INTENT_KEYWORDS) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.intent;
    }
  }
  return 'general';
}

function answerOutdoorActivity(
  profile: HouseholdProfile,
  ctx: FallbackContext,
): AskAnswerResult {
  if (!ctx.aqiAvailable) {
    return {
      impactFraming: 'personal_exposure',
      answer: `Live modelled AQI readings for ${ctx.locationName} are currently unavailable, so SAANS cannot confirm outdoor air conditions right now. For ${ctx.householdDesc}, take a precautionary approach: keep vigorous exercise indoors or choose a brief, low-exertion walk away from busy roads only if visibility looks clear, and recheck once live readings refresh.`,
      keyTakeaway:
        'AQI is unavailable right now — take a precautionary approach and recheck live readings before vigorous outdoor exercise.',
    };
  }

  const pm25Part = ctx.pm25 !== null ? `, PM2.5 ${ctx.pm25} µg/m³` : '';

  if (ctx.high) {
    let activityPhrase = 'outdoor walking, running, or cardio';
    if (profile.children > 0) {
      activityPhrase = 'walking, running, or children’s active play';
    } else if (profile.olderAdults > 0) {
      activityPhrase = 'brisk walks and morning/evening outdoor strolls';
    }

    const windowParagraph = ctx.lowerWinCompact
      ? `Your forecast shows a relatively lower-pollution window around ${ctx.lowerWinCompact}, though air remains elevated (not completely safe). If you must step out briefly then, keep the pace gentle, avoid busy roads, and consider a well-fitted N95 mask.`
      : 'Check updated readings later in the afternoon before planning even brief outdoor errands.';

    return {
      impactFraming: 'personal_exposure',
      answer: `Right now in ${ctx.locationName}, modelled air quality is ${ctx.category.label} (${ctx.aqiDisplay}${pm25Part}), with ${ctx.dominantMeta.symbol} as the main concern. For ${ctx.householdDesc}, it is better to move ${activityPhrase} indoors today.\n\n${windowParagraph}`,
      keyTakeaway: ctx.lowerWinCompact
        ? `Move exercise indoors now; use ${ctx.lowerWinCompact} only for brief, low-exertion errands.`
        : 'Move exercise indoors now; wait for conditions to ease.',
    };
  }

  if (ctx.elevated) {
    const groupNote = ctx.hasSensitiveGroup
      ? 'Because your household includes children, older adults, or a respiratory sensitivity preference, keep outdoor walks short and gentle rather than vigorous.'
      : 'A light walk away from busy traffic corridors is workable, while intense cardio is better indoors.';
    const windowNote = ctx.lowerWinCompact
      ? `\n\nThe relatively lower-pollution forecast window is ${ctx.lowerWinCompact} — aiming your walk there reduces exposure compared to rush-hour peaks.`
      : '';

    return {
      impactFraming: 'personal_exposure',
      answer: `Modelled air in ${ctx.locationName} is currently ${ctx.category.label} (${ctx.aqiDisplay}). ${groupNote}${windowNote}`,
      keyTakeaway: ctx.lowerWinCompact
        ? `Keep outdoor activity light or shift to ${ctx.lowerWinCompact}.`
        : 'Prefer light walks on quieter streets over vigorous outdoor workouts.',
    };
  }

  return {
    impactFraming: 'personal_exposure',
    answer: `Modelled air quality in ${ctx.locationName} is currently ${ctx.category.label} (${ctx.aqiDisplay}${pm25Part}). This is a reasonable time for a walk or light outdoor activity, especially along quieter residential roads away from idling vehicles.\n\nRemember that Open-Meteo provides regional modelled estimates rather than street-level sensors, so if you notice visible dust or smoke nearby, cut the walk short.`,
    keyTakeaway:
      'Suitable for a walk on quieter streets; watch for localized dust or traffic smoke.',
  };
}

function answerIndoorHome(
  profile: HouseholdProfile,
  ctx: FallbackContext,
): AskAnswerResult {
  const needsSeal = ctx.high || !ctx.aqiAvailable;
  let windowGuidance =
    'Ventilate briefly during lower-traffic midday hours and close windows if haze increases.';
  if (needsSeal) {
    windowGuidance =
      'Keep exterior windows closed now, especially on street-facing sides. Only do a brief 10-minute air refresh if updated readings or the afternoon forecast ease noticeably.';
  } else if (ctx.lowerWinCompact) {
    windowGuidance = `Plan a short 15–20 minute cross-ventilation refresh around ${ctx.lowerWinCompact}, then close windows before evening pollution rises.`;
  }

  const cookingGuidance =
    profile.cookingFuel === 'induction_electric'
      ? 'Use lids when sautéing and avoid incense, dhoop, or scented candles.'
      : 'Run your kitchen exhaust fan while cooking with gas and close bedroom doors so cooking NO₂ and PM2.5 don’t spread.';

  const filtrationGuidance = profile.hasAirPurifier
    ? 'Run your HEPA purifier continuously in the main occupied room with doors shut.'
    : 'Damp-mop floors instead of dry sweeping and block visible door drafts with a cloth strip — practical zero-cost steps without needing new hardware.';

  return {
    impactFraming: 'personal_exposure',
    answer: `For your ${profile.homeType.replace('_', ' ')} (${
      profile.hasAirPurifier ? 'with an air purifier' : 'without an air purifier'
    }, ${profile.cookingFuel.replace('_', ' ')} cooking) under ${ctx.category.label} air (${ctx.aqiDisplay}):\n\n1. **Windows & Ventilation**: ${windowGuidance}\n2. **Cooking & Indoor Sources**: ${cookingGuidance}\n3. **Filtration & Dust**: ${filtrationGuidance}`,
    keyTakeaway: needsSeal
      ? 'Keep windows sealed, control cooking fumes, and protect sleeping rooms.'
      : 'Time brief ventilation to lower-AQI hours and minimize indoor smoke sources.',
  };
}

function answerCommute(
  profile: HouseholdProfile,
  ctx: FallbackContext,
): AskAnswerResult {
  const isOpenAir =
    profile.commuteType === 'two_wheeler' ||
    profile.commuteType === 'cycling' ||
    profile.commuteType === 'walking';

  let exposureLine =
    'Enclosed metro or AC bus coaches generally shield you better from street-level dust than open roadside waiting.';
  if (isOpenAir) {
    exposureLine = ctx.high
      ? 'Open-air commuting puts you directly in roadway particulate plumes. Switching to enclosed metro/AC bus today or wearing a well-fitted N95 mask significantly reduces what you breathe.'
      : 'Avoid tailgating diesel vehicles and take parallel residential roads where feasible.';
  } else if (profile.commuteType === 'car') {
    exposureLine =
      'Switch cabin AC to recirculation mode on congested stretches (briefly refreshing on clearer stretches to prevent CO₂ drowsiness).';
  }

  return {
    impactFraming: 'both',
    answer: `Looking at your **${ctx.commuteLabel}** (~${profile.commuteDistanceKm} km each way) and current ${ctx.category.label} air (${ctx.aqiDisplay}):\n\n- **Personal exposure**: ${exposureLine}\n- **Wider emissions**: Swapping even 1–2 solo motor trips a week to metro, bus, or a 3-person carpool meaningfully cuts transport CO₂e over time (use SAANS’s Impact Calculator for documented DESNZ/DEFRA estimates). Note that an individual commute shift reduces cumulative emissions rather than immediately changing city AQI.`,
    keyTakeaway:
      'Separate exposure protection (enclosed transit/N95/recirculate) from emissions impact (shared transit, batching trips, zero idling).',
  };
}

function answerForecast(
  air: AirQualityData,
  ctx: FallbackContext,
): AskAnswerResult {
  const t = air.summary?.tomorrowOutlook ?? null;
  if (!t) {
    return {
      impactFraming: 'personal_exposure',
      answer: `Your current 6-hour trend is **${ctx.trendDirection}** (${ctx.trendNote}). Full next-day hourly points are currently limited, so recheck SAANS tomorrow morning before setting your outdoor schedule.`,
      keyTakeaway: `Current 6h trend is ${ctx.trendDirection}; recheck in the morning.`,
    };
  }

  const prepGuidance =
    t.avgUsAqi >= US_AQI_THRESHOLDS.UNHEALTHY
      ? 'arranging indoor backup activities, checking N95 masks, and exploring enclosed transit or WFH options if possible.'
      : 'planning quick errands and short home ventilation for the relatively lower midday window.';

  return {
    impactFraming: 'personal_exposure',
    answer: `Tomorrow’s modelled forecast for ${ctx.locationName} shows US AQI between **${t.minUsAqi} and ${t.maxUsAqi}** (average ~${t.avgUsAqi}, which looks **${t.directionVsToday}** compared to today).\n\nTonight, you can prepare by ${prepGuidance} Always recheck live conditions in the morning because atmospheric models update as wind patterns shift.`,
    keyTakeaway: `Tomorrow averages ~${t.avgUsAqi} US AQI (${t.directionVsToday} vs today) — plan commute & indoor backups tonight.`,
  };
}

function answerEmissions(
  profile: HouseholdProfile,
  ctx: FallbackContext,
): AskAnswerResult {
  const vehicleWord = profile.commuteType === 'car' ? 'car' : 'motorised';
  return {
    impactFraming: 'wider_emissions',
    answer: `Practical low-emission shifts that fit ${ctx.householdDesc} (${ctx.commuteLabel}, ${profile.budgetPreference.replace('_', ' ')} budget):\n\n1. **Commute swaps**: Replacing even two weekly solo ${vehicleWord} trips with metro, bus, or carpooling cuts per-trip transport CO₂e substantially.\n2. **Combine errands & zero idling**: Batching stops reduces cold-start exhaust and cutting engine idling at signals avoids wasted fuel and street-level fumes.\n3. **Avoid open burning & peak energy waste**: Never burn dry leaves or household waste, and shift heavy appliances away from evening peak grid demand.\n\nTo be transparent: these actions lower cumulative greenhouse gas and urban emissions over time — they will not noticeably lower today’s neighborhood AQI on their own, which is why SAANS tracks exposure protection and emissions reduction separately.`,
    keyTakeaway:
      'Focus on commute mode swaps, batching errands, zero idling, and avoiding open burning — tracked separately from personal exposure protection.',
  };
}

function answerGeneral(
  profile: HouseholdProfile,
  ctx: FallbackContext,
): AskAnswerResult {
  const pm25Part = ctx.pm25 !== null ? `, PM2.5 ${ctx.pm25} µg/m³` : '';
  let exposureLine = 'Keep strenuous activity away from heavy traffic corridors.';
  if (ctx.high || !ctx.aqiAvailable) {
    exposureLine =
      'Prioritise indoor routines, keep outside windows shut, and use an N95 mask for essential outdoor trips.';
  } else if (ctx.lowerWinCompact) {
    exposureLine = `Schedule outdoor errands and brief ventilation around ${ctx.lowerWinCompact}.`;
  }

  return {
    impactFraming: 'both',
    answer: `In ${ctx.locationName}, modelled air quality is currently **${ctx.category.label}** (**${ctx.aqiDisplay}**${pm25Part}), with **${ctx.dominantMeta.symbol}** as the dominant pollutant. ${ctx.trendNote}\n\nFor ${ctx.householdDesc} (${ctx.commuteLabel}, ${
      profile.hasAirPurifier ? 'HEPA purifier available' : 'no air purifier'
    }):\n- **Personal exposure**: ${exposureLine}\n- **Wider emissions**: Batch errands into one trip, switch off engines while idling, and shift trips to public transit or carpooling when feasible.`,
    keyTakeaway: `${ctx.category.label} (${ctx.aqiDisplay}) driven by ${ctx.dominantMeta.symbol}; ${ctx.trendDirection} 6-hour trend.`,
  };
}

export function generateFallbackAskResponse(
  question: string,
  profile: HouseholdProfile,
  air: AirQualityData,
  fallbackReason: string,
  fallbackCode: FallbackCode = 'missing_key',
): AskSaansResponse {
  const ctx = buildFallbackContext(profile, air);
  const dataPointsUsed: string[] = [
    `Location: ${ctx.locationName} (${air.isDemo ? 'Demo scenario' : 'Open-Meteo CAMS model'})`,
    `Current US AQI: ${ctx.aqiAvailable ? ctx.rawAqi : 'Unavailable'} (${ctx.category.label})`,
    ...(ctx.pm25 !== null ? [`PM2.5: ${ctx.pm25} µg/m³`] : []),
    `Dominant pollutant: ${ctx.dominantMeta.symbol}`,
    `6h trend: ${ctx.trendDirection}`,
  ];

  const intent = detectAskIntent(question);
  const handlerMap: Record<AskIntent, () => AskAnswerResult> = {
    outdoor_activity: () => answerOutdoorActivity(profile, ctx),
    indoor_home: () => answerIndoorHome(profile, ctx),
    commute: () => answerCommute(profile, ctx),
    forecast: () => answerForecast(air, ctx),
    emissions: () => answerEmissions(profile, ctx),
    general: () => answerGeneral(profile, ctx),
  };
  const result = handlerMap[intent]();

  return {
    ...result,
    dataPointsUsed,
    followUpSuggestions: [
      'When is the best window to ventilate my home today?',
      'How should I adapt my commute right now?',
      'What should my family prepare for tomorrow?',
    ],
    source: 'fallback',
    fallbackReason,
    fallbackCode,
    generatedAt: new Date().toISOString(),
  };
}
