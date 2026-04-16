import {
  createDefaultStudentPreferences,
  createMealModuleSeed,
} from '../../data/mock/mealData';
import { CUTOFF_STORAGE_KEY, DEFAULT_CUTOFF_TIME } from '../../constants/mealConfig';

const MODULE_STORAGE_KEY = 'meal_module_state_v1';
const STUDENT_PREF_STORAGE_KEY = 'meal_student_preferences_v1';
const DEFAULT_STUDENT_ID = 'active-student';

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

function readJSON(storageKey, fallbackFactory) {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    const fallback = fallbackFactory();
    localStorage.setItem(storageKey, JSON.stringify(fallback));
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch {
    const fallback = fallbackFactory();
    localStorage.setItem(storageKey, JSON.stringify(fallback));
    return fallback;
  }
}

function writeJSON(storageKey, value) {
  localStorage.setItem(storageKey, JSON.stringify(value));
}

function normalizeModuleState(moduleState) {
  const state = moduleState && typeof moduleState === 'object'
    ? moduleState
    : createMealModuleSeed();

  if (!state.settings) {
    state.settings = createMealModuleSeed().settings;
  }

  const legacyCutoff = localStorage.getItem(CUTOFF_STORAGE_KEY);
  if (!state.settings.cutoffTime) {
    state.settings.cutoffTime = legacyCutoff || DEFAULT_CUTOFF_TIME;
  }

  localStorage.setItem(CUTOFF_STORAGE_KEY, state.settings.cutoffTime);
  return state;
}

function getModuleState() {
  const rawState = readJSON(MODULE_STORAGE_KEY, () => createMealModuleSeed());
  const normalized = normalizeModuleState(rawState);
  writeJSON(MODULE_STORAGE_KEY, normalized);
  return normalized;
}

function setModuleState(nextState) {
  const normalized = normalizeModuleState(nextState);
  writeJSON(MODULE_STORAGE_KEY, normalized);
  localStorage.setItem(CUTOFF_STORAGE_KEY, normalized.settings.cutoffTime);
  return normalized;
}

function getStudentPreferencesMap() {
  return readJSON(STUDENT_PREF_STORAGE_KEY, () => ({}));
}

function setStudentPreferencesMap(nextMap) {
  writeJSON(STUDENT_PREF_STORAGE_KEY, nextMap);
}

function parseItems(items) {
  return (items || [])
    .filter((item) => item && typeof item.name === 'string')
    .map((item) => ({
      id: item.id || `item-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: item.name.trim(),
      cost: Number(item.cost) || 0,
    }));
}

const localRepository = {
  async getModule() {
    return clone(getModuleState());
  },

  async updateCutoffTime(cutoffTime) {
    const state = getModuleState();
    state.settings.cutoffTime = cutoffTime || DEFAULT_CUTOFF_TIME;
    return clone(setModuleState(state));
  },

  async upsertMealConfiguration({ dayId, mealTypeId, commonItems, optionalItems }) {
    const state = getModuleState();
    const day = state.days.find((entry) => entry.id === dayId);

    if (!day) {
      throw new Error(`Day ${dayId} was not found in meal configuration.`);
    }

    const meal = day.meals.find((entry) => entry.mealTypeId === mealTypeId);

    if (!meal) {
      day.meals.push({
        mealTypeId,
        commonItems: parseItems(commonItems),
        optionalItems: parseItems(optionalItems),
        status: 'active',
      });
    } else {
      meal.commonItems = parseItems(commonItems);
      meal.optionalItems = parseItems(optionalItems);
    }

    return clone(setModuleState(state));
  },

  async getStudentPreferences(studentId = DEFAULT_STUDENT_ID) {
    const state = getModuleState();
    const allPrefs = getStudentPreferencesMap();
    const current = allPrefs[studentId] || createDefaultStudentPreferences(state.settings.mealTypes);
    return clone(current);
  },

  async saveStudentPreferences(studentId = DEFAULT_STUDENT_ID, preferences) {
    const state = getModuleState();
    const allPrefs = getStudentPreferencesMap();
    const normalized = { ...createDefaultStudentPreferences(state.settings.mealTypes), ...(preferences || {}) };
    allPrefs[studentId] = normalized;
    setStudentPreferencesMap(allPrefs);
    return clone(normalized);
  },
};

const apiRepository = {
  async getModule() {
    throw new Error('API repository is not configured yet. Switch VITE_MEAL_DATA_SOURCE to local.');
  },
  async updateCutoffTime() {
    throw new Error('API repository is not configured yet.');
  },
  async upsertMealConfiguration() {
    throw new Error('API repository is not configured yet.');
  },
  async getStudentPreferences() {
    throw new Error('API repository is not configured yet.');
  },
  async saveStudentPreferences() {
    throw new Error('API repository is not configured yet.');
  },
};

const source = import.meta.env.VITE_MEAL_DATA_SOURCE || 'local';
const mealRepository = source === 'api' ? apiRepository : localRepository;

export default mealRepository;
