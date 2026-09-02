import { useCallback, useEffect, useMemo, useState } from 'react';
import mealRepository from '../services/meal/mealRepository';
import { getTomorrowDayId, getMinutesUntilCutoff, isAfterDailyCutoff } from '../constants/mealConfig';
import { useCachedFetch } from './useCachedFetch';
import { queryCache } from '../services/queryCache';

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getEffectivePreferenceDate(cutoffTime, currentDate = new Date()) {
  const effectiveDate = new Date(currentDate);
  effectiveDate.setDate(effectiveDate.getDate() + (isAfterDailyCutoff(cutoffTime, currentDate) ? 2 : 1));
  return formatLocalDate(effectiveDate);
}

function mapPreferenceList(preferenceList = []) {
  return Object.fromEntries(preferenceList.map((preference) => [
    preference.mealPeriod,
    {
      enabled: preference.isOn,
      optionItemId: preference.optionItemId || '',
      // Propagate the server-resolved selection state so the UI can show the right indicator.
      optionSelectionState: preference.optionSelectionState || 'not_required',
    },
  ]));
}

function removeUnavailableOptions(preferences, moduleState, effectiveDate) {
  const targetDate = new Date(`${effectiveDate}T00:00:00`);
  const dayIds = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const targetDay = moduleState?.days?.find((day) => day.id === dayIds[targetDate.getDay()]);
  if (!targetDay) return preferences;

  return Object.fromEntries(Object.entries(preferences).map(([mealPeriod, preference]) => {
    const meal = targetDay.meals.find((entry) => entry.mealTypeId === mealPeriod);
    const optionExists = !preference.optionItemId
      || meal?.optionalItems?.some((option) => option.id === preference.optionItemId);
    if (optionExists) return [mealPeriod, preference];
    // Option was removed from the menu — clear it locally but keep the server state (backend
    // will recompute on next GET /preferences/me).
    return [mealPeriod, { ...preference, optionItemId: '', optionSelectionState: 'selection_required' }];
  }));
}

export default function useStudentMealModule(studentId) {
  const [preferences, setPreferences] = useState({});
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const moduleCacheKey = studentId ? `student-meal-module-${studentId}` : null;
  const {
    data: moduleData,
    isLoading: isModuleLoading,
    error: moduleError,
    refresh: refreshModule,
  } = useCachedFetch(
    moduleCacheKey,
    () => mealRepository.getModule(),
    { ttl: 10 * 60_000 }
  );

  const cutoffTime = moduleData?.settings?.cutoffTime || '';
  const effectiveDate = cutoffTime ? getEffectivePreferenceDate(cutoffTime, currentTime) : '';

  const prefsCacheKey = studentId && effectiveDate ? `student-meal-preferences-${studentId}-${effectiveDate}` : null;
  const {
    data: rawPreferences,
    isLoading: isPrefsLoading,
    error: prefsError,
    refresh: refreshPrefs,
  } = useCachedFetch(
    prefsCacheKey,
    () => mealRepository.getStudentPreferences(effectiveDate),
    { ttl: 5 * 60_000 }
  );

  // Sync loaded preferences to form state
  useEffect(() => {
    if (rawPreferences && moduleData && effectiveDate) {
      setPreferences(removeUnavailableOptions(
        mapPreferenceList(rawPreferences),
        moduleData,
        effectiveDate,
      ));
    }
  }, [rawPreferences, moduleData, effectiveDate]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    const handleFocus = () => {
      refreshModule();
      refreshPrefs();
      setCurrentTime(new Date());
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(intervalId);
    };
  }, [refreshModule, refreshPrefs]);

  const mealTypes = useMemo(() => moduleData?.settings?.mealTypes || [], [moduleData]);

  const tomorrowMenu = useMemo(() => {
    if (!moduleData?.days?.length) return null;
    const tomorrowDayId = getTomorrowDayId(currentTime);
    return moduleData.days.find((day) => day.id === tomorrowDayId) || moduleData.days[0];
  }, [currentTime, moduleData]);

  const isCutoffPassed = isAfterDailyCutoff(cutoffTime, currentTime);
  const minutesUntilCutoff = getMinutesUntilCutoff(cutoffTime, currentTime);

  const updatePreference = useCallback((mealTypeId, field, value) => {
    setPreferences((prev) => ({
      ...prev,
      [mealTypeId]: {
        ...(prev[mealTypeId] || { enabled: true, optionItemId: '' }),
        [field]: value,
      },
    }));
  }, []);

  const errorMessage = moduleError || prefsError || '';
  const isLoading = isModuleLoading || isPrefsLoading;

  const clearErrorMessage = useCallback(() => {
    // SWR error handles automatically, but we can clear from local if we want, or keep empty
  }, []);

  const savePreferences = useCallback(async () => {
    const effectiveFrom = getEffectivePreferenceDate(cutoffTime);
    const meals = mealTypes.map((mealType) => {
      const preference = preferences[mealType.id] || { enabled: false, optionItemId: '' };
      return {
        mealPeriod: mealType.id,
        isOn: preference.enabled,
        optionItemId: preference.enabled && preference.optionItemId
          ? preference.optionItemId
          : null,
        optionName: null,
        guestCount: 0,
      };
    });

    const updated = await mealRepository.saveStudentPreferences({ effectiveFrom, meals });

    // Update queryCache directly
    if (prefsCacheKey) {
      queryCache.set(prefsCacheKey, updated, 5 * 60_000);
    }
    setPreferences(mapPreferenceList(updated));
  }, [cutoffTime, mealTypes, preferences, prefsCacheKey]);

  const resetPreferences = useCallback(async () => {
    const effectiveDateVal = getEffectivePreferenceDate(cutoffTime);
    if (prefsCacheKey) {
      queryCache.remove(prefsCacheKey);
    }
    const defaults = await mealRepository.getStudentPreferences(effectiveDateVal);
    if (prefsCacheKey) {
      queryCache.set(prefsCacheKey, defaults, 5 * 60_000);
    }
    setPreferences(mapPreferenceList(defaults));
  }, [cutoffTime, prefsCacheKey]);

  const getMealOptions = useCallback((mealTypeId) => {
    if (!tomorrowMenu) return [];
    const meal = tomorrowMenu.meals.find((entry) => entry.mealTypeId === mealTypeId);
    return meal?.optionalItems || [];
  }, [tomorrowMenu]);

  /**
   * Returns true when the student must actively choose an optional item before saving.
   * Use this to highlight the meal row in the UI.
   */
  const requiresSelection = useCallback((mealTypeId) => {
    const pref = preferences[mealTypeId];
    return pref?.optionSelectionState === 'selection_required';
  }, [preferences]);

  return {
    isLoading,
    errorMessage,
    mealTypes,
    cutoffTime,
    isCutoffPassed,
    minutesUntilCutoff,
    tomorrowMenu,
    preferences,
    moduleDays: moduleData?.days || [],
    clearErrorMessage,
    updatePreference,
    savePreferences,
    resetPreferences,
    getMealOptions,
    requiresSelection,
    reload: () => {
      refreshModule();
      refreshPrefs();
    },
  };
}
