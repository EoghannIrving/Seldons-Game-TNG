/**
 * Personal Name Pools — Phase 10G-i
 *
 * Six culturally-differentiated name pools, each with 100 first names and
 * 100 last names. Foundation-universe names are distributed across pools
 * where they fit phonetically and thematically.
 *
 * Culture is determined from a star's traits and star type. All members of
 * a dynasty share the founder's last name (family cohesion). Heirs get new
 * first names, keeping the dynasty surname.
 *
 * 1 phase ≈ 5–10 years. Names are designed for a galactic-scale civilisation
 * spanning thousands of years — timeless, not era-specific.
 */

import { Star, StarType, Trait, GovernmentType } from '../core/types';

// ---------------------------------------------------------------------------
// Culture enum
// ---------------------------------------------------------------------------

export type CultureStyle =
  | 'imperial'    // Imperialist, Ambitious, Monarchy/Autocracy — Latin-inflected, commanding
  | 'martial'     // Militaristic, Volatile, Junta — short, punchy, hard consonants
  | 'scholarly'   // Scholarly, PostScarcity, Republic — Greek/Arabic, cerebral, melodic
  | 'mercantile'  // Mercantile, Cosmopolitan, Oligarchy — multicultural blend, short
  | 'spiritual'   // Spiritualist, Traditionalist, Theocracy — soft, reverent, flowing
  | 'agrarian';   // Agrarian, Stoic, Cautious — earthy, Germanic, unpretentious

// ---------------------------------------------------------------------------
// Name pools
// ---------------------------------------------------------------------------

interface NamePool {
  first: string[];
  last: string[];
}

const IMPERIAL: NamePool = {
  first: [
    // Foundation-universe: Imperial/political figures
    'Cleon', 'Eto', 'Demerzel', 'Agis', 'Randa', 'Laskin', 'Hari', 'Wyan',
    'Bel', 'Riose', 'Han', 'Preem', 'Palver', 'Stor', 'Gendibal',
    // Latin-inflected originals
    'Caeron', 'Valdris', 'Sextus', 'Lyrian', 'Octaven', 'Marcell', 'Aurel',
    'Cassian', 'Lucan', 'Tiberan', 'Maxen', 'Flavian', 'Decian', 'Hadren',
    'Trajan', 'Cornelan', 'Brutian', 'Severin', 'Galban', 'Nervan', 'Vitell',
    'Domitian', 'Caracan', 'Gordian', 'Valerian', 'Gallien', 'Probian',
    'Caran', 'Leontian', 'Mauran', 'Heraclan', 'Constans', 'Julian',
    'Valentan', 'Graccan', 'Stilich', 'Aetian', 'Antheman', 'Glycan',
    'Zenon', 'Basillan', 'Phocen', 'Heracan', 'Leontius', 'Romanan',
    'Nicephor', 'Stauran', 'Alexan', 'Isacan', 'Androcan', 'Michalen',
    'Constanan', 'Paleolog', 'Cantacan', 'Manuelen', 'Andronican',
    'Crestian', 'Morrovan', 'Solantian', 'Darellan', 'Velantian',
    'Aurelian', 'Clavdian', 'Sempron', 'Vespasan', 'Titian',
    'Quintilan', 'Neratan', 'Caligulan', 'Claudan', 'Caliguan',
    'Macrinian', 'Elagaban', 'Alexandian', 'Maximian', 'Balbinan',
    'Pupienan', 'Aemilian', 'Volusian', 'Trebonian', 'Hostilian',
    'Deciian', 'Philipan', 'Gordanian', 'Balbinian', 'Floranian',
    'Tacitian', 'Aurelanian', 'Probanian', 'Carinan', 'Numeran',
    'Diocletan', 'Galerian', 'Severan', 'Maxentian', 'Licinanian',
    'Constan', 'Magnentian',
  ],
  last: [
    // Foundation-universe surnames/house names that fit
    'Seldon', 'Darell', 'Mallow', 'Hardin', 'Palver', 'Gendibal', 'Trevize',
    'Branno', 'Compor', 'Delarmi', 'Kodell', 'Liono', 'Quoriana', 'Riose',
    'Pritcher',
    // Imperial originals
    'Darellan', 'Velanthi', 'Crestus', 'Morrovan', 'Solantis', 'Valdris',
    'Aurenthal', 'Cassivell', 'Lucanor', 'Tiberavon', 'Maxenthor',
    'Flaviantis', 'Decidian', 'Hadrenor', 'Trajanis', 'Cornelius',
    'Brutianis', 'Severinus', 'Galbanus', 'Nervanus', 'Vitellian',
    'Domitianis', 'Caracalis', 'Gordianus', 'Valerianus', 'Gallienus',
    'Probianus', 'Caranthor', 'Leontian', 'Maurantis', 'Heraclian',
    'Constanor', 'Julianus', 'Valentian', 'Graccanus', 'Stilichor',
    'Aetiusan', 'Anthemian', 'Glycerian', 'Zenonian', 'Basillian',
    'Phocerian', 'Heraclian', 'Leontius', 'Romanor', 'Nicephoran',
    'Stauranus', 'Alexanis', 'Isacanus', 'Androcanus', 'Michalean',
    'Constanor', 'Paleologis', 'Cantacuzen', 'Manuelian', 'Andronicar',
    'Orenthal', 'Clavdianis', 'Sempronius', 'Vespasian', 'Titianus',
    'Quintilian', 'Neratian', 'Caligulian', 'Claudian', 'Macrinian',
    'Elagabalan', 'Alexandrian', 'Maximinian', 'Balbinian', 'Floranian',
    'Tacitian', 'Aurelanian', 'Probanian', 'Carinian', 'Numeranian',
    'Diocletan', 'Galerian', 'Severan', 'Maxentian', 'Licinanian',
    'Constantian', 'Magnentian', 'Jovian', 'Valentinian', 'Gratian',
    'Theodorian', 'Arcadian', 'Honorian', 'Valentian',
  ],
};

