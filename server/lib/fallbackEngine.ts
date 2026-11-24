import {
  formatTimeRange,
  getUsAqiCategory,
  POLLUTANT_META,
} from '../../shared/aqi.js';
import type {
  AirQualityData,
  AskSaansResponse,
  DailyPlanResponse,
  FallbackCode,
  HouseholdProfile,
  PlanItem,
} from '../../shared/types.js';

function describeHouseholdShort(profile: HouseholdProfile): string {
  const parts: string[] = [];
  if (profile.adults > 0)
    parts.push(`${profile.adults} adult${profile.adults > 1 ? 's' : ''}`);
  if (profile.children > 0)
    parts.push(`${profile.children} child${profile.children > 1 ? 'ren' : ''}`);
  if (profile.olderAdults > 0)
    parts.push(
      `${profile.olderAdults} older adult${profile.olderAdults > 1 ? 's' : ''}`,
    );
  return parts.length > 0 ? parts.join(', ') : 'your household';
}

function getCommuteLabel(commute: HouseholdProfile['commuteType']): string {
  const map: Record<HouseholdProfile['commuteType'], string> = {
    public_transport: 'public transport',
    car: 'private car',
    two_wheeler: 'two-wheeler',
    walking: 'walking commute',
    cycling: 'cycling commute',
    wfh: 'work-from-home routine',
  };
  return map[commute];
}

