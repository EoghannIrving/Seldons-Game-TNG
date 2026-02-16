# Seldon's Game - Technical Architecture & Development Plan

This document outlines the technical approach, architecture decisions, and development roadmap for enhancing Seldon's Game from its current 26-star prototype to a robust 100-1000 star psychohistory simulation.

---

## Project Vision

**Core Concept:** A browser-based, turn-based psychohistory simulation inspired by Isaac Asimov's Foundation and Mike Singleton's emergent gameplay design philosophy.

**Key Requirements:**
- 100-1000 stars (vs. current 26)
- Turn-based, phase-driven gameplay (no real-time requirements)
- Browser-accessible (major feature, not a compromise)
- Single-player (opponent is "history itself")
- Optional 3D visualization (plan for future)
- Deep emergent narratives from simple mathematical rules

**Non-Requirements:**
- Real-time multiplayer ❌
- AI opponents ❌
- 60 FPS gameplay ❌ (turn-based!)
- Native desktop app ❌ (browser is the target)

---

## Architecture Decisions

### Technology Stack: TypeScript + Vite

**Chosen Stack:**
- **TypeScript** - Type-safe JavaScript with modern tooling
- **Vite** - Fast development server and build tool
- **Canvas API** - 2D rendering (current approach)
- **Three.js** - 3D rendering (future addition)
- **Web Audio API** - Sound effects and star songs (future)

### Why JavaScript/TypeScript?

**Strengths for This Project:**
✅ **Browser accessibility** - Zero installation, works everywhere
✅ **Computational demands are LOW** - Turn-based = calculations only on player input
✅ **Rich ecosystem** - Canvas, WebGL, audio, extensive libraries
✅ **Easy sharing** - Send a URL, anyone can play
✅ **Cross-platform** - Desktop, mobile, tablet support
✅ **Fast iteration** - Instant hot reload during development
✅ **Educational distribution** - No IT department barriers

**Performance Reality:**
- **1000 stars** × **1000 comparisons** = 1 million operations per phase
- Modern JavaScript: 100+ million operations/second
- **Result:** ~100ms per phase = feels instant in turn-based game
- Optimization nice-to-have, not requirement

**The Original Game Context:**
Mike Singleton built this on a ZX Spectrum (48KB RAM, ~3.5 MHz CPU). We have literally **1 million times more computing power** in a browser. JavaScript is total overkill for this problem space.

### Why TypeScript Over Vanilla JavaScript?

**Type Safety for Complex Systems:**
```typescript
// With 1000 stars and deep enhancement systems, bugs are inevitable
// TypeScript catches them at compile time:

interface Star {
  name: string;
  strength: number;
  growth: number;
  centralization: number;
  ruler: string | null;
  traits: StarTrait[];
  history: PhaseRecord[];
}

// Catches typos
star.strangth = 100; // ERROR: Property 'strangth' does not exist

// Catches type errors
star.strength = "high"; // ERROR: Type 'string' not assignable to 'number'

// Enables autocomplete
star. // IDE shows all valid properties
```

**Benefits:**
- Self-documenting code
- Fewer runtime bugs
- Better IDE support (autocomplete, refactoring)
- Easier collaboration
- Scales better as codebase grows

**Migration Path:**
- Start with TypeScript from the beginning
- Compiles to JavaScript (still runs in browser)
- No runtime overhead
- Can gradually add type annotations

### Why Vite?

**Modern Development Experience:**
- ⚡ Instant server startup
- 🔥 Hot Module Replacement (changes appear immediately)
- 📦 Automatic code splitting
- 🎯 Simple configuration (works out of the box)
- 🏗️ Production builds are optimized automatically

**Alternative Considered:** Webpack (too complex for our needs)

---

## Turn-Based Performance Model

### Key Insight: We Don't Need 60 FPS

**Traditional Game Loop (NOT NEEDED):**
```javascript
// Real-time games do this:
function gameLoop() {
  updatePhysics();      // 60 times per second
  handleInput();        // 60 times per second
  render();            // 60 times per second
  requestAnimationFrame(gameLoop);
}
```

**Our Turn-Based Model:**
```typescript
// Calculate only when player acts:
class Galaxy {
  advancePhase() {
    // Player pressed Space
    this.calculateInfluences();  // Run once
    this.updateRulers();         // Run once
    this.updateGrowth();         // Run once
    this.render();               // Redraw once
  }
}

// No continuous loop needed!
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    galaxy.advancePhase(); // Only when player acts
  }
});
```

### Performance Targets

| Metric | Target | Reasoning |
|--------|--------|-----------|
| Phase calculation (100 stars) | < 10ms | Imperceptible to user |
| Phase calculation (1000 stars) | < 100ms | Feels instant in turn-based |
| Initial galaxy generation | < 2 seconds | One-time cost, loading screen acceptable |
| Rendering (static) | < 16ms | 60 FPS if we add optional animations later |
| History scrubbing | < 50ms | Responsive timeline navigation |