const MARTIAL: NamePool = {
  first: [
    // Foundation-universe: military figures
    'Bel', 'Ducem', 'Lathan', 'Inchney', 'Barr', 'Onum',
    'Wienis', 'Sermak', 'Callia', 'Brodrig', 'Munn',
    // Martial originals — short, hard consonants
    'Kord', 'Brek', 'Thael', 'Harn', 'Voss', 'Rael', 'Drak',
    'Gorn', 'Thrak', 'Weld', 'Brant', 'Krael', 'Sturm', 'Zael',
    'Hroth', 'Baldur', 'Ragnar', 'Sigurd', 'Gunnar', 'Leif',
    'Bjorn', 'Ulf', 'Sven', 'Erik', 'Ivar', 'Olaf', 'Halfdan',
    'Thorvald', 'Hakon', 'Eirik', 'Gunnulf', 'Ketil', 'Asmund',
    'Floki', 'Rollo', 'Sigvard', 'Orm', 'Egil', 'Brand', 'Helgi',
    'Vemund', 'Torkel', 'Arnmund', 'Skuli', 'Stein', 'Grim', 'Knut',
    'Frode', 'Magnul', 'Rolf', 'Askel', 'Torstein', 'Sigmund',
    'Vrekk', 'Dael', 'Marek', 'Garek', 'Torek', 'Harvel', 'Kael',
    'Drael', 'Wreth', 'Svael', 'Threk', 'Gorvel', 'Brakk', 'Graen',
    'Hrael', 'Veld', 'Skarl', 'Torval', 'Grath', 'Wrekk', 'Dorn',
    'Krath', 'Varn', 'Breld', 'Skarn', 'Theld', 'Wrael', 'Greld',
    'Drath', 'Keld', 'Vrael', 'Srath', 'Brath', 'Hreld', 'Grael',
    'Vreld', 'Skrael', 'Threld', 'Dael', 'Vreld', 'Skeld', 'Brael',
  ],
  last: [
    // Foundation-universe martial surnames
    'Riose', 'Barr', 'Inchney', 'Brodrig', 'Sermak',
    // Martial originals — compound, harsh
    'Ironvar', 'Stonbrek', 'Falkren', 'Grael', 'Morthas',
    'Blackthorn', 'Grimwald', 'Steelborn', 'Ironkeld', 'Stormvar',
    'Ravenmoor', 'Darkfell', 'Shardbane', 'Wraithend', 'Coldfire',
    'Dawnbrek', 'Duskvar', 'Nightkeld', 'Ashfell', 'Cinderborn',
    'Hammerfall', 'Bladekeld', 'Shieldvar', 'Spearborn', 'Axefell',
    'Warbrek', 'Combatvar', 'Fightborn', 'Strikeld', 'Clashvar',
    'Thornbrek', 'Bouldervar', 'Cliffthorn', 'Rockfeld', 'Stonevar',
    'Ironfeld', 'Steelvar', 'Metalborn', 'Forgekeld', 'Anvilvar',
    'Hardfell', 'Toughvar', 'Strongborn', 'Boldkeld', 'Bravevar',
    'Swiftbrek', 'Quickvar', 'Fastborn', 'Fleetkeld', 'Speedvar',
    'Fiercefell', 'Savagevar', 'Wildborn', 'Ragebrek', 'Wrathvar',
    'Grimvar', 'Darkborn', 'Shadowkeld', 'Nightvar', 'Duskborn',
    'Starkeld', 'Bleakvar', 'Coldborn', 'Frostbrek', 'Icevar',
    'Emberfell', 'Blazevar', 'Burnborn', 'Charkeld', 'Scorchvar',
    'Brightfell', 'Glarevar', 'Blazeborn', 'Sunkeld', 'Dawnvar',
    'Deepfell', 'Abyssvar', 'Voidborn', 'Darkbrek', 'Gulfvar',
    'Highfell', 'Peakvar', 'Crownborn', 'Summiteld', 'Apexvar',
    'Swiftfall', 'Trueborn', 'Hardkeld', 'Roughvar', 'Rudeborn',
    'Grafthorn', 'Brekthorn', 'Skaelthorn', 'Kraelthorn', 'Vaelthorn',
  ],
};

