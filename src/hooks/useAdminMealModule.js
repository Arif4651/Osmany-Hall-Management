import { useCallback, useMemo } from 'react';
import mealRepository from '../services/meal/mealRepository';
import { getTomorrowDayId } from '../constants/mealConfig';
import { useCachedFetch } from './useCachedFetch';
import { queryCache } from '../services/queryCache';

function getItemsCost(items = []) {
  return items.reduce((sum, item) => sum + Number(item.cost || 0), 0);
}

function estimateDemand(baseDemand, commonItems, optionalItems, bias = 0) {
  const projected = baseDemand + (commonItems.length * 11) + (optionalItems.length * 8) + bias;
  return Math.max(24, Math.round(projected));
}

function parseItemsFromText(textValue, idPrefix) {
  return (textValue || '')
    .split(',')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, index) => {
      const separatorIndex = chunk.lastIndexOf('-');
      const namePart = separatorIndex >= 0 ? chunk.slice(0, separatorIndex).trim() : chunk;
      const costPart = separatorIndex >= 0 ? chunk.slice(separatorIndex + 1).trim() : '';
      const cost = Number(costPart);
      const fallbackId = `${idPrefix}-${index + 1}`;
      return {
        id: `${idPrefix}-${namePart || fallbackId}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
        name: namePart || `Item ${index + 1}`,
        cost: Number.isFinite(cost) ? cost : 0,
      };
    });
}

function formatItemsToText(items = []) {
  return items.map((item) => `${item.name}-${item.cost}`).join(', ');
}

function parseOptionalItems(textValue, idPrefix) {
  return (textValue || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, index) => ({
      id: `${idPrefix}-${name || index + 1}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      name,
      cost: 0,
    }));
}

function formatOptionalItemsToText(items = []) {
  return items.map((item) => item.name).join(', ');
}

function cleanItems(items = [], includeIsDefault = false) {
  return items
    .filter((item) => item.inventoryItemId || item.id || item.name)
    .map((item, index) => ({
      id: item.inventoryItemId || item.id || `item-${index + 1}`,
      inventoryItemId: item.inventoryItemId || null,
      name: item.name || '',
      cost: Number(item.cost || 0),
      // Carry isDefault only for optional items — it has no meaning on common items.
      ...(includeIsDefault ? { isDefault: Boolean(item.isDefault) } : {}),
    }));
}