### When Animation Matters (Optional)

**Static rendering is perfectly valid:**
- Mike Singleton's original had no animations
- Foundation is about history and narrative, not visual spectacle
- Turn-based games don't require smooth motion

**Optional polish we might add later:**
- Power flow particle effects
- Empire expansion/collapse transitions
- Camera zoom/pan smoothness
- Star selection pulse effects
- Background galaxy rotation

**Implementation approach if we add animations:**
```typescript
// Game state: updates on demand
class Galaxy {
  advancePhase() {
    this.doCalculations(); // Turn-based
  }
}

// Visual polish: runs continuously but lightweight
class AnimationLayer {
  animate() {
    this.updateParticles();  // Just eye candy
    this.render();
    requestAnimationFrame(() => this.animate());
  }
}

// Separate concerns:
// - Logic runs on player input (turn-based)
// - Visuals run continuously (optional polish)
```

**Decision: Start with static rendering, add animations only if desired.**

---

## Project Structure

### Directory Layout

```
seldons-game-next/
├── src/
│   ├── core/
│   │   ├── types.ts              # All TypeScript interfaces
│   │   ├── constants.ts          # Game constants
│   │   ├── galaxy.ts             # Main Galaxy class
│   │   ├── star.ts               # Star class
│   │   ├── psychohistory.ts      # Core calculation formulas
│   │   └── history-tracker.ts    # Phase history storage
│   │
│   ├── engine/
│   │   ├── influence-calculator.ts    # Power/distance calculations
│   │   ├── growth-engine.ts           # Growth rate updates
│   │   ├── centralization-engine.ts   # Centralization dynamics
│   │   ├── ruler-resolver.ts          # Determine who rules whom
│   │   └── event-system.ts            # Crisis events, etc.
│   │
│   ├── rendering/
│   │   ├── galaxy-renderer.ts         # 2D Canvas rendering
│   │   ├── galaxy-renderer-3d.ts      # Three.js (future)
│   │   ├── particle-effects.ts        # Visual polish (optional)
│   │   └── ui-overlay.ts              # HUD, info panels
│   │
│   ├── procedural/
│   │   ├── galaxy-generator.ts        # Initial star placement
│   │   ├── name-generator.ts          # Star/dynasty names
│   │   ├── trait-generator.ts         # Personality traits
│   │   ├── history-narrator.ts        # Procedural text generation
│   │   └── encyclopedia.ts            # Encyclopedia Galactica entries
│   │
│   ├── ui/
│   │   ├── controls.ts                # Keyboard/mouse input
│   │   ├── detail-panel.ts            # Star information display
│   │   ├── timeline.ts                # Phase history scrubber
│   │   ├── settings-menu.ts           # Game configuration
│   │   └── help-overlay.ts            # Tutorial/help text
│   │
│   ├── utils/
│   │   ├── spatial-index.ts           # Fast neighbor queries (optional optimization)
│   │   ├── storage.ts                 # Save/load to localStorage
│   │   ├── seed-random.ts             # Deterministic RNG
│   │   ├── math-utils.ts              # Vector math, etc.
│   │   └── export.ts                  # CSV/JSON export
│   │
│   ├── audio/
│   │   ├── sound-manager.ts           # Web Audio API wrapper
│   │   └── star-songs.ts              # Generative music (future)
│   │
│   ├── styles/
│   │   ├── main.css                   # Global styles
│   │   └── ui.css                     # UI component styles
│   │
│   └── main.ts                        # Application entry point
│
├── public/
│   ├── assets/
│   │   ├── textures/                  # Star sprites, backgrounds
│   │   ├── audio/                     # Sound effects
│   │   └── fonts/                     # Custom fonts
│   └── favicon.ico
│
├── docs/
│   ├── Gameplay Ideas.md
│   ├── Enhancement Ideas - Core Mechanics.md
│   ├── Planet Personality & Character Ideas.md
│   └── Technical Architecture & Development Plan.md (this file)
│
├── tests/
│   ├── psychohistory.test.ts          # Core math tests
│   ├── galaxy.test.ts                 # Simulation tests
│   └── procedural.test.ts             # Generation tests
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .gitignore
└── README.md
```

### Module Responsibilities

**Core (`/core`):**
- Type definitions (interfaces, enums)
- Galaxy state management
- Core psychohistory formulas
- No rendering, no UI - pure logic

**Engine (`/engine`):**
- Subsystems that calculate specific aspects
- Influence, growth, centralization, events
- Stateless pure functions where possible
- Testable in isolation

**Rendering (`/rendering`):**
- All visual output
- 2D Canvas initially
- 3D Three.js later (separate module)
- Receives galaxy state, produces visuals

