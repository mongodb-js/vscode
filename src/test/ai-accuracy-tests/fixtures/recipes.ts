import type { Fixture } from './fixture-type';

const recipes: Fixture = {
  db: 'CookBook',
  coll: 'recipes',
  documents: [
    {
      title: 'Spaghetti Bolognese',
      ingredients: [
        'spaghetti',
        'ground beef',
        'tomato sauce',
        'onions',
        'garlic',
      ],
      preparationTime: 60,
      difficulty: 'Medium',
    },
    {
      title: 'Avocado Toast',
      ingredients: ['avocado', 'bread', 'salt', 'pepper'],
      optionalIngredients: ['lime'],
      preparationTime: 10,
      difficulty: 'Easy',
    },
    {
      title: 'Beef Wellington',
      ingredients: [
        'beef tenderloin',
        'mushroom duxelles',
        'puff pastry',
        'egg wash',
      ],
      preparationTime: 120,
      difficulty: 'Hard',
    },
  ],
};

export default recipes;
