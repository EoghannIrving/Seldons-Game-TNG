import { EventType, GalaxyState, HistoricalEvent, Star } from '../types';

export type NarrativeSentenceMode = 'recent' | 'long';

interface ConquestMeta {
  role: 'conqueror' | 'conquered' | 'unknown';
  conquerorName?: string;
  targetName?: string;
}

interface LiberationMeta {
  role: 'liberated' | 'overlord_lost' | 'unknown';
  previousRulerName?: string;
  liberatedStarName?: string;
}

interface WarMeta {
  role: 'aggressor' | 'defender' | 'unknown';
  counterpartName?: string;
}

interface PeaceMeta {
  counterpartName?: string;
  resultQuality?: 'decisive' | 'negotiated' | 'fragile';
}

interface PlagueMeta {
  severityBand?: 'mild' | 'moderate' | 'severe' | 'catastrophic';
}

export interface NarrativeSentenceDeps {
  pickTemplate: (family: string, seed: number, starId: string, phase: number, typeKey: string, mode: NarrativeSentenceMode) => string;
  fillTemplate: (template: string, values: Record<string, string>) => string;
  familyForType: (type: EventType) => string;
  humanizeEventType: (type: EventType) => string;
  directionForEventType: (type: EventType) => string;
  getStarName: (state: GalaxyState, id: string) => string;
  extractConquestMeta: (event: HistoricalEvent) => ConquestMeta;
  extractLibMeta: (event: HistoricalEvent) => LiberationMeta;
  extractWarMeta: (event: HistoricalEvent) => WarMeta;
  extractPeaceMeta: (event: HistoricalEvent) => PeaceMeta;
  extractPlagueMeta: (event: HistoricalEvent) => PlagueMeta;
}

export function humanizeEventType(type: EventType): string {
  return type
    .toString()
    .replace(/[_-]/g, ' ')
    .toLowerCase();
}

export function directionForEventType(type: EventType): string {
  if (
    type === EventType.CrisisStarted ||
    type === EventType.Collapse ||
    type === EventType.DecadenceCollapse ||
    type === EventType.Anarchy ||
    type === EventType.ExternalThreat ||
    type === EventType.TheMule ||
    type === EventType.Plague ||
    type === EventType.WarDeclared ||
    type === EventType.Conquest
  ) {
    return 'instability';
  }

  if (
    type === EventType.Liberation ||
    type === EventType.CrisisResolved ||
    type === EventType.ReformEnacted ||
    type === EventType.GoldenAge ||
    type === EventType.GoldenAgeStarted ||
    type === EventType.TradeBoom ||
    type === EventType.PeaceTreaty
  ) {
    return 'stability';
  }

  if (type === EventType.GovernmentTransition) return 'instability';
  return 'mixed outcomes';
}