**Procedural (`/procedural`):**
- Content generation
- Names, traits, histories, narratives
- Deterministic from seed
- Stateless generators

**UI (`/ui`):**
- User interaction
- Input handling
- Panels and overlays
- Settings and controls

**Utils (`/utils`):**
- Cross-cutting concerns
- Math helpers, storage, export
- No game-specific logic
- Reusable utilities

---

## Core Type System

### Primary Interfaces

```typescript
// types.ts

import { Vector3 } from 'three'; // Use Vector3 from start (z=0 for 2D)

export enum Epoch {
  Imperial = 0,    // Centralizing
  Communal = 1,    // Decentralizing
}

export enum StarType {
  BlueGiant = 'blue-giant',      // O, B class
  YellowDwarf = 'yellow-dwarf',   // G class (Sun-like)
  RedDwarf = 'red-dwarf',         // M class
  RedGiant = 'red-giant',         // K class evolved
  WhiteDwarf = 'white-dwarf',     // Stellar remnant
  Binary = 'binary',              // Two-star system
}

export interface StarTrait {
  id: string;
  name: string;
  description: string;
  effects: {
    growthModifier?: number;       // ±0.1 to growth rate
    centralizationBias?: number;   // Preference for high/low centralization
    powerProjection?: number;       // Influence distance modifier
    rebellionResistance?: number;   // How well it resists conquest
  };
}

export interface HistoricalEvent {
  phase: number;
  type: 'conquest' | 'liberation' | 'crisis' | 'golden-age' | 'collapse' | 'revolution';
  description: string;
  involvedStars: string[];
}

export interface Dynasty {
  name: string;
  foundedPhase: number;
  endedPhase?: number;
  founder: string;
  rulers: Ruler[];
}

export interface Ruler {
  name: string;
  startPhase: number;
  endPhase?: number;
  achievements: string[];
}

export interface Star {
  // Identity
  id: string;                      // Unique identifier
  name: string;                    // Display name (Betelgeuse, Rigel, etc.)
  type: StarType;                  // Stellar classification
  symbol: string;                  // Heraldic symbol (SVG path or icon ID)

  // Position
  position: Vector3;               // 3D coordinates (z=0 for 2D mode)

  // Core Stats (from original game)
  strength: number;                // Base power
  growth: number;                  // Growth rate per phase
  centralization: number;          // 0.0 (local) to 1.0 (central)
  power: number;                   // Calculated effective influence
  epoch: Epoch;                    // Imperial or Communal

  // Relationships
  ruler: string | null;            // ID of ruling star (null if independent)
  subjects: string[];              // IDs of subject stars

  // Personality
  traits: StarTrait[];             // 2-3 personality traits

  // History
  history: HistoricalEvent[];      // Timeline of major events
  currentDynasty?: Dynasty;        // Current ruling dynasty
  pastDynasties: Dynasty[];        // Historical dynasties

  // Technology (future)
  technologies?: Technology[];     // Unlocked tech

  // Visual (future)
  color?: string;                  // Custom empire color
}

export interface GalaxyConfig {
  seed: number;                    // RNG seed for deterministic generation
  starCount: number;               // 26, 100, 1000, etc.
  interactionFactor: number;       // Q parameter (how much distance matters)
  galaxyShape: 'random' | 'spiral' | 'elliptical' | 'cluster';
  initialEpochDistribution: 'random' | 'mixed' | 'all-imperial' | 'all-communal';
}

export interface GalaxyState {
  config: GalaxyConfig;
  stars: Map<string, Star>;        // Keyed by star ID
  phase: number;

  // Cached calculations (for performance)
  distanceMatrix?: Map<string, Map<string, number>>;  // Pre-calculated distances

  // History
  phaseHistory: PhaseSnapshot[];   // Store every Nth phase for scrubbing

  // Metadata
  createdAt: Date;
  lastModified: Date;
}

export interface PhaseSnapshot {
  phase: number;
  timestamp: Date;
  stars: Map<string, StarSnapshot>;  // Minimal snapshot for history
  majorEvents: HistoricalEvent[];
}

export interface StarSnapshot {
  id: string;
  strength: number;
  power: number;
  centralization: number;
  ruler: string | null;
  subjectCount: number;
}

export interface Camera {
  position: Vector3;
  zoom: number;
  rotation: number;  // For 3D view
}

export interface RenderOptions {
  showRulerArrows: boolean;
  showPowerGlow: boolean;
  showLabels: boolean;
  showGrid: boolean;
  theme: 'dark' | 'light' | 'foundation' | 'retro';
  viewMode: '2d' | '3d';
}
```

---

## Core Algorithms

### Psychohistory Calculations