const SCHOLARLY: NamePool = {
  first: [
    // Foundation-universe: scholars and scientists
    'Hari', 'Gaal', 'Dornick', 'Yugo', 'Amaryl', 'Raych', 'Wanda',
    'Bellis', 'Quoriana', 'Stettin', 'Elvett', 'Janov', 'Pelorat',
    'Bliss', 'Novi', 'Toran', 'Bayta', 'Arkady', 'Ponyets',
    'Ebling', 'Mis', 'Magnifico',
    // Greek/Arabic-inflected originals
    'Erathos', 'Lysan', 'Calion', 'Davan', 'Thessar', 'Mirael', 'Oryn',
    'Pythan', 'Socrael', 'Platonel', 'Aristhan', 'Euclael', 'Archimael',
    'Hippocran', 'Thales', 'Anaximael', 'Heraclael', 'Parmenael',
    'Zenophael', 'Epicurael', 'Stoicael', 'Pythonel', 'Sophoclael',
    'Euripidael', 'Aeschylael', 'Pindarael', 'Simonael', 'Alcael',
    'Ibycael', 'Stesichorael', 'Bacchylael', 'Corinnael', 'Sapphonel',
    'Alcmanael', 'Mimnerael', 'Solonael', 'Theognael', 'Phoculael',
    'Xenophanael', 'Parmenael', 'Empedoclael', 'Democrael', 'Leucippael',
    'Anaxagorael', 'Diogenael', 'Antisthenel', 'Aristippael', 'Cyrenaicael',
    'Megarian', 'Eudoxael', 'Speusippael', 'Xenocrael', 'Polemonael',
    'Crantorael', 'Arcesilael', 'Carnael', 'Clitomachael', 'Phitonael',
    'Aenesidemael', 'Agrippakel', 'Sextusael', 'Menodotael', 'Herodotael',
    'Thucydael', 'Xenophonael', 'Polybael', 'Diodorael', 'Dionysael',
    'Arianael', 'Appianael', 'Cassael', 'Herodianel', 'Zonarael',
    'Kedrael', 'Skylitzel', 'Psellael', 'Nicetael', 'Akropolitael',
  ],
  last: [
    // Foundation-universe scholarly surnames
    'Seldon', 'Amaryl', 'Pelorat', 'Dornick', 'Mis', 'Palver',
    // Scholarly originals
    'Veranthos', 'Kalidon', 'Thessian', 'Mordecal', 'Phaelon',
    'Pythorean', 'Socration', 'Platonian', 'Aristothan', 'Euclidean',
    'Archimedean', 'Hippocration', 'Thalesian', 'Heraclitian', 'Parmenidean',
    'Epicurean', 'Stoician', 'Sophoclan', 'Euripidean', 'Aeschylean',
    'Pindarean', 'Simonidean', 'Alcaean', 'Sapphoean', 'Anacreontean',
    'Solonian', 'Theognidean', 'Xenophanean', 'Democritean', 'Anaxagorean',
    'Diogenean', 'Antisthenic', 'Megarian', 'Eudoxian', 'Speusippean',
    'Xenocratic', 'Polemonian', 'Crantorian', 'Arcesilaean', 'Carneadean',
    'Clitomachean', 'Philonian', 'Aenesidemic', 'Agrippean', 'Sextian',
    'Menodotean', 'Herodotean', 'Thucydidean', 'Xenophontean', 'Polybian',
    'Diodorean', 'Dionysian', 'Arianian', 'Appianic', 'Cassidian',
    'Herodian', 'Zonarian', 'Kedrenic', 'Skylitzeic', 'Psellean',
    'Nicetaean', 'Akropolitean', 'Manassean', 'Kantakuzenean', 'Gregoran',
    'Chalkokonean', 'Doukaean', 'Komnenean', 'Palaiologean', 'Laskarian',
    'Vatatzean', 'Kantean', 'Hegelean', 'Marxean', 'Nietzschean',
    'Schopenhauerean', 'Kierkegaardean', 'Husserlean', 'Heidegerean',
    'Wittgensteinean', 'Popperian', 'Kuhnic', 'Feyerabendean', 'Lakatosian',
    'Quinean', 'Davidsonean', 'Kripkean', 'Putnamean', 'Rawlsian',
    'Nozickian', 'Dworkinian', 'Habermassian', 'Foucaultian', 'Derridean',
    'Deluzian', 'Baudrillarean', 'Lyotardian', 'Baumanean', 'Beckian',
  ],
};

