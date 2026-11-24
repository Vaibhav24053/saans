import { useEffect, useState } from 'react';
import {
  Compass,
  Loader2,
  MapPin,
  Search,
  X,
} from 'lucide-react';
import type { LocationInfo } from '@shared/types';
import { reverseGeocode, searchCities } from '@/services/api';

const QUICK_CITIES: LocationInfo[] = [
  {
    name: 'New Delhi',
    admin1: 'Delhi',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.209,
    timezone: 'Asia/Kolkata',
    source: 'geocoding',
  },
  {
    name: 'Mumbai',
    admin1: 'Maharashtra',
    country: 'India',
    latitude: 19.076,
    longitude: 72.8777,
    timezone: 'Asia/Kolkata',
    source: 'geocoding',
  },
  {
    name: 'Bengaluru',
    admin1: 'Karnataka',
    country: 'India',
    latitude: 12.9716,
    longitude: 77.5946,
    timezone: 'Asia/Kolkata',
    source: 'geocoding',
  },
  {
    name: 'Kolkata',
    admin1: 'West Bengal',
    country: 'India',
    latitude: 22.5726,
    longitude: 88.3639,
    timezone: 'Asia/Kolkata',
    source: 'geocoding',
  },
  {
    name: 'Gurugram',
    admin1: 'Haryana',
    country: 'India',
    latitude: 28.4595,
    longitude: 77.0266,
    timezone: 'Asia/Kolkata',
    source: 'geocoding',
  },
  {
    name: 'London',
    admin1: 'England',
    country: 'United Kingdom',
    latitude: 51.5072,
    longitude: -0.1276,
    timezone: 'Europe/London',
    source: 'geocoding',
  },
];

export function LocationSearchModal({
  open,
  onClose,
  onSelect,
  currentLocation,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (loc: LocationInfo) => void;
  currentLocation: LocationInfo;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const list = await searchCities(trimmed);
        setResults(list);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'City search failed. Try again or pick a quick city below.',
        );
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, open]);

  if (!open) return null;

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setError('Browser geolocation is not supported in this browser.');
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
          onSelect(resolved);
          onClose();
        } catch {
          onSelect({
            name: `${pos.coords.latitude.toFixed(2)}°, ${pos.coords.longitude.toFixed(2)}°`,
            country: 'Current Location',
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            timezone: 'auto',
            source: 'geolocation',
          });
          onClose();
        } finally {
          setLocating(false);
        }
      },
      (geoErr) => {
        setLocating(false);
        setError(
          geoErr.code === 1
            ? 'Location permission was declined. You can search for your city manually instead.'
            : 'Unable to determine your location right now. Please search manually.',
        );
      },
      { timeout: 10000 },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#151B18]/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Choose location"
    >
      <div className="w-full max-w-lg bg-white rounded-2xl border border-[#E6E3DA] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E6E3DA]">
          <div>
            <h2 className="text-base font-semibold text-[#151B18]">
              Change Location
            </h2>
            <p className="text-xs text-[#717D77]">
              Queries live Open-Meteo modelled air-quality forecasts (Copernicus CAMS)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#717D77] hover:bg-[#F0EEE7] hover:text-[#151B18] transition-colors cursor-pointer"
            aria-label="Close location picker"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#717D77] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search city or town (e.g., Delhi, Pune, Jaipur)..."
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-[#D4D0C4] bg-[#FAF9F6] focus:bg-white focus:border-[#2D6A4F] outline-none transition-colors"
                autoFocus
              />
              {searching && (
                <Loader2 className="w-4 h-4 text-[#2D6A4F] animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
              )}
            </div>
            <button
              type="button"
              onClick={handleGeolocate}
              disabled={locating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-[#E6F0EB] text-[#1B4332] hover:bg-[#D7E8DF] transition-colors disabled:opacity-60 cursor-pointer shrink-0"
            >
              {locating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Compass className="w-3.5 h-3.5" />
              )}
              <span>Use GPS</span>
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-[#FDECEC] border border-[#F5BDBD] text-xs text-[#991B1B]">
              {error}
            </div>
          )}

          {query.trim().length >= 2 && (
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {results.length === 0 && !searching && !error && (
                <p className="text-xs text-[#717D77] py-4 text-center">
                  No matching locations found for “{query}”.
                </p>
              )}
              {results.map((loc, idx) => (
                <button
                  key={`${loc.name}-${loc.latitude}-${idx}`}
                  type="button"
                  onClick={() => {
                    onSelect(loc);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-[#F2F0E9] text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-[#151B18]">
                        {loc.name}
                      </div>
                      <div className="text-xs text-[#717D77]">
                        {[loc.admin1, loc.country].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono-tabular text-[#717D77]">
                    {loc.latitude.toFixed(2)}, {loc.longitude.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#717D77] mb-2">
              Popular Cities
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_CITIES.map((city) => {
                const isActive =
                  city.name === currentLocation.name &&
                  city.country === currentLocation.country;
                return (
                  <button
                    key={city.name}
                    type="button"
                    onClick={() => {
                      onSelect(city);
                      onClose();
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#1B4332] text-white border-[#1B4332]'
                        : 'bg-[#FAF9F6] text-[#151B18] border-[#E6E3DA] hover:border-[#2D6A4F]'
                    }`}
                  >
                    {city.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