**Power Calculation:**
```typescript
// psychohistory.ts

export function calculatePower(star: Star, galaxy: GalaxyState): number {
  const { strength, centralization } = star;
  const subjectPower = star.subjects.reduce((total, subjectId) => {
    const subject = galaxy.stars.get(subjectId);
    if (!subject) return total;
    return total + subject.strength * (1 - subject.centralization);
  }, 0);

  return strength * centralization + subjectPower;
}
```

**Influence Calculation:**
```typescript
export function calculateInfluence(
  fromStar: Star,
  toStar: Star,
  config: GalaxyConfig,
  distanceMatrix: Map<string, Map<string, number>>
): number {
  const power = fromStar.power;
  const distance = distanceMatrix.get(fromStar.id)?.get(toStar.id) || 0;
  const Q = config.interactionFactor;

  // Original formula: influence = power / (distance^2 + Q)
  return power / (distance * distance + Q);
}
```

**Determine Ruler:**
```typescript
export function determineRuler(
  star: Star,
  galaxy: GalaxyState,
  distanceMatrix: Map<string, Map<string, number>>
): string | null {
  let maxInfluence = 0;
  let newRuler: string | null = null;

  for (const [otherId, otherStar] of galaxy.stars) {
    if (otherId === star.id) continue;

    const influence = calculateInfluence(
      otherStar,
      star,
      galaxy.config,
      distanceMatrix
    );

    if (influence > maxInfluence) {
      maxInfluence = influence;
      newRuler = otherId;
    }
  }

  // Only ruled if influence exceeds star's own power
  return maxInfluence > star.power ? newRuler : null;
}
```

**Growth Update:**
```typescript
export function calculateGrowth(star: Star, epoch: Epoch): number {
  const baseGrowth = epoch === Epoch.Imperial ? 1.15 : 1.10;

  // Apply trait modifiers
  const traitModifier = star.traits.reduce((mod, trait) => {
    return mod + (trait.effects.growthModifier || 0);
  }, 0);

  return baseGrowth + traitModifier;
}

export function applyGrowth(star: Star): void {
  star.strength *= star.growth;
}
```

**Centralization Update:**
```typescript
export function updateCentralization(star: Star): void {
  const target = star.epoch === Epoch.Imperial ? 0.9 : 0.1;
  const changeRate = 0.1; // 10% move toward target per phase

  star.centralization += (target - star.centralization) * changeRate;

  // Apply trait bias
  const traitBias = star.traits.reduce((bias, trait) => {
    return bias + (trait.effects.centralizationBias || 0);
  }, 0);

  star.centralization = Math.max(0, Math.min(1, star.centralization + traitBias));
}
```

### Phase Advancement

```typescript
// galaxy.ts

export class Galaxy {
  state: GalaxyState;
  private distanceMatrix: Map<string, Map<string, number>>;

  constructor(config: GalaxyConfig) {
    this.state = this.generateGalaxy(config);
    this.distanceMatrix = this.calculateDistances();
  }

  advancePhase(): void {
    // 1. Calculate all star powers
    for (const [id, star] of this.state.stars) {
      star.power = calculatePower(star, this.state);
    }

    // 2. Update rulers based on influence
    for (const [id, star] of this.state.stars) {
      const oldRuler = star.ruler;
      const newRuler = determineRuler(star, this.state, this.distanceMatrix);

      if (oldRuler !== newRuler) {
        this.handleRulerChange(star, oldRuler, newRuler);
      }

      star.ruler = newRuler;
    }

    // 3. Update subject lists
    this.updateSubjectLists();

    // 4. Apply growth
    for (const [id, star] of this.state.stars) {
      star.growth = calculateGrowth(star, star.epoch);
      applyGrowth(star);
    }

    // 5. Update centralization
    for (const [id, star] of this.state.stars) {
      updateCentralization(star);
    }

    // 6. Process events (crises, etc.)
    this.processEvents();

    // 7. Record history
    this.state.phase++;
    this.recordPhaseSnapshot();
  }

  private handleRulerChange(
    star: Star,
    oldRuler: string | null,
    newRuler: string | null
  ): void {
    // Create historical event
    const event: HistoricalEvent = {
      phase: this.state.phase,
      type: newRuler === null ? 'liberation' : 'conquest',
      description: newRuler === null
        ? `${star.name} achieved independence`
        : `${star.name} conquered by ${this.state.stars.get(newRuler)?.name}`,
      involvedStars: [star.id, ...(newRuler ? [newRuler] : [])],
    };

    star.history.push(event);

    // Update dynasty if becoming independent
    if (newRuler === null) {
      this.startNewDynasty(star);
    }
  }

  private calculateDistances(): Map<string, Map<string, number>> {
    const matrix = new Map<string, Map<string, number>>();

    for (const [id1, star1] of this.state.stars) {
      const row = new Map<string, number>();

      for (const [id2, star2] of this.state.stars) {
        if (id1 === id2) {
          row.set(id2, 0);
        } else {
          const dx = star1.position.x - star2.position.x;
          const dy = star1.position.y - star2.position.y;
          const dz = star1.position.z - star2.position.z;
          row.set(id2, Math.sqrt(dx * dx + dy * dy + dz * dz));
        }
      }

      matrix.set(id1, row);
    }

    return matrix;
  }
}
```