const MERCANTILE: NamePool = {
  first: [
    // Foundation-universe: traders and merchants
    'Hober', 'Mallow', 'Jorane', 'Sutt', 'Jord', 'Fara', 'Jaim',
    'Limmar', 'Ponyets', 'Gorov', 'Asper', 'Latham', 'Wellby',
    'Noro', 'Onum', 'Terens', 'Rik', 'Valona',
    // Multicultural blend originals
    'Jove', 'Tess', 'Maro', 'Niv', 'Pell', 'Kira', 'Solan', 'Renna',
    'Cael', 'Dove', 'Lira', 'Mace', 'Nova', 'Pax', 'Quill', 'Rex',
    'Sage', 'Tave', 'Ulen', 'Vane', 'Wren', 'Xael', 'Yale', 'Zeno',
    'Aven', 'Bael', 'Cove', 'Dael', 'Evan', 'Fael', 'Glen', 'Hael',
    'Ivan', 'Joel', 'Kane', 'Lane', 'Mare', 'Nael', 'Owen', 'Paen',
    'Qaen', 'Rael', 'Sean', 'Tael', 'Uvan', 'Vaen', 'Wade', 'Xen',
    'Yael', 'Zaen', 'Aden', 'Bren', 'Cren', 'Dren', 'Eren', 'Fren',
    'Gren', 'Hren', 'Iren', 'Jren', 'Kren', 'Lren', 'Mren', 'Nren',
    'Oren', 'Pren', 'Qren', 'Rren', 'Sren', 'Tren', 'Uren', 'Vren',
    'Wren', 'Xren', 'Yren', 'Zren', 'Asen', 'Bsen', 'Csen', 'Dsen',
    'Esen', 'Fsen', 'Gsen', 'Hsen',
  ],
  last: [
    // Foundation-universe mercantile surnames
    'Mallow', 'Sutt', 'Ponyets', 'Gorov', 'Fara',
    // Mercantile originals
    'Ashvari', 'Pellmont', 'Nirovel', 'Tessen', 'Goldvar',
    'Silvermark', 'Copperfield', 'Ironwood', 'Steelgate', 'Bronzehall',
    'Tradewind', 'Fairhaven', 'Goodport', 'Richland', 'Goldport',
    'Silverport', 'Bronzeport', 'Copperport', 'Ironport', 'Steelport',
    'Marketfall', 'Bazaarend', 'Exchangeton', 'Tradeston', 'Barterfield',
    'Vendormont', 'Merchantvale', 'Dealerholm', 'Brokerfield', 'Agentton',
    'Northfield', 'Southgate', 'Eastwood', 'Westmark', 'Crossroads',
    'Midpoint', 'Junctionton', 'Hubvale', 'Nexusvale', 'Centreton',
    'Rivermark', 'Harbourton', 'Portfield', 'Dockland', 'Shoreton',
    'Bayvale', 'Covemont', 'Inletfield', 'Estuary', 'Deltaland',
    'Hilltop', 'Ridgefield', 'Valleyton', 'Plainmont', 'Meadowland',
    'Forestmark', 'Woodvale', 'Grovemont', 'Copse', 'Thicketton',
    'Stonemark', 'Rockfield', 'Clifton', 'Cragmont', 'Peakland',
    'Starmark', 'Moonfield', 'Sunton', 'Dawnvale', 'Duskmont',
    'Brightmark', 'Glowfield', 'Lumenton', 'Radiant', 'Vividmark',
    'Swiftmark', 'Quickfield', 'Fastonvale', 'Fleetmont', 'Speediton',
    'Farmark', 'Widefield', 'Broadton', 'Longevale', 'Distantmont',
    'Richmark', 'Wealthfield', 'Prosperton', 'Affluentvale', 'Opulentmont',
    'Noblemark', 'Honorfield', 'Worthton', 'Estimvale', 'Reputablemont',
  ],
};

