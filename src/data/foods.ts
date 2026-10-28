export type FoodItem = {
  id: string;
  name: string;
  englishName?: string;
  romanUrduName?: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving: string;
  tags?: string[];
};

export type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';
export type MealTag = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Pre-workout' | 'Post-workout';

export type MealPlanEntry = {
  day: string;
  meals: {
    slot: MealSlot;
    tag: MealTag;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }[];
};

const baseFoods: FoodItem[] = [
  {id: 'anda-paratha', name: 'Anda Paratha', englishName: 'Egg Paratha', romanUrduName: 'Anda Paratha', category: 'Pakistani Breakfast', calories: 420, protein: 22, carbs: 46, fat: 18, serving: '1 serving', tags: ['Breakfast']},
  {id: 'karak-chai', name: 'Karak Chai', englishName: 'Karak Tea', romanUrduName: 'Karak Chai', category: 'Beverage', calories: 120, protein: 4, carbs: 10, fat: 5, serving: '1 cup', tags: ['Breakfast']},
  {id: 'chicken-biryani', name: 'Chicken Biryani', englishName: 'Chicken Biryani', romanUrduName: 'Chicken Biryani', category: 'Pakistani Main', calories: 680, protein: 42, carbs: 72, fat: 24, serving: '1 plate', tags: ['Lunch', 'Dinner']},
  {id: 'halwa-poori', name: 'Halwa Puri', englishName: 'Halwa Puri', romanUrduName: 'Halwa Puri', category: 'Pakistani Breakfast', calories: 560, protein: 18, carbs: 62, fat: 24, serving: '1 serving', tags: ['Breakfast']},
  {id: 'nihari', name: 'Nihari', englishName: 'Nihari', romanUrduName: 'Nihari', category: 'Pakistani Main', calories: 620, protein: 36, carbs: 32, fat: 28, serving: '1 bowl', tags: ['Lunch', 'Dinner']},
  {id: 'seekh-kebab', name: 'Seekh Kebab', englishName: 'Seekh Kebab', romanUrduName: 'Seekh Kebab', category: 'Pakistani Main', calories: 310, protein: 28, carbs: 12, fat: 18, serving: '2 kebabs', tags: ['Lunch', 'Dinner']},
  {id: 'chapli-kebab', name: 'Chapli Kebab', englishName: 'Chapli Kebab', romanUrduName: 'Chapli Kebab', category: 'Pakistani Main', calories: 280, protein: 24, carbs: 14, fat: 15, serving: '2 kebabs', tags: ['Lunch', 'Dinner']},
  {id: 'karahi-gosht', name: 'Chicken Karahi', englishName: 'Chicken Karahi', romanUrduName: 'Chicken Karahi', category: 'Pakistani Main', calories: 520, protein: 36, carbs: 18, fat: 26, serving: '1 plate', tags: ['Lunch', 'Dinner']},
  {id: 'tikka', name: 'Chicken Tikka', englishName: 'Chicken Tikka', romanUrduName: 'Chicken Tikka', category: 'Pakistani Main', calories: 340, protein: 38, carbs: 8, fat: 16, serving: '200g', tags: ['Lunch', 'Dinner']},
  {id: 'daal', name: 'Daal', englishName: 'Lentil Curry', romanUrduName: 'Daal', category: 'Pakistani Main', calories: 260, protein: 18, carbs: 28, fat: 8, serving: '1 bowl', tags: ['Lunch', 'Dinner']},
  {id: 'khichdi', name: 'Khichdi', englishName: 'Khichdi', romanUrduName: 'Khichdi', category: 'Pakistani Main', calories: 340, protein: 16, carbs: 48, fat: 8, serving: '1 bowl', tags: ['Lunch', 'Dinner']},
  {id: 'aaloo-paratha', name: 'Aloo Paratha', englishName: 'Potato Paratha', romanUrduName: 'Aloo Paratha', category: 'Pakistani Breakfast', calories: 390, protein: 14, carbs: 48, fat: 16, serving: '1 paratha', tags: ['Breakfast']},
  {id: 'shami-kebab', name: 'Shami Kebab', englishName: 'Shami Kebab', romanUrduName: 'Shami Kebab', category: 'Pakistani Snack', calories: 260, protein: 20, carbs: 18, fat: 12, serving: '2 kebabs', tags: ['Snack']},
  {id: 'samosa', name: 'Samosa', englishName: 'Samosa', romanUrduName: 'Samosa', category: 'Pakistani Snack', calories: 240, protein: 7, carbs: 22, fat: 12, serving: '1 piece', tags: ['Snack']},
  {id: 'pakora', name: 'Pakora', englishName: 'Pakora', romanUrduName: 'Pakora', category: 'Pakistani Snack', calories: 210, protein: 8, carbs: 16, fat: 12, serving: '2 pieces', tags: ['Snack']},
  {id: 'jalebi', name: 'Jalebi', englishName: 'Jalebi', romanUrduName: 'Jalebi', category: 'Pakistani Sweet', calories: 255, protein: 3, carbs: 40, fat: 7, serving: '2 pieces', tags: ['Snack']},
  {id: 'gulab-jamun', name: 'Gulab Jamun', englishName: 'Gulab Jamun', romanUrduName: 'Gulab Jamun', category: 'Pakistani Sweet', calories: 220, protein: 4, carbs: 28, fat: 9, serving: '2 pieces', tags: ['Snack']},
  {id: 'lassi', name: 'Lassi', englishName: 'Lassi', romanUrduName: 'Lassi', category: 'Pakistani Beverage', calories: 190, protein: 10, carbs: 18, fat: 6, serving: '1 glass', tags: ['Breakfast']},
  {id: 'kheer', name: 'Kheer', englishName: 'Rice Pudding', romanUrduName: 'Kheer', category: 'Pakistani Sweet', calories: 320, protein: 9, carbs: 45, fat: 8, serving: '1 bowl', tags: ['Snack']},
  {id: 'plain-rice', name: 'Plain Rice', englishName: 'White Rice', romanUrduName: 'Safed Chawal', category: 'Carb Base', calories: 205, protein: 4, carbs: 45, fat: 0.5, serving: '1 cup cooked', tags: ['Lunch', 'Dinner']},
  {id: 'roti', name: 'Chapati / Roti', englishName: 'Flatbread', romanUrduName: 'Roti', category: 'Bread', calories: 120, protein: 4, carbs: 22, fat: 1, serving: '1 roti', tags: ['Lunch', 'Dinner']},
  {id: 'naan', name: 'Naan', englishName: 'Flatbread', romanUrduName: 'Naan', category: 'Bread', calories: 260, protein: 8, carbs: 38, fat: 5, serving: '1 naan', tags: ['Lunch', 'Dinner']},
  {id: 'paratha-plain', name: 'Plain Paratha', englishName: 'Plain Paratha', romanUrduName: 'Plain Paratha', category: 'Bread', calories: 260, protein: 6, carbs: 36, fat: 9, serving: '1 paratha', tags: ['Breakfast']},
  {id: 'bolognese-pasta', name: 'Pasta Bolognese', englishName: 'Pasta Bolognese', romanUrduName: 'Pasta Bolognese', category: 'International Main', calories: 540, protein: 28, carbs: 62, fat: 18, serving: '1 bowl', tags: ['Lunch', 'Dinner']},
  {id: 'grilled-chicken', name: 'Grilled Chicken Breast', englishName: 'Grilled Chicken', romanUrduName: 'Grilled Chicken', category: 'International Protein', calories: 260, protein: 50, carbs: 0, fat: 6, serving: '180g', tags: ['Lunch', 'Dinner', 'Post-workout']},
  {id: 'salmon-fillet', name: 'Salmon Fillet', englishName: 'Salmon', romanUrduName: 'Salmon', category: 'International Protein', calories: 310, protein: 34, carbs: 0, fat: 18, serving: '170g', tags: ['Dinner']},
  {id: 'oats-milk', name: 'Oats with Milk', englishName: 'Oats with Milk', romanUrduName: 'Oats with Milk', category: 'Breakfast', calories: 350, protein: 18, carbs: 42, fat: 9, serving: '1 bowl', tags: ['Breakfast']},
  {id: 'banana', name: 'Banana', englishName: 'Banana', romanUrduName: 'Kela', category: 'Fruit', calories: 105, protein: 1, carbs: 27, fat: 0.3, serving: '1 medium', tags: ['Snack', 'Pre-workout']},
  {id: 'eggs', name: 'Eggs', englishName: 'Eggs', romanUrduName: 'Anday', category: 'Protein', calories: 155, protein: 13, carbs: 1, fat: 11, serving: '2 large', tags: ['Breakfast']},
  {id: 'brown-lentils', name: 'Brown Lentils', englishName: 'Lentils', romanUrduName: 'Masoor', category: 'Protein', calories: 230, protein: 18, carbs: 40, fat: 1, serving: '1 cup cooked', tags: ['Lunch', 'Dinner']},
  {id: 'greek-yogurt', name: 'Greek Yogurt', englishName: 'Greek Yogurt', romanUrduName: 'Greek Yogurt', category: 'Dairy', calories: 140, protein: 17, carbs: 6, fat: 0.5, serving: '200g', tags: ['Breakfast', 'Snack']},
  {id: 'avocado', name: 'Avocado', englishName: 'Avocado', romanUrduName: 'Avocado', category: 'Healthy Fat', calories: 160, protein: 2, carbs: 9, fat: 15, serving: '1 whole', tags: ['Breakfast', 'Snack']},
  {id: 'whole-wheat-bread', name: 'Whole Wheat Bread', englishName: 'Whole Wheat Bread', romanUrduName: 'Whole Wheat Bread', category: 'Bread', calories: 170, protein: 8, carbs: 30, fat: 2, serving: '2 slices', tags: ['Breakfast']},
  {id: 'whey-protein', name: 'Whey Protein Shake', englishName: 'Protein Shake', romanUrduName: 'Protein Shake', category: 'Supplement', calories: 150, protein: 24, carbs: 5, fat: 2, serving: '1 scoop', tags: ['Post-workout']},
  {id: 'almonds', name: 'Almonds', englishName: 'Almonds', romanUrduName: 'Badam', category: 'Healthy Fat', calories: 164, protein: 6, carbs: 6, fat: 14, serving: '1 oz', tags: ['Snack']},
  {id: 'burger', name: 'Beef Burger', englishName: 'Beef Burger', romanUrduName: 'Beef Burger', category: 'Fast Food', calories: 540, protein: 28, carbs: 42, fat: 28, serving: '1 burger', tags: ['Lunch', 'Dinner']},
  {id: 'fried-chicken', name: 'Fried Chicken', englishName: 'Fried Chicken', romanUrduName: 'Fried Chicken', category: 'Fast Food', calories: 420, protein: 26, carbs: 20, fat: 24, serving: '1 serving', tags: ['Lunch', 'Dinner']},
  {id: 'fries', name: 'French Fries', englishName: 'French Fries', romanUrduName: 'Fries', category: 'Fast Food', calories: 320, protein: 4, carbs: 41, fat: 16, serving: '1 medium', tags: ['Snack']},
  {id: 'cola', name: 'Cola', englishName: 'Cola', romanUrduName: 'Cola', category: 'Fast Food Beverage', calories: 150, protein: 0, carbs: 39, fat: 0, serving: '1 can', tags: ['Snack']},
  {id: 'pizza', name: 'Cheese Pizza', englishName: 'Cheese Pizza', romanUrduName: 'Pizza', category: 'Fast Food', calories: 520, protein: 24, carbs: 52, fat: 20, serving: '2 slices', tags: ['Lunch', 'Dinner']},
  {id: 'sandwich', name: 'Chicken Sandwich', englishName: 'Chicken Sandwich', romanUrduName: 'Chicken Sandwich', category: 'Fast Food', calories: 470, protein: 26, carbs: 45, fat: 18, serving: '1 sandwich', tags: ['Lunch']},
  {id: 'zinger', name: 'Zinger Burger', englishName: 'Zinger Burger', romanUrduName: 'Zinger Burger', category: 'Fast Food', calories: 620, protein: 29, carbs: 52, fat: 32, serving: '1 burger', tags: ['Lunch', 'Dinner']},
  {id: 'baked-salmon', name: 'Baked Salmon', englishName: 'Baked Salmon', romanUrduName: 'Baked Salmon', category: 'International Main', calories: 360, protein: 38, carbs: 0, fat: 21, serving: '170g', tags: ['Dinner']},
  {id: 'turkey-breast', name: 'Turkey Breast', englishName: 'Turkey Breast', romanUrduName: 'Turkey Breast', category: 'International Protein', calories: 220, protein: 42, carbs: 0, fat: 5, serving: '150g', tags: ['Lunch', 'Dinner']},
  {id: 'pasta', name: 'Whole Wheat Pasta', englishName: 'Whole Wheat Pasta', romanUrduName: 'Pasta', category: 'International Main', calories: 360, protein: 14, carbs: 58, fat: 4, serving: '1 bowl', tags: ['Lunch', 'Dinner']},
  {id: 'rice-cake', name: 'Rice Cake', englishName: 'Rice Cake', romanUrduName: 'Rice Cake', category: 'Snack', calories: 35, protein: 0.5, carbs: 7, fat: 0.1, serving: '2 cakes', tags: ['Snack']},
  {id: 'peanut-butter', name: 'Peanut Butter', englishName: 'Peanut Butter', romanUrduName: 'Peanut Butter', category: 'Healthy Fat', calories: 190, protein: 8, carbs: 8, fat: 16, serving: '2 tbsp', tags: ['Snack']},
  {id: 'apple', name: 'Apple', englishName: 'Apple', romanUrduName: 'Seb', category: 'Fruit', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, serving: '1 medium', tags: ['Snack']},
  {id: 'orange', name: 'Orange', englishName: 'Orange', romanUrduName: 'Santra', category: 'Fruit', calories: 62, protein: 1, carbs: 15, fat: 0.2, serving: '1 medium', tags: ['Snack']},
  {id: 'mango', name: 'Mango', englishName: 'Mango', romanUrduName: 'Aam', category: 'Fruit', calories: 100, protein: 1, carbs: 22, fat: 0.5, serving: '1 medium', tags: ['Snack']},
  {id: 'trail-mix', name: 'Trail Mix', englishName: 'Trail Mix', romanUrduName: 'Trail Mix', category: 'Snack', calories: 230, protein: 6, carbs: 20, fat: 14, serving: '1 pouch', tags: ['Snack']},
  {id: 'dark-chocolate', name: 'Dark Chocolate', englishName: 'Dark Chocolate', romanUrduName: 'Dark Chocolate', category: 'Sweet', calories: 170, protein: 2, carbs: 24, fat: 9, serving: '30g', tags: ['Snack']},
  {id: 'protein-bar', name: 'Protein Bar', englishName: 'Protein Bar', romanUrduName: 'Protein Bar', category: 'Supplement', calories: 210, protein: 20, carbs: 18, fat: 6, serving: '1 bar', tags: ['Snack', 'Pre-workout']},
  {id: 'hummus', name: 'Hummus', englishName: 'Hummus', romanUrduName: 'Hummus', category: 'Dip', calories: 150, protein: 5, carbs: 12, fat: 8, serving: '4 tbsp', tags: ['Snack']},
  {id: 'veggies', name: 'Mixed Vegetables', englishName: 'Mixed Vegetables', romanUrduName: 'Sabzi', category: 'Side', calories: 120, protein: 4, carbs: 18, fat: 2, serving: '1 cup', tags: ['Lunch', 'Dinner']},
  {id: 'mashroom', name: 'Mushroom Stir Fry', englishName: 'Mushroom Stir Fry', romanUrduName: 'Mushroom', category: 'Side', calories: 160, protein: 7, carbs: 12, fat: 10, serving: '1 cup', tags: ['Lunch', 'Dinner']},
  {id: 'soup', name: 'Chicken Soup', englishName: 'Chicken Soup', romanUrduName: 'Chicken Soup', category: 'Soup', calories: 180, protein: 20, carbs: 8, fat: 4, serving: '1 bowl', tags: ['Lunch']},
  {id: 'mayo', name: 'Mayo Sandwich', englishName: 'Mayo Sandwich', romanUrduName: 'Mayo Sandwich', category: 'Quick Meal', calories: 390, protein: 16, carbs: 32, fat: 18, serving: '1 sandwich', tags: ['Lunch']},
  {id: 'fruit-salad', name: 'Fruit Salad', englishName: 'Fruit Salad', romanUrduName: 'Fruit Salad', category: 'Fruit', calories: 140, protein: 2, carbs: 30, fat: 0.5, serving: '1 bowl', tags: ['Snack']},
  {id: 'muesli', name: 'Muesli Bowl', englishName: 'Muesli Bowl', romanUrduName: 'Muesli Bowl', category: 'Breakfast', calories: 330, protein: 12, carbs: 44, fat: 9, serving: '1 bowl', tags: ['Breakfast']},
  {id: 'egg-wrap', name: 'Egg Wrap', englishName: 'Egg Wrap', romanUrduName: 'Egg Wrap', category: 'Breakfast', calories: 290, protein: 18, carbs: 28, fat: 10, serving: '1 wrap', tags: ['Breakfast']},
  {id: 'peshawari-naan', name: 'Peshawari Naan', englishName: 'Peshawari Naan', romanUrduName: 'Peshawari Naan', category: 'Bread', calories: 300, protein: 10, carbs: 42, fat: 8, serving: '1 naan', tags: ['Dinner']},
  {id: 'mince-kabab', name: 'Mince Kebab', englishName: 'Mince Kebab', romanUrduName: 'Mince Kebab', category: 'Pakistani Main', calories: 330, protein: 25, carbs: 10, fat: 18, serving: '2 pieces', tags: ['Dinner']},
  {id: 'biryani-plate', name: 'Chicken Biryani Plate', englishName: 'Chicken Biryani Plate', romanUrduName: 'Chicken Biryani Plate', category: 'Pakistani Main', calories: 710, protein: 46, carbs: 78, fat: 24, serving: '1 plate', tags: ['Lunch', 'Dinner']},
  {id: 'malai-boti', name: 'Malai Boti', englishName: 'Malai Boti', romanUrduName: 'Malai Boti', category: 'Pakistani Main', calories: 350, protein: 30, carbs: 8, fat: 18, serving: '150g', tags: ['Dinner']},
  {id: 'fish', name: 'Grilled Fish', englishName: 'Grilled Fish', romanUrduName: 'Fish', category: 'Protein', calories: 280, protein: 32, carbs: 0, fat: 12, serving: '180g', tags: ['Dinner']},
  {id: 'tomato-soup', name: 'Tomato Soup', englishName: 'Tomato Soup', romanUrduName: 'Tomato Soup', category: 'Soup', calories: 130, protein: 4, carbs: 16, fat: 4, serving: '1 bowl', tags: ['Lunch']},
  {id: 'corn-flakes', name: 'Corn Flakes', englishName: 'Corn Flakes', romanUrduName: 'Corn Flakes', category: 'Breakfast', calories: 210, protein: 4, carbs: 46, fat: 0.5, serving: '1 bowl', tags: ['Breakfast']},
  {id: 'spinach-omelet', name: 'Spinach Omelet', englishName: 'Spinach Omelet', romanUrduName: 'Spinach Omelet', category: 'Breakfast', calories: 260, protein: 18, carbs: 8, fat: 14, serving: '2 eggs', tags: ['Breakfast']},
  {id: 'protein-oats', name: 'Protein Oats', englishName: 'Protein Oats', romanUrduName: 'Protein Oats', category: 'Breakfast', calories: 420, protein: 30, carbs: 38, fat: 8, serving: '1 bowl', tags: ['Breakfast', 'Pre-workout']},
];