---

## Performance Optimizations (Optional)

### When Optimization Becomes Necessary

**Triggers:**
- Star count > 1000
- Phase calculation > 200ms
- User experience feels sluggish

**Optimization Strategies (in order of implementation):**

### 1. Spatial Index (Most Effective)

**Problem:** O(n²) influence calculations
- 1000 stars = 1,000,000 comparisons per phase

**Solution:** Only check nearby stars

```typescript
// spatial-index.ts

export class SpatialIndex {
  private gridSize: number;
  private grid: Map<string, Star[]>;

  constructor(gridSize = 100) {
    this.gridSize = gridSize;
    this.grid = new Map();
  }

  rebuild(stars: Map<string, Star>): void {
    this.grid.clear();

    for (const [id, star] of stars) {
      const cellKey = this.getCellKey(star.position);

      if (!this.grid.has(cellKey)) {
        this.grid.set(cellKey, []);
      }

      this.grid.get(cellKey)!.push(star);
    }
  }

  queryRadius(position: Vector3, radius: number): Star[] {
    const results: Star[] = [];
    const cellRadius = Math.ceil(radius / this.gridSize);
    const centerX = Math.floor(position.x / this.gridSize);
    const centerY = Math.floor(position.y / this.gridSize);
    const centerZ = Math.floor(position.z / this.gridSize);

    // Check neighboring cells
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        for (let dz = -cellRadius; dz <= cellRadius; dz++) {
          const cellKey = `${centerX + dx},${centerY + dy},${centerZ + dz}`;
          const cell = this.grid.get(cellKey);

          if (cell) {
            results.push(...cell);
          }
        }
      }
    }

    // Filter by actual distance
    return results.filter(star => {
      const dist = position.distanceTo(star.position);
      return dist <= radius;
    });
  }

  private getCellKey(position: Vector3): string {
    const x = Math.floor(position.x / this.gridSize);
    const y = Math.floor(position.y / this.gridSize);
    const z = Math.floor(position.z / this.gridSize);
    return `${x},${y},${z}`;
  }
}

// Usage in Galaxy class:
class Galaxy {
  private spatialIndex: SpatialIndex;

  advancePhase(): void {
    // Only check stars within influence range
    const maxInfluenceRange = 500; // Configurable

    for (const [id, star] of this.state.stars) {
      const nearby = this.spatialIndex.queryRadius(
        star.position,
        maxInfluenceRange
      );

      // Now only checking ~50 stars instead of 1000
      for (const other of nearby) {
        calculateInfluence(star, other, ...);
      }
    }
  }
}
```

**Performance Gain:** O(n²) → O(n × k) where k = average neighbors (~50)
- 1,000,000 comparisons → 50,000 comparisons
- **20x speedup**

### 2. Distance Matrix Caching

**Already implemented** in core design - distances never change, calculate once.

### 3. Influence Cutoff

```typescript
// Don't bother calculating influence if distance is huge
const MAX_INFLUENCE_DISTANCE = 1000;

function calculateInfluence(...): number {
  if (distance > MAX_INFLUENCE_DISTANCE) {
    return 0; // Too far to matter
  }

  return power / (distance * distance + Q);
}
```

### 4. Web Workers (If Still Needed)

```typescript
// psychohistory-worker.ts
self.onmessage = (e) => {
  const { galaxyState, phase } = e.data;

  // Do heavy calculations in background thread
  const newState = advancePhase(galaxyState);

  self.postMessage({ newState, phase: phase + 1 });
};

// main.ts
const worker = new Worker('psychohistory-worker.ts');

function advancePhaseAsync() {
  worker.postMessage({ galaxyState: galaxy.state, phase: galaxy.state.phase });
}

worker.onmessage = (e) => {
  galaxy.state = e.data.newState;
  renderer.render(galaxy);
};
```

**Trade-off:** Adds complexity, only worth it if calculations > 500ms

### 5. Incremental Rendering (For 3D)

```typescript
// Only render visible stars
class GalaxyRenderer3D {
  render(galaxy: Galaxy, camera: Camera) {
    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      )
    );

    for (const [id, star] of galaxy.state.stars) {
      // Frustum culling - don't render off-screen stars
      if (!frustum.containsPoint(star.position)) {
        continue;
      }

      // Level of detail - simplify distant stars
      const distance = camera.position.distanceTo(star.position);

      if (distance > 1000) {
        this.renderAsPoint(star);      // Simple dot
      } else if (distance > 500) {
        this.renderSimple(star);       // Basic sphere
      } else {
        this.renderDetailed(star);     // Full model with glow
      }
    }
  }
}
```