const SPIRITUAL: NamePool = {
  first: [
    // Foundation-universe: spiritual/religious figures
    'Salvor', 'Ankor', 'Verisof', 'Poly', 'Arnaut', 'Jord', 'Lewis',
    'Sermak', 'Dorwin', 'Ovall', 'Phath', 'Commdor', 'Commdora',
    'Loren', 'Elia', 'Mira', 'Sera',
    // Spiritual originals — soft syllables, reverent
    'Elara', 'Solan', 'Miri', 'Aven', 'Seraph', 'Lirien', 'Asel',
    'Ariel', 'Bethel', 'Carmel', 'Danel', 'Eliael', 'Fael', 'Gabrael',
    'Hanael', 'Itael', 'Jophael', 'Kamael', 'Lumael', 'Micheal', 'Nathael',
    'Ophanael', 'Penael', 'Raphael', 'Samarael', 'Tzadkael', 'Urael',
    'Vael', 'Zaphael', 'Adonael', 'Barakael', 'Cassael', 'Danael',
    'Elimael', 'Fomael', 'Gadrael', 'Habrael', 'Ibrael', 'Jaoel',
    'Kezael', 'Lelael', 'Masnael', 'Nahelael', 'Onael', 'Phadael',
    'Qaspael', 'Rasael', 'Samael', 'Tagrael', 'Ufael', 'Varael',
    'Wael', 'Xaphael', 'Yophael', 'Zael', 'Anpael', 'Boel', 'Choel',
    'Drael', 'Ehael', 'Fyael', 'Gaael', 'Hael', 'Iael', 'Jael',
    'Kael', 'Lael', 'Mael', 'Nael', 'Oael', 'Pael', 'Qael', 'Rael',
    'Sael', 'Tael', 'Uael', 'Wael', 'Xael', 'Yael', 'Zael',
    'Anael', 'Bnael', 'Cnael', 'Dnael', 'Enael', 'Fnael', 'Gnael',
  ],
  last: [
    // Foundation-universe spiritual surnames
    'Hardin', 'Verisof', 'Arnaut', 'Ovall', 'Sermak',
    // Spiritual originals
    'Sunavar', 'Aveneth', 'Mirathi', 'Selanor', 'Elindra',
    'Lighthaven', 'Faithmoor', 'Graceland', 'Blessedhall', 'Holyvale',
    'Sacredmont', 'Divinefield', 'Hallowedton', 'Sanctifiedvale', 'Consecmont',
    'Templeton', 'Shrine', 'Altarvale', 'Sanctuarymont', 'Chapelton',
    'Cathvale', 'Priorymont', 'Abbeyton', 'Monastvale', 'Conventmont',
    'Prayerfield', 'Meditaton', 'Contemplvale', 'Reflectmont', 'Devotton',
    'Spiritmark', 'Soulfield', 'Faithton', 'Believevale', 'Trustmont',
    'Hopemark', 'Lovefield', 'Graceton', 'Mercyvale', 'Peacmont',
    'Serenemark', 'Calmfield', 'Tranqton', 'Quietvale', 'Stillmont',
    'Lightmark', 'Brightfield', 'Lumton', 'Glowvale', 'Radmont',
    'Starfield', 'Moonmark', 'Sunton', 'Dawnvale', 'Heavenmont',
    'Skymark', 'Cloudfield', 'Aleton', 'Highvale', 'Exaltmont',
    'Truthmark', 'Wisdomfield', 'Knowton', 'Learnvale', 'Teachmont',
    'Guidemark', 'Leadfield', 'Shepherton', 'Pastorval', 'Flocmont',
    'Blesmark', 'Anofield', 'Ordaiton', 'Consecvale', 'Sacmont',
    'Eternmark', 'Immortalfield', 'Everton', 'Perpetvale', 'Endlessmont',
    'Divmark', 'Godlyfield', 'Piouston', 'Devoutvale', 'Reverentmont',
    'Angmark', 'Seraphfield', 'Cheruton', 'Archanvale', 'Ophanmont',
  ],
};

