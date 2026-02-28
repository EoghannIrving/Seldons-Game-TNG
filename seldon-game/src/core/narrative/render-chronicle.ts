import type { CanonicalWindowReport } from './types';

const LEGACY_CLOSE_QUESTION_FRAGMENTS = [
  'The next phase will test whether these gains and losses consolidate into a durable direction',
  'The immediate question is whether this pattern hardens into doctrine or breaks on first stress',
  'What follows depends on whether the current alignment can survive one more cycle of pressure',
];

function buildRiskSentence(primary: NonNullable<CanonicalWindowReport['riskVector']>['primary']): string {
  switch (primary) {
    case 'autonomy_snapback':
      return sentence('The autonomy pressure that ran beneath this window has not resolved — that tension has a way of returning suddenly, and the next trigger may not allow for a gradual response');
    case 'bureaucratic_paralysis':
      return sentence('The administrative machinery was already under strain when the window closed — if another major demand arrives before it recovers, the capacity to respond may not be there');
    case 'dependency_shock':
      return sentence('The reliance on outside trade that served this system well in stable times now looks like a fragility — one sharp disruption from a difficult adjustment');
    case 'legitimacy_crisis':
      return sentence('The question of whether the current authority has the right to lead this world was not answered here — it was deferred, and deferred questions have a way of becoming crises');
    case 'frontier_overstretch':
      return sentence('The reach of this system has grown beyond what it can comfortably hold — the frontier is always the first place where the gap between ambition and capacity becomes visible');
    case 'succession_instability':
      return sentence('When the next succession comes, the ground beneath it will be less stable than it appears from the outside — the window has left things unsettled in ways the record does not fully capture');
    default:
      return sentence('No dominant risk pattern emerged from this window — though the absence of a clear signal can itself precede sudden, unorganized crisis');
  }
}

function sentence(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim().replace(/[.?!]\s*$/, '');
  return `${collapsed}.`;
}

type ChronicleImpactDomain = 'population' | 'trade' | 'technology' | 'governance';

interface ChronicleImpactCandidate {
  key: string;
  domain: ChronicleImpactDomain;
  basePriority: number;
  text: string;
}

function populationHumanCostSentence(report: CanonicalWindowReport): ChronicleImpactCandidate | null {
  if (report.costs[0]?.kind !== 'population_loss') return null;
  const popDelta = report.windowSignals?.populationDeltaPct ?? null;
  if (popDelta === null || popDelta >= 0) return null;
  const causes = new Set(report.windowSignals?.dominantCauseTags ?? []);
  const severity = report.costs[0]?.severity ?? 'low';

  if (causes.has('plague') && causes.has('war')) {
    if (severity === 'high') return { key: 'population_deaths_war_plague_high', domain: 'population', basePriority: 90, text: sentence('War and plague did not take turns — they ran together, and the population that remained was a remnant of what had entered') };
    if (severity === 'medium') return { key: 'population_deaths_war_plague_medium', domain: 'population', basePriority: 90, text: sentence('The window had two ways to die in it, and many found at least one of them') };
    return { key: 'population_deaths_war_plague', domain: 'population', basePriority: 90, text: sentence('War and plague ran together, as they so often do — the dead came from both fronts at once') };
  }
  if (causes.has('plague')) {
    if (severity === 'high') return { key: 'population_deaths_plague_high', domain: 'population', basePriority: 90, text: sentence('The plague unmade in seasons what had taken generations to build. Those who lived would carry the memory of those who did not') };
    if (severity === 'medium') return { key: 'population_deaths_plague_medium', domain: 'population', basePriority: 90, text: sentence('The plague left the count plainly smaller — not a crisis that makes headlines, but a real and lasting subtraction') };
    return { key: 'population_deaths_plague', domain: 'population', basePriority: 90, text: sentence('The plague moved through quietly, and the count at the window\'s close was smaller than the one it opened') };
  }
  if (causes.has('war')) {
    if (severity === 'high') return { key: 'population_losses_war_high', domain: 'population', basePriority: 85, text: sentence('The war did not merely press the population — it diminished it. The count at the close is a record of what was lost') };
    if (severity === 'medium') return { key: 'population_losses_war_medium', domain: 'population', basePriority: 85, text: sentence('Those who survived the window were fewer than those who had entered it — the war had seen to that') };
    return { key: 'population_losses_war', domain: 'population', basePriority: 85, text: sentence('The war took lives steadily, and the population that emerged from the window was smaller for it') };
  }
  if (causes.has('crisis')) {
    if (severity === 'high') return { key: 'population_losses_crisis_high', domain: 'population', basePriority: 80, text: sentence('What the crisis consumed would not return when it ended. The dead stayed dead') };
    if (severity === 'medium') return { key: 'population_losses_crisis_medium', domain: 'population', basePriority: 80, text: sentence('Sustained crisis grinds people down before it breaks systems — the count at the window\'s close was evidence of that grinding') };
    return { key: 'population_losses_crisis', domain: 'population', basePriority: 80, text: sentence('The crisis cost lives, not only stability — the dead did not appear in the political summaries') };
  }
  if (severity === 'high') return { key: 'population_losses_neutral_high', domain: 'population', basePriority: 75, text: sentence('These were not fluctuations in the numbers — they were losses, and losses of this depth leave marks that outlast the event') };
  if (severity === 'medium') return { key: 'population_losses_neutral_medium', domain: 'population', basePriority: 75, text: sentence('The population at the close was smaller than at the open, and the difference was not a statistical artifact') };
  return { key: 'population_losses_neutral', domain: 'population', basePriority: 75, text: sentence('The window cost lives. The precise cause does not appear clearly in the record, but the count is plain') };
}