export const foodLibrary: FoodItem[] = baseFoods;

export const starterPrograms = [
  {id: 'program-1', name: 'Athleo Strength Foundation', focus: 'Hypertrophy', durationWeeks: 8, goal: 'Build overall strength and muscle'},
  {id: 'program-2', name: 'Lean Muscle Phase', focus: 'Muscle Gains', durationWeeks: 10, goal: 'Add size without fat gain'},
  {id: 'program-3', name: 'Fat Loss Engine', focus: 'Cutting', durationWeeks: 8, goal: 'Keep lean mass while dropping fat'},
  {id: 'program-4', name: 'Power Build', focus: 'Explosive strength', durationWeeks: 12, goal: 'Increase force and athletic performance'},
  {id: 'program-5', name: 'Home Performance', focus: 'Minimal equipment', durationWeeks: 6, goal: 'Train anywhere with full-body impact'},
  {id: 'program-6', name: 'Recovery Reset', focus: 'Mobility + conditioning', durationWeeks: 4, goal: 'Reduce fatigue and maintain movement quality'},
  {id: 'program-7', name: 'Upper Body Blast', focus: 'Chest, back and shoulders', durationWeeks: 6, goal: 'Drive upper-body size and pressing strength'},
  {id: 'program-8', name: 'Lower Body Dominance', focus: 'Legs and posterior chain', durationWeeks: 8, goal: 'Build squat, hinge and leg strength'},
  {id: 'program-9', name: 'Core Stability Builder', focus: 'Trunk control', durationWeeks: 5, goal: 'Improve anti-rotation and bracing'},
  {id: 'program-10', name: 'Cardio Conditioning', focus: 'Aerobic power', durationWeeks: 6, goal: 'Raise conditioning and work capacity'},
  {id: 'program-11', name: 'Body Recomposition', focus: 'Nutrition + training', durationWeeks: 10, goal: 'Improve physique while increasing performance'},
  {id: 'program-12', name: 'Performance Peak', focus: 'Competition prep', durationWeeks: 12, goal: 'Peak strength and conditioning'},
];

