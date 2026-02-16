import { GalaxyState, Star, StarTier, Trait } from './types';
import { STAR_TYPE_PROPERTIES } from './star-properties';

export type EntryDataState = 'missing' | 'partial' | 'complete';

export type EntryVisualType = 'star_system' | 'capital_city';

export type EntrySectionKind =
  | 'core_status'
  | 'system_inventory'
  | 'governance'
  | 'relations_summary'
  | 'dynasty_family_tree'
  | 'ecology_profile'
  | 'capital_administration'
  | 'capital_survey_profile';

export interface EntryVisibilityRules {
  minPhase?: number;
  requiresIndependent?: boolean;
}

export interface EntryVisual {
  id: string;
  type: EntryVisualType;
  title: string;
  subtitle: string;
  imageSeed: string;
  renderMode: 'procedural' | 'placeholder';
  availability: EntryDataState;
  loreCaption: string;
}

export interface EntrySection<TPayload = unknown> {
  id: string;
  title: string;
  kind: EntrySectionKind;
  priority: number;
  dataVersion: number;
  dataState: EntryDataState;
  payload: TPayload;
  emptyState?: string;
  visibilityRules?: EntryVisibilityRules;
}

export interface StarEncyclopediaEntry {
  starId: string;
  title: string;
  subtitle: string;
  phase: number;
  visuals: EntryVisual[];
  sections: EntrySection<unknown>[];
}

interface CoreStatusPayload {
  tier: StarTier;
  starType: string;
  epoch: 'imperial' | 'communal';
  regionId?: string;
  regionName: string;
  traits: string[];
  strength: number;
  power: number;
  growth: number;
  centralization: number;
}

interface GovernancePayload {
  isIndependent: boolean;
  rulerId: string | null;
  rulerName: string;
  subjectCount: number;
  vitality: number;
  loyalty?: number;
}

interface RelationsSummaryPayload {
  allies: number;
  tradeRoutes: number;
  wars: number;
  activeEventCount: number;
  activeCrisisCount: number;
}

interface SystemInventoryPayload {
  source: 'procedural-star-system-renderer';
  note: string;
}

interface DynastyFamilyTreePayload {
  houseName?: string;
  foundingPhase?: number;
  currentRulerName?: string;
  lineage?: {
    phase: number;
    fromRulerName: string;
    toRulerName: string;
    reason: string;
  }[];
  tree?: FamilyTreeNode;
}

export interface FamilyTreeNode {
  id: string;
  name: string;
  isBastard: boolean;
  isLegitimized: boolean;
  birthPhase: number;
  deathPhase?: number;
  parents: FamilyTreeNode[];
  spouse?: FamilyTreeNode;
}

function getNode(
  dynastId: string,
  galaxyState: GalaxyState,
  memo: Map<string, FamilyTreeNode>
): FamilyTreeNode | undefined {
  if (memo.has(dynastId)) {
    return memo.get(dynastId);
  }

  const dynast = galaxyState.dynasts.get(dynastId);
  if (!dynast) return undefined;

  const node: FamilyTreeNode = {
    id: dynast.id,
    name: dynast.name,
    isBastard: dynast.isBastard,
    isLegitimized: dynast.isLegitimized,
    birthPhase: dynast.birthPhase,
    deathPhase: dynast.deathPhase,
    parents: [],
    spouse: undefined,
  };
  memo.set(dynastId, node);
  return node;
}

function buildTree(
  dynastId: string,
  galaxyState: GalaxyState,
  memo: Map<string, FamilyTreeNode>
): FamilyTreeNode | undefined {
  const relationships = galaxyState.dynasticRelationships || [];
  const rootNode = getNode(dynastId, galaxyState, memo);
  if (!rootNode) return undefined;

  const parentRelationships = relationships.filter(
    (r) => r.toDynastId === dynastId && r.type === 'parent'
  );
  for (const rel of parentRelationships) {
    const parentNode = buildTree(rel.fromDynastId, galaxyState, memo);
    if (parentNode) {
      rootNode.parents.push(parentNode);
    }
  }

  const spouseRelationship = relationships.find(
    (r) =>
      (r.fromDynastId === dynastId || r.toDynastId === dynastId) &&
      r.type === 'spouse'
  );
  if (spouseRelationship) {
    const spouseId =
      spouseRelationship.fromDynastId === dynastId
        ? spouseRelationship.toDynastId
        : spouseRelationship.fromDynastId;
    rootNode.spouse = getNode(spouseId, galaxyState, memo);
  }

  return rootNode;
}

