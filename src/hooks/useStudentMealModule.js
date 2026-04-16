import { useCallback, useEffect, useMemo, useState } from 'react';
import mealRepository from '../services/meal/mealRepository';
import { getTomorrowDayId, getMinutesUntilCutoff, isAfterDailyCutoff } from '../constants/mealConfig';

const DEFAULT_STUDENT_ID = 'active-student';

export default function useStudentMealModule(studentId = DEFAULT_STUDENT_ID) {
  const [moduleData, setModuleData] = useState(null);
  const [preferences, setPreferences] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const loadState = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [moduleState, preferenceState] = await Promise.all([
        mealRepository.getModule(),
        mealRepository.getStudentPreferences(studentId),
      ]);

      setModuleData(moduleState);
      setPreferences(preferenceState);
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

  const mealTypes = moduleData?.settings?.mealTypes || [];
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

  const savePreferences = useCallback(async () => {
    const updated = await mealRepository.saveStudentPreferences(studentId, preferences);
    setPreferences(updated);
  }, [preferences, studentId]);

  const resetPreferences = useCallback(async () => {
    const defaults = await mealRepository.getStudentPreferences(studentId);
    setPreferences(defaults);
  }, [studentId]);

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
    updatePreference,
    savePreferences,
    resetPreferences,
    getMealOptions,
    reload: loadState,
  };
}
