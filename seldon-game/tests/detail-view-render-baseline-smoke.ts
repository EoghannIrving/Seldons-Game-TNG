import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArchiveQueryEngine } from '../src/core/archive-query';
import { Galaxy } from '../src/core/galaxy';
import { buildStarEncyclopediaEntry } from '../src/core/encyclopedia-entry';
import { GalaxyRenderer } from '../src/rendering/galaxy-renderer';
import { GalaxyConfig, GalaxyShape, Star } from '../src/core/types';

type DetailTab = 'abstract' | 'entry' | 'narrative' | 'events' | 'relations' | 'lineage';

interface DetailFixture {
  role: 'low_history' | 'high_history_capital' | 'sparse_lineage_subject';
  star: Star;
}

interface RenderBaselineRow {
  role: DetailFixture['role'];
  starId: string;
  starName: string;
  phase: number;
  tab: DetailTab;
  hash: string;
  commandCount: number;
  eventCount: number;
}

interface RenderBaselineFile {
  seed: number;
  phase: number;
  generatedAt: string;
  rows: RenderBaselineRow[];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
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

function fnv1a(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function withDeterministicMathRandom<T>(seed: number, fn: () => T): T {
  const originalRandom = Math.random;
  const originalPerfNow = globalThis.performance?.now?.bind(globalThis.performance);
  let state = seed >>> 0;
  let perfTicks = 0;
  Math.random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  if (globalThis.performance && typeof globalThis.performance.now === 'function') {
    globalThis.performance.now = () => {
      perfTicks++;
      // Deterministic monotonic time source for renderer animation state during baseline capture.
      return perfTicks * 16.6667;
    };
  }
  try {
    return fn();
  } finally {
    Math.random = originalRandom;
    if (globalThis.performance && originalPerfNow) {
      globalThis.performance.now = originalPerfNow;
    }
  }
}

function formatArg(arg: unknown): string {
  if (typeof arg === 'number') {
    return Number.isFinite(arg) ? arg.toFixed(2) : String(arg);
  }
  if (typeof arg === 'string') {
    return JSON.stringify(arg.length > 64 ? `${arg.slice(0, 61)}...` : arg);
  }
  if (arg === null || arg === undefined) {
    return String(arg);
  }
  if (typeof arg === 'boolean') {
    return arg ? 'true' : 'false';
  }
  if (Array.isArray(arg)) {
    return `[${arg.map(formatArg).join(',')}]`;
  }
  if (typeof arg === 'object') {
    return '{obj}';
  }
  return String(arg);
}

function createMockContext(width: number, height: number): { ctx: CanvasRenderingContext2D; commands: string[] } {
  const commands: string[] = [];
  const gradients: Array<{ addColorStop: (offset: number, color: string) => void }> = [];

  const target: Record<string, unknown> = {
    canvas: { width, height },
    fillStyle: '#000000',
    strokeStyle: '#000000',
    shadowColor: '#000000',
    font: '12px monospace',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    lineWidth: 1,
    globalAlpha: 1,
    lineDashOffset: 0,
    imageSmoothingEnabled: true,
    save: () => void commands.push('save()'),
    restore: () => void commands.push('restore()'),
    beginPath: () => void commands.push('beginPath()'),
    closePath: () => void commands.push('closePath()'),
    clip: () => void commands.push('clip()'),
    fill: () => void commands.push('fill()'),
    stroke: () => void commands.push('stroke()'),
    moveTo: (x: number, y: number) => void commands.push(`moveTo(${x.toFixed(2)},${y.toFixed(2)})`),
    lineTo: (x: number, y: number) => void commands.push(`lineTo(${x.toFixed(2)},${y.toFixed(2)})`),
    rect: (x: number, y: number, w: number, h: number) => void commands.push(`rect(${x.toFixed(2)},${y.toFixed(2)},${w.toFixed(2)},${h.toFixed(2)})`),
    arc: (x: number, y: number, r: number) => void commands.push(`arc(${x.toFixed(2)},${y.toFixed(2)},${r.toFixed(2)})`),
    ellipse: (x: number, y: number, rx: number, ry: number) =>
      void commands.push(`ellipse(${x.toFixed(2)},${y.toFixed(2)},${rx.toFixed(2)},${ry.toFixed(2)})`),
    fillRect: (x: number, y: number, w: number, h: number) =>
      void commands.push(`fillRect(${x.toFixed(2)},${y.toFixed(2)},${w.toFixed(2)},${h.toFixed(2)})`),
    strokeRect: (x: number, y: number, w: number, h: number) =>
      void commands.push(`strokeRect(${x.toFixed(2)},${y.toFixed(2)},${w.toFixed(2)},${h.toFixed(2)})`),
    clearRect: (x: number, y: number, w: number, h: number) =>
      void commands.push(`clearRect(${x.toFixed(2)},${y.toFixed(2)},${w.toFixed(2)},${h.toFixed(2)})`),
    fillText: (text: string, x: number, y: number) =>
      void commands.push(`fillText(${formatArg(text)},${x.toFixed(2)},${y.toFixed(2)})`),
    strokeText: (text: string, x: number, y: number) =>
      void commands.push(`strokeText(${formatArg(text)},${x.toFixed(2)},${y.toFixed(2)})`),
    setLineDash: (segments: number[]) =>
      void commands.push(`setLineDash(${segments.map((s) => s.toFixed(2)).join(',')})`),
    measureText: (text: string) => ({ width: text.length * 6.25 }),
    translate: (x: number, y: number) => void commands.push(`translate(${x.toFixed(2)},${y.toFixed(2)})`),
    rotate: (radians: number) => void commands.push(`rotate(${radians.toFixed(3)})`),
    scale: (x: number, y: number) => void commands.push(`scale(${x.toFixed(2)},${y.toFixed(2)})`),
    quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) =>
      void commands.push(`quadraticCurveTo(${cpx.toFixed(2)},${cpy.toFixed(2)},${x.toFixed(2)},${y.toFixed(2)})`),
    bezierCurveTo: (cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) =>
      void commands.push(
        `bezierCurveTo(${cp1x.toFixed(2)},${cp1y.toFixed(2)},${cp2x.toFixed(2)},${cp2y.toFixed(2)},${x.toFixed(2)},${y.toFixed(2)})`
      ),
    createLinearGradient: () => {
      commands.push('createLinearGradient()');
      const gradient = {
        addColorStop: (offset: number, color: string) => {
          commands.push(`gradient.addColorStop(${offset.toFixed(2)},${formatArg(color)})`);
        },
      };
      gradients.push(gradient);
      return gradient;
    },
    createRadialGradient: () => {
      commands.push('createRadialGradient()');
      const gradient = {
        addColorStop: (offset: number, color: string) => {
          commands.push(`gradient.addColorStop(${offset.toFixed(2)},${formatArg(color)})`);
        },
      };
      gradients.push(gradient);
      return gradient;
    },
  };

  const proxy = new Proxy(target, {
    get(obj, prop: string) {
      if (prop in obj) {
        return obj[prop];
      }
      return (...args: unknown[]) => {
        commands.push(`${prop}(${args.map(formatArg).join(',')})`);
      };
    },
    set(obj, prop: string, value) {
      obj[prop] = value;
      if (!prop.startsWith('_')) {
        commands.push(`set:${prop}=${formatArg(value)}`);
      }
      return true;
    },
  });

  return { ctx: proxy as unknown as CanvasRenderingContext2D, commands };
}

function createMockCanvas(width: number, height: number): { canvas: HTMLCanvasElement; commands: string[] } {
  const { ctx, commands } = createMockContext(width, height);
  const canvas = {
    width,
    height,
    getContext: (kind: string) => (kind === '2d' ? ctx : null),
    getBoundingClientRect: () => ({ width, height }),
  } as unknown as HTMLCanvasElement;
  return { canvas, commands };
}

function pickFixtureStars(galaxy: Galaxy): DetailFixture[] {
  const stars = galaxy.getAllStars();
  assert(stars.length > 0, 'Expected non-empty star list');

  const byHistoryAsc = [...stars].sort((a, b) => {
    const historyDelta = (a.history?.length ?? 0) - (b.history?.length ?? 0);
    if (historyDelta !== 0) return historyDelta;
    return a.id.localeCompare(b.id);
  });
  const byHistoryDesc = [...stars].sort((a, b) => {
    const historyDelta = (b.history?.length ?? 0) - (a.history?.length ?? 0);
    if (historyDelta !== 0) return historyDelta;
    return a.id.localeCompare(b.id);
  });

  const lowHistory = byHistoryAsc[0];
  assert(lowHistory, 'Expected low-history fixture star');

  const capitals = stars
    .filter((s) => s.ruler === s.id && (s.subjects?.length ?? 0) > 0)
    .sort((a, b) => {
      const historyDelta = (b.history?.length ?? 0) - (a.history?.length ?? 0);
      if (historyDelta !== 0) return historyDelta;
      return a.id.localeCompare(b.id);
    });
  const highHistoryCapital = capitals[0] ?? byHistoryDesc[0];
  assert(highHistoryCapital, 'Expected high-history-capital fixture star');

  const subjects = stars.filter((s) => s.ruler !== s.id);
  assert(subjects.length > 0, 'Expected at least one subject star');
  const sparseLineageSubject = subjects
    .map((star) => {
      const entry = buildStarEncyclopediaEntry(star, galaxy.state);
      const lineageSection = entry.sections.find((section) => section.kind === 'dynasty_family_tree');
      const lineageCount =
        ((lineageSection?.payload as { lineage?: unknown[] } | undefined)?.lineage?.length) ?? 0;
      return {
        star,
        lineageCount,
        dataState: lineageSection?.dataState ?? 'missing',
      };
    })
    .sort((a, b) => {
      const dataStateDelta = (a.dataState === 'complete' ? 1 : 0) - (b.dataState === 'complete' ? 1 : 0);
      if (dataStateDelta !== 0) return dataStateDelta;
      const lineageDelta = a.lineageCount - b.lineageCount;
      if (lineageDelta !== 0) return lineageDelta;
      return a.star.id.localeCompare(b.star.id);
    })[0]?.star;
  assert(sparseLineageSubject, 'Expected sparse-lineage-subject fixture star');

  return [
    { role: 'low_history', star: lowHistory },
    { role: 'high_history_capital', star: highHistoryCapital },
    { role: 'sparse_lineage_subject', star: sparseLineageSubject },
  ];
}

function computeRows(seed: number, phaseTarget: number): RenderBaselineRow[] {
  return withDeterministicMathRandom(seed, () => {
    const galaxy = new Galaxy(buildConfig(seed));
    for (let i = 0; i < phaseTarget; i++) {
      galaxy.advancePhase();
    }

    const fixtures = pickFixtureStars(galaxy);
    const tabs: DetailTab[] = ['abstract', 'entry', 'narrative', 'events', 'relations', 'lineage'];
    const rows: RenderBaselineRow[] = [];

    for (const fixture of fixtures) {
      for (const tab of tabs) {
        const { canvas, commands } = createMockCanvas(1280, 720);
        const renderer = new GalaxyRenderer(canvas);
        renderer.setOptions({
          detailV2Shell: true,
          detailAbstractInfobox: true,
          detailCounterfactualTeaser: true,
          detailSpineNav: true,
          detailDossierTape: true,
          detailQuestionTrails: true,
          detailDebateSplit: true,
          detailClaimEvidence: true,
          detailCrossrefGraph: true,
        });
        renderer.openStarDetail(fixture.star.id, tab);
        renderer.render(galaxy);

        const eventCount = ArchiveQueryEngine.queryEvents(galaxy.state, {
          starIds: [fixture.star.id],
          sort: 'phase_desc',
          limit: 200,
        }).items.length;

        const hash = fnv1a(commands.join('\n'));
        rows.push({
          role: fixture.role,
          starId: fixture.star.id,
          starName: fixture.star.name,
          phase: galaxy.state.phase,
          tab,
          hash,
          commandCount: commands.length,
          eventCount,
        });
      }
    }

    return rows.sort((a, b) => {
      const roleDelta = a.role.localeCompare(b.role);
      if (roleDelta !== 0) return roleDelta;
      const tabDelta = a.tab.localeCompare(b.tab);
      if (tabDelta !== 0) return tabDelta;
      return a.starId.localeCompare(b.starId);
    });
  });
}

function main(): void {
  const seed = 404;
  const phaseTarget = 120;
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const baselinePath = path.resolve(testDir, './baselines/detail-view-render-baseline.json');

  const rowsFirst = computeRows(seed, phaseTarget);
  const rowsSecond = computeRows(seed, phaseTarget);
  assert(
    JSON.stringify(rowsFirst) === JSON.stringify(rowsSecond),
    'Render baseline rows should be deterministic across repeated capture runs'
  );

  const updateMode = process.env.UPDATE_DETAIL_RENDER_BASELINE === '1';

  if (updateMode) {
    const payload: RenderBaselineFile = {
      seed,
      phase: phaseTarget,
      generatedAt: new Date().toISOString(),
      rows: rowsFirst,
    };
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    fs.writeFileSync(baselinePath, JSON.stringify(payload, null, 2));
    console.log(`[DETAIL-RENDER-BASELINE] wrote ${rowsFirst.length} rows to ${baselinePath}`);
  }

  assert(fs.existsSync(baselinePath), `Missing baseline file at ${baselinePath}. Run with UPDATE_DETAIL_RENDER_BASELINE=1 first.`);
  const baselineRaw = fs.readFileSync(baselinePath, 'utf8');
  const baseline = JSON.parse(baselineRaw) as RenderBaselineFile;

  assert(baseline.seed === seed, 'Baseline seed mismatch');
  assert(baseline.phase === phaseTarget, 'Baseline phase mismatch');
  assert(baseline.rows.length === rowsFirst.length, 'Baseline row count mismatch');

  for (let i = 0; i < rowsFirst.length; i++) {
    const expected = baseline.rows[i]!;
    const actual = rowsFirst[i]!;
    assert(
      expected.role === actual.role &&
        expected.tab === actual.tab &&
        expected.starId === actual.starId,
      `Baseline key mismatch at row ${i}`
    );
    assert(
      expected.hash === actual.hash,
      `Render baseline hash mismatch for role=${actual.role} tab=${actual.tab} star=${actual.starName}: expected=${expected.hash} actual=${actual.hash}`
    );
  }

  for (const row of rowsFirst) {
    console.log(
      `[DETAIL-RENDER-BASELINE] role=${row.role} tab=${row.tab} star=${row.starName} hash=${row.hash} commands=${row.commandCount}`
    );
  }

  console.log('[PASS] detail-view-render-baseline-smoke');
}

main();
