import { DAY_CONFIG, DEFAULT_CUTOFF_TIME } from '../../constants/mealConfig';

export const DEFAULT_MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', order: 1, startsAt: '07:30', endsAt: '09:00' },
  { id: 'lunch', label: 'Lunch', order: 2, startsAt: '12:30', endsAt: '14:00' },
  { id: 'dinner', label: 'Dinner', order: 3, startsAt: '19:30', endsAt: '21:00' },
];

const DAY_MEAL_ITEMS = {
  sun: {
    breakfast: {
      commonItems: [
        { id: 'sun-bf-paratha', name: 'Paratha', cost: 18 },
        { id: 'sun-bf-dal', name: 'Dal', cost: 10 },
      ],
      optionalItems: [{ id: 'sun-bf-egg', name: 'Egg', cost: 15 }],
    },
    lunch: {
      commonItems: [
        { id: 'sun-ln-rice', name: 'Rice', cost: 22 },
        { id: 'sun-ln-dal', name: 'Dal', cost: 10 },
        { id: 'sun-ln-veg', name: 'Vegetable', cost: 14 },
      ],
      optionalItems: [
        { id: 'sun-ln-chicken', name: 'Chicken', cost: 80 },
        { id: 'sun-ln-fish', name: 'Fish', cost: 60 },
      ],
    },
    dinner: {
      commonItems: [
        { id: 'sun-dn-rice', name: 'Rice', cost: 22 },
        { id: 'sun-dn-dal', name: 'Dal', cost: 10 },
      ],
      optionalItems: [
        { id: 'sun-dn-beef', name: 'Beef', cost: 120 },
        { id: 'sun-dn-egg', name: 'Egg Curry', cost: 40 },
      ],
    },
  },
  mon: {
    breakfast: {
      commonItems: [
        { id: 'mon-bf-khichuri', name: 'Khichuri', cost: 28 },
      ],
      optionalItems: [{ id: 'mon-bf-egg', name: 'Egg', cost: 15 }],
    },
    lunch: {
      commonItems: [
        { id: 'mon-ln-rice', name: 'Rice', cost: 22 },
        { id: 'mon-ln-dal', name: 'Dal', cost: 10 },
      ],
      optionalItems: [
        { id: 'mon-ln-fish', name: 'Fish', cost: 58 },
        { id: 'mon-ln-veg', name: 'Vegetarian', cost: 50 },
      ],
    },
    dinner: {
      commonItems: [
        { id: 'mon-dn-rice', name: 'Rice', cost: 22 },
        { id: 'mon-dn-dal', name: 'Dal', cost: 10 },
      ],
      optionalItems: [
        { id: 'mon-dn-chicken', name: 'Chicken', cost: 85 },
        { id: 'mon-dn-polao', name: 'Polao + Chicken', cost: 120 },
      ],
    },
  },
  tue: {
    breakfast: {
      commonItems: [
        { id: 'tue-bf-ruti', name: 'Ruti', cost: 14 },
        { id: 'tue-bf-veg', name: 'Mixed Veg', cost: 12 },
      ],
      optionalItems: [{ id: 'tue-bf-egg', name: 'Egg', cost: 15 }],
    },
    lunch: {
      commonItems: [
        { id: 'tue-ln-rice', name: 'Rice', cost: 22 },
        { id: 'tue-ln-dal', name: 'Dal', cost: 10 },
        { id: 'tue-ln-bhorta', name: 'Bhorta', cost: 12 },
      ],
      optionalItems: [
        { id: 'tue-ln-beef', name: 'Beef', cost: 120 },
        { id: 'tue-ln-chicken', name: 'Chicken', cost: 80 },
      ],
    },
    dinner: {
      commonItems: [
        { id: 'tue-dn-rice', name: 'Rice', cost: 22 },
        { id: 'tue-dn-dal', name: 'Dal', cost: 10 },
      ],
      optionalItems: [
        { id: 'tue-dn-fish', name: 'Fish', cost: 63 },
        { id: 'tue-dn-veg', name: 'Vegetarian', cost: 50 },
      ],
    },
  },
  wed: {
    breakfast: {
      commonItems: [
        { id: 'wed-bf-paratha', name: 'Paratha', cost: 18 },
        { id: 'wed-bf-dal', name: 'Dal', cost: 10 },
      ],
      optionalItems: [{ id: 'wed-bf-egg', name: 'Egg', cost: 15 }],
    },
    lunch: {
      commonItems: [
        { id: 'wed-ln-rice', name: 'Rice', cost: 22 },
        { id: 'wed-ln-dal', name: 'Dal', cost: 10 },
      ],
      optionalItems: [
        { id: 'wed-ln-fish', name: 'Fish', cost: 58 },
        { id: 'wed-ln-egg', name: 'Egg Curry', cost: 40 },
      ],
    },
    dinner: {
      commonItems: [
        { id: 'wed-dn-rice', name: 'Rice', cost: 22 },
        { id: 'wed-dn-dal', name: 'Dal', cost: 10 },
      ],
      optionalItems: [
        { id: 'wed-dn-chicken', name: 'Chicken', cost: 85 },
        { id: 'wed-dn-beef', name: 'Beef', cost: 120 },
      ],
    },
  },
  thu: {
    breakfast: {
      commonItems: [
        { id: 'thu-bf-khichuri', name: 'Khichuri', cost: 28 },
      ],
      optionalItems: [{ id: 'thu-bf-egg', name: 'Egg', cost: 15 }],
    },
    lunch: {
      commonItems: [
        { id: 'thu-ln-rice', name: 'Rice', cost: 22 },
        { id: 'thu-ln-dal', name: 'Dal', cost: 10 },
      ],
      optionalItems: [
        { id: 'thu-ln-chicken', name: 'Chicken', cost: 80 },
        { id: 'thu-ln-fish', name: 'Fish', cost: 60 },
      ],
    },
    dinner: {
      commonItems: [
        { id: 'thu-dn-rice', name: 'Rice', cost: 22 },
        { id: 'thu-dn-dal', name: 'Dal', cost: 10 },
      ],
      optionalItems: [
        { id: 'thu-dn-fish', name: 'Fish', cost: 63 },
        { id: 'thu-dn-veg', name: 'Vegetarian', cost: 50 },
      ],
    },
  },
  fri: {
    breakfast: {
      commonItems: [
        { id: 'fri-bf-ruti', name: 'Ruti', cost: 14 },
        { id: 'fri-bf-halva', name: 'Halva', cost: 16 },
      ],
      optionalItems: [{ id: 'fri-bf-egg', name: 'Egg', cost: 15 }],
    },
    lunch: {
      commonItems: [
        { id: 'fri-ln-rice', name: 'Rice', cost: 22 },
        { id: 'fri-ln-dal', name: 'Dal', cost: 10 },
        { id: 'fri-ln-salad', name: 'Salad', cost: 10 },
      ],
      optionalItems: [
        { id: 'fri-ln-beef', name: 'Beef', cost: 120 },
        { id: 'fri-ln-chicken', name: 'Chicken', cost: 80 },
      ],
    },
    dinner: {
      commonItems: [
        { id: 'fri-dn-rice', name: 'Rice', cost: 22 },
        { id: 'fri-dn-dal', name: 'Dal', cost: 10 },
      ],
      optionalItems: [
        { id: 'fri-dn-fish', name: 'Fish', cost: 63 },
        { id: 'fri-dn-egg', name: 'Egg Curry', cost: 40 },
      ],
    },
  },
  sat: {
    breakfast: {
      commonItems: [
        { id: 'sat-bf-paratha', name: 'Paratha', cost: 18 },
        { id: 'sat-bf-veg', name: 'Vegetable', cost: 12 },
      ],
      optionalItems: [{ id: 'sat-bf-egg', name: 'Egg', cost: 15 }],
    },
    lunch: {
      commonItems: [
        { id: 'sat-ln-rice', name: 'Rice', cost: 22 },
        { id: 'sat-ln-dal', name: 'Dal', cost: 10 },
      ],
      optionalItems: [
        { id: 'sat-ln-chicken', name: 'Chicken', cost: 80 },
        { id: 'sat-ln-veg', name: 'Vegetarian', cost: 50 },
      ],
    },
    dinner: {
      commonItems: [
        { id: 'sat-dn-rice', name: 'Rice', cost: 22 },
        { id: 'sat-dn-dal', name: 'Dal', cost: 10 },
      ],
      optionalItems: [
        { id: 'sat-dn-rice-meat', name: 'Rice + Meat', cost: 80 },
        { id: 'sat-dn-polao-chicken', name: 'Polao + Chicken', cost: 120 },
      ],
    },
  },
};

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

