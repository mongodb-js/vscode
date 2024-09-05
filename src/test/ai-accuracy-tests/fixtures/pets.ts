import type { Fixture } from './fixture-type';

const petCompetition: Fixture = {
  db: 'pets',
  coll: 'competition-results',
  documents: [
    {
      name: 'Fluffy',
      species: 'dog',
      category: 'best costume',
      score: 9.1,
      year: 2021,
    },
    {
      name: 'Scruffy',
      species: 'dog',
      category: 'best costume',
      score: 9.5,
      year: 2021,
    },
    {
      name: 'Whiskers',
      species: 'cat',
      category: 'most agile',
      score: 8.7,
      year: 2022,
    },
    {
      name: 'Bubbles',
      species: 'fish',
      category: 'prettiest scales',
      score: 7.5,
      year: 2021,
    },
  ],
};

export default petCompetition;