function findAncestors(
  dynastId: string,
  galaxyState: GalaxyState,

): FamilyTreeNode | undefined {
  const memo = new Map<string, FamilyTreeNode>();
  return buildTree(dynastId, galaxyState, memo);
}

interface EcologyProfilePayload {
  habitability: number;
  climateBand: 'Frozen' | 'Cold' | 'Temperate' | 'Hot' | 'Extreme';
  biosphereComplexity: 'Sterile' | 'Microbial' | 'Developing' | 'Complex';
  waterPresence: 'Trace' | 'Limited' | 'Present' | 'Abundant';
  ecoStability: 'Fragile' | 'Strained' | 'Stable';
  agriCapacity: 'Minimal' | 'Constrained' | 'Viable' | 'High';
  dominantBiomes: string[];
  hazards: string[];
  summary: string;
}

interface DerivedEcologyProfile extends EcologyProfilePayload {
  waterScore: number;
}

function getTierLabel(tier: StarTier): string {
  switch (tier) {
    case StarTier.Major:
      return 'Major Power';
    case StarTier.Regional:
      return 'Regional Power';
    default:
      return 'Minor Power';
  }
}

function toTitleCase(value: string): string {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function createEntryVisuals(star: Star): EntryVisual[] {
  return [
    {
      id: 'star-system',
      type: 'star_system',
      title: 'Star System Survey',
      subtitle: `${star.name} System`,
      imageSeed: `${star.id}:star_system`,
      renderMode: 'procedural',
      availability: 'complete',
      loreCaption: 'Primary astronomical survey retained in the Imperial Archive.',
    },
    {
      id: 'capital-city',
      type: 'capital_city',
      title: 'Capital City Survey',
      subtitle: `${star.name} Administrative Seat`,
      imageSeed: `${star.id}:capital_city`,
      renderMode: 'procedural',
      availability: 'complete',
      loreCaption: 'Procedural archival reconstruction of the administrative seat.',
    },
  ];
}

export function buildCoreStatusSection(star: Star, galaxyState: GalaxyState): EntrySection<CoreStatusPayload> {
  const starType = STAR_TYPE_PROPERTIES[star.starType].name;
  const tierLabel = getTierLabel(star.tier);
  const regionName = star.regionId
    ? (galaxyState.regions.find((region) => region.id === star.regionId)?.name ?? star.regionId)
    : 'Unassigned';

  return {
    id: 'core-status',
    title: 'Core Status',
    kind: 'core_status',
    priority: 10,
    dataVersion: 1,
    dataState: 'complete',
    payload: {
      tier: star.tier,
      starType,
      epoch: star.epoch === 0 ? 'imperial' : 'communal',
      regionId: star.regionId,
      regionName,
      traits: star.traits.map((trait) => toTitleCase(trait)),
      strength: star.strength,
      power: star.power,
      growth: star.growth,
      centralization: star.centralization,
    },
    emptyState: `${tierLabel} records unavailable.`,
  };
}

export function buildGovernanceSection(star: Star, galaxyState: GalaxyState): EntrySection<GovernancePayload> {
  const isIndependent = star.ruler === star.id;
  const ruler = star.ruler ? galaxyState.stars.get(star.ruler) : null;

  return {
    id: 'governance',
    title: 'Governance',
    kind: 'governance',
    priority: 20,
    dataVersion: 1,
    dataState: 'complete',
    payload: {
      isIndependent,
      rulerId: star.ruler,
      rulerName: isIndependent ? star.name : ruler?.name ?? 'Unknown',
      subjectCount: star.subjects.length,
      vitality: star.vitality,
      loyalty: isIndependent ? undefined : star.loyalty,
    },
  };
}

export function buildRelationsSummarySection(
  star: Star,
  galaxyState: GalaxyState
): EntrySection<RelationsSummaryPayload> {
  const activeEventCount = galaxyState.events.filter(
    (event) => !event.resolved && event.targetStarIds.includes(star.id)
  ).length;
  const activeCrisisCount = galaxyState.activeCrises.filter(
    (crisis) => !crisis.resolved && crisis.targetStarId === star.id
  ).length;

  return {
    id: 'relations-summary',
    title: 'Relations Summary',
    kind: 'relations_summary',
    priority: 30,
    dataVersion: 1,
    dataState: 'complete',
    payload: {
      allies: star.allies.length,
      tradeRoutes: star.tradeRoutes.length,
      wars: star.atWarWith.length,
      activeEventCount,
      activeCrisisCount,
    },
  };
}

export function buildSystemInventorySection(): EntrySection<SystemInventoryPayload> {
  return {
    id: 'system-inventory',
    title: 'System Inventory',
    kind: 'system_inventory',
    priority: 15,
    dataVersion: 1,
    dataState: 'complete',
    payload: {
      source: 'procedural-star-system-renderer',
      note: 'Planet registry is generated from the same deterministic source as the star system image.',
    },
  };
}

export function buildDynastyFamilyTreeSection(
  star: Star,
  galaxyState: GalaxyState
): EntrySection<DynastyFamilyTreePayload> {
  const rulingDynast = star.currentDynastId
    ? galaxyState.dynasts.get(star.currentDynastId)
    : undefined;
  const dynasty = rulingDynast
    ? galaxyState.dynasties.get(rulingDynast.dynastyId)
    : undefined;

  if (!dynasty || !rulingDynast) {
    return {
      id: 'dynasty-family-tree',
      title: 'Dynasty Family Tree',
      kind: 'dynasty_family_tree',
      priority: 40,
      dataVersion: 1,
      dataState: 'missing',
      payload: {},
      emptyState: 'No ruling dynasty established for this system.',
    };
  }

  const lineageRecords = (galaxyState.dynastySuccessionRecords || []).filter(
    (r) => r.starId === star.id
  );

  const tree = findAncestors(rulingDynast.id, galaxyState);
  const hasLineageData = lineageRecords.length > 0;
  const hasTreeData = tree && (tree.parents.length > 0 || !!tree.spouse);
  const dataState: EntryDataState = hasTreeData
    ? 'complete'
    : hasLineageData
      ? 'partial'
      : 'partial';

  return {
    id: 'dynasty-family-tree',
    title: 'Dynasty Family Tree',
    kind: 'dynasty_family_tree',
    priority: 40,
    dataVersion: 1,
    dataState,
    payload: {
      houseName: dynasty.houseName,
      foundingPhase: dynasty.foundingPhase,
      currentRulerName: rulingDynast.name,
      tree,
      lineage: hasLineageData
        ? lineageRecords
            .map((r) => {
              const from = r.fromDynastId ? galaxyState.dynasts.get(r.fromDynastId) : null;
              const to = r.toDynastId ? galaxyState.dynasts.get(r.toDynastId) : null;
              return {
                phase: r.phase,
                fromRulerName: from?.name || 'Unknown',
                toRulerName: to?.name || 'Unknown',
                reason: r.reason,
              };
            })
            .sort((a, b) => b.phase - a.phase)
        : [],
    },
    emptyState: hasTreeData
      ? undefined
      : 'No known ancestors or spouse for the current ruler.',
  };
}

function deriveEcologyProfile(star: Star): DerivedEcologyProfile {
  const typeName = STAR_TYPE_PROPERTIES[star.starType].name.toLowerCase();
  const hasTrait = (trait: Trait): boolean => star.traits.includes(trait);
  const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
  const idHash = star.id.split('').reduce((acc, ch) => (Math.imul(acc, 33) + ch.charCodeAt(0)) >>> 0, 5381);
  const hydrologyVariance = ((((idHash >>> 8) & 1023) / 1023) - 0.5) * 0.42;

  const starHeatBias = typeName.includes('red giant')
    ? 0.18
    : typeName.includes('red')
      ? 0.08
      : typeName.includes('blue giant')
        ? -0.08
        : typeName.includes('white')
          ? -0.03
          : 0;
  const stabilityScore = clamp(star.stability, 0, 1);
  const warScore = clamp(star.atWarWith.length / 4, 0, 1);
  const techScore = clamp((star.administrativeTech - 0.4) / 1.8, 0, 1);
  const vitalityScore = clamp(star.vitality, 0, 1);
  const hazardPressure = clamp(
    (1 - stabilityScore) * 0.45 + warScore * 0.35 + (hasTrait(Trait.Militaristic) ? 0.08 : 0) + (hasTrait(Trait.Industrial) ? 0.05 : 0),
    0,
    1
  );

  const baseHabitability = clamp(
    0.52 + (vitalityScore - 0.5) * 0.35 + (techScore - 0.5) * 0.22 - Math.abs(starHeatBias) * 0.35 - hazardPressure * 0.28,
    0.05,
    0.95
  );
  const hydrologyBase = 0.18 + baseHabitability * 0.52;
  const starHydrologyBias = typeName.includes('blue giant')
    ? 0.05
    : typeName.includes('yellow')
      ? 0.02
      : typeName.includes('white')
        ? -0.03
        : typeName.includes('red giant')
          ? -0.10
          : typeName.includes('red')
            ? -0.06
            : 0;
  const traitHydrologyBias =
    (hasTrait(Trait.Industrial) ? -0.06 : 0) +
    (hasTrait(Trait.Mercantile) ? 0.02 : 0) +
    (hasTrait(Trait.Spiritualist) ? 0.01 : 0);
  const waterScore = clamp(
    hydrologyBase + starHydrologyBias + traitHydrologyBias + hydrologyVariance,
    0,
    1
  );
  const biosphereScore = clamp(
    baseHabitability * 0.68 + stabilityScore * 0.18 + (hasTrait(Trait.Spiritualist) ? 0.06 : 0) - hazardPressure * 0.25,
    0,
    1
  );

  const climateBand: EcologyProfilePayload['climateBand'] = starHeatBias <= -0.11
    ? 'Frozen'
    : starHeatBias <= -0.03
      ? 'Cold'
      : starHeatBias < 0.08
        ? 'Temperate'
        : starHeatBias < 0.15
          ? 'Hot'
          : 'Extreme';
  const waterPresence: EcologyProfilePayload['waterPresence'] = waterScore < 0.18
    ? 'Trace'
    : waterScore < 0.34
      ? 'Limited'
      : waterScore < 0.56
        ? 'Present'
        : 'Abundant';
  const biosphereComplexity: EcologyProfilePayload['biosphereComplexity'] = biosphereScore < 0.2
    ? 'Sterile'
    : biosphereScore < 0.4
      ? 'Microbial'
      : biosphereScore < 0.7
        ? 'Developing'
        : 'Complex';
  const ecoStability: EcologyProfilePayload['ecoStability'] = hazardPressure > 0.6
    ? 'Fragile'
    : hazardPressure > 0.35
      ? 'Strained'
      : 'Stable';
  const agriCapacity: EcologyProfilePayload['agriCapacity'] = baseHabitability < 0.22
    ? 'Minimal'
    : baseHabitability < 0.42
      ? 'Constrained'
      : baseHabitability < 0.7
        ? 'Viable'
        : 'High';

  const dominantBiomes: string[] = [];
  if (waterPresence === 'Abundant') dominantBiomes.push('Oceanic Basins');
  if (waterPresence === 'Present' && climateBand !== 'Frozen') dominantBiomes.push('Temperate Plains');
  if (climateBand === 'Frozen' || climateBand === 'Cold') dominantBiomes.push('Cryogenic Highlands');
  if (climateBand === 'Hot' || climateBand === 'Extreme') dominantBiomes.push('Arid Belts');
  if (hasTrait(Trait.Industrial)) dominantBiomes.push('Urban-Industrial Corridors');
  if (hasTrait(Trait.Scholarly)) dominantBiomes.push('Managed Research Preserves');
  if (hasTrait(Trait.Spiritualist)) dominantBiomes.push('Sacred Wild Zones');
  if (dominantBiomes.length === 0) dominantBiomes.push('Mixed Continental Terrain');

  const hazards: string[] = [];
  if (warScore >= 0.3) hazards.push('Conflict-driven infrastructure damage');
  if (hazardPressure >= 0.55) hazards.push('Supply-chain fragility');
  if (climateBand === 'Extreme') hazards.push('Extreme thermal cycling');
  if (waterPresence === 'Trace') hazards.push('Chronic water scarcity');
  if (hasTrait(Trait.Industrial) && ecoStability !== 'Stable') hazards.push('Industrial pollution pressure');
  if (hazards.length === 0) hazards.push('No system-scale hazard currently dominant');

  const summary = `${star.name} sustains a ${climateBand.toLowerCase()} ecology with ${waterPresence.toLowerCase()} water reserves and a ${biosphereComplexity.toLowerCase()} biosphere. Current ecological resilience is ${ecoStability.toLowerCase()}, with agricultural capacity rated ${agriCapacity.toLowerCase()}.`;

  return {
    habitability: baseHabitability,
    climateBand,
    biosphereComplexity,
    waterPresence,
    ecoStability,
    agriCapacity,
    dominantBiomes: dominantBiomes.slice(0, 3),
    hazards: hazards.slice(0, 3),
    summary,
    waterScore,
  };
}

export function getEcologyProfile(star: Star): {
  habitability: number;
  climateBand: 'Frozen' | 'Cold' | 'Temperate' | 'Hot' | 'Extreme';
  biosphereComplexity: 'Sterile' | 'Microbial' | 'Developing' | 'Complex';
  waterPresence: 'Trace' | 'Limited' | 'Present' | 'Abundant';
  ecoStability: 'Fragile' | 'Strained' | 'Stable';
  agriCapacity: 'Minimal' | 'Constrained' | 'Viable' | 'High';
  dominantBiomes: string[];
  hazards: string[];
  summary: string;
  waterScore: number;
} {
  return deriveEcologyProfile(star);
}

export function buildEcologyProfileSection(star: Star): EntrySection {
  const ecology = deriveEcologyProfile(star);
  return {
    id: 'ecology-profile',
    title: 'Ecology Profile',
    kind: 'ecology_profile',
    priority: 50,
    dataVersion: 1,
    dataState: 'complete',
    payload: {
      habitability: ecology.habitability,
      climateBand: ecology.climateBand,
      biosphereComplexity: ecology.biosphereComplexity,
      waterPresence: ecology.waterPresence,
      ecoStability: ecology.ecoStability,
      agriCapacity: ecology.agriCapacity,
      dominantBiomes: ecology.dominantBiomes,
      hazards: ecology.hazards,
      summary: ecology.summary,
    },
  };
}

export function buildCapitalAdministrationSection(star: Star): EntrySection {
  const centralizationBand = star.centralization >= 0.7
    ? 'High'
    : (star.centralization >= 0.4 ? 'Moderate' : 'Distributed');
  const adminCapacityBand = star.administrativeTech >= 1.3
    ? 'Advanced'
    : (star.administrativeTech >= 0.9 ? 'Standard' : 'Strained');
  const stabilityBand = star.stability >= 0.7
    ? 'Stable'
    : (star.stability >= 0.45 ? 'Mixed' : 'Fragile');
  const vitalityBand = star.vitality >= 0.7
    ? 'High'
    : (star.vitality >= 0.45 ? 'Moderate' : 'Low');

  return {
    id: 'capital-administration',
    title: 'Capital Administration',
    kind: 'capital_administration',
    priority: 60,
    dataVersion: 1,
    dataState: 'complete',
    payload: {
      hasCapitalSurvey: true,
      seatType: star.ruler === star.id ? 'sovereign-capital' : 'governor-seat',
      centralizationBand,
      adminCapacityBand,
      stabilityBand,
      vitalityBand,
      subjectLoad: star.subjects.length,
      activeWarCount: star.atWarWith.length,
    },
  };
}

export function buildCapitalSurveyProfileSection(star: Star): EntrySection {
  return {
    id: 'capital-survey-profile',
    title: 'Capital Survey Profile',
    kind: 'capital_survey_profile',
    priority: 65,
    dataVersion: 1,
    dataState: 'complete',
    payload: {
      source: 'capital-visual-style-profile',
      starId: star.id,
    },
  };
}

export function buildStarEncyclopediaEntry(star: Star, galaxyState: GalaxyState): StarEncyclopediaEntry {
  const sections: EntrySection<unknown>[] = [
    buildCoreStatusSection(star, galaxyState),
    buildSystemInventorySection(),
    buildGovernanceSection(star, galaxyState),
    buildRelationsSummarySection(star, galaxyState),
    buildDynastyFamilyTreeSection(star, galaxyState),
    buildEcologyProfileSection(star),
    buildCapitalAdministrationSection(star),
    buildCapitalSurveyProfileSection(star),
  ].sort((a, b) => a.priority - b.priority);

  return {
    starId: star.id,
    title: star.name,
    subtitle: `${STAR_TYPE_PROPERTIES[star.starType].name} • ${getTierLabel(star.tier)}`,
    phase: galaxyState.phase,
    visuals: createEntryVisuals(star),
    sections,
  };
}
