import type { Fixture } from './fixture-type';

// Dynamic date fixture.
export default function getUFOSightingsFixture(): Fixture {
  return {
    db: 'UFO',
    coll: 'sightings',
    documents: [
      {
        description: 'Flying Saucer in the sky, numerous reports.',
        where: 'Oklahoma',
        // Last year.
        year: `${new Date().getFullYear() - 1}`,
      },
      {
        description: 'Alien spaceship.',
        where: 'Tennessee',
        year: '2005',
      },
      {
        description:
          'Portal in the sky created by moving object, possibly just northern lights.',
        where: 'Alaska',
        year: '2020',
      },
      {
        description: 'Floating pineapple, likely northern lights.',
        where: 'Alaska',
        year: '2021',
      },
      {
        description:
          'Someone flying on a broomstick, sighters reported "It looks like Harry Potter".',
        where: 'New York',
        year: '2022',
      },
    ],
  };
}
