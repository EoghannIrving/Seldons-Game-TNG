export interface ForensicPivotButton {
  label: string;
  dataAttrs: Record<string, string | number>;
}

function sanitizeDataAttrName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function renderDataAttrs(
  attrs: Record<string, string | number>,
  escapeHtml: (input: string) => string
): string {
  return Object.entries(attrs)
    .map(([key, value]) => {
      const safeKey = sanitizeDataAttrName(key);
      return safeKey.length > 0
        ? ` data-${safeKey}="${escapeHtml(String(value))}"`
        : '';
    })
    .join('');
}

export function computeForensicConfidence(
  phase: number,
  currentPhase: number,
  typeSeed: string,
  textSeed: string
): number {
  const recency = Math.max(0, Math.min(1, 1 - ((currentPhase - phase) / 40)));
  const typeBias = /crisis|war|revolution|collapse|succession|rebellion/i.test(typeSeed) ? 0.08 : 0.03;
  let hash = 5381;
  const seed = `${typeSeed}|${textSeed}|${phase}`;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) >>> 0;
  }
  const variation = (hash % 23) / 100;
  return Math.max(0.52, Math.min(0.95, 0.55 + (recency * 0.24) + typeBias + variation));
}

export function buildForensicEvidenceBlockHtml(args: {
  phase: number;
  currentPhase: number;
  typeSeed: string;
  textSeed: string;
  evidenceLines: string[];
  pivots: ForensicPivotButton[];
  escapeHtml: (input: string) => string;
}): string {
  const { phase, currentPhase, typeSeed, textSeed, evidenceLines, pivots, escapeHtml } = args;
  const confidence = Math.round(computeForensicConfidence(phase, currentPhase, typeSeed, textSeed) * 100);
  const evidenceLinesHtml = evidenceLines
    .slice(0, 2)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
  const pivotsHtml = pivots
    .map((pivot) =>
      `<button type="button" class="encyclopedia-forensic-pivot-btn"${renderDataAttrs(pivot.dataAttrs, escapeHtml)}>${escapeHtml(pivot.label)}</button>`
    )
    .join('');

  return `
      <div class="encyclopedia-forensic-block">
        <div class="encyclopedia-forensic-head">
          <span class="encyclopedia-forensic-confidence">Confidence ${confidence}%</span>
        </div>
        <div class="encyclopedia-forensic-evidence">
          ${evidenceLinesHtml}
        </div>
        ${pivotsHtml.length > 0 ? `<div class="encyclopedia-forensic-pivots">${pivotsHtml}</div>` : ''}
      </div>
    `;
}
