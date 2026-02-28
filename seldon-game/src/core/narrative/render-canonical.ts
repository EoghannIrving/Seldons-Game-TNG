import type { CanonicalWindowReport } from './types';

function titleCaseRiskLabel(label: string): string {
  return label.replace(/_/g, ' ');
}

function formatSignedPct(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

function continuityCollapseLine(report: CanonicalWindowReport): string | null {
  const meta = report.repetitionSuppression;
  if (!meta || meta.collapseCandidates.length === 0) return null;

  const tags: string[] = [];
  if (meta.collapseCandidates.includes('quiet_phase_stability')) {
    tags.push(`quiet_phases=${meta.quietPhaseCount}`);
  }
  if (meta.collapseCandidates.includes('trade_continuity')) {
    tags.push('trade_continuity_collapsed');
  }
  if (meta.collapseCandidates.includes('arc_quiet_continuity')) {
    tags.push('quiet_arc_repetition_collapsed');
  }
  if (tags.length === 0) return null;
  return `Repetition: ${tags.join(', ')}.`;
}

export function renderCanonicalWindowReport(report: CanonicalWindowReport): string[] {
  const families = Object.entries(report.eventTotals.byFamily)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([family, count]) => `${family}=${count}`);

  const lines: string[] = [];
  lines.push(
    `Window ${report.windowStartPhase}-${report.windowEndPhase}: ${report.eventTotals.totalEvents} events; final arc=${report.arcAssessment.finalArcType.replace(/_/g, ' ')}.`
  );
  if (families.length > 0) {
    lines.push(`Event families: ${families.join(', ')}.`);
  } else {
    lines.push('Event families: none (quiet window).');
  }
  lines.push(
    `Network: wars=${report.networkState.wars}, alliances=${report.networkState.alliances}, trade=${report.networkState.tradeLinks}, subjects=${report.networkState.subjects}; role=${report.networkState.starRole}.`
  );
  lines.push(
    `Pressure(end): stability=${report.pressureSummary.end.stability.toFixed(2)}, legitimacy=${report.pressureSummary.end.legitimacy.toFixed(2)}, external=${report.pressureSummary.end.externalPressure.toFixed(2)}, social=${report.pressureSummary.end.socialStrain.toFixed(2)}.`
  );
  if (report.windowSignals) {
    const pop = formatSignedPct(report.windowSignals.populationDeltaPct);
    const tech = formatSignedPct(report.windowSignals.techDeltaPct);
    const plagueMort = report.windowSignals.plagueMortalityRatePct;
    const signalParts: string[] = [];
    if (pop) signalParts.push(`population=${pop}`);
    if (tech) signalParts.push(`tech=${tech}`);
    if (typeof plagueMort === 'number' && plagueMort > 0) {
      signalParts.push(`plague_mort=${Math.round(plagueMort * 10) / 10}%`);
    }
    const inferredCauseParts =
      report.windowSignals.dominantCauseTags.length > 0
        ? [`causes=${report.windowSignals.dominantCauseTags.join('|')}`]
        : [];
    if (signalParts.length > 0) lines.push(`Signals: ${signalParts.join(', ')}.`);
    if (inferredCauseParts.length > 0) lines.push(`Inferred causes: ${inferredCauseParts.join(', ')}.`);
  }
  const repetitionLine = continuityCollapseLine(report);
  if (repetitionLine) lines.push(repetitionLine);
  if (report.costs[0]) lines.push(`Cost: ${report.costs[0].summary}`);
  if (report.irreversibleShifts[0]) lines.push(`Irreversible shift: ${report.irreversibleShifts[0].summary}`);
  if (report.riskVector) lines.push(`Primary risk: ${titleCaseRiskLabel(report.riskVector.primary)}.`);
  return lines;
}