function plagueCasualtySentence(report: CanonicalWindowReport): ChronicleImpactCandidate | null {
  if (report.costs[0]?.kind !== 'plague_casualties') return null;
  const severity = report.costs[0]?.severity;

  if (severity === 'high') {
    return { key: 'plague_casualties_high', domain: 'population', basePriority: 88, text: sentence('The plague took its share even as the living kept pace. The count grew, but the dead were real — history records both numbers') };
  }
  if (severity === 'medium') {
    return { key: 'plague_casualties_medium', domain: 'population', basePriority: 86, text: sentence('Population grew across the window, though the plague extracted its toll throughout. A growing society can absorb losses; it does not forget them') };
  }
  return { key: 'plague_casualties_low', domain: 'population', basePriority: 85, text: sentence('The plague moved through, and some did not survive it — even years in which the population grows have their dead') };
}

function warCasualtySentence(report: CanonicalWindowReport): ChronicleImpactCandidate | null {
  if (report.costs[0]?.kind !== 'war_casualties') return null;
  const causes = new Set(report.windowSignals?.dominantCauseTags ?? []);
  const severity = report.costs[0]?.severity;

  if (causes.has('plague')) {
    return { key: 'war_casualties_plague_concurrent', domain: 'population', basePriority: 88, text: sentence('War and plague together claimed lives the overall count obscured') };
  }
  if (severity === 'high') {
    return { key: 'war_casualties_high', domain: 'population', basePriority: 88, text: sentence('The war killed at a pace the birth rate was barely keeping pace with') };
  }
  return { key: 'war_casualties_net_growth', domain: 'population', basePriority: 85, text: sentence('The war claimed lives throughout the window even as the population held its overall size') };
}

function tradeHumanCostSentence(report: CanonicalWindowReport): ChronicleImpactCandidate | null {
  const causes = new Set(report.windowSignals?.dominantCauseTags ?? []);
  const primaryCost = report.costs[0]?.kind;
  const risk = report.riskVector?.primary;

  const hasTradeDisruptionSignal = primaryCost === 'trade_disruption' || causes.has('trade_disruption');
  if (!hasTradeDisruptionSignal && risk !== 'dependency_shock') return null;

  if (risk === 'dependency_shock' && causes.has('trade_disruption')) {
    return { key: 'trade_shortage_dependency_disruption', domain: 'trade', basePriority: 82, text: sentence('When the trade routes broke down, shortages followed quickly — a system this reliant on outside supply has little cushion') };
  }
  if (causes.has('trade_disruption')) {
    return { key: 'trade_supply_disruption', domain: 'trade', basePriority: 76, text: sentence('The disruption hit trade, and the effects spread to anyone who depended on those routes holding') };
  }
  if (risk === 'dependency_shock' && report.networkState.tradeLinks >= 3) {
    return { key: 'trade_dependency_shock_exposure', domain: 'trade', basePriority: 74, text: sentence('The dependence on outside trade, useful in stable times, had become a fragility — one supply shock away from shortages') };
  }
  return null;
}