export function createDefaultStudentPreferences(mealTypes = DEFAULT_MEAL_TYPES) {
  return mealTypes.reduce((acc, mealType) => {
    acc[mealType.id] = { enabled: true, optionItemId: '' };
    return acc;
  }, {});
}

export function createMealModuleSeed() {
  const days = DAY_CONFIG.map((dayConfig) => {
    const dayMeals = DAY_MEAL_ITEMS[dayConfig.id] || {};

    return {
      id: dayConfig.id,
      label: dayConfig.label,
      order: dayConfig.order,
      meals: DEFAULT_MEAL_TYPES.map((mealType) => {
        const mealEntry = dayMeals[mealType.id] || { commonItems: [], optionalItems: [] };
        return {
          mealTypeId: mealType.id,
          commonItems: clone(mealEntry.commonItems),
          optionalItems: clone(mealEntry.optionalItems),
          status: 'active',
        };
      }),
    };
  });

  return {
    settings: {
      cutoffTime: DEFAULT_CUTOFF_TIME,
      mealTypes: clone(DEFAULT_MEAL_TYPES),
      forecastBaseDemand: {
        breakfast: 160,
        lunch: 190,
        dinner: 180,
      },
      forecastBiasByMealType: {
        breakfast: 6,
        lunch: 12,
        dinner: 4,
      },
      forecastMaxOptions: 6,
    },
    days,
  };
}

export const mealModuleSeed = createMealModuleSeed();

// Backward-compatible export for legacy code paths.
export const weeklyMenu = mealModuleSeed.days.map((day) => ({
  day: day.label,
  meals: day.meals.map((meal) => ({
    mealType: DEFAULT_MEAL_TYPES.find((type) => type.id === meal.mealTypeId)?.label || meal.mealTypeId,
    commonItems: clone(meal.commonItems),
    optionalItems: clone(meal.optionalItems),
  })),
}));