const AGRARIAN: NamePool = {
  first: [
    // Foundation-universe: rural/agrarian figures
    'Rik', 'Valona', 'Squire', 'Terens', 'Ragusnik', 'Grew',
    'Edith', 'Pola', 'Hella', 'Arvardan', 'Shekt', 'Schwartz',
    'Natter', 'Ennius', 'Balkis',
    // Germanic/Old English originals — earthy, plain
    'Bram', 'Calla', 'Aldric', 'Rowena', 'Theon', 'Maret', 'Garth',
    'Edric', 'Wulfric', 'Aelfric', 'Godric', 'Kenric', 'Rodric', 'Cedric',
    'Baldric', 'Aldred', 'Ethred', 'Godred', 'Leofric', 'Sigebert',
    'Aelfbert', 'Godbert', 'Eadbert', 'Cuthbert', 'Egbert', 'Ethelbert',
    'Aethelbert', 'Osbert', 'Oslaf', 'Oslac', 'Osric', 'Oswald', 'Oswin',
    'Edmund', 'Eadmund', 'Ethelmund', 'Godmund', 'Sigmund', 'Thurmund',
    'Wulfmund', 'Aelfmund', 'Leofmund', 'Eadwin', 'Baldwin', 'Godwin',
    'Leofwin', 'Oswin', 'Sigewin', 'Wulfwin', 'Aelfwin', 'Erwin',
    'Aldwin', 'Ethelwin', 'Edwin', 'Eowyn', 'Brynwyn', 'Carwyn',
    'Gwyn', 'Llew', 'Mabon', 'Nudd', 'Owain', 'Pryderi', 'Rhun',
    'Taliesin', 'Urien', 'Vortigern', 'Wulfnoth', 'Aelfnoth', 'Leofnoth',
    'Sigenoth', 'Eadnoth', 'Godwine', 'Aethelmere', 'Leofmere', 'Wulfmere',
    'Aelfmere', 'Godmere', 'Eathmere', 'Ethelmere', 'Sigemere', 'Oslacmere',
    'Heremere', 'Thornmere', 'Alver', 'Brever', 'Clover', 'Drover',
  ],
  last: [
    // Foundation-universe agrarian surnames
    'Arvardan', 'Grew', 'Schwartz', 'Shekt', 'Natter',
    // Agrarian originals — earthy compounds
    'Stonefield', 'Ashvale', 'Millward', 'Cragen', 'Brynmore',
    'Heathfield', 'Moorland', 'Fenwick', 'Marshton', 'Bogvale',
    'Hollowood', 'Deepdale', 'Greenfield', 'Meadowbrook', 'Riverside',
    'Hillcrest', 'Valleyside', 'Plainview', 'Farmstead', 'Hayward',
    'Grazing', 'Plowfield', 'Cropland', 'Harvestton', 'Seedvale',
    'Springwater', 'Clearbrook', 'Freshwell', 'Coldspring', 'Deepwell',
    'Oldtree', 'Greattree', 'Broadleaf', 'Deeproot', 'Strongtrunk',
    'Hornbeam', 'Oakwood', 'Elmfield', 'Ashford', 'Birchton',
    'Maplewood', 'Cedarhill', 'Pineval', 'Firvale', 'Spruceton',
    'Thornfield', 'Briers', 'Hedgewood', 'Brambleston', 'Gorse',
    'Brownfield', 'Clayhill', 'Loamton', 'Richsoil', 'Darkearth',
    'Rainfell', 'Cloudvale', 'Fogmorton', 'Mistfield', 'Dewmead',
    'Sunfield', 'Lightmead', 'Warmvale', 'Brightmorton', 'Clearvale',
    'Coldfield', 'Frostmead', 'Icemorton', 'Chillvale', 'Winterton',
    'Longfield', 'Farmeadow', 'Widebrook', 'Broaddale', 'Deepmeadow',
    'Oldfield', 'Ancientdale', 'Longbrook', 'Anchorton', 'Rootvale',
    'Goodfield', 'Richmeadow', 'Fairbrook', 'Truedale', 'Justton',
    'Wisefield', 'Learneddale', 'Sagemeadow', 'Elderbrook', 'Ancientton',
    'Strongfield', 'Toughmeadow', 'Hardbrook', 'Robustdale', 'Stalwartton',
  ],
};