function technologyHumanImpactSentence(report: CanonicalWindowReport): ChronicleImpactCandidate | null {
  const techDeltaPct = report.windowSignals?.techDeltaPct ?? null;
  if (techDeltaPct === null) return null;
  const causes = new Set(report.windowSignals?.dominantCauseTags ?? []);

  if (techDeltaPct <= -4) {
    if (causes.has('war') || causes.has('crisis')) {
      return { key: 'technology_regression_pressure', domain: 'technology', basePriority: 64, text: sentence('Under sustained pressure, the accumulated technical knowledge began to slip — infrastructure that had taken years to build started falling behind') };
    }
    return { key: 'technology_regression_neutral', domain: 'technology', basePriority: 60, text: sentence('Something harder to rebuild than armies or governments was lost here: the technical base that everything else rests on retreated') };
  }

  if (techDeltaPct >= 4) {
    if (causes.has('war') || causes.has('crisis')) {
      return { key: 'technology_learning_under_pressure', domain: 'technology', basePriority: 56, text: sentence('That the institutions kept learning through all of this is worth noting — it meant something survived intact that pressure usually damages') };
    }
    return { key: 'technology_capacity_build', domain: 'technology', basePriority: 54, text: sentence('The underlying knowledge base kept growing through the window — a quieter kind of progress than military or political gains, but no less real') };
  }

  return null;
}

function governanceHumanImpactSentence(report: CanonicalWindowReport): ChronicleImpactCandidate | null {
  const risk = report.riskVector?.primary;
  const loyalty = report.networkState.loyaltyPct;
  const starRole = report.networkState.starRole;

  if (risk === 'autonomy_snapback') {
    if (starRole === 'subject') {
      return { key: 'governance_autonomy_subject', domain: 'governance', basePriority: 78, text: sentence('The people of this subject world were growing less willing to follow orders from the center — not open defiance yet, but the compliance was thinning visibly') };
    }
    if (loyalty < 25) {
      return { key: 'governance_autonomy_low_loyalty', domain: 'governance', basePriority: 74, text: sentence('The gap between what the center commanded and what the worlds actually did kept widening — a gap that is easy to ignore and hard to close once it grows') };
    }
  }

  if (risk === 'bureaucratic_paralysis') {
    if (report.pressureSummary.troughs.stability < 0.35 || report.pressureSummary.average.externalPressure > 0.45) {
      return { key: 'governance_bureaucratic_overload', domain: 'governance', basePriority: 76, text: sentence('There was more to manage than the system could hold — decisions slowed, requests backed up, and the machinery of governance began to seize') };
    }
  }

  if (starRole === 'subject' && loyalty < 20) {
    return { key: 'governance_coercive_compliance', domain: 'governance', basePriority: 70, text: sentence('With loyalty this low in a subject world, compliance has to be compelled rather than expected — that is a costly way to rule, and not a stable one') };
  }

  return null;
}

function costDomain(report: CanonicalWindowReport): ChronicleImpactDomain | null {
  switch (report.costs[0]?.kind) {
    case 'population_loss': return 'population';
    case 'war_casualties': return 'population';
    case 'plague_casualties': return 'population';
    case 'trade_disruption': return 'trade';
    case 'loyalty_strain':
    case 'legitimacy_strain': return 'governance';
    case 'war_burden': return report.windowSignals?.populationDeltaPct !== null && (report.windowSignals?.populationDeltaPct ?? 0) < 0 ? 'population' : 'governance';
    case 'infrastructure_damage': return 'technology';
    default: return null;
  }
}

function riskDomain(report: CanonicalWindowReport): ChronicleImpactDomain | null {
  switch (report.riskVector?.primary) {
    case 'dependency_shock': return 'trade';
    case 'autonomy_snapback':
    case 'bureaucratic_paralysis':
    case 'legitimacy_crisis':
    case 'succession_instability': return 'governance';
    case 'frontier_overstretch':
      return report.windowSignals?.populationDeltaPct !== null && (report.windowSignals?.populationDeltaPct ?? 0) < 0 ? 'population' : 'governance';
    default: return null;
  }
}

function domainPriority(domain: ChronicleImpactDomain): number {
  switch (domain) {
    case 'population': return 4;
    case 'trade': return 3;
    case 'governance': return 2;
    case 'technology': return 1;
  }
}

function shouldSuppressDarkAgeBoilerplate(report: CanonicalWindowReport): boolean {
  const causes = new Set(report.windowSignals?.dominantCauseTags ?? []);
  const techDelta = report.windowSignals?.techDeltaPct ?? null;
  const lowTechStress = techDelta !== null && techDelta <= -4;
  const severeDisruption = causes.has('war') || causes.has('crisis') || causes.has('plague');
  return !lowTechStress && !severeDisruption;
}

function shouldSoftenQuietContinuityPhrase(report: CanonicalWindowReport): boolean {
  const warCount = report.eventTotals.byFamily.war ?? 0;
  const succCount = report.eventTotals.byFamily.succession ?? 0;
  const conquestCount = report.eventTotals.byFamily.conquest ?? 0;
  return (
    report.arcAssessment.finalArcType === 'quiet_continuity'
    && (
      report.eventTotals.totalEvents >= 10
      || conquestCount > 0
      || warCount >= 3
      || succCount >= 3
      || report.costs[0]?.kind === 'population_loss'
      || report.irreversibleShifts[0]?.kind === 'conquest'
    )
  );
}