---

## Save/Load System

### LocalStorage for Browser Persistence

```typescript
// storage.ts

export interface SaveData {
  version: string;
  galaxyState: GalaxyState;
  camera: Camera;
  settings: RenderOptions;
  savedAt: Date;
}

export class StorageManager {
  private readonly STORAGE_KEY = 'seldons-game-save';
  private readonly VERSION = '1.0.0';

  save(galaxy: Galaxy, camera: Camera, settings: RenderOptions): boolean {
    try {
      const saveData: SaveData = {
        version: this.VERSION,
        galaxyState: this.serializeGalaxyState(galaxy.state),
        camera,
        settings,
        savedAt: new Date(),
      };

      const json = JSON.stringify(saveData);
      localStorage.setItem(this.STORAGE_KEY, json);
      return true;
    } catch (error) {
      console.error('Failed to save:', error);
      return false;
    }
  }

  load(): SaveData | null {
    try {
      const json = localStorage.getItem(this.STORAGE_KEY);
      if (!json) return null;

      const saveData = JSON.parse(json);

      // Version compatibility check
      if (saveData.version !== this.VERSION) {
        console.warn('Save data version mismatch');
        // Could implement migration here
      }

      return saveData;
    } catch (error) {
      console.error('Failed to load:', error);
      return null;
    }
  }

  private serializeGalaxyState(state: GalaxyState): any {
    // Convert Map to array for JSON serialization
    return {
      ...state,
      stars: Array.from(state.stars.entries()),
    };
  }

  private deserializeGalaxyState(data: any): GalaxyState {
    return {
      ...data,
      stars: new Map(data.stars),
    };
  }
}
```

### Auto-Save

```typescript
class Game {
  private storageManager = new StorageManager();
  private autoSaveInterval = 60000; // 1 minute

  startAutoSave() {
    setInterval(() => {
      this.storageManager.save(this.galaxy, this.camera, this.settings);
      console.log('Auto-saved');
    }, this.autoSaveInterval);
  }
}
```

---

## Development Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal:** Port existing game to TypeScript + Vite with enhanced architecture

**Tasks:**
1. ✅ Set up Vite + TypeScript project
2. ✅ Define core type system (`types.ts`)
3. ✅ Port existing psychohistory calculations
4. ✅ Port existing Canvas rendering
5. ✅ Implement Galaxy class with phase advancement
6. ✅ Test with 26 stars (current scope)
7. ✅ Add save/load functionality

**Deliverable:** Current game functionality in new architecture

### Phase 2: Scale to 100 Stars (Week 3)

**Goal:** Validate that architecture handles more stars

**Tasks:**
1. ✅ Implement procedural galaxy generation for 100 stars
2. ✅ Add zoom/pan controls for larger map
3. ✅ Optimize rendering (only draw visible stars)
4. ✅ Add performance monitoring (FPS counter, phase timing)
5. ✅ Test phase calculations (should be < 50ms)

**Deliverable:** 100-star galaxy running smoothly

### Phase 3: Planet Personalities (Week 4-5)

**Goal:** Make each star memorable (see Planet Personality doc)

**Tasks:**
1. ✅ Implement star types (visual classification)
2. ✅ Add trait system (2-3 traits per star)
3. ✅ Procedural name generation (real star names)
4. ✅ Historical event tracking
5. ✅ Dynasty system
6. ✅ Improved detail panel showing personality
7. ✅ Encyclopedia Galactica entry generation

**Deliverable:** Stars feel like unique worlds with stories

### Phase 4: Core Enhancements (Week 6-8)

**Goal:** Implement highest-priority enhancements from brainstorming docs

**From "Enhancement Ideas - Core Mechanics.md":**
1. ✅ Growth visualization (sparklines, trends)
2. ✅ Centralization improvements (power flow animation)
3. ✅ Succession & collapse mechanics
4. ✅ Historical phase memory (timeline scrubber)
5. ✅ Multiple galaxy themes (visual variety)
6. ✅ Better playback controls (auto-advance, speed control)

**Deliverable:** Deeper, more polished simulation

### Phase 5: Scale to 1000 Stars (Week 9-10)

**Goal:** Handle maximum planned star count

**Tasks:**
1. ✅ Implement spatial indexing (if needed)
2. ✅ Optimize phase calculations
3. ✅ Test rendering performance
4. ✅ Add level-of-detail rendering
5. ✅ Stress test with 1000 stars × 1000 phases

**Success Criteria:**
- Phase calculation < 100ms
- Rendering > 30 FPS
- No memory leaks over long sessions

**Deliverable:** 1000-star galaxy confirmed working

### Phase 6: Advanced Features (Week 11-14)