export default function useAdminMealModule(wing) {
  const cacheKey = wing ? `admin-meal-module-${wing}` : null;
  const {
    data: moduleData,
    isLoading,
    error: cachedError,
    refresh: loadModule,
    mutate: setModuleData,
  } = useCachedFetch(
    cacheKey,
    () => mealRepository.getModule(wing),
    { ttl: 10 * 60_000 }
  );

  const errorMessage = cachedError || '';

  const mealTypes = useMemo(() => moduleData?.settings?.mealTypes || [], [moduleData]);
  const days = useMemo(() => moduleData?.days || [], [moduleData]);

  const dayOptions = useMemo(
    () => days.map((day) => ({ id: day.id, label: day.label })),
    [days],
  );

  const mealTypeOptions = useMemo(
    () => mealTypes.map((mealType) => ({ id: mealType.id, label: mealType.label })),
    [mealTypes],
  );

  const menuRows = useMemo(
    () =>
      days.map((day) => {
        const mealsByType = day.meals.reduce((acc, meal) => {
          acc[meal.mealTypeId] = meal;
          return acc;
        }, {});

        const commonTotal = day.meals.reduce((sum, meal) => sum + getItemsCost(meal.commonItems), 0);
        const optionalTotal = day.meals.reduce((sum, meal) => sum + getItemsCost(meal.optionalItems), 0);

        return {
          id: day.id,
          dayId: day.id,
          dayLabel: day.label,
          mealsByType,
          costSummary: {
            commonTotal,
            optionalTotal,
            total: commonTotal + optionalTotal,
          },
        };
      }),
    [days],
  );

  const tomorrowForecast = useMemo(() => {
    if (!moduleData) {
      return { dayLabel: '', entries: [] };
    }

    const tomorrowDayId = getTomorrowDayId();
    const tomorrowMenu = days.find((day) => day.id === tomorrowDayId) || days[0];

    if (!tomorrowMenu) {
      return { dayLabel: '', entries: [] };
    }

    const mealEntries = mealTypes.map((mealType) => {
      const meal = tomorrowMenu.meals.find((entry) => entry.mealTypeId === mealType.id) || {
        commonItems: [],
        optionalItems: [],
      };

      const base = moduleData.settings.forecastBaseDemand?.[mealType.id] || 120;
      const bias = moduleData.settings.forecastBiasByMealType?.[mealType.id] || 0;

      return {
        key: `meal-${mealType.id}`,
        label: mealType.label,
        value: estimateDemand(base, meal.commonItems, meal.optionalItems, bias),
      };
    });

    const optionalDemandMap = {};
    tomorrowMenu.meals.forEach((meal, mealIndex) => {
      meal.optionalItems.forEach((item, itemIndex) => {
        const previous = optionalDemandMap[item.name] || 0;
        const projected = Math.max(14, Math.round((item.cost / 2.4) + 22 + (mealIndex * 5) - (itemIndex * 4)));
        optionalDemandMap[item.name] = previous + projected;
      });
    });

    const optionEntries = Object.entries(optionalDemandMap)
      .map(([label, value]) => ({ key: `option-${label}`, label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, moduleData.settings.forecastMaxOptions || 6);

    return {
      dayLabel: tomorrowMenu.label,
      entries: [...mealEntries, ...optionEntries],
    };
  }, [days, mealTypes, moduleData]);

  const cutoffTime = moduleData?.settings?.cutoffTime || '';

  const updateCutoffTime = useCallback(async (nextCutoffTime) => {
    const updated = await mealRepository.updateCutoffTime(nextCutoffTime, wing);
    queryCache.invalidate('meal-counts');
    setModuleData(updated);
  }, [wing, setModuleData]);

  const getMealForEdit = useCallback((dayId, mealTypeId) => {
    const day = days.find((entry) => entry.id === dayId);
    const meal = day?.meals.find((entry) => entry.mealTypeId === mealTypeId);

    return {
      dayId,
      mealTypeId,
      commonItems: cleanItems(meal?.commonItems),
      // Preserve isDefault from the server so the editor pre-populates the default radio button.
      optionalItems: cleanItems(meal?.optionalItems, true),
      commonText: formatItemsToText(meal?.commonItems),
      optionalText: formatOptionalItemsToText(meal?.optionalItems),
    };
  }, [days]);

  const saveMealConfiguration = useCallback(async ({ dayId, mealTypeId, commonItems, optionalItems, commonText, optionalText }) => {
    const nextCommonItems = Array.isArray(commonItems)
      ? cleanItems(commonItems)
      : parseItemsFromText(commonText, `${dayId}-${mealTypeId}-common`);
    // Include isDefault when sending optional items — critical for the default-fallback feature.
    const nextOptionalItems = Array.isArray(optionalItems)
      ? cleanItems(optionalItems, true)
      : parseOptionalItems(optionalText, `${dayId}-${mealTypeId}-optional`);

    const updated = await mealRepository.upsertMealConfiguration({
      dayId,
      mealTypeId,
      wing,
      commonItems: nextCommonItems,
      optionalItems: nextOptionalItems,
    });

    queryCache.invalidate('meal-counts');
    setModuleData(updated);
  }, [wing, setModuleData]);

  return {
    isLoading,
    errorMessage,
    cutoffTime,
    dayOptions,
    mealTypeOptions,
    menuRows,
    tomorrowForecast,
    loadModule,
    updateCutoffTime,
    getMealForEdit,
    saveMealConfiguration,
  };
}
