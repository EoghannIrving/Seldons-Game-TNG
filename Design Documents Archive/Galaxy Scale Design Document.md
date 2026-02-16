# Design Document: Galaxy Scale & Tiers (Phase 6)

**Status:** ✅ Implemented (See `PHASE_6_COMPLETE.md`)
**Last Updated:** 2026-02-14

---

## Overview

This document addresses the fundamental design question: **How many stars should the galaxy have?**

This decision impacts player attachment, strategic depth, psychohistory authenticity, and technical implementation.

---

## The Core Tension

**Psychohistory's Philosophy:**
- "Individuals don't matter, only statistical masses"
- Large numbers required for mathematical validity
- Hari Seldon dealt with billions of people, millions of worlds

**Storytelling Reality:**
- Humans connect with specific characters and places
- We remember names, stories, personalities
- Too many options → paradox of choice → attachment to none
- Foundation focused on ~50 named worlds despite galaxy-wide scope

**Our Challenge:** Balance psychohistory's need for scale with players' need for meaningful connections.

---

## Psychological Limits

### Dunbar's Number Applied

**Research on human social capacity:**
- **Intimate relationships:** ~5 people (family/best friends)
- **Close relationships:** ~15 people (good friends)
- **Casual friends:** ~50 people (social circle)
- **Acquaintances:** ~150 people (Dunbar's number)
- **Recognizable:** ~500 people (can put name to face)

**Applied to stars in a game:**
- **5-10 stars:** Deep attachment, know everything about them
- **20-50 stars:** Know names, follow their stories, have favorites
- **100 stars:** Recognize many, know a subset well
- **500+ stars:** Anonymous masses, statistical entities

### The Paradox of Choice

**Too few stars (< 50):**
- ✅ Personal connection to every star
- ✅ Remember all names and histories
- ✅ Every change feels significant
- ❌ Limited strategic variety
- ❌ Psychohistory feels small-scale
- ❌ Less emergent complexity

**Too many stars (1000+) without management:**
- ❌ Overwhelming information
- ❌ No attachment to any individual star
- ❌ Analysis paralysis
- ❌ Defeats personality goal
- ✅ Perfect for pure statistical psychohistory
- ✅ Grand scale feeling

**Sweet spot (100-200 with good UI):**
- ✅ Can develop favorites (~10-20 stars)
- ✅ Recognize many others (~50 stars)
- ✅ Strategic variety
- ✅ Psychohistory patterns emerge
- ✅ Galaxy feels appropriately vast
- ⚠️ Some stars will be ignored (natural and okay)

---

## What Asimov Actually Did

### Foundation Series Analysis

**Named and Characterized Worlds Across All Books:**

**Foundation (1951):**
- Trantor (capital)
- Terminus (Foundation)
- Anacreon (kingdom)
- Smyrno (kingdom)
- Korell (kingdom)
- **Total: ~5 detailed worlds**

**Foundation and Empire (1952):**
- Kalgan (Mule's base)
- Haven (trader world)
- Neotrantor (fallen capital)
- **Total: +3 worlds = ~8 cumulative**

**Second Foundation (1953):**
- Tazenda (suspected location)
- Rossem (remote outpost)
- **Total: +2 worlds = ~10 cumulative**

**Foundation's Edge (1982):**
- Gaia (group mind planet)
- Sayshell (independent world)
- **Total: +2 worlds = ~12 cumulative**

**Foundation and Earth (1986):**
- Solaria (Spacer world)
- Aurora (Spacer world)
- Earth (original world)
- Alpha (orbital city)
- Comporellon (conservative world)
- **Total: +5 worlds = ~17 cumulative**

**Prequel Series:**
- Helicon (Seldon's birthplace)
- Mycogen (traditionalist sector)
- Dahl (lower-class sector)
- **Total: +3 worlds = ~20 cumulative**

### Asimov's Pattern

**Key Insight:**
- Galaxy contains **25 million inhabited worlds**
- Books characterize approximately **20-25 worlds total**
- Rest exist as:
  - Statistical aggregates ("The Periphery")
  - Regional blocs ("The Four Kingdoms")
  - Anonymous references ("The Outer Sectors")

**Lesson:**
You can *represent* vast scale while *focusing* attention on manageable numbers.

**The rest weren't missing—they were background:**
- Mentioned in statistics
- Grouped into regions
- Part of the sweep of history
- But not individually characterized

**We can do the same.**

---

## Proposed Solution: Tiered Personality System

### The 5-50-500 Model

Inspired by Dunbar's number and Asimov's approach:

**Tier 1: Major Powers (5-15 stars)**
- **Full personality treatment:**
  - Complete dynasty system with named rulers
  - Detailed historical events and timelines
  - Rich encyclopedia entries (500+ words)
  - Crisis events and special mechanics
  - Procedural monuments/wonders
  - Technology specializations
  - Complex relationship webs
- **Player experience:**
  - These are "main characters" in the story
  - Player learns their names naturally
  - Follows their rise and fall emotionally
  - Bookmarks and revisits frequently
- **Visual treatment:**
  - Always show labels
  - Full detail rendering
  - Special visual effects
  - Prominent on timeline

**Tier 2: Regional Powers (30-60 stars)**
- **Moderate detail:**
  - Basic traits (2-3 per star)
  - Simplified dynasty tracking
  - Major events only (conquests, revolutions)
  - Brief encyclopedia entries (50-100 words)
  - Basic technology tracking
- **Player experience:**
  - "Supporting cast"
  - Recognized by name
  - Appear in major events
  - Occasionally followed closely
- **Visual treatment:**
  - Show labels when zoomed in or nearby
  - Standard detail rendering
  - Moderate effects

**Tier 3: Minor Systems (remaining stars)**
- **Minimal detail:**
  - Basic stats only (strength, power, ruler)
  - Generic traits or no traits
  - Events only in aggregate
  - No individual encyclopedia entries
  - Mentioned only in regional summaries
- **Player experience:**
  - "The masses" - statistical background
  - Rarely interacted with individually
  - Matter only in aggregate
  - Pure psychohistory subjects
- **Visual treatment:**
  - No labels (unless selected)
  - Simple dot rendering
  - Minimal effects
  - Aggregate into regional blocs

### Dynamic Tier Assignment

**Tiers are not static—they evolve based on:**

**1. Strategic Importance:**
```typescript
function calculateImportance(star: Star): number {
  let score = 0;

  // Power
  if (star.strength > 1000) score += 30;
  if (star.power > 5000) score += 20;

  // Empire size
  score += star.subjects.length * 5;

  // Independence
  if (star.ruler === null) score += 20;

  // Recent activity
  score += star.recentEvents.length * 10;

  // Longevity
  if (star.dynastyAge > 50) score += 15;

  return score;
}

// Promote/demote based on score
if (score > 80 && tier === 'minor') tier = 'regional';
if (score > 150 && tier === 'regional') tier = 'major';
if (score < 50 && tier === 'major') tier = 'regional';
```

**2. Player Attention:**
```typescript
// Track player interactions
class PlayerFocus {
  clickCount: Map<string, number>;
  viewDuration: Map<string, number>;
  bookmarks: Set<string>;

  // Promote stars player cares about
  updateTiers(stars: Star[]) {
    for (const star of stars) {
      if (this.bookmarks.has(star.id)) {
        star.tier = 'major'; // Player explicitly cares
      } else if (this.clickCount.get(star.id) > 10) {
        star.tier = 'regional'; // Player interested
      }
    }
  }
}
```

**3. Narrative Significance:**
```typescript
// Automatic promotion during major events
if (event.type === 'empire-collapse' && affectedStars.length > 10) {
  // This is a big deal, promote central star
  centralStar.tier = 'major';
}

if (star.ruledFor > 100 && star.subjects.length > 20) {
  // Long-lasting empire, deserves Major status
  star.tier = 'major';
}
```

**Result:** The galaxy naturally develops "main characters" that emerge from gameplay, not just initial randomization.

---

## Galaxy Size Options

### Configurable Scales

```typescript
interface GalaxyConfig {
  size: GalaxySize;
  personalityMode: PersonalityMode;
}

enum GalaxySize {
  Small = 50,      // Intimate
  Medium = 200,    // Balanced (RECOMMENDED DEFAULT)
  Large = 500,     // Grand
  Epic = 1000      // Psychohistory
}

enum PersonalityMode {
  Full = 'full',        // All stars get full personality
  Tiered = 'tiered',    // Major/Regional/Minor (RECOMMENDED DEFAULT)
  Minimal = 'minimal'   // Stats only, no narrative
}
```

### Size Comparison

| Size | Total Stars | Major | Regional | Minor | Use Case |
|------|-------------|-------|----------|-------|----------|
| **Small** | 50 | 10 | 40 | 0 | Intimate storytelling, learning the game |
| **Medium** | 200 | 15 | 60 | 125 | **Recommended default** - balanced scale |
| **Large** | 500 | 20 | 80 | 400 | Grand strategy, multiple empires |
| **Epic** | 1000 | 25 | 100 | 875 | Pure psychohistory, statistical focus |

### Personality Mode Comparison

**Full Personality (All stars get complete treatment):**
- Best for: Small galaxies (50-100 stars)
- Pros: Deep connection to every star
- Cons: Performance cost, information overload at large scales
- When to use: Player wants maximum narrative depth

**Tiered Personality (Major/Regional/Minor):**
- Best for: Medium-Epic galaxies (200-1000 stars)
- Pros: Manageable complexity, natural focus, scalable
- Cons: Some stars feel generic
- When to use: **Default recommendation** - balance of scale and story

**Minimal Personality (Stats only):**
- Best for: Players who want pure simulation
- Pros: Maximum performance, clean interface, pure psychohistory
- Cons: No narrative connection, feels sterile
- When to use: Experimental/analytical playstyle

---

## UI Solutions for Managing Scale

### 1. Smart Filtering

**Show only stars that matter right now:**

```typescript
enum FilterMode {
  All,           // Show everything (can be overwhelming)
  Relevant,      // Major + Regional stars only
  Major,         // Only Major tier stars
  Independent,   // Stars with no ruler
  Powerful,      // High strength/power
  Active,        // Recent events
  Bookmarked     // Player favorites
}

// Example: Medium galaxy with Relevant filter
// Shows 15 Major + 60 Regional = 75 stars labeled
// Other 125 shown as unlabeled dots
// Manageable visual complexity
```

**Search and Discovery:**
```
"Find stars matching:
  - Name contains 'Rigel'
  - Trait is 'Militaristic'
  - Strength > 1000
  - Independent for 20+ phases
  - Changed ruler 3+ times
  - In the Northern sector"
```

### 2. Aggregation and Regions

**Group Minor stars into named regions:**

```typescript
interface Region {
  name: string;              // "The Outer Rim"
  stars: Star[];             // All minor stars in region
  bounds: BoundingBox;       // Geographic area

  // Aggregate statistics
  totalStrength: number;
  dominantEpoch: Epoch;
  majorRuler: string | null; // Which Major star controls this region
  independentCount: number;

  // Visual
  color: Color;              // Region color on map
  shape: Polygon;            // Region boundary
}

// Display
// - Zoomed out: Region shown as colored blob with name
// - Click region: Zoom in to see individual stars
// - Region stat rollup: "The Outer Rim: 47 stars, mostly Communal, contested"
```

**Region Examples:**
- "The Core Worlds" (dense, highly centralized)
- "The Outer Rim" (sparse, independent)
- "The Northern Sectors" (geographic grouping)
- "The Trantorian Sphere" (political grouping)

### 3. Level-of-Detail Rendering

**Visual complexity scales with zoom:**

```typescript
function render(star: Star, camera: Camera) {
  const distance = camera.position.distanceTo(star.position);
  const zoom = camera.zoom;

  if (star.tier === 'major') {
    // Always render with full detail
    drawStar(star, DetailLevel.Full);
    drawLabel(star);
    drawPowerGlow(star);
    drawRulerArrows(star);

  } else if (star.tier === 'regional') {
    if (zoom > 1.0 || distance < 200) {
      // Render with labels when close
      drawStar(star, DetailLevel.Medium);
      drawLabel(star);
    } else {
      // Simple star when far
      drawStar(star, DetailLevel.Simple);
    }

  } else { // minor
    if (zoom > 2.0 && distance < 100) {
      // Only show details when very close
      drawStar(star, DetailLevel.Simple);
      if (selected) drawLabel(star);
    } else {
      // Just a dot
      drawDot(star);
    }
  }
}
```

**Result:**
- Galaxy feels vast when zoomed out (dots and regions)
- Detail emerges when you zoom in
- Major stars always visible
- Visual clarity maintained at all scales

### 4. Encyclopedia Focus

**Narrative generation matches tier:**

```typescript
function generateEncyclopediaEntry(star: Star): string {
  if (star.tier === 'major') {
    return generateFullEntry(star);
    // 500+ words
    // Detailed history
    // All dynasties
    // Major events
    // Relationships
    // Cultural analysis

  } else if (star.tier === 'regional') {
    return generateBriefEntry(star);
    // 50-100 words
    // Basic history
    // Current status
    // Most significant events

  } else { // minor
    // No individual entry
    // Mentioned only in regional summaries
    return `${star.name} - A minor system in the ${star.region.name}.`;
  }
}

// Encyclopedia index
// - Major stars: Full entries (15-25 entries)
// - Regional stars: Brief entries (30-60 entries)
// - Minor stars: Regional summaries only
// - Total: Manageable amount of generated text
```

### 5. Timeline and History Focus

**History tracking prioritizes important stars:**

```typescript
class HistoryTracker {
  // Store detailed snapshots for Major stars
  majorStarHistory: Map<string, PhaseSnapshot[]>;

  // Store sparse snapshots for Regional
  regionalStarHistory: Map<string, PhaseSnapshot[]>;

  // Store only current state for Minor
  minorStarState: Map<string, StarSnapshot>;

  // Events stored based on tier
  recordEvent(event: HistoricalEvent) {
    if (event.involvesMajorStar()) {
      // Full detail, always stored
      this.majorEvents.push(event);
    } else if (event.involvesRegionalStar() && event.significance > threshold) {
      // Significant events only
      this.regionalEvents.push(event);
    } else {
      // Minor events aggregated
      this.minorEventCounts[event.type]++;
    }
  }
}

// Timeline display
// - Detailed timeline for Major stars (every phase)
// - Sparse timeline for Regional stars (major events only)
// - No individual timeline for Minor stars
```

### 6. Contextual Information Display

**HUD shows relevant information based on selection:**

```typescript
// Star selected
if (selectedStar.tier === 'major') {
  // Show full detail panel
  // - All stats
  // - Full history timeline
  // - Relationship web
  // - Dynasty tree
  // - Technology tree
  // - Encyclopedia entry

} else if (selectedStar.tier === 'regional') {
  // Show condensed panel
  // - Key stats
  // - Recent events (last 10 phases)
  // - Current relationships
  // - Brief description

} else { // minor
  // Show minimal panel
  // - Current stats only
  // - Ruler (if any)
  // - "Promote to Regional" button
}

// Nothing selected
// - Show galaxy overview
// - Major empires list
// - Recent significant events
// - Statistical summary
```

---

## Implementation Strategy

### Phase 1: Start with 100 Stars (Week 3)

**Rationale:**
- Sweet spot for initial development
- Enough for strategic variety
- Small enough to manage without tiering
- Psychohistory patterns emerge
- Performance is trivial
- **Test bed for personality systems**

**Configuration:**
```typescript
const initialConfig = {
  size: 100,
  personalityMode: 'full', // All 100 stars get full treatment
  // Learn what players naturally focus on
};
```

**What we'll observe:**
- Which stars do players click most?
- How many stars do players actually track?
- Do players feel overwhelmed or engaged?
- Which personality features matter most?

### Phase 2-3: Implement Personality (Week 4-8)

**Add full suite of personality features at 100 stars:**
- Star types and visual distinction
- Trait system (2-3 traits per star)
- Historical event tracking
- Dynasty system
- Relationship tracking
- Encyclopedia generation

**Collect data:**
```typescript
class PlaytestAnalytics {
  // What are players actually doing?
  starClickCounts: Map<string, number>;
  starViewDuration: Map<string, number>;
  bookmarkedStars: Set<string>;
  searchQueries: string[];

  // Survey questions (after 50-100 phases played)
  questions: [
    "How many stars can you name without looking?",
    "Which 5 stars do you care about most?",
    "Do you wish there were more stars, fewer stars, or is 100 right?",
    "What makes you care about a particular star?",
    "Do you feel overwhelmed or do you want more complexity?",
  ]
}
```

### Phase 4: Data-Driven Scale Decision (Week 9-10)

**Analyze Phase 2-3 results:**

**Scenario A: Players naturally focus on ~10-20 stars**
```
Evidence:
- 90% of clicks on 15-20 stars
- Players bookmark 5-10 favorites
- Can name ~15 stars consistently
- Want "more stars" for variety

Decision:
→ Implement tiering system
→ Scale to Medium (200 stars) or Large (500 stars)
→ 10-20 Major (what they already focus on)
→ 40-80 Regional (variety and depth)
→ Rest Minor (statistical background)
```

**Scenario B: Players know and care about most 100 stars**
```
Evidence:
- Clicks distributed across 50+ stars
- Players bookmark 20+ stars
- Can name 30+ stars
- Want more detail, not more stars

Decision:
→ Keep 100 stars, or expand to 200 with full personality
→ Don't implement tiering (not needed)
→ Focus on deepening existing systems
```

**Scenario C: Players are overwhelmed at 100**
```
Evidence:
- Only interact with 5-10 stars
- Feel lost in galaxy
- Want simpler interface
- Analysis paralysis

Decision:
→ Reduce default to Small (50 stars)
→ All stars get full personality
→ Simplify UI
→ Option for 100+ as "advanced mode"
```

**Most Likely Outcome:** Scenario A
- Research suggests ~10-20 active focus objects is natural
- This matches Asimov's approach (20-25 characterized worlds)
- Tiering system becomes valuable
- Scale to 200-500 stars with good UI

### Implementation: Tiered System

**If Scenario A (most likely):**

```typescript
// Week 9, Days 3-5: Implement tiering

class Star {
  tier: StarTier;

  // Tier determines detail level
  getPersonalityDetail(): PersonalityDetail {
    switch(this.tier) {
      case 'major':
        return {
          dynasties: true,
          detailedEvents: true,
          fullEncyclopedia: true,
          technologyTree: true,
          complexRelationships: true,
          monuments: true,
        };

      case 'regional':
        return {
          dynasties: true, // simplified
          detailedEvents: false, // major events only
          fullEncyclopedia: false, // brief entry
          technologyTree: false,
          complexRelationships: false,
          monuments: false,
        };

      case 'minor':
        return {
          dynasties: false,
          detailedEvents: false,
          fullEncyclopedia: false,
          technologyTree: false,
          complexRelationships: false,
          monuments: false,
        };
    }
  }
}

// Assign tiers based on importance
function assignInitialTiers(stars: Star[], config: GalaxyConfig) {
  // Sort by strategic position, central location
  const sorted = sortByStrategicImportance(stars);

  const majorCount = Math.floor(stars.length * 0.10); // 10%
  const regionalCount = Math.floor(stars.length * 0.30); // 30%

  // Top 10% become Major
  sorted.slice(0, majorCount).forEach(s => s.tier = 'major');

  // Next 30% become Regional
  sorted.slice(majorCount, majorCount + regionalCount)
    .forEach(s => s.tier = 'regional');

  // Rest are Minor
  sorted.slice(majorCount + regionalCount)
    .forEach(s => s.tier = 'minor');
}

// Dynamic tier updates
function updateTiers(galaxy: Galaxy) {
  for (const star of galaxy.stars.values()) {
    const importance = calculateImportance(star);
    const playerFocus = getPlayerFocusScore(star);

    // Combine algorithmic and player-driven promotion
    const score = importance + playerFocus;

    if (score > 150 && star.tier !== 'major') {
      promoteTo(star, 'major');
      logEvent(`${star.name} promoted to Major tier`);
    } else if (score < 50 && star.tier === 'major') {
      demoteTo(star, 'regional');
      logEvent(`${star.name} demoted to Regional tier`);
    }
  }
}
```

### Week 9, Days 6-7: Galaxy Size Options

```typescript
// Let players choose their experience
const presets = {
  small: {
    starCount: 50,
    personalityMode: 'full',
    description: "Intimate - Every star has deep personality"
  },

  medium: {
    starCount: 200,
    personalityMode: 'tiered',
    majorCount: 15,
    regionalCount: 60,
    description: "Balanced - Focus on favorites, galaxy feels vast (RECOMMENDED)"
  },

  large: {
    starCount: 500,
    personalityMode: 'tiered',
    majorCount: 20,
    regionalCount: 80,
    description: "Grand Strategy - Multiple empires, complex politics"
  },

  epic: {
    starCount: 1000,
    personalityMode: 'tiered',
    majorCount: 25,
    regionalCount: 100,
    description: "Psychohistory - Pure statistical simulation"
  }
};
```

---

## Recommended Default Configuration

### Medium Galaxy (200 Stars) with Tiered Personalities

**Why this is the recommended default:**

**Scale Benefits:**
- ✅ Large enough for psychohistory patterns to emerge clearly
- ✅ Multiple major empires can coexist (3-5 simultaneously)
- ✅ Strategic variety and replayability
- ✅ Feels appropriately galactic in scope
- ✅ Room for surprise emergent behavior

**Personality Benefits:**
- ✅ 15 Major stars = enough "main characters" to follow
- ✅ 60 Regional stars = supporting cast provides depth
- ✅ 125 Minor stars = background "masses" for psychohistory
- ✅ Matches human capacity (~50 stars player might recognize)
- ✅ Player can have clear favorites without overwhelm

**Performance Benefits:**
- ✅ Phase calculation < 20ms (trivial)
- ✅ Rendering is smooth
- ✅ History storage is reasonable
- ✅ No optimization needed

**Comparison to Foundation:**
- ✅ Similar to Asimov's approach (20-25 characterized worlds)
- ✅ Rest of galaxy exists but isn't individually detailed
- ✅ Can reference regions and sectors
- ✅ Statistical validity maintained

**Flexibility:**
- Easy to adjust up or down based on preference
- Small (50) available for intimate experience
- Large (500) available for grand strategy
- Epic (1000) available for pure psychohistory

### Configuration Details

```typescript
const RECOMMENDED_DEFAULT = {
  galaxySize: 200,
  personalityMode: 'tiered',

  tiers: {
    major: {
      count: 15,  // 7.5% of stars
      features: 'full',
    },
    regional: {
      count: 60,  // 30% of stars
      features: 'moderate',
    },
    minor: {
      count: 125, // 62.5% of stars
      features: 'minimal',
    }
  },

  galaxyShape: 'spiral',
  interactionFactor: 10,

  ui: {
    defaultFilter: 'relevant', // Show Major + Regional by default
    showMinorStars: true,       // As unlabeled dots
    enableRegions: true,        // Aggregate Minor stars
    autoPromote: true,          // Dynamic tier changes
  }
};
```

---

## Benefits of This Approach

### 1. Best of Both Worlds

**Intimacy:**
- Player can develop deep attachment to 10-20 Major stars
- Know their names, dynasties, histories
- Follow their rise and fall emotionally
- Feel like they matter

**Scale:**
- Galaxy has 200 stars (feels vast)
- Psychohistory patterns emerge clearly
- Multiple empires coexist
- Statistical validity

**Asimov's Approach:**
- Matches Foundation's focus (20-25 detailed worlds)
- Background exists but isn't overwhelming
- Psychohistory works on masses, stories focus on individuals

### 2. Natural Emergence

**Stars become "characters" organically:**
- Not pre-scripted
- Based on what actually happens in simulation
- Player attention shapes which stars matter
- Each playthrough creates different "main characters"

**Example emergence:**
```
Phase 0: All stars generated, 15 randomly assigned Major tier

Phase 50:
- TRANTOR (initially Regional) promoted to Major (became huge empire)
- VEGA (initially Major) demoted to Regional (collapsed)
- DENEB (initially Minor) promoted to Regional (player keeps clicking it)

Phase 100:
- Player's top 5 bookmarked stars are all Major tier
- 3 stars promoted due to game events
- 2 stars demoted due to insignificance
- Natural focus has emerged
```

### 3. Scalable Complexity

**Information scales with player attention:**

**New player:**
- Focus on just the Major stars (15)
- Learn the mechanics
- Not overwhelmed
- Can ignore Minor stars entirely

**Experienced player:**
- Knows all Major stars by name
- Recognizes Regional stars
- Occasionally dives into Minor star details
- Uses filtering and search extensively

**Expert player:**
- Manipulates tier promotions strategically
- Tracks complex webs of relationships
- Analyzes regional statistics
- Uses all 200 stars as strategic elements

### 4. Replayability

**Each game creates unique focus:**
- Different stars become Major based on emergence
- Different empires dominate
- Different stories unfold
- Same seed, different if player focuses differently

**Sharing and comparison:**
- "In my game, RIGEL became dominant"
- "Really? In mine, VEGA absorbed everything"
- Same galaxy, different narratives
- Encourages multiple playthroughs

---

## Testing and Validation

### Playtest Metrics (Phase 2-3)

**Quantitative Data:**
```typescript
interface PlaytestMetrics {
  // Attention distribution
  starClickCounts: Map<string, number>;
  starViewDuration: Map<string, number>;

  // Player focus
  bookmarkedStars: Set<string>;
  mostViewedStars: string[]; // Top 20

  // Comprehension
  starsPlayerCanName: number; // Survey question
  favoriteStars: string[]; // Top 5

  // Engagement
  averageSessionPhases: number;
  totalPlaytime: number;

  // Preference
  desiredStarCount: number; // "More, fewer, or just right?"
  overwhelmRating: number; // 1-10 scale
  engagementRating: number; // 1-10 scale
}
```

**Qualitative Feedback:**
```
Survey Questions:
1. "How many stars can you name without looking at the game?"
2. "Which stars do you care about most? Why?"
3. "Do you wish there were more stars, fewer stars, or is it about right?"
4. "Do you feel overwhelmed by information, or do you want more detail?"
5. "What makes a star interesting to you?"
6. "Have you ignored some stars completely? Why?"
7. "Would you like the option for a larger galaxy?"
```

### Success Criteria

**Tier system is working if:**
- ✅ 80%+ of player interactions focus on 20-30 stars
- ✅ Players can name 10-20 stars consistently
- ✅ Players report having "favorite" stars
- ✅ Players don't complain about information overload
- ✅ Players request more stars (indicating they want scale)

**Keep 100 stars if:**
- ✅ Players interact with 50+ stars regularly
- ✅ Players can name 30+ stars
- ✅ Players don't request more stars
- ✅ Players want deeper systems, not more stars

**Reduce to 50 if:**
- ✅ Players only interact with 5-10 stars
- ✅ Players report feeling lost
- ✅ Players can't name more than 5-10 stars
- ✅ Players request simpler experience

---

## Future Considerations

### Post-Release Options

**v1.1 - Galaxy Size Configurator:**
```typescript
interface AdvancedConfig {
  starCount: number; // Custom: 10-10000

  tierPercentages: {
    major: number;    // % of stars
    regional: number; // % of stars
    minor: number;    // % of stars (auto-calculated)
  };

  personalityDetail: {
    major: PersonalityFeatures;
    regional: PersonalityFeatures;
    minor: PersonalityFeatures;
  };

  promotionRules: {
    enableDynamic: boolean;
    importanceThreshold: number;
    playerFocusWeight: number;
  };
}
```

**v1.2 - Community Scenarios:**
```typescript
// Players share interesting configurations
const communityScenario = {
  name: "The Thirty Tyrants",
  description: "30 Major powers, no Regional/Minor. Intimate but chaotic.",
  starCount: 30,
  allMajor: true,
  recommendedFor: "Players who want deep attachment to all stars",
};
```

### Modding Support

**Let players define custom tier systems:**
```json
{
  "customTiers": [
    {
      "name": "Galactic Capitals",
      "count": 5,
      "features": ["dynasties", "monuments", "fullEncyclopedia"]
    },
    {
      "name": "Regional Hubs",
      "count": 20,
      "features": ["dynasties", "basicEncyclopedia"]
    },
    {
      "name": "Frontier Worlds",
      "count": 75,
      "features": ["basicTraits"]
    },
    {
      "name": "The Unknown Regions",
      "count": 100,
      "features": []
    }
  ]
}
```

---

## Summary and Recommendation

### The Decision

**Phase 1 (Week 3): Start with 100 stars, full personality**
- Learn what players naturally focus on
- Test all personality systems
- Collect data on player behavior

**Phase 2-3 (Week 4-8): Implement personality at 100 stars**
- Star types, traits, dynasties, history, encyclopedia
- Observe player patterns
- Survey player preferences

**Phase 4 (Week 9-10): Data-driven scale decision**
- Most likely: Players focus on ~15-20 stars
- Implement tiering system (Major/Regional/Minor)
- Scale to 200 stars (Medium galaxy)
- 15 Major, 60 Regional, 125 Minor
- This becomes the **recommended default**

**Alternative outcomes:**
- If players love all 100 → keep 100-200, all full personality
- If players overwhelmed → reduce to 50
- If players want more → scale to 500 with tiering

### Default Configuration (Expected)

```typescript
const SELDON_GAME_DEFAULT = {
  galaxySize: 200,
  personalityMode: 'tiered',
  majorStars: 15,
  regionalStars: 60,
  minorStars: 125,

  description: "Medium galaxy with tiered personalities - " +
               "focus on your favorites while the galaxy feels vast"
};
```

### Why This Works

**Honors psychohistory:**
- Large enough for statistical patterns
- Masses matter, not just individuals
- 200 stars is plenty for emergent complexity

**Honors storytelling:**
- 15 Major stars = "main characters"
- Deep attachment possible
- Matches Asimov's approach (~20 characterized worlds)

**Honors players:**
- Not overwhelming (good UI + filtering)
- Can have favorites
- Natural focus emerges
- Replayable with different narratives

**Honors Mike Singleton:**
- Simple rules, complex emergence
- Player discovers which stars matter
- Not pre-scripted
- Elegant design

---

*"The mathematics of psychohistory demands large numbers. The art of storytelling demands specific characters. We can have both."*

— Design Philosophy, Seldon's Game TNG
