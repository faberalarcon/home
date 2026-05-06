import { db } from './index';
import { profiles, drinks } from './schema';

const existingProfiles = db.select().from(profiles).all();
if (existingProfiles.length === 0) {
  db.insert(profiles)
    .values([
      { name: 'Alex', color: '#f97316' },
      { name: 'Sam', color: '#0ea5e9' },
      { name: 'Jordan', color: '#a855f7' },
      { name: 'Guest', color: '#10b981' }
    ])
    .run();
  console.log('Seeded profiles.');
}

const existingDrinks = db.select().from(drinks).all();
if (existingDrinks.length === 0) {
  db.insert(drinks)
    .values([
      {
        name: 'Old Fashioned',
        description: 'Bourbon, bitters, sugar, orange peel',
        category: 'cocktail',
        haTriggerEvent: 'drink_ordered',
        sortOrder: 10
      },
      {
        name: 'Negroni',
        description: 'Gin, Campari, sweet vermouth',
        category: 'cocktail',
        haTriggerEvent: 'drink_ordered',
        sortOrder: 20
      },
      {
        name: 'Margarita',
        description: 'Tequila, lime, triple sec',
        category: 'cocktail',
        haTriggerEvent: 'drink_ordered',
        sortOrder: 30
      },
      {
        name: 'IPA',
        description: 'Hoppy pale ale',
        category: 'beer',
        haTriggerEvent: 'drink_ordered',
        sortOrder: 40
      },
      {
        name: 'Red Wine',
        description: 'House red',
        category: 'wine',
        haTriggerEvent: 'drink_ordered',
        sortOrder: 50
      },
      {
        name: 'Sparkling Water',
        description: 'Bubbly & cold',
        category: 'non-alcoholic',
        haTriggerEvent: 'drink_ordered',
        sortOrder: 60
      }
    ])
    .run();
  console.log('Seeded drinks.');
}

console.log('Seed complete.');