export function buildNarrativeSentenceWithDeps(
  deps: NarrativeSentenceDeps,
  state: GalaxyState,
  star: Star,
  phase: number,
  event: HistoricalEvent,
  mode: NarrativeSentenceMode
): string {
  if (event.type === EventType.Succession && event.metadata) {
    const template = deps.pickTemplate('succession', state.config.seed, star.id, phase, String(event.type), mode);
    return deps.fillTemplate(template, {
      star: star.name,
      fromDynastName: event.metadata.fromDynastName || 'an unknown ruler',
      toDynastName: event.metadata.toDynastName || 'an unknown heir',
      houseName: event.metadata.houseName || 'an unknown house',
    });
  }

  if (event.type === EventType.GovernmentTransition && event.metadata) {
    const isPeacefulConversion = event.metadata.endReason === 'Peaceful Ideological Conversion';
    const isConverterRecord = event.metadata.isConverterRecord === true;

    if (isConverterRecord && event.metadata.convertedStarName) {
      const template = deps.pickTemplate('religious_conversion', state.config.seed, star.id, phase, 'converter', mode);
      return deps.fillTemplate(template, {
        star: event.metadata.convertedStarName,
        converter: star.name,
        oldGov: 'former government',
      });
    }

    if (isPeacefulConversion) {
      const template = deps.pickTemplate('religious_conversion', state.config.seed, star.id, phase, String(event.type), mode);
      return deps.fillTemplate(template, {
        star: star.name,
        converter: event.metadata.converterName || 'a neighboring Theocracy',
        oldGov: event.metadata.oldGov?.replace(/-/g, ' ') || 'old government',
      });
    }

    const template = deps.pickTemplate('government_transition', state.config.seed, star.id, phase, String(event.type), mode);
    return deps.fillTemplate(template, {
      star: star.name,
      oldGov: event.metadata.oldGov?.replace(/-/g, ' ') || 'old government',
      newGov: event.metadata.newGov?.replace(/-/g, ' ') || 'new government',
      endReason: event.metadata.endReason || 'political upheaval',
    });
  }

  const counterpartFallback = event.relatedStars?.[0] ? deps.getStarName(state, event.relatedStars[0]!) : 'a neighboring power';

  if (event.type === EventType.Conquest) {
    const { role, conquerorName, targetName } = deps.extractConquestMeta(event);
    if (role === 'conquered') {
      const cName = conquerorName ?? counterpartFallback;
      const template = deps.pickTemplate('conquest_conquered', state.config.seed, star.id, phase, String(event.type), mode);
      return deps.fillTemplate(template, { star: star.name, conquerorName: cName });
    }
    if (role === 'conqueror') {
      const tName = targetName ?? counterpartFallback;
      const template = deps.pickTemplate('conquest', state.config.seed, star.id, phase, String(event.type), mode);
      return deps.fillTemplate(template, { star: star.name, target: tName });
    }
  }

  if (event.type === EventType.Liberation) {
    const { role, previousRulerName, liberatedStarName } = deps.extractLibMeta(event);
    if (role === 'liberated') {
      const template = deps.pickTemplate('liberation_liberated', state.config.seed, star.id, phase, String(event.type), mode);
      return deps.fillTemplate(template, { star: star.name, previousRulerName: previousRulerName ?? counterpartFallback });
    }
    if (role === 'overlord_lost') {
      const lName = liberatedStarName ?? counterpartFallback;
      const template = deps.pickTemplate('liberation', state.config.seed, star.id, phase, String(event.type), mode);
      return deps.fillTemplate(template, { star: star.name, target: lName });
    }
  }

  if (event.type === EventType.WarDeclared) {
    const { role, counterpartName } = deps.extractWarMeta(event);
    if (role === 'defender') {
      const cName = counterpartName ?? counterpartFallback;
      const template = deps.pickTemplate('war_defender', state.config.seed, star.id, phase, String(event.type), mode);
      return deps.fillTemplate(template, { star: star.name, counterpartName: cName });
    }
  }

  if (event.type === EventType.PeaceTreaty) {
    const { counterpartName, resultQuality } = deps.extractPeaceMeta(event);
    const cName = counterpartName ?? counterpartFallback;
    const rqLabel = resultQuality === 'decisive' ? 'decisive' : resultQuality === 'fragile' ? 'fragile' : 'negotiated';
    const template = deps.pickTemplate('peace', state.config.seed, star.id, phase, String(event.type), mode);
    return deps.fillTemplate(template, { star: star.name, counterpartName: cName, resultQuality: rqLabel });
  }

  if (event.type === EventType.Plague) {
    const { severityBand } = deps.extractPlagueMeta(event);
    const template = deps.pickTemplate('plague', state.config.seed, star.id, phase, String(event.type), mode);
    return deps.fillTemplate(template, { star: star.name, severityBand: severityBand ?? 'severe' });
  }

  if (event.type === EventType.HyperlaneCollapse) {
    const template = deps.pickTemplate('hyperlane', state.config.seed, star.id, phase, String(event.type), mode);
    return deps.fillTemplate(template, { star: star.name });
  }

  const family = deps.familyForType(event.type);
  const targetId = event.relatedStars?.[0];
  const target = targetId ? deps.getStarName(state, targetId) : 'a neighboring system';
  const template = deps.pickTemplate(family, state.config.seed, star.id, phase, String(event.type), mode);
  return deps.fillTemplate(template, {
    star: star.name,
    target,
    phase: String(phase),
    eventLabel: deps.humanizeEventType(event.type),
    direction: deps.directionForEventType(event.type),
  });
}