export const defaultMacroTargets = {
  calories: 2500,
  protein: 180,
  carbs: 260,
  fat: 68,
};

export const mealPlan: MealPlanEntry[] = [
  {
    day: 'Day 1',
    meals: [
      {slot: 'Breakfast', tag: 'Breakfast', name: 'Anda Paratha + Karak Chai', calories: 540, protein: 26, carbs: 56, fat: 23},
      {slot: 'Lunch', tag: 'Lunch', name: 'Chicken Biryani + Raita', calories: 760, protein: 48, carbs: 84, fat: 26},
      {slot: 'Dinner', tag: 'Dinner', name: 'Grilled Chicken, Rice & Mixed Vegetables', calories: 680, protein: 54, carbs: 62, fat: 16},
      {slot: 'Snacks', tag: 'Snack', name: 'Banana + Greek Yogurt', calories: 245, protein: 18, carbs: 30, fat: 5},
    ],
  },
  {
    day: 'Day 2',
    meals: [
      {slot: 'Breakfast', tag: 'Breakfast', name: 'Oats with Milk + Almonds', calories: 500, protein: 22, carbs: 52, fat: 16},
      {slot: 'Lunch', tag: 'Lunch', name: 'Chicken Karahi + Chapati', calories: 690, protein: 40, carbs: 36, fat: 33},
      {slot: 'Dinner', tag: 'Dinner', name: 'Salmon Fillet + Rice + Veggies', calories: 700, protein: 46, carbs: 38, fat: 26},
      {slot: 'Snacks', tag: 'Pre-workout', name: 'Protein Shake + Banana', calories: 255, protein: 25, carbs: 24, fat: 3},
    ],
  },
  {
    day: 'Day 3',
    meals: [
      {slot: 'Breakfast', tag: 'Breakfast', name: 'Eggs + Whole Wheat Toast + Fruit', calories: 430, protein: 24, carbs: 28, fat: 20},
      {slot: 'Lunch', tag: 'Lunch', name: 'Daal + Rice + Salad', calories: 600, protein: 30, carbs: 54, fat: 14},
      {slot: 'Dinner', tag: 'Dinner', name: 'Chicken Tikka + Naan + Veggie Mix', calories: 710, protein: 44, carbs: 52, fat: 24},
      {slot: 'Snacks', tag: 'Snack', name: 'Trail Mix + Apple', calories: 330, protein: 7, carbs: 26, fat: 18},
    ],
  },
  {
    day: 'Day 4',
    meals: [
      {slot: 'Breakfast', tag: 'Breakfast', name: 'Aloo Paratha + Lassi', calories: 520, protein: 18, carbs: 58, fat: 18},
      {slot: 'Lunch', tag: 'Lunch', name: 'Seekh Kebab + Rice + Cucumber Salad', calories: 620, protein: 38, carbs: 42, fat: 20},
      {slot: 'Dinner', tag: 'Dinner', name: 'Turkey Breast + Potatoes + Veg', calories: 640, protein: 50, carbs: 46, fat: 15},
      {slot: 'Snacks', tag: 'Post-workout', name: 'Whey Protein + Mango', calories: 290, protein: 28, carbs: 22, fat: 5},
    ],
  },
  {
    day: 'Day 5',
    meals: [
      {slot: 'Breakfast', tag: 'Breakfast', name: 'Halwa Puri + Chai', calories: 610, protein: 18, carbs: 68, fat: 26},
      {slot: 'Lunch', tag: 'Lunch', name: 'Chicken Biryani + Salad', calories: 760, protein: 44, carbs: 82, fat: 25},
      {slot: 'Dinner', tag: 'Dinner', name: 'Grilled Fish + Rice + Greens', calories: 640, protein: 42, carbs: 36, fat: 18},
      {slot: 'Snacks', tag: 'Snack', name: 'Protein Bar + Orange', calories: 265, protein: 20, carbs: 30, fat: 7},
    ],
  },
  {
    day: 'Day 6',
    meals: [
      {slot: 'Breakfast', tag: 'Breakfast', name: 'Spinach Omelet + Toast', calories: 390, protein: 23, carbs: 18, fat: 18},
      {slot: 'Lunch', tag: 'Lunch', name: 'Nihari + Naan', calories: 760, protein: 42, carbs: 46, fat: 34},
      {slot: 'Dinner', tag: 'Dinner', name: 'Chicken Karahi + Chapati + Rice', calories: 720, protein: 46, carbs: 48, fat: 31},
      {slot: 'Snacks', tag: 'Pre-workout', name: 'Banana + Peanut Butter', calories: 210, protein: 7, carbs: 26, fat: 9},
    ],
  },
  {
    day: 'Day 7',
    meals: [
      {slot: 'Breakfast', tag: 'Breakfast', name: 'Protein Oats + Berries', calories: 470, protein: 30, carbs: 42, fat: 10},
      {slot: 'Lunch', tag: 'Lunch', name: 'Chapli Kebab + Roti + Daal', calories: 620, protein: 36, carbs: 40, fat: 20},
      {slot: 'Dinner', tag: 'Dinner', name: 'Chicken Biryani + Yogurt', calories: 760, protein: 46, carbs: 78, fat: 20},
      {slot: 'Snacks', tag: 'Snack', name: 'Fruit Salad + Dark Chocolate', calories: 255, protein: 4, carbs: 38, fat: 8},
    ],
  },
];