export function generateFallbackDailyPlan(
  profile: HouseholdProfile,
  air: AirQualityData,
  fallbackReason: string,
  fallbackCode: FallbackCode = 'missing_key',
): DailyPlanResponse {
  const rawAqi = air.current.usAqi;
  const aqiAvailable = rawAqi !== null;
  const aqi = rawAqi ?? 0;
  const aqiDisplay = aqiAvailable ? `${rawAqi} US AQI` : 'AQI currently unavailable';
  const pm25 = air.current.pm25;
  const cat = getUsAqiCategory(rawAqi);
  const dominantMeta = POLLUTANT_META[air.summary.dominantPollutant];
  const hasSensitiveGroup =
    profile.children > 0 ||
    profile.olderAdults > 0 ||
    profile.respiratorySensitivity !== 'none';
  const severe = aqiAvailable && aqi >= 200;
  const high = aqiAvailable && aqi >= 151;
  const elevated = aqiAvailable && aqi >= 101;
  const lowerWinText = air.summary.lowerWindow
    ? `${formatTimeRange(
        air.summary.lowerWindow.startTime,
        air.summary.lowerWindow.endTime,
      )} (forecast ~${air.summary.lowerWindow.avgUsAqi} US AQI)`
    : null;
  const peakWinText = air.summary.peakWindow
    ? `${formatTimeRange(
        air.summary.peakWindow.startTime,
        air.summary.peakWindow.endTime,
      )} (forecast up to ~${air.summary.peakWindow.peakUsAqi} US AQI)`
    : null;

  const householdDesc = describeHouseholdShort(profile);
  const commuteLabel = getCommuteLabel(profile.commuteType);

  // Headline
  const headline = !aqiAvailable
    ? `Live AQI is currently unavailable for ${air.location.name}: follow precautionary indoor habits until readings refresh.`
    : severe
      ? `Heavy ${dominantMeta.symbol} smog day in ${air.location.name}: protect indoor air and shift ${householdDesc}'s routines indoors.`
      : high
        ? `Unhealthy modelled air (${aqiDisplay}): adjust ${commuteLabel} timing and keep strenuous activity indoors.`
        : elevated
          ? `${cat.shortLabel} air (${aqiDisplay}): plan outdoor time around lower-pollution windows for ${householdDesc}.`
          : `${cat.label} modelled air (${aqiDisplay}): good opportunity for planned ventilation and cleaner commute habits.`;

  // Hero summary
  const currentConditions = !aqiAvailable
    ? `Live modelled AQI readings for ${air.location.name} are temporarily unavailable, so SAANS is not estimating a numeric index. Until fresh environmental data loads, favour cautious indoor ventilation and lower-emission errands for ${householdDesc}.`
    : `Modelled air quality in ${air.location.name} is ${cat.label} (${aqiDisplay}${
        pm25 !== null ? `, PM2.5 at ${pm25} µg/m³` : ''
      }), driven primarily by ${dominantMeta.symbol}. ${air.summary.trendNote} For ${householdDesc}${
        profile.respiratorySensitivity !== 'none'
          ? ` with ${profile.respiratorySensitivity} respiratory sensitivity preference`
          : ''
      }, ${
        high
          ? 'keeping high-exertion activity indoors and sealing street-facing air leaks are the highest-leverage steps right now.'
          : elevated
            ? 'moderating prolonged outdoor exertion and choosing cleaner windows helps keep daily exposure lower.'
            : 'routine outdoor activities are broadly feasible while still avoiding heavy roadside traffic pockets.'
      }`;

  const avoidToday: string[] = [];
  if (high || (elevated && hasSensitiveGroup)) {
    avoidToday.push(
      profile.children > 0
        ? 'Vigorous outdoor play or sports for children during peak pollution hours'
        : 'High-exertion outdoor exercise near busy roads',
    );
  }
  if (profile.commuteType === 'two_wheeler' || profile.commuteType === 'cycling' || profile.commuteType === 'walking') {
    avoidToday.push(
      high
        ? `Unmasked ${commuteLabel} along arterial traffic corridors`
        : 'Idling behind diesel buses or heavy traffic junctions during your commute',
    );
  } else if (profile.commuteType === 'car') {
    avoidToday.push('Leaving car ventilation on fresh-air intake or idling in slow traffic queues');
  }
  if (air.summary.trendDirection === 'worsening' && peakWinText) {
    avoidToday.push(`Keeping windows open into the worsening ${peakWinText} window`);
  } else if (high) {
    avoidToday.push('Indoor smoke sources such as incense, dhoop, or unvented high-heat frying');
  } else {
    avoidToday.push('Unnecessary short vehicle trips that can be combined into one errand');
  }

  const prioritiseToday: string[] = [];
  if (profile.hasAirPurifier && elevated) {
    prioritiseToday.push(
      'Run your HEPA air purifier continuously in the main occupied room with doors and windows closed during high-AQI hours.',
    );
  } else if (!profile.hasAirPurifier && elevated) {
    prioritiseToday.push(
      'Keep street-facing windows shut during peak hours, damp-mop settled dust, and run kitchen exhaust while cooking.',
    );
  } else {
    prioritiseToday.push(
      'Refresh indoor rooms briefly during the relatively cleaner forecast window to clear stale indoor air.',
    );
  }

  if (profile.commuteType === 'car' || profile.commuteType === 'two_wheeler') {
    prioritiseToday.push(
      profile.sustainabilityFocus === 'low_emission_priority' || !severe
        ? `Swap today's ${profile.commuteDistanceKm} km ${commuteLabel} for metro/public transit or carpool if practical, or combine errands into one trip.`
        : `Plan a single consolidated trip${lowerWinText ? ` closer to ${lowerWinText}` : ''} and avoid engine idling.`,
    );
  } else {
    prioritiseToday.push(
      profile.commuteType === 'wfh'
        ? 'Batch essential outdoor errands into the relatively lower-pollution daytime window.'
        : 'Use quieter side streets or enclosed metro/AC transit coaches when available.',
    );
  }

  const bestLowerWindowNote = lowerWinText
    ? high
      ? `Forecast indicates a relatively lower-pollution window around ${lowerWinText}, though air remains elevated — not completely safe. Recheck live estimates before stepping out.`
      : `Forecast suggests a relatively lower-pollution period around ${lowerWinText}. Even during lower windows, conditions are modelled estimates rather than guaranteed safe.`
    : 'Forecast hourly window data is limited; check updated readings before planning outdoor errands or ventilation.';

  const immediateAction = severe
    ? profile.hasAirPurifier
      ? 'Close outside windows now and switch your air purifier to medium-high in the primary family room.'
      : 'Close street-facing windows now, seal obvious door drafts with a rolled towel, and move planned outdoor activity indoors.'
    : air.summary.trendDirection === 'worsening'
      ? 'Air quality is forecast to worsen later — complete any quick ventilation and essential outdoor errands earlier while levels are comparatively lower.'
      : elevated
        ? profile.commuteType === 'two_wheeler' || profile.commuteType === 'cycling'
          ? 'Pack a well-fitted N95 mask before heading out and switch high-effort workouts indoors.'
          : 'Switch car AC to cabin recirculation or plan outdoor walks for the relatively lower forecast window.'
        : 'Take advantage of moderate conditions for a 15-minute cross-ventilation refresh and plan one lower-emission errand or commute swap.';

  // Morning block
  const morning: PlanItem[] = [
    {
      id: 'm-commute',
      title:
        profile.commuteType === 'wfh'
          ? 'Morning indoor workspace setup'
          : `Adapt your morning ${commuteLabel}`,
      action:
        profile.commuteType === 'two_wheeler'
          ? high
            ? 'Wear a snug-fitting N95 mask for your ride, or shift today’s trip to enclosed metro/bus or WFH if your schedule permits.'
            : 'Take less congested parallel lanes and keep an N95 mask handy for traffic bottlenecks.'
          : profile.commuteType === 'car'
            ? high
              ? 'Keep car windows closed with cabin AC on recirculate (cracking briefly only on open stretches to prevent stuffiness), and carpool or take metro if available.'
              : 'Consider metro, bus, or carpooling for today’s commute and turn off the engine at long red lights.'
            : profile.commuteType === 'cycling' || profile.commuteType === 'walking'
              ? high
                ? 'Pause brisk outdoor commuting during heavy pollution; use enclosed public transit or delay departure to a lower-AQI window.'
                : 'Choose tree-lined inner streets away from main arterial exhaust and pace exertion lightly.'
              : profile.commuteType === 'public_transport'
                ? 'Prefer enclosed metro or AC bus coaches over open waiting stops along busy junctions, and wear an N95 mask if AQI exceeds 150.'
                : 'Keep windows closed if early-morning inversion haze is visible outside, and check the midday forecast before airing out your room.',
      whyRecommended: high
        ? `Morning traffic and cool boundary-layer air trap ${dominantMeta.symbol} near street level (currently ${aqi} US AQI).`
        : `Morning rush hour elevates roadside NO₂ and particulates even when regional AQI is ${cat.shortLabel.toLowerCase()}.`,
      triggers: [
        `Commute: ${commuteLabel} (${profile.commuteDistanceKm} km)`,
        `Current US AQI: ${aqi}`,
        `Dominant pollutant: ${dominantMeta.symbol}`,
      ],
      expectedBenefit:
        profile.commuteType === 'car' || profile.commuteType === 'two_wheeler'
          ? 'Reduces personal rush-hour particulate inhalation and lowers tailpipe emissions when opting for shared or rail transit.'
          : 'Limits direct inhalation of fresh roadway exhaust during morning rush hours.',
      impactCategory:
        profile.commuteType === 'car' || profile.commuteType === 'two_wheeler'
          ? 'both'
          : 'personal_exposure',
      priority: high ? 'high' : 'medium',
      timeframe: '07:00 – 10:30',
    },
    {
      id: 'm-activity',
      title:
        profile.outdoorWindow === 'early_morning' || profile.outdoorWindow === 'mid_morning'
          ? 'Adjust your preferred morning outdoor time'
          : 'Morning home prep & ventilation check',
      action:
        air.summary.trendDirection === 'worsening' && !high
          ? `Because air is forecast to worsen later (${air.summary.trendNote.toLowerCase()}), do a brief 15-minute window refresh and finish quick outdoor errands before noon.`
          : high || (elevated && hasSensitiveGroup)
            ? `Move morning ${
                profile.children > 0 ? 'family play or ' : ''
              }workouts indoors (stretching, yoga, indoor games) rather than exercising in early-morning smog.`
            : 'Light morning outdoor movement is reasonable; keep high-intensity cardio away from busy main roads.',
      whyRecommended:
        air.summary.trendDirection === 'worsening'
          ? 'Hourly forecast shows cleaner air earlier in the day before evening buildup.'
          : `Early morning temperatures often trap overnight ${dominantMeta.symbol} close to the ground.`,
      triggers: [
        `Preferred window: ${profile.outdoorWindow.replace('_', ' ')}`,
        `Household: ${householdDesc}`,
        `6h trend: ${air.summary.trendDirection}`,
      ],
      expectedBenefit:
        'Prevents deep lung deposition of fine particles during elevated breathing rates.',
      impactCategory: 'personal_exposure',
      priority: high || air.summary.trendDirection === 'worsening' ? 'high' : 'medium',
      timeframe: '06:30 – 10:00',
    },
  ];

  // Afternoon block
  const afternoon: PlanItem[] = [
    {
      id: 'a-window',
      title: 'Use the forecast window thoughtfully',
      action: lowerWinText
        ? high
          ? `If essential outdoor errands cannot wait, schedule them near ${lowerWinText} and keep trips short; remember elevated air is still not completely safe.`
          : `Target ${lowerWinText} for errands, school pickup coordination, or a short 15–20 minute indoor air exchange.`
        : 'Keep outdoor errands consolidated and brief while checking hourly updates before heading out.',
      whyRecommended:
        'Midday warming typically lifts the urban atmospheric boundary layer slightly, dispersing trapped morning particulates.',
      triggers: [
        lowerWinText ? `Relatively lower window: ${lowerWinText}` : `Current US AQI: ${aqi}`,
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
      action:
        profile.commuteType === 'car' || profile.commuteType === 'two_wheeler'
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
      priority: profile.sustainabilityFocus === 'low_emission_priority' ? 'high' : 'medium',
      timeframe: '13:00 – 17:00',
    },
  ];

  // Evening block
  const evening: PlanItem[] = [
    {
      id: 'e-cooking',
      title:
        profile.cookingFuel === 'induction_electric'
          ? 'Keep evening indoor air sealed and low-particle'
          : 'Manage evening cooking emissions indoors',
      action:
        profile.cookingFuel === 'induction_electric'
          ? `Close outside windows before dusk${peakWinText ? ` ahead of ${peakWinText}` : ''}, use pot lids when simmering, and avoid burning candles or incense.`
          : 'Run the kitchen exhaust fan or chimney on medium-high throughout gas cooking, keep the kitchen door closed from bedrooms, and prefer steaming or lidded cooking over heavy frying.',
      whyRecommended:
        profile.cookingFuel === 'induction_electric'
          ? 'Evening inversions raise outdoor particulates while high-heat oil cooking can quickly spike indoor PM2.5.'
          : 'LPG/gas stoves generate indoor NO₂ and cooking oil aerosols that get trapped indoors when windows are shut against evening smog.',
      triggers: [
        `Cooking setup: ${profile.cookingFuel.replace('_', ' ')}`,
        `Home: ${profile.homeType.replace('_', ' ')}`,
        peakWinText ? `Peak window: ${peakWinText}` : `Current US AQI: ${aqi}`,
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
      action: profile.hasAirPurifier
        ? `Close bedroom doors and windows at least 45 minutes before bedtime and run your HEPA purifier on medium, then switch to sleep mode overnight${
            profile.olderAdults > 0 || profile.children > 0
              ? ' — prioritising rooms used by children or older adults.'
              : '.'
          }`
        : `Wet-wipe dusty sills and damp-mop floors instead of dry sweeping, seal noticeable window gaps before nightfall, and plan ${
            profile.children > 0
              ? 'indoor storytime or board games'
              : 'indoor mobility or reading'
          } instead of late-evening outdoor walks.`,
      whyRecommended:
        'Overnight cooling often concentrates fine particulates outdoors; reducing indoor dust resuspension keeps sleeping air cleaner.',
      triggers: [
        profile.hasAirPurifier ? 'Air purifier available' : 'No air purifier (zero-cost focus)',
        `Household: ${householdDesc}`,
      ],
      expectedBenefit:
        'Lowers overnight particulate exposure in sleeping spaces without requiring unnecessary new purchases.',
      impactCategory: 'personal_exposure',
      priority: high || hasSensitiveGroup ? 'high' : 'medium',
      timeframe: '19:30 – 22:30',
    },
  ];

  // Tomorrow block
  const tOutlook = air.summary.tomorrowOutlook;
  const tomorrow: PlanItem[] = [
    {
      id: 't-outlook',
      title: tOutlook
        ? `Prepare for ${tOutlook.directionVsToday === 'better' ? 'slightly easing' : tOutlook.directionVsToday === 'worse' ? 'heavier' : 'similar'} air tomorrow`
        : 'Check updated morning forecast before stepping out',
      action: tOutlook
        ? `Tomorrow’s modelled US AQI ranges from ~${tOutlook.minUsAqi} to ~${tOutlook.maxUsAqi} (average ~${tOutlook.avgUsAqi}). ${
            tOutlook.avgUsAqi >= 151
              ? 'Coordinate remote work, enclosed transit, or indoor school/play backup plans tonight.'
              : tOutlook.directionVsToday === 'better'
                ? 'Plan laundry airing, short home ventilation, or lighter outdoor activity for tomorrow’s relatively lower afternoon hours.'
                : 'Keep N95 masks by the door and confirm morning commute alternatives tonight.'
          }`
        : 'Review SAANS tomorrow morning before opening windows or departing for your commute.',
      whyRecommended:
        'Preparing commute and family logistics the evening before makes lower-exposure and lower-emission choices much easier to follow.',
      triggers: [
        tOutlook
          ? `Tomorrow forecast: ${tOutlook.minUsAqi}–${tOutlook.maxUsAqi} US AQI`
          : 'Forecast horizon',
        `Commute: ${commuteLabel}`,
      ],
      expectedBenefit:
        'Helps your household avoid last-minute high-exposure rush trips and plan cleaner transport options ahead of time.',
      impactCategory: 'both',
      priority: tOutlook && tOutlook.avgUsAqi >= 151 ? 'high' : 'medium',
      timeframe: 'Tomorrow',
    },
    {
      id: 't-habit',
      title: 'Pre-commit one low-emission swap for tomorrow',
      action:
        profile.commuteType === 'car'
          ? 'Message a colleague or neighbour tonight to carpool tomorrow, or map a metro/bus route for at least one leg.'
          : profile.commuteType === 'two_wheeler'
            ? 'Check if tomorrow’s errands can be grouped with your main trip or shifted to public transit.'
            : 'Pre-batch tomorrow’s errands and reduce standby appliance load overnight.',
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

  return {
    source: 'fallback',
    fallbackReason,
    fallbackCode,
    generatedAt: new Date().toISOString(),
    headline,
    heroSummary: {
      currentConditions,
      avoidToday: avoidToday.slice(0, 3),
      prioritiseToday: prioritiseToday.slice(0, 3),
      bestLowerWindowNote,
      immediateAction,
    },
    blocks: {
      morning,
      afternoon,
      evening,
      tomorrow,
    },
    transparencyNote:
      'Generated by SAANS’s transparent rules-based engine from supplied modelled environmental data and your household preferences. Configure GEMINI_API_KEY on the server to enable generative Gemini 3.5 Flash-Lite planning.',
  };
}

export function generateFallbackAskResponse(
  question: string,
  profile: HouseholdProfile,
  air: AirQualityData,
  fallbackReason: string,
  fallbackCode: FallbackCode = 'missing_key',
): AskSaansResponse {
  const q = question.toLowerCase();
  const aqi = air.current.usAqi;
  const pm25 = air.current.pm25;
  const cat = getUsAqiCategory(aqi);
  const dominantMeta = POLLUTANT_META[air.summary.dominantPollutant];
  const lowerWin = air.summary.lowerWindow
    ? `${formatTimeRange(
        air.summary.lowerWindow.startTime,
        air.summary.lowerWindow.endTime,
      )} (~${air.summary.lowerWindow.avgUsAqi} US AQI)`
    : null;
  const high = (aqi ?? 0) >= 151;
  const elevated = (aqi ?? 0) >= 101;
  const hasSensitive =
    profile.children > 0 ||
    profile.olderAdults > 0 ||
    profile.respiratorySensitivity !== 'none';

  const dataPointsUsed: string[] = [
    `Location: ${air.location.name} (${air.isDemo ? 'Demo scenario' : 'Open-Meteo CAMS model'})`,
    `Current US AQI: ${aqi ?? 'Unavailable'} (${cat.label})`,
    ...(pm25 !== null ? [`PM2.5: ${pm25} µg/m³`] : []),
    `Dominant pollutant: ${dominantMeta.symbol}`,
    `6h trend: ${air.summary.trendDirection}`,
  ];

  let answer = '';
  let keyTakeaway = '';
  let impactFraming: AskSaansResponse['impactFraming'] = 'personal_exposure';

  if (q.includes('walk') || q.includes('run') || q.includes('exercise') || q.includes('park') || q.includes('child') || q.includes('outside')) {
    impactFraming = 'personal_exposure';
    if (high) {
      const activityPhrase =
        profile.children > 0
          ? 'walking, running, or children’s active play'
          : profile.olderAdults > 0
            ? 'brisk walks and morning/evening outdoor strolls'
            : 'outdoor walking, running, or cardio';
      answer = `Right now in ${air.location.name}, modelled air quality is ${cat.label} (${aqi} US AQI${
        pm25 !== null ? `, PM2.5 ${pm25} µg/m³` : ''
      }), with ${dominantMeta.symbol} as the main concern. For ${describeHouseholdShort(
        profile,
      )}, it is better to move ${activityPhrase} indoors today.\n\n${
        lowerWin
          ? `Your forecast shows a relatively lower-pollution window around ${lowerWin}, though air remains elevated (not completely safe). If you must step out briefly then, keep the pace gentle, avoid busy roads, and consider a well-fitted N95 mask.`
          : 'Check updated readings later in the afternoon before planning even brief outdoor errands.'
      }`;
      keyTakeaway = `Move exercise indoors now; ${lowerWin ? `use ${lowerWin} only for brief, low-exertion errands.` : 'wait for conditions to ease.'}`;
    } else if (elevated) {
      answer = `Modelled air in ${air.location.name} is currently ${cat.label} (${aqi} US AQI). ${
        hasSensitive
          ? 'Because your household includes children, older adults, or a respiratory sensitivity preference, keep outdoor walks short and gentle rather than vigorous.'
          : 'A light walk away from busy traffic corridors is workable, while intense cardio is better indoors.'
      }\n\n${
        lowerWin
          ? `The relatively lower-pollution forecast window is ${lowerWin} — aiming your walk there reduces exposure compared to rush-hour peaks.`
          : ''
      }`;
      keyTakeaway = lowerWin
        ? `Keep outdoor activity light or shift to ${lowerWin}.`
        : 'Prefer light walks on quieter streets over vigorous outdoor workouts.';
    } else {
      answer = `Modelled air quality in ${air.location.name} is currently ${cat.label} (${aqi} US AQI${
        pm25 !== null ? `, PM2.5 ${pm25} µg/m³` : ''
      }). This is a reasonable time for a walk or light outdoor activity, especially along quieter residential roads away from idling vehicles.\n\nRemember that Open-Meteo provides regional modelled estimates rather than street-level sensors, so if you notice visible dust or smoke nearby, cut the walk short.`;
      keyTakeaway = 'Suitable for a walk on quieter streets; watch for localized dust or traffic smoke.';
    }
  } else if (q.includes('home') || q.includes('window') || q.includes('indoor') || q.includes('purifier') || q.includes('cook')) {
    impactFraming = 'personal_exposure';
    answer = `For your ${profile.homeType.replace('_', ' ')} (${
      profile.hasAirPurifier ? 'with an air purifier' : 'without an air purifier'
    }, ${profile.cookingFuel.replace('_', ' ')} cooking) under ${cat.label} air (${aqi} US AQI):\n\n1. **Windows & Ventilation**: ${
      high
        ? 'Keep exterior windows closed now, especially on street-facing sides. Only do a brief 10-minute air refresh if the afternoon forecast eases noticeably.'
        : lowerWin
          ? `Plan a short 15–20 minute cross-ventilation refresh around ${lowerWin}, then close windows before evening pollution rises.`
          : 'Ventilate briefly during lower-traffic midday hours and close windows if haze increases.'
    }\n2. **Cooking & Indoor Sources**: ${
      profile.cookingFuel === 'induction_electric'
        ? 'Use lids when sautéing and avoid incense, dhoop, or scented candles.'
        : 'Run your kitchen exhaust fan while cooking with gas and close bedroom doors so cooking NO₂ and PM2.5 don’t spread.'
    }\n3. **Filtration & Dust**: ${
      profile.hasAirPurifier
        ? 'Run your HEPA purifier continuously in the main occupied room with doors shut.'
        : 'Damp-mop floors instead of dry sweeping and block visible door drafts with a cloth strip — practical zero-cost steps without needing new hardware.'
    }`;
    keyTakeaway = high
      ? 'Keep windows sealed, control cooking fumes, and protect sleeping rooms.'
      : 'Time brief ventilation to lower-AQI hours and minimize indoor smoke sources.';
  } else if (q.includes('commute') || q.includes('office') || q.includes('drive') || q.includes('car') || q.includes('bike') || q.includes('bus') || q.includes('metro')) {
    impactFraming = 'both';
    answer = `Looking at your **${getCommuteLabel(profile.commuteType)}** (~${profile.commuteDistanceKm} km each way) and current ${cat.label} air (${aqi} US AQI):\n\n- **Personal exposure**: ${
      profile.commuteType === 'two_wheeler' || profile.commuteType === 'cycling' || profile.commuteType === 'walking'
        ? high
          ? 'Open-air commuting puts you directly in roadway particulate plumes. Switching to enclosed metro/AC bus today or wearing a well-fitted N95 mask significantly reduces what you breathe.'
          : 'Avoid tailgating diesel vehicles and take parallel residential roads where feasible.'
        : profile.commuteType === 'car'
          ? 'Switch cabin AC to recirculation mode on congested stretches (briefly refreshing on clearer stretches to prevent CO₂ drowsiness).'
          : 'Enclosed metro or AC bus coaches generally shield you better from street-level dust than open roadside waiting.'
    }\n- **Wider emissions**: Swapping even 1–2 solo motor trips a week to metro, bus, or a 3-person carpool meaningfully cuts transport CO₂e over time (use SAANS’s Impact Calculator for documented DESNZ/DEFRA estimates). Note that an individual commute shift reduces cumulative emissions rather than immediately changing city AQI.`;
    keyTakeaway = 'Separate exposure protection (enclosed transit/N95/recirculate) from emissions impact (shared transit, batching trips, zero idling).';
  } else if (q.includes('tomorrow') || q.includes('forecast') || q.includes('later')) {
    impactFraming = 'personal_exposure';
    const t = air.summary.tomorrowOutlook;
    answer = t
      ? `Tomorrow’s modelled forecast for ${air.location.name} shows US AQI between **${t.minUsAqi} and ${t.maxUsAqi}** (average ~${t.avgUsAqi}, which looks **${t.directionVsToday}** compared to today).\n\nTonight, you can prepare by ${
          t.avgUsAqi >= 151
            ? 'arranging indoor backup activities, checking N95 masks, and exploring enclosed transit or WFH options if possible.'
            : 'planning quick errands and short home ventilation for the relatively lower midday window.'
        } Always recheck live conditions in the morning because atmospheric models update as wind patterns shift.`
      : `Your current 6-hour trend is **${air.summary.trendDirection}** (${air.summary.trendNote}). Full next-day hourly points are currently limited, so recheck SAANS tomorrow morning before setting your outdoor schedule.`;
    keyTakeaway = t
      ? `Tomorrow averages ~${t.avgUsAqi} US AQI (${t.directionVsToday} vs today) — plan commute & indoor backups tonight.`
      : `Current 6h trend is ${air.summary.trendDirection}; recheck in the morning.`;
  } else if (q.includes('footprint') || q.includes('emission') || q.includes('sustain') || q.includes('reduce') || q.includes('impact')) {
    impactFraming = 'wider_emissions';
    answer = `Practical low-emission shifts that fit ${describeHouseholdShort(
      profile,
    )} (${getCommuteLabel(profile.commuteType)}, ${profile.budgetPreference.replace('_', ' ')} budget):\n\n1. **Commute swaps**: Replacing even two weekly solo ${
      profile.commuteType === 'car' ? 'car' : 'motorised'
    } trips with metro, bus, or carpooling cuts per-trip transport CO₂e substantially.\n2. **Combine errands & zero idling**: Batching stops reduces cold-start exhaust and cutting engine idling at signals avoids wasted fuel and street-level fumes.\n3. **Avoid open burning & peak energy waste**: Never burn dry leaves or household waste, and shift heavy appliances away from evening peak grid demand.\n\nTo be transparent: these actions lower cumulative greenhouse gas and urban emissions over time — they will not noticeably lower today’s neighborhood AQI on their own, which is why SAANS tracks exposure protection and emissions reduction separately.`;
    keyTakeaway = 'Focus on commute mode swaps, batching errands, zero idling, and avoiding open burning — tracked separately from personal exposure protection.';
  } else {
    impactFraming = 'both';
    answer = `In ${air.location.name}, modelled air quality is currently **${cat.label}** (**${aqi ?? 'N/A'} US AQI**${
      pm25 !== null ? `, PM2.5 ${pm25} µg/m³` : ''
    }), with **${dominantMeta.symbol}** as the dominant pollutant. ${air.summary.trendNote}\n\nFor ${describeHouseholdShort(
      profile,
    )} (${getCommuteLabel(profile.commuteType)}, ${
      profile.hasAirPurifier ? 'HEPA purifier available' : 'no air purifier'
    }):\n- **Personal exposure**: ${
      high
        ? 'Prioritise indoor routines, keep outside windows shut, and use an N95 mask for essential outdoor trips.'
        : lowerWin
          ? `Schedule outdoor errands and brief ventilation around ${lowerWin}.`
          : 'Keep strenuous activity away from heavy traffic corridors.'
    }\n- **Wider emissions**: Batch errands into one trip, switch off engines while idling, and shift trips to public transit or carpooling when feasible.`;
    keyTakeaway = `${cat.label} (${aqi ?? 'N/A'} US AQI) driven by ${dominantMeta.symbol}; ${air.summary.trendDirection} 6-hour trend.`;
  }

  return {
    answer,
    keyTakeaway,
    impactFraming,
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
