const pineapples = {
  db: 'FarmData',
  coll: 'Pineapples',
  documents: [
    {
      weightKg: 2.4,
      heightCm: 25,
      plantedDate: '2022-03-15',
      harvestedDate: '2022-09-20',
      soilPH: 5.5,
      farmerNotes: 'Grew faster than usual due to experimental fertilizer',
      sweetnessScale: 8,
      color: 'Golden',
      waterings: 35,
      sunlightHours: 400,
      pestIncidents: 2,
    },
    {
      weightKg: 1.8,
      heightCm: 22,
      plantedDate: '2021-11-10',
      harvestedDate: '2022-06-05',
      soilPH: 6.0,
      farmerNotes: 'Had issues with pests but used organic methods to control',
      sweetnessScale: 7,
      color: 'Yellow',
      waterings: 28,
      sunlightHours: 380,
      pestIncidents: 3,
    },
  ],
};

export default pineapples;
