import type { Fixture } from './fixture-type';

const antiques: Fixture = {
  db: 'Antiques',
  coll: 'items',
  documents: [
    {
      itemName: 'Vintage Beatles Vinyl',
      owner: {
        name: 'John Doe',
        location: 'London',
      },
      acquisition: {
        date: '1998-03-13',
        price: 1200,
      },
      condition: 'Mint',
      history: [
        { event: 'Auction Win', date: '1998-03-13' },
        { event: 'Restoration', date: '2005-07-22' },
      ],
    },
    {
      itemName: 'Ancient Roman Coin',
      owner: {
        name: 'Jane Doe',
        location: 'Rome',
      },
      acquisition: {
        date: '2002-11-27',
        price: 5000,
      },
      condition: 'Good',
      history: [
        { event: 'Found in a dig', date: '2002-11-27' },
        { event: 'Museum Display', date: '2010-02-15' },
      ],
    },
    {
      itemName: 'Victorian Pocket Watch',
      owner: {
        name: 'Arnold Arnoldson',
        location: 'London',
      },
      acquisition: {
        date: '2010-06-30',
        price: 800,
      },
      condition: 'Fair',
      history: [
        { event: 'Inherited', date: '2010-06-30' },
        { event: 'Repair', date: '2015-09-12' },
      ],
    },
    {
      itemName: 'An Ancient Pineapple (super rare)',
      owner: {
        name: 'Monkey',
        location: 'New York',
      },
      acquisition: {
        date: '2018-02-05',
        price: 2300,
      },
      condition: 'Mint',
      history: [
        { event: 'Estate Sale', date: '2018-02-05' },
        { event: 'Appraisal', date: '2020-04-18' },
      ],
    },
  ],
};

export default antiques;