export const foodLogMethods = [
  'Search',
  'Recents',
  'Favourites',
  'Copy yesterday\'s meal',
  'Barcode scan',
  'Custom food',
  'Custom recipe',
  'Quick-add calories',
];

export const appSettings = [
  {key: 'weightUnit', label: 'Weight unit', value: 'kg', options: ['kg', 'lbs']},
  {key: 'heightUnit', label: 'Height unit', value: 'cm', options: ['cm', 'ft-in']},
  {key: 'language', label: 'Language', value: 'English', options: ['English', 'Urdu']},
  {key: 'haptics', label: 'Haptics', value: 'On', options: ['On', 'Off']},
  {key: 'sound', label: 'Sound', value: 'On', options: ['On', 'Off']},
  {key: 'reduceMotion', label: 'Reduce motion', value: 'On', options: ['On', 'Off']},
  {key: 'performanceMode', label: 'Performance mode', value: 'Balanced', options: ['Balanced', 'Boost', 'Battery']},
  {key: 'connectedDevices', label: 'Connected devices', value: '2', options: ['0', '1', '2']},
  {key: 'syncStatus', label: 'Sync status', value: 'Synced', options: ['Synced', 'Pending', 'Offline']},
  {key: 'notifications', label: 'Notification controls', value: 'Enabled', options: ['Enabled', 'Muted', 'Quiet hours']},
  {key: 'quietHours', label: 'Quiet hours', value: '10 PM - 7 AM', options: ['10 PM - 7 AM', '11 PM - 8 AM', 'Off']},
  {key: 'biometricUnlock', label: 'Biometric unlock', value: 'Enabled', options: ['Enabled', 'Disabled']},
  {key: 'privacy', label: 'Privacy', value: 'Standard', options: ['Standard', 'Enhanced']},
  {key: 'dataExport', label: 'Data export', value: 'CSV', options: ['CSV', 'JSON']},
  {key: 'accountDeletion', label: 'Account deletion', value: 'Available', options: ['Available', 'Locked']},
  {key: 'helpFeedback', label: 'Help & feedback', value: 'Open', options: ['Open', 'Email', 'Chat']},
];

export const foodCatalogCounts = {
  totalBaseFoods: 70,
  totalTargetFoods: 600,
  pakistaniFoods: 150,
  fastFoodFoods: 12,
};