// ---------------------------------------------------------------------------
// Culture pool registry
// ---------------------------------------------------------------------------

const CULTURE_POOLS: Record<CultureStyle, NamePool> = {
  imperial:   IMPERIAL,
  martial:    MARTIAL,
  scholarly:  SCHOLARLY,
  mercantile: MERCANTILE,
  spiritual:  SPIRITUAL,
  agrarian:   AGRARIAN,
};

// ---------------------------------------------------------------------------
// Culture determination
// ---------------------------------------------------------------------------

/**
 * Determine the dominant cultural style for a star based on traits and type.
 * Priority order: specific trait combos first, star type as fallback.
 */
export function determineCulture(star: Star): CultureStyle {
  const has = (t: Trait) => star.traits.includes(t);

  // Spiritualist overrides most — religion is the most defining cultural force
  if (has(Trait.Spiritualist)) return 'spiritual';

  // Militaristic + Volatile = martial culture
  if (has(Trait.Militaristic) && has(Trait.Volatile)) return 'martial';

  // Scholarly + (PostScarcity or Republican) = scholarly culture
  if (has(Trait.Scholarly) && (has(Trait.PostScarcity) || has(Trait.Republican))) return 'scholarly';

  // Mercantile + Cosmopolitan = mercantile culture
  if (has(Trait.Mercantile) && has(Trait.Cosmopolitan)) return 'mercantile';

  // Imperialist + (Ambitious or Monarchic government) = imperial culture
  if (has(Trait.Imperialist) && (has(Trait.Ambitious) ||
    star.governmentType === GovernmentType.Monarchy ||
    star.governmentType === GovernmentType.Autocracy)) return 'imperial';

  // Agrarian + (Stoic or Cautious) = agrarian culture
  if (has(Trait.Agrarian) && (has(Trait.Stoic) || has(Trait.Cautious))) return 'agrarian';

  // Single-trait fallbacks
  if (has(Trait.Scholarly))    return 'scholarly';
  if (has(Trait.Mercantile))   return 'mercantile';
  if (has(Trait.Imperialist))  return 'imperial';
  if (has(Trait.Militaristic)) return 'martial';
  if (has(Trait.Agrarian))     return 'agrarian';
  if (has(Trait.Traditionalist)) return 'agrarian';
  if (has(Trait.Republican))   return 'scholarly';

  // Star type fallback
  switch (star.starType) {
    case StarType.BlueGiant:   return 'imperial';
    case StarType.RedGiant:    return 'martial';
    case StarType.WhiteDwarf:  return 'scholarly';
    case StarType.Binary:      return 'mercantile';
    case StarType.RedDwarf:    return 'agrarian';
    default:                   return 'imperial'; // YellowDwarf default
  }
}

