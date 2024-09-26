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
        'salt',
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
      title: 'Pineapple',
      ingredients: ['pineapple'],
      preparationTime: 5,
      difficulty: 'Very Hard',
    },
    {
      title: 'Pizza',
      ingredients: ['dough', 'tomato sauce', 'mozzarella cheese', 'basil'],
      optionalIngredients: ['pineapple'],
      preparationTime: 40,
      difficulty: 'Medium',
    },
    {
      title: 'Beef Wellington',
      ingredients: [
        'beef tenderloin',
        'mushroom duxelles',
        'puff pastry',
        'egg wash',
        'salt',
      ],
      preparationTime: 120,
      difficulty: 'Hard',
    },
  ],
};

export default recipes;