**From "Gameplay Ideas.md":**
1. ⏳ Seldon Crises (random events)
2. ⏳ Foundation mechanics (special strategic stars)
3. ⏳ Predicted vs. Actual futures (psychohistory forecasting)
4. ⏳ Religion/ideology spread
5. ⏳ Historical eras & tech progression

**Deliverable:** Strategic depth matching Foundation themes

### Phase 7: 3D View (Week 15-16) [Optional]

**Goal:** Add optional 3D galaxy visualization

**Tasks:**
1. ⏳ Integrate Three.js
2. ⏳ Create 3D renderer (separate from 2D)
3. ⏳ Generate spiral galaxy layout
4. ⏳ Camera controls (orbit, zoom)
5. ⏳ Toggle 2D/3D views
6. ⏳ Particle effects in 3D space

**Deliverable:** Beautiful 3D galaxy view option

### Phase 8: Polish & Release (Week 17-18)

**Tasks:**
1. ⏳ Tutorial/help system
2. ⏳ Audio effects (optional)
3. ⏳ Multiple save slots
4. ⏳ Export capabilities (CSV, GIF animation)
5. ⏳ Performance optimization pass
6. ⏳ Bug fixing
7. ⏳ Documentation
8. ⏳ Deploy to GitHub Pages

**Deliverable:** Public release

---

## Testing Strategy

### Unit Tests

```typescript
// psychohistory.test.ts
import { describe, it, expect } from 'vitest';
import { calculatePower, calculateInfluence } from './psychohistory';

describe('Psychohistory Calculations', () => {
  it('should calculate power correctly for independent star', () => {
    const star: Star = {
      strength: 100,
      centralization: 0.5,
      subjects: [],
      // ...
    };

    const power = calculatePower(star, mockGalaxy);
    expect(power).toBe(50); // 100 * 0.5
  });

  it('should include subject power in calculation', () => {
    // Test with subjects...
  });

  it('should calculate influence with distance falloff', () => {
    // Test influence formula...
  });
});
```

### Integration Tests

```typescript
// galaxy.test.ts
describe('Galaxy Simulation', () => {
  it('should advance phase deterministically', () => {
    const galaxy1 = new Galaxy({ seed: 42, starCount: 26 });
    const galaxy2 = new Galaxy({ seed: 42, starCount: 26 });

    galaxy1.advancePhase();
    galaxy2.advancePhase();

    // Same seed should produce identical results
    expect(galaxy1.state).toEqual(galaxy2.state);
  });

  it('should handle empire collapse correctly', () => {
    // Set up scenario where empire should collapse
    // Verify subjects become independent
  });
});
```

### Performance Tests

```typescript
describe('Performance', () => {
  it('should calculate 1000-star phase in < 200ms', () => {
    const galaxy = new Galaxy({ seed: 42, starCount: 1000 });

    const start = performance.now();
    galaxy.advancePhase();
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(200);
  });
});
```

---

## Deployment

### Build for Production

```bash
# Build optimized production bundle
npm run build

# Output in /dist:
# - index.html
# - assets/main.[hash].js (minified, tree-shaken)
# - assets/main.[hash].css
```

### GitHub Pages Deployment

```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "deploy": "npm run build && gh-pages -d dist"
  },
  "devDependencies": {
    "gh-pages": "^6.0.0"
  }
}
```

```bash
# Deploy to GitHub Pages
npm run deploy

# Live at: https://yourusername.github.io/seldons-game-next
```

### Alternative Hosting

**Options:**
- **Netlify** - Drag & drop /dist folder, auto HTTPS
- **Vercel** - Connect GitHub repo, auto deploys
- **itch.io** - Upload as HTML5 game
- **GitHub Pages** - Free, simple, version controlled

**All free, all support single-page apps.**

---

## Design Principles

### 1. Respect the Elegant Core

**Mike Singleton's original:**
- Simple rules → complex emergence
- Minimal input → rich output
- Pure psychohistory mathematics

**Our approach:**
- Enhancements should **amplify** emergence, not obscure it
- Player should always understand why things happen
- Math should be transparent, not hidden

### 2. Turn-Based Philosophy

**Key insight:** We don't compete on graphics or speed

**We compete on:**
- Historical depth
- Emergent narratives
- Strategic complexity
- Educational value (understanding psychohistory)

**Therefore:**
- Static rendering is valid
- Animations are optional polish
- Performance targets are lenient
- Complexity budget goes to simulation, not visuals

### 3. Browser Accessibility is a Feature

**Not a compromise:**
- Zero installation barrier
- Works on any device
- Easy to share
- Educational contexts
- Portfolio piece

**Maintain this advantage:**
- No native-only features
- Progressive enhancement
- Mobile-friendly UI (future consideration)

### 4. Determinism & Replayability

**Foundation's theme:** History is deterministic (statistically)

