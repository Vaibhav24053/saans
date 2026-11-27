import { useEffect, useState } from 'react';
import type { LocationInfo } from '@shared/types';
import { reverseGeocode, searchCities } from '@/services/api';

interface UseLocationSearchOptions {
  enabled?: boolean;
  searchErrorFallback: string;
  geoUnsupportedMessage: string;
  geoDeniedMessage?: string;
  geoUnavailableMessage: string;
}

function buildFallbackCoordinatesLocation(
  latitude: number,
  longitude: number,
): LocationInfo {
  const latDir = latitude >= 0 ? 'N' : 'S';
  const lonDir = longitude >= 0 ? 'E' : 'W';
  return {
    name: `${Math.abs(latitude).toFixed(2)}°${latDir}, ${Math.abs(longitude).toFixed(2)}°${lonDir}`,
    country: 'Current Location',
    latitude,
    longitude,
    timezone: 'auto',
    source: 'geolocation',
  };
}

export function useLocationSearch(options: UseLocationSearchOptions) {
  const {
    enabled = true,
    searchErrorFallback,
    geoUnsupportedMessage,
    geoDeniedMessage,
    geoUnavailableMessage,
  } = options;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    let active = true;
    const timer = setTimeout(async () => {
      if (!active) return;
      setSearching(true);
      setError(null);
      try {
        const list = await searchCities(trimmed);
        if (active) setResults(list);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error && searchErrorFallback === ''
              ? err.message
              : searchErrorFallback ||
                  (err instanceof Error
                    ? err.message
                    : 'City search failed. Try again.'),
          );
        }
      } finally {
        if (active) setSearching(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [enabled, query, searchErrorFallback]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setError(null);
      setSearching(false);
    }
  };

  const resetSearch = () => {
    setQuery('');
    setResults([]);
    setError(null);
    setSearching(false);
  };

  const requestGeolocation = (onResolved: (loc: LocationInfo) => void) => {
    if (!navigator.geolocation) {
      setError(geoUnsupportedMessage);
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const resolved = await reverseGeocode(
            pos.coords.latitude,
            pos.coords.longitude,
          );
          onResolved(resolved);
        } catch {
          onResolved(
            buildFallbackCoordinatesLocation(
              pos.coords.latitude,
              pos.coords.longitude,
            ),
          );
        } finally {
          setLocating(false);
        }
      },
      (geoErr) => {
        setLocating(false);
        setError(
          geoErr.code === 1 && geoDeniedMessage
            ? geoDeniedMessage
            : geoUnavailableMessage,
        );
      },
      { timeout: 10000 },
    );
  };

  return {
    query,
    results,
    searching,
    locating,
    error,
    handleQueryChange,
    resetSearch,
    requestGeolocation,
  };
}
