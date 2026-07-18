import type { CaseFile, HypothesisScore } from '../../core/types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function buildEncyclopediaInvestigationsPaneHtml(args: {
  caseFiles: CaseFile[];
  scores: HypothesisScore[];
}): string {
  const { caseFiles, scores } = args;
  if (caseFiles.length === 0) {
    return '<p class="encyclopedia-empty-copy">Run more phases to generate preservation investigations.</p>';
  }

  const scoreByCase = new Map(scores.map((score) => [score.caseId, score]));

  return `
    <section class="encyclopedia-investigations">
      <div class="encyclopedia-investigation-summary">
        <h3>Preservation Investigations</h3>
        <p>Study empire pressure, pin evidence, and test whether civilization can survive the next fracture.</p>
      </div>
      <div class="encyclopedia-investigation-grid">
        ${caseFiles.map((caseFile) => {
          const score = scoreByCase.get(caseFile.id);
          const scoreHtml = score
            ? `<div class="investigation-score ${score.verdict}">
                <strong>${Math.round(score.total * 100)}%</strong>
                <span>${escapeHtml(formatLabel(score.verdict))} hypothesis</span>
                <small>${score.rationale.map(escapeHtml).join(' | ')}</small>
              </div>`
            : '';
          return `
            <article class="investigation-case">
              <header>
                <h4>${escapeHtml(caseFile.title)}</h4>
                <span>Phases ${caseFile.startPhase}-${caseFile.endPhase}</span>
              </header>
              <p>${escapeHtml(caseFile.prompt)}</p>
              <div class="investigation-tags">
                <span>${escapeHtml(formatLabel(caseFile.recommendedCause))}</span>
                <span>${escapeHtml(formatLabel(caseFile.recommendedOutcome))}</span>
              </div>
              <div class="investigation-stakes">
                ${caseFile.preservationStakes.map((stake) => `<span>${escapeHtml(stake)}</span>`).join('')}
              </div>
              <div class="investigation-evidence">
                ${caseFile.evidencePins.map((pin) => `
                  <button type="button" data-investigation-pin="${escapeHtml(pin.id)}" data-link-phase="${pin.phase ?? caseFile.endPhase}" ${pin.starId ? `data-link-star-id="${escapeHtml(pin.starId)}"` : ''}>
                    ${escapeHtml(pin.label)}
                  </button>
                `).join('')}
              </div>
              <button type="button" class="encyclopedia-clear-btn investigation-score-btn" data-score-case-id="${escapeHtml(caseFile.id)}">Score Best Hypothesis</button>
              ${scoreHtml}
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `;
}
