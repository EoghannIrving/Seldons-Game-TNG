/**
 * Star names for galaxy generation
 * Phase 1: Better star naming
 *
 * Includes Foundation series worlds + real astronomical names
 * Ordered to put Foundation worlds first for recognition
 */

export const STAR_NAMES = [
  // Foundation series - Major worlds (always appear in small galaxies)
  'Trantor', 'Terminus', 'Kalgan', 'Anacreon', 'Korell',
  'Smyrno', 'Askone', 'Tazenda', 'Mnemon', 'Iss',
  'Santanni', 'Wencory', 'Synnax', 'Siwenna', 'Ifni',
  'Derowd', 'Lioesse', 'Radole', 'Sarip', 'Whassalian',

  // Foundation series - More worlds
  'Sayshell', 'Gaia', 'Aurora', 'Solaria', 'Nexon',
  'Lingane', 'Rhodia', 'Tyrann', 'Florina', 'Sark',
  'Nephelos', 'Kalgash', 'Lagash', 'Gammer', 'Comporellon',
  'Melpomenia', 'Baleyworld', 'Aurora', 'Haven', 'Smitheus',

  // Real astronomical stars (brightest)
  'Sirius', 'Canopus', 'Rigel', 'Arcturus', 'Vega',
  'Capella', 'Rigel', 'Procyon', 'Betelgeuse', 'Achernar',
  'Hadar', 'Altair', 'Aldebaran', 'Antares', 'Spica',
  'Pollux', 'Fomalhaut', 'Deneb', 'Regulus', 'Adhara',
  'Castor', 'Shaula', 'Bellatrix', 'Elnath', 'Miaplacidus',

  // Bright stars (magnitude 1.5-2.5)
  'Alnilam', 'Alnitak', 'Alnair', 'Alioth', 'Dubhe',
  'Mirfak', 'Wezen', 'Sargas', 'Kaus Australis', 'Avior',
  'Alkaid', 'Menkalinan', 'Atria', 'Alhena', 'Peacock',
  'Alsephina', 'Mirzam', 'Alphard', 'Polaris', 'Hamal',
  'Algieba', 'Diphda', 'Mizar', 'Nunki', 'Menkent',

  // Named stars from various cultures
  'Thuban', 'Sabik', 'Kochab', 'Eltanin', 'Rastaban',
  'Etamin', 'Kaus Meridionalis', 'Kaus Borealis', 'Ascella', 'Rukbat',
  'Arkab', 'Deneb Algedi', 'Nashira', 'Albali', 'Sadalsuud',
  'Sadalmelik', 'Enif', 'Baham', 'Homam', 'Matar',

  // Greek letter designations (Alpha, Beta, etc.)
  'Alphecca', 'Alpherg', 'Alpheratz', 'Ankaa', 'Scheat',
  'Markab', 'Algenib', 'Skat', 'Fum al Samakah', 'Baten Kaitos',
  'Menkar', 'Zaurak', 'Rana', 'Azha', 'Acamar',
  'Cursa', 'Rigel', 'Saiph', 'Mintaka', 'Hatsya',

  // Constellation stars
  'Meissa', 'Tabit', 'Algol', 'Mirach', 'Almach',
  'Triangulum', 'Sheratan', 'Mesarthim', 'Botein', 'Nair al Saif',
  'Nihal', 'Arneb', 'Phact', 'Wazn', 'Naos',
  'Regor', 'Suhail', 'Turais', 'Aspidiske', 'Markeb',

  // More named stars
  'Alsuhail', 'Azmidiske', 'Muhlifain', 'Phurud', 'Aludra',
  'Adhil', 'Furud', 'Tejat', 'Propus', 'Wasat',
  'Mebsuta', 'Alhena', 'Alzirr', 'Mekbuda', 'Gomeisa',

  // Binary/multiple systems
  'Albireo', 'Cor Caroli', 'Izar', 'Alcyone', 'Atlas',
  'Electra', 'Maia', 'Merope', 'Taygeta', 'Pleione',
  'Celaeno', 'Sterope', 'Alcor', 'Sheliak', 'Sulafat',

  // Additional stars to reach 200+
  'Rasalgethi', 'Rasalhague', 'Cebalrai', 'Yed Prior', 'Yed Posterior',
  'Sabik', 'Marfik', 'Han', 'Atik', 'Alcyone',
  'Sarin', 'Tania Borealis', 'Tania Australis', 'Alula Borealis', 'Alula Australis',
  'Talitha', 'Muscida', 'Megrez', 'Phecda', 'Merak',

  // Modern catalog names (for variety)
  'Proxima', 'Barnards Star', 'Wolf 359', 'Lalande', 'Luyten',
  'Ross 154', 'Ross 248', 'Epsilon Eridani', 'Lacaille', 'Groombridge',
  'Struve', 'Kapteyn', 'Kruger', 'Cordoba', 'Van Maanen',

  // Exoplanet host stars
  'Kepler', 'Trappist', 'Gliese 581', 'Gliese 667', 'HD 189733',
  'HD 209458', '51 Pegasi', 'Upsilon Andromedae', 'Tau Ceti', 'Epsilon Indi',

  // Additional constellation stars
  'Alpheratz', 'Caph', 'Schedar', 'Ruchbah', 'Segin',
  'Mirach', 'Almach', 'Adhil', 'Nembus', 'Veritate',
  'Titawin', 'Helvetios', 'Spe', 'Dulcinea', 'Quijote',

  // More bright stars
  'Acubens', 'Tarf', 'Asellus Borealis', 'Asellus Australis', 'Regulus',
  'Algieba', 'Adhafera', 'Zosma', 'Chertan', 'Denebola',
  'Zavijava', 'Porrima', 'Minelauva', 'Vindemiatrix', 'Zaniah',

  // Final batch to exceed 200
  'Rijl al Awwa', 'Syrma', 'Khambalia', 'Seginus', 'Nekkar',
  'Alkalurops', 'Izar', 'Muphrid', 'Mufrid', 'Princeps',
  'Diadem', 'Azelfafage', 'Cebalrai', 'Cheleb', 'Marsik',
  'Edasich', 'Aldhibah', 'Giausar', 'Grumium', 'Rastaban',
];

/**
 * Fallback to procedural names if we run out of real star names
 * Supports unlimited stars with pattern: A-Z, then AA-ZZ, then AAA-ZZZ, etc.
 */
export function getProceduralStarName(index: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  if (index < 26) {
    // First 26: A-Z
    return letters[index]!;
  }

  // After 26: AA-AZ, BA-BZ, ..., ZA-ZZ (676 names)
  if (index < 26 + 676) {
    const adjusted = index - 26;
    const first = Math.floor(adjusted / 26);
    const second = adjusted % 26;
    return letters[first]! + letters[second]!;
  }

  // After 702: AAA-ZZZ (17576 names)
  const adjusted = index - 26 - 676;
  const first = Math.floor(adjusted / 676);
  const remainder = adjusted % 676;
  const second = Math.floor(remainder / 26);
  const third = remainder % 26;
  return letters[first]! + letters[second]! + letters[third]!;
}

/**
 * Get star name by index
 * Uses real star names first, then falls back to procedural naming
 */
export function getStarName(index: number): string {
  if (index < STAR_NAMES.length) {
    return STAR_NAMES[index]!;
  }
  return getProceduralStarName(index);
}