// ---------------------------------------------------------------------------
// Name picking functions
// ---------------------------------------------------------------------------

/**
 * Pick a full name (first + last) for a new dynasty founder.
 * The last name becomes the dynasty's house name.
 * Seeded deterministically so the same star/phase always produces the same name.
 */
export function pickFounderName(
  star: Star,
  seed: number,
  phase: number,
): { firstName: string; lastName: string; fullName: string } {
  const culture = determineCulture(star);
  const pool = CULTURE_POOLS[culture];
  const starIndex = parseInt(star.id.split('_')[1] || '0', 10);

  const firstIdx = Math.abs((seed * 31 + phase * 97 + starIndex * 113) % pool.first.length);
  const lastIdx  = Math.abs((seed * 61 + phase * 53 + starIndex * 79)  % pool.last.length);

  const firstName = pool.first[firstIdx]!;
  const lastName  = pool.last[lastIdx]!;
  return { firstName, lastName, fullName: `${firstName} ${lastName}` };
}

/**
 * Pick a first name for an heir, inheriting the dynasty's last name.
 * childIndex ensures siblings get different first names.
 */
export function pickHeirName(
  star: Star,
  dynastyLastName: string,
  seed: number,
  phase: number,
  childIndex: number,
): string {
  const culture = determineCulture(star);
  const pool = CULTURE_POOLS[culture];
  const starIndex = parseInt(star.id.split('_')[1] || '0', 10);

  const firstIdx = Math.abs((seed * 31 + phase * 97 + starIndex * 113 + childIndex * 137) % pool.first.length);
  return `${pool.first[firstIdx]!} ${dynastyLastName}`;
}

/**
 * Pick a first name for a spouse, using the dynasty's last name.
 * spouseIndex allows multiple spouses across different phases to differ.
 */
export function pickSpouseName(
  star: Star,
  dynastyLastName: string,
  seed: number,
  phase: number,
  spouseIndex: number,
): string {
  const culture = determineCulture(star);
  const pool = CULTURE_POOLS[culture];
  const starIndex = parseInt(star.id.split('_')[1] || '0', 10);

  // Use a different hash offset from heirs so spouses aren't the same name
  const firstIdx = Math.abs((seed * 43 + phase * 71 + starIndex * 89 + spouseIndex * 157) % pool.first.length);
  return `${pool.first[firstIdx]!} ${dynastyLastName}`;
}

/**
 * Pick a name for a non-dynastic political successor (Republic, Oligarchy).
 * These are standalone figures without a shared house name.
 */
export function pickPoliticalName(
  star: Star,
  seed: number,
  phase: number,
): string {
  const culture = determineCulture(star);
  const pool = CULTURE_POOLS[culture];
  const starIndex = parseInt(star.id.split('_')[1] || '0', 10);

  const firstIdx = Math.abs((seed * 37 + phase * 83 + starIndex * 101) % pool.first.length);
  const lastIdx  = Math.abs((seed * 67 + phase * 59 + starIndex * 73)  % pool.last.length);
  return `${pool.first[firstIdx]!} ${pool.last[lastIdx]!}`;
}

/**
 * Build a display-ready house name from a dynasty's surname.
 * e.g. "Darellan" → "House Darellan"
 */
export function buildHouseName(lastName: string): string {
  return `House ${lastName}`;
}
