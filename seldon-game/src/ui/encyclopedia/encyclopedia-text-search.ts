import type { EncyclopediaEntry } from '../../core/encyclopedia';

export interface EncyclopediaSearchSuggestion {
  value: string;
  label: string;
  type: 'star' | 'type' | 'event';
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function linkifyEncyclopediaText(text: string, starNames: Array<{ id: string; name: string }>): string {
  const raw = text ?? '';
  if (raw.length === 0) return '';
  const lower = raw.toLowerCase();
  const matches: Array<{ start: number; end: number; kind: 'phase' | 'star'; value: string }> = [];

  const phaseRegex = /phase\s+(\d+)/gi;
  let phaseMatch = phaseRegex.exec(raw);
  while (phaseMatch) {
    const fullMatch = phaseMatch[0];
    const phaseNumber = phaseMatch[1];
    if (phaseNumber) {
      matches.push({
        start: phaseMatch.index,
        end: phaseMatch.index + fullMatch.length,
        kind: 'phase',
        value: phaseNumber,
      });
    }
    phaseMatch = phaseRegex.exec(raw);
  }

  const namesSorted = [...starNames].sort((a, b) => b.name.length - a.name.length);
  for (const star of namesSorted) {
    const needle = star.name.toLowerCase();
    if (needle.length < 3) continue;
    let startAt = 0;
    while (startAt < lower.length) {
      const idx = lower.indexOf(needle, startAt);
      if (idx < 0) break;
      const left = idx === 0 ? '' : lower[idx - 1] ?? '';
      const right = idx + needle.length >= lower.length ? '' : lower[idx + needle.length] ?? '';
      const leftBoundary = left.length === 0 || !/[a-z0-9]/.test(left);
      const rightBoundary = right.length === 0 || !/[a-z0-9]/.test(right);
      if (leftBoundary && rightBoundary) {
        matches.push({
          start: idx,
          end: idx + needle.length,
          kind: 'star',
          value: star.id,
        });
      }
      startAt = idx + needle.length;
    }
  }

  matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (b.end - b.start) - (a.end - a.start);
  });

  const accepted: typeof matches = [];
  for (const match of matches) {
    const overlaps = accepted.some((existing) => !(match.end <= existing.start || match.start >= existing.end));
    if (!overlaps) accepted.push(match);
  }

  if (accepted.length === 0) return escapeHtml(raw);

  let cursor = 0;
  let html = '';
  for (const match of accepted) {
    if (match.start > cursor) {
      html += escapeHtml(raw.slice(cursor, match.start));
    }
    const tokenText = raw.slice(match.start, match.end);
    if (match.kind === 'phase') {
      html += `<button type="button" class="encyclopedia-inline-link" data-link-phase="${match.value}">${escapeHtml(tokenText)}</button>`;
    } else {
      html += `<button type="button" class="encyclopedia-inline-link" data-link-star-id="${match.value}">${escapeHtml(tokenText)}</button>`;
    }
    cursor = match.end;
  }
  if (cursor < raw.length) {
    html += escapeHtml(raw.slice(cursor));
  }
  return html;
}

export function buildEncyclopediaSearchSuggestions(query: string, events: EncyclopediaEntry[]): EncyclopediaSearchSuggestion[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  const suggestions: EncyclopediaSearchSuggestion[] = [];
  const seen = new Set<string>();
  const pushUnique = (item: EncyclopediaSearchSuggestion) => {
    const key = `${item.type}:${item.value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push(item);
  };

  for (const starName of Array.from(new Set(events.map((event) => event.starName)))) {
    if (starName.toLowerCase().includes(normalized)) {
      pushUnique({ value: starName, label: `${starName} (star)`, type: 'star' });
    }
    if (suggestions.length >= 4) break;
  }

  const eventTypes = Array.from(new Set(events.map((event) => event.type)));
  for (const eventType of eventTypes) {
    if (eventType.toLowerCase().includes(normalized)) {
      pushUnique({ value: eventType, label: `${eventType} (type)`, type: 'type' });
    }
    if (suggestions.length >= 6) break;
  }

  for (const event of events) {
    if (event.description.toLowerCase().includes(normalized)) {
      pushUnique({
        value: event.description,
        label: `${event.description.slice(0, 64)}${event.description.length > 64 ? '...' : ''} (event)`,
        type: 'event',
      });
    }
    if (suggestions.length >= 8) break;
  }

  return suggestions.slice(0, 8);
}
