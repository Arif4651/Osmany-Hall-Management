import { useCallback, useEffect, useMemo, useState } from 'react';
import mealRepository from '../services/meal/mealRepository';
import { getTomorrowDayId, getMinutesUntilCutoff, isAfterDailyCutoff } from '../constants/mealConfig';

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
    return [
      mealPeriod,
      optionExists ? preference : { ...preference, optionItemId: '' },
    ];
  }));
}

export default function useStudentMealModule(studentId) {
  const [moduleData, setModuleData] = useState(null);
  const [preferences, setPreferences] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const loadState = useCallback(async () => {
    if (!studentId) {
      setIsLoading(true);
      setErrorMessage('');
      setModuleData(null);
      setPreferences({});
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const moduleState = await mealRepository.getModule();
      const effectiveDate = getEffectivePreferenceDate(moduleState?.settings?.cutoffTime);
      const preferenceState = await mealRepository.getStudentPreferences(effectiveDate);

      setModuleData(moduleState);
      setPreferences(removeUnavailableOptions(
        mapPreferenceList(preferenceState),
        moduleState,
        effectiveDate,
      ));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load student meal module.');
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadState();

    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    const handleFocus = () => {
      loadState();
      setCurrentTime(new Date());
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(intervalId);
    };
  }, [loadState]);

  const mealTypes = useMemo(() => moduleData?.settings?.mealTypes || [], [moduleData]);
  const cutoffTime = moduleData?.settings?.cutoffTime || '';

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

  const clearErrorMessage = useCallback(() => setErrorMessage(''), []);

  const savePreferences = useCallback(async () => {
    setErrorMessage('');

    try {
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
      setPreferences(mapPreferenceList(updated));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save meal preferences.');
      throw error;
    }
  }, [cutoffTime, mealTypes, preferences]);

  const resetPreferences = useCallback(async () => {
    setErrorMessage('');

    try {
      const effectiveDate = getEffectivePreferenceDate(cutoffTime);
      const defaults = await mealRepository.getStudentPreferences(effectiveDate);
      setPreferences(mapPreferenceList(defaults));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to reset meal preferences.');
      throw error;
    }
  }, [cutoffTime]);

  const getMealOptions = useCallback((mealTypeId) => {
    if (!tomorrowMenu) return [];
    const meal = tomorrowMenu.meals.find((entry) => entry.mealTypeId === mealTypeId);
    return meal?.optionalItems || [];
  }, [tomorrowMenu]);

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
    reload: loadState,
  };
}
