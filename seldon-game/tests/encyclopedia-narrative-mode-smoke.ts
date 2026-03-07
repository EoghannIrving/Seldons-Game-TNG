import { Galaxy } from '../src/core/galaxy';
import { GalaxyConfig, GalaxyShape } from '../src/core/types';
import {
  buildEncyclopediaNarrativeDocumentModel,
  resolveNarrativeDocumentStarId,
  selectNarrativePaneHtml,
} from '../src/ui/encyclopedia/encyclopedia-narrative-document-data';
import { buildEncyclopediaNarrativeDocumentHtml } from '../src/ui/encyclopedia/encyclopedia-narrative-pane';
import { buildEncyclopediaEventsPaneHtml } from '../src/ui/encyclopedia/encyclopedia-events-pane';
import { linkifyEncyclopediaText } from '../src/ui/encyclopedia/encyclopedia-text-search';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function buildConfig(seed: number): GalaxyConfig {
  return {
    seed,
    starCount: 200,
    interactionFactor: 10,
    shape: GalaxyShape.Random,
    width: 31,
    height: 21,
    tierDistribution: {
      major: 0.05,
      regional: 0.2,
    },
  };
}

function main(): void {
  const galaxy = new Galaxy(buildConfig(2048));
  for (let i = 0; i < 70; i++) {
    galaxy.advancePhase();
  }

  const stars = galaxy.getAllStars();
  assert(stars.length >= 2, 'Expected at least two stars for narrative mode smoke test');
  const selectedStar = stars[0]!;
  const chapterAnchorStar = stars[1]!;

  const directStarId = resolveNarrativeDocumentStarId({
    selectedStarId: selectedStar.id,
    selectedChapterAnchorStarId: chapterAnchorStar.id,
    pinChapterAnchor: false,
  });
  assert(directStarId === selectedStar.id, 'Document mode should prefer selected star when pin is disabled');

  const pinnedStarId = resolveNarrativeDocumentStarId({
    selectedStarId: selectedStar.id,
    selectedChapterAnchorStarId: chapterAnchorStar.id,
    pinChapterAnchor: true,
  });
  assert(pinnedStarId === chapterAnchorStar.id, 'Pinned anchor should override selected star for document mode');

  const modelA = buildEncyclopediaNarrativeDocumentModel({
    state: galaxy.state,
    selectedStarId: selectedStar.id,
    selectedChapterAnchorStarId: chapterAnchorStar.id,
    pinChapterAnchor: true,
    resolveStarById: (starId) => {
      const star = galaxy.getStar(starId);
      return star ? { id: star.id, name: star.name } : null;
    },
  });
  const modelB = buildEncyclopediaNarrativeDocumentModel({
    state: galaxy.state,
    selectedStarId: selectedStar.id,
    selectedChapterAnchorStarId: chapterAnchorStar.id,
    pinChapterAnchor: true,
    resolveStarById: (starId) => {
      const star = galaxy.getStar(starId);
      return star ? { id: star.id, name: star.name } : null;
    },
  });

  assert(modelA !== null, 'Expected a narrative document model to be generated');
  assert(JSON.stringify(modelA) === JSON.stringify(modelB), 'Narrative document model should be deterministic for fixed state');
  assert(modelA!.recentEntries.length >= 1, 'Recent Chronicle should include at least one entry');
  assert(modelA!.canonicalLines.length >= 1, 'Canonical Report should include at least one line');

  const starNameLinkData = stars.map((star) => ({ id: star.id, name: star.name }));
  const html = buildEncyclopediaNarrativeDocumentHtml({
    starName: modelA!.starName,
    recentEntries: modelA!.recentEntries,
    canonicalLines: modelA!.canonicalLines,
    longLines: modelA!.longLines,
    starNameLinkData,
    linkifyEncyclopediaText,
  });

  assert(html.includes('Recent Chronicle'), 'Document view should render Recent Chronicle section');
  assert(html.includes('Canonical Report'), 'Document view should render Canonical Report section');
  assert(html.includes('Long Archive'), 'Document view should render Long Archive section');

  const selectedDocumentPane = selectNarrativePaneHtml({
    narrativeViewMode: 'document',
    chapterPaneHtml: '<p>chapter</p>',
    documentPaneHtml: '<p>document</p>',
  });
  const selectedChapterPane = selectNarrativePaneHtml({
    narrativeViewMode: 'chapter',
    chapterPaneHtml: '<p>chapter</p>',
    documentPaneHtml: '<p>document</p>',
  });
  assert(selectedDocumentPane === '<p>document</p>', 'Document mode should choose document pane');
  assert(selectedChapterPane === '<p>chapter</p>', 'Chapter mode should choose chapter pane');

  verifyDrilldownMarkup(stars);

  console.log('[PASS] encyclopedia-narrative-mode-smoke');
}

main();

function verifyDrilldownMarkup(stars: Array<{ id: string; name: string }>): void {
  const sampleEvent = {
    phase: 42,
    type: 'conquest',
    description: `Phase 42: ${stars[0]!.name} pressured ${stars[1]!.name}`,
    starId: stars[0]!.id,
    starName: stars[0]!.name,
    relatedStars: [stars[1]!.id],
  };
  const html = buildEncyclopediaEventsPaneHtml({
    displayedEvents: [sampleEvent],
    timelineEvents: [sampleEvent],
    selectedPhase: 42,
    selectedStarId: stars[0]!.id,
    hasMoreEvents: false,
    eventsViewMode: 'timeline',
    starNameLinkData: stars.map((star) => ({ id: star.id, name: star.name })),
    currentPhase: 70,
    resolveChapterIdForPhase: () => 'chapter-0-49',
    forensicEnabled: true,
    linkifyEncyclopediaText,
    escapeHtml: (input) => input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;'),
  });

  assert(html.includes('data-show-phase-events="42"'), 'Events pane should expose all-phase-events drilldown');
  assert(html.includes('Narrative Arc ->'), 'Timeline detail should expose narrative arc cross-navigation action');
  assert(html.includes('All This Phase ->'), 'Timeline detail should expose all-this-phase action');
}