**Our implementation:**
- Same seed = same galaxy = same history
- Players can share interesting seeds
- Replaying with same seed teaches patterns
- Psychohistory becomes learnable

**Technical requirement:**
- All randomness from seeded RNG
- No time-based randomness
- Save files must be portable

### 5. Emergent Storytelling

**Goal:** Every playthrough creates unique narratives

**How:**
- Procedural history generation
- Meaningful events tracked
- Encyclopedia Galactica summaries
- Player can name favorites

**When successful:**
- Players tell stories about "their" galaxy
- "DENEB survived 12 rulers!"
- "The Fall of Trantor in Phase 47 was tragic"
- Emotional connection to statistical entities

---

## Open Questions & Future Considerations

### Multiplayer (Not Planned, But...)

**Async multiplayer could work:**
- Players share same galaxy seed
- Each runs simulation independently
- Compare who achieved better outcome by Phase 100
- "High score" = stability, unity, predicted futures
- No networking required - just seed exchange

**True multiplayer would require:**
- Backend server
- WebSocket connections
- Synchronization logic
- Significant complexity increase

**Decision: Not worth it for v1.0**

### Mobile Support

**Current approach works on mobile:**
- Touch events instead of mouse
- Smaller screen considerations
- Performance usually fine

**Future mobile-specific enhancements:**
- Touch gestures (pinch to zoom)
- Simplified UI for small screens
- Portrait mode layout
- Haptic feedback

**Decision: Desktop-first, mobile-compatible**

### Modding / Custom Content

**Potential features:**
- User-created scenarios
- Custom trait definitions
- Modified psychohistory formulas
- Shared community content

**Implementation path:**
- JSON-based scenario files
- Import/export custom rulesets
- Workshop-style sharing

**Decision: Consider for v2.0**

### AI-Generated Content

**Encyclopedia Galactica could use LLMs:**
- Generate richer historical narratives
- Create character backstories
- Write Foundation-style prose

**Trade-offs:**
- Requires API calls (cost, latency)
- Or client-side model (large download)
- Determinism harder to guarantee

**Decision: Procedural generation first, AI enhancement later**

---

## Success Metrics

### Technical Success

- ✅ 1000 stars run at < 100ms per phase
- ✅ Zero installation (browser-based)
- ✅ Deterministic (same seed = same result)
- ✅ Saves/loads reliably
- ✅ No crashes over 1000+ phase sessions

### User Experience Success

- ✅ Players understand psychohistory mechanics
- ✅ Each star feels distinct and memorable
- ✅ Emergent stories are compelling
- ✅ Players replay with different seeds
- ✅ Players share their galaxies

### Community Success

- ✅ GitHub stars (interest indicator)
- ✅ Player-created content (scenarios, seeds)
- ✅ Discussion of strategies
- ✅ Educational use (students learning math/history)
- ✅ Foundation fans appreciate authenticity

---

## Conclusion

**Core Philosophy:**

This is a **turn-based psychohistory simulation** where the opponent is history itself. We prioritize:

1. **Mathematical elegance** - Simple rules, complex emergence
2. **Historical depth** - Rich procedural narratives
3. **Browser accessibility** - Zero barriers to entry
4. **Deterministic replayability** - Same seed, same story
5. **Educational value** - Teach psychohistory concepts

**Technology Stack:**

- **TypeScript + Vite** - Modern, type-safe, organized
- **Canvas/Three.js** - Proven rendering solutions
- **Turn-based model** - No 60 FPS requirement
- **LocalStorage** - Simple persistence
- **GitHub Pages** - Free, reliable hosting

**Development Approach:**

- Start simple, add complexity incrementally
- Port existing → Scale to 100 → Add personalities → Enhance mechanics → Scale to 1000 → Polish
- Test performance at each stage
- Maintain browser accessibility throughout

**The Vision:**

A game where players feel like Hari Seldon, watching civilizations rise and fall according to mathematical laws, yet still feeling the emotional weight of each empire's story. Where the line between determinism and chaos creates endless replayability. Where psychohistory becomes not just a concept from science fiction, but an experience you can explore.

**In Mike Singleton's Spirit:**

Complex emergence from simple rules. Deep gameplay from minimal input. Stories that players tell themselves. A game that respects the player's intelligence and rewards their curiosity.

**In Isaac Asimov's Spirit:**

The mathematics of history. The inevitability of trends. The power of prediction. The dignity of civilizations. The hope that understanding the patterns might help us guide the future.

---

*"The fall of Empire, gentlemen, is a massive thing, however, and not easily fought. It is dictated by a rising bureaucracy, a receding initiative, a freezing of caste, a damming of curiosity—a hundred other factors. It has been going on, as I have said, for centuries, and it is too majestic and massive a movement to stop."*

— Hari Seldon, Foundation

Let's build something worthy of that vision.