function normalizeLegacyCloseParts(parts: string[], report: CanonicalWindowReport): string[] {
  const next = [...parts];
  if (next.length > 0 && shouldSoftenQuietContinuityPhrase(report)) {
    const first = next[0];
    if (first) next[0] = first.replace(
      /arc through this window was one of quiet continuity/i,
      'arc through this window was one of strained continuity'
    );
  }
  return next.filter((part) => {
    if (shouldSuppressDarkAgeBoilerplate(report) && /Operating under dark-age conditions/i.test(part)) {
      return false;
    }
    return true;
  });
}

function domainRegex(domain: ChronicleImpactDomain): RegExp {
  switch (domain) {
    case 'population':
      return /deaths|displacement|population losses|claimed lives|barely keeping pace|the dead|the plague|the war took|smaller for it|fewer than those|dead stayed dead|not a statistical artifact|the window cost lives|left marks that outlast/i;
    case 'trade':
      return /shortages|supply disruption|trade-dependent|commerce exposed|market shock|routes broke down|trade routes|outside trade|outside supply/i;
    case 'technology':
      return /technical|maintenance debt|institutional learning|capacity|knowledge base|technical base|kept learning/i;
    case 'governance':
      return /autonomy|compliance|administrative|bureaucratic|governance dependent|commands and what the worlds|less willing to follow|coercive|machinery of governance/i;
  }
}

function selectImpactSentences(report: CanonicalWindowReport, existingParts: string[]): string[] {
  const rawCandidates = [
    populationHumanCostSentence(report),
    warCasualtySentence(report),
    plagueCasualtySentence(report),
    tradeHumanCostSentence(report),
    technologyHumanImpactSentence(report),
    governanceHumanImpactSentence(report),
  ].filter((c): c is ChronicleImpactCandidate => c !== null);

  const byKey = new Map<string, ChronicleImpactCandidate>();
  for (const c of rawCandidates) {
    if (!byKey.has(c.key)) byKey.set(c.key, c);
  }

  const preferredCostDomain = costDomain(report);
  const preferredRiskDomain = riskDomain(report);
  const candidates = Array.from(byKey.values()).map((c) => {
    let priority = c.basePriority;
    if (preferredCostDomain && c.domain === preferredCostDomain) priority += 40;
    if (preferredRiskDomain && c.domain === preferredRiskDomain) priority += 25;
    if (preferredCostDomain && c.domain !== preferredCostDomain) priority -= 6;
    if (preferredRiskDomain && c.domain !== preferredRiskDomain) priority -= 4;
    if (
      (report.riskVector?.primary === 'succession_instability' || report.riskVector?.primary === 'legitimacy_crisis')
      && c.domain === 'governance'
    ) {
      priority += 18;
    }
    return { ...c, priority };
  });

  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const domainDelta = domainPriority(b.domain) - domainPriority(a.domain);
    if (domainDelta !== 0) return domainDelta;
    return a.key.localeCompare(b.key);
  });

  const selected: string[] = [];
  const usedDomains = new Set<ChronicleImpactDomain>();
  const budget = 2;

  for (const candidate of candidates) {
    if (selected.length >= budget) break;
    if (usedDomains.has(candidate.domain)) continue;
    const regex = domainRegex(candidate.domain);
    if (existingParts.some((part) => regex.test(part))) continue;
    selected.push(candidate.text);
    usedDomains.add(candidate.domain);
  }

  return selected;
}

function replaceLegacyQuestionWithRisk(paragraph: string, report: CanonicalWindowReport): string {
  const risk = report.riskVector;
  if (!risk) return paragraph;

  const parts = paragraph
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const filtered = normalizeLegacyCloseParts(parts, report).filter((part) =>
    !LEGACY_CLOSE_QUESTION_FRAGMENTS.some((frag) => part.includes(frag))
  );

  const humanImpactSentences = selectImpactSentences(report, filtered);
  filtered.push(...humanImpactSentences);

  filtered.push(buildRiskSentence(risk.primary));
  return filtered.join(' ');
}

export function renderChronicleOverlayWithPolicy(
  legacyLines: string[],
  report: CanonicalWindowReport
): string[] {
  if (legacyLines.length < 5) return legacyLines;
  const next = [...legacyLines];
  const closeIdx = 4;
  next[closeIdx] = replaceLegacyQuestionWithRisk(next[closeIdx] ?? '', report);
  return next;
}
