# Implementation Roadmap - Prioritized

This document takes all the ideas from our brainstorming sessions and organizes them into a prioritized, phased implementation plan. Each phase builds on the previous one, with clear goals and deliverables.

---

## Prioritization Framework

### Impact vs. Effort Matrix

**High Impact, Low Effort (Do First):**
- Core infrastructure improvements
- Essential UX enhancements
- Foundation-authentic features

**High Impact, High Effort (Do Second):**
- Major new systems
- Complex visualizations
- Deep simulation enhancements

**Low Impact, Low Effort (Fill-in work):**
- Polish features
- Nice-to-have visuals
- Quality of life improvements

**Low Impact, High Effort (Skip or Defer):**
- Experimental features
- Uncertain value propositions
- Over-engineering risks

### Core Principles

1. **Foundation First** - Get the tech stack and architecture solid
2. **Playable at Each Phase** - Every phase should result in a complete, playable game
3. **Personality Before Complexity** - Make stars memorable before adding complex systems
4. **Test Scale Early** - Validate 1000 stars works before adding more features
5. **Polish Last** - Visual effects and animations are final touches

---

## Phase 0: Migration & Foundation (Week 1-2)

**Goal:** Port existing game to TypeScript + Vite with solid architecture

**Status:** 🎯 CRITICAL PATH - Nothing else can start until this is done

### Tasks

#### Setup (Day 1)
- [ ] Create Vite + TypeScript project
- [ ] Install dependencies (Three.js for later, testing framework)
- [ ] Set up project structure (all directories from architecture doc)
- [ ] Configure TypeScript (strict mode)
- [ ] Set up Git repository

#### Core Types (Day 2)
- [ ] Define all TypeScript interfaces (`types.ts`)
  - Star, GalaxyState, GalaxyConfig, Camera, RenderOptions
  - Epoch enum, StarType enum
- [ ] Create constants file
- [ ] Set up proper Vector3 usage (prepare for 3D)

#### Port Existing Logic (Day 3-5)
- [ ] Port psychohistory calculations
  - `calculatePower()`
  - `calculateInfluence()`
  - `determineRuler()`
  - `calculateGrowth()`
  - `updateCentralization()`
- [ ] Create Galaxy class
  - Constructor with config
  - `advancePhase()` method
  - Distance matrix calculation
- [ ] Create basic Star class/interface
- [ ] Test with 26 stars - ensure identical results to original

#### Port Rendering (Day 6-7)
- [ ] Create GalaxyRenderer class (Canvas 2D)
- [ ] Port existing drawing code
  - Stars as circles
  - Ruler arrows
  - Labels
  - Power glow
- [ ] Set up canvas sizing and scaling
- [ ] Basic camera (pan/zoom placeholder)

#### Basic UI (Day 8-9)
- [ ] Input handling (keyboard events)
  - Space = advance phase
  - A-Z = select star
  - Click = select star
- [ ] Detail panel (basic stats display)
- [ ] Phase counter display
- [ ] Instructions overlay

#### Save/Load (Day 10)
- [ ] Implement StorageManager
- [ ] LocalStorage save/load
- [ ] Auto-save every N phases
- [ ] Load on startup if save exists

### Deliverable
✅ **Current game working in new architecture**
- Same 26-star experience
- TypeScript type safety
- Modular code structure
- Save/load functionality
- Ready to scale

### Success Criteria
- [ ] Zero TypeScript errors
- [ ] Deterministic (same seed = same result as original)
- [ ] Saves and loads correctly
- [ ] Code is organized and documented
- [ ] All original features work

---

## Phase 1: Scale to 100 Stars (Week 3)

**Goal:** Validate architecture handles more stars, add necessary scaling features

**Status:** 🎯 PRIORITY - Proves the tech stack works at scale

**Design Decision:** Start with 100 stars as the sweet spot for testing personality systems. This allows players to develop favorites naturally while maintaining psychohistory patterns. Based on Phase 2-3 feedback, we'll determine optimal final scale (100-500 stars) and whether tiering is needed.

### Tasks

#### Galaxy Generation (Day 1-2)
- [ ] Implement procedural star generation
  - Random positions in 2D space
  - Configurable star count (26, 50, 100, 1000)
  - Galaxy shape options (random, clustered, sparse)
- [ ] Better star name generation
  - Use real star names (Betelgeuse, Rigel, etc.)
  - List of 1000+ real astronomical names
  - Fallback to procedural names if needed
- [ ] Initial strength/epoch randomization

#### Camera & Navigation (Day 3-4)
- [ ] Implement proper Camera class
  - Position, zoom level
  - Pan with mouse drag
  - Zoom with mouse wheel
  - Bounds checking
- [ ] Viewport culling
  - Only render visible stars
  - Performance optimization
- [ ] Mini-map (optional, nice-to-have)
  - Small overview in corner
  - Show camera viewport

#### UI Improvements (Day 5-6)
- [ ] Search/filter stars
  - By name
  - By independence
  - By power level
- [ ] Keyboard shortcuts
  - Arrow keys to pan
  - +/- to zoom
  - Home to reset view
  - Tab to cycle through stars
- [ ] Settings menu
  - Star count selector
  - Seed input
  - Interaction factor slider
  - Visual theme picker

#### Performance Monitoring (Day 7)
- [ ] FPS counter (optional, for debugging)
- [ ] Phase calculation timer
  - Display how long phase took
  - Warning if > 100ms
- [ ] Performance profiling
  - Test 26, 50, 100, 500, 1000 stars
  - Document timings
  - Identify bottlenecks if any

### Deliverable
✅ **100-star galaxy running smoothly**
- Procedural generation works
- Navigation is smooth
- Performance is acceptable
- Settings are configurable

### Success Criteria
- [ ] 100 stars calculate in < 50ms per phase
- [ ] Rendering is smooth (no visible lag)
- [ ] Pan/zoom feels responsive
- [ ] Can find and select any star easily
- [ ] Different seeds produce different galaxies

---

## Phase 2: Planet Personalities - Foundation (Week 4-5)

**Goal:** Make each star feel unique and memorable

**Status:** 🌟 HIGH IMPACT - This is what makes the game special

### Priority Features (High Impact, Medium Effort)

#### Star Types (Day 1-2)
- [ ] Define stellar classifications
  - Blue Giant (O/B class)
  - Yellow Dwarf (G class)
  - Red Dwarf (M class)
  - Red Giant (K class)
  - White Dwarf
  - Binary system
- [ ] Assign types procedurally (based on seed)
- [ ] Visual representation
  - Different colors
  - Different sizes
  - Subtle glow effects
- [ ] Gameplay effects
  - Blue Giants: high growth, unstable
  - Red Dwarfs: low growth, very stable
  - Etc.

#### Trait System (Day 3-5)
- [ ] Define trait categories
  - Political: Imperialist, Republican, Adaptable, Traditionalist
  - Economic: Mercantile, Agrarian, Industrial, Post-Scarcity
  - Social: Cosmopolitan, Xenophobic, Scholarly, Militaristic
  - Psychological: Ambitious, Cautious, Volatile, Stoic
- [ ] Implement trait effects
  - Modify growth rates (±10-20%)
  - Affect centralization tendencies
  - Influence power projection
  - Rebellion resistance
- [ ] Procedural trait assignment (2-3 per star)
- [ ] Trait display in UI
  - Icons or text
  - Tooltip descriptions
  - Effects explained

#### Historical Event Tracking (Day 6-7)
- [ ] Event types
  - Conquest (ruler change to someone new)
  - Liberation (gaining independence)
  - Golden Age (high growth period)
  - Dark Age (collapse/decline)
  - Revolution (epoch change)
- [ ] Automatic event detection
  - Track ruler changes
  - Detect strength milestones
  - Notice epoch flips
- [ ] Event storage in star history
- [ ] Timeline visualization (simple list for now)

#### Enhanced Detail Panel (Day 8-10)
- [ ] Redesign star detail view
  - Star type and visual
  - Traits with descriptions
  - Current stats (strength, power, growth, centralization)
  - Ruler information
  - Subject list
  - Historical timeline
- [ ] Comparison mode (optional)
  - Compare two stars side-by-side
  - Highlight differences
- [ ] Better visual design
  - Card-based layout
  - Color coding by epoch
  - Icons for traits

### Deliverable
✅ **Stars have personality and character**
- Each star is visually distinct
- Traits create gameplay variety
- History is tracked and visible
- Players can identify "favorite" stars

### Success Criteria
- [ ] Can identify star by appearance
- [ ] Traits affect gameplay meaningfully
- [ ] History tells a coherent story
- [ ] Detail panel is informative and attractive
- [ ] Players develop preferences for certain stars

---

## Phase 3: Core Gameplay Enhancements (Week 6-8)

**Goal:** Implement high-priority enhancements from brainstorming docs

**Status:** 🎮 GAMEPLAY DEPTH - Makes the game more interesting to play

### Visualization Improvements (Week 6, Days 1-3)

#### Growth Visualization
- [ ] Growth rate display
  - Color-code stars by growth (red = declining, green = booming)
  - Trend arrows (↑ accelerating, → steady, ↓ declining)
- [ ] Growth sparklines (optional)
  - Tiny line chart showing last 10-20 phases
  - Visible on hover or in detail panel
- [ ] Growth forecast
  - "At current rate, strength will double in X phases"

#### Power Flow Animation (Optional)
- [ ] Particle system for influence
  - Particles flow from subjects to ruler
  - Flow intensity = power transferred
  - Makes centralization visible
- [ ] Empire cohesion visualization
  - Tight connections for high centralization
  - Loose connections for low centralization
- [ ] Note: This is optional polish, not core gameplay

#### Centralization Display
- [ ] Visual spectrum indicator
  - Show where star sits on 0.0-1.0 scale
  - Historical average as reference
- [ ] Color coding by centralization level
  - High = tight/rigid (sharp edges)
  - Low = loose/organic (soft edges)

### Historical Depth (Week 6, Days 4-7)

#### Phase History System
- [ ] Store snapshots every N phases
  - Configurable (every 1, 5, 10, or 50 phases)
  - Trade-off: memory vs. granularity
- [ ] Timeline scrubber
  - Slider to navigate history
  - Jump to any previous phase
  - Playback mode (auto-advance through history)
- [ ] Phase bookmarks
  - User can mark significant moments
  - "Phase 47: Fall of Trantor"
  - Jump to bookmarked phases
- [ ] Phase comparison
  - Side-by-side view of two phases
  - Highlight what changed
  - "30 phases ago vs. now"

#### Historical Events
- [ ] Major event detection
  - Empire collapse (ruler loses 5+ subjects)
  - Unification (star gains 5+ subjects)
  - Century of peace (no ruler changes for 50+ phases)
  - Revolution (epoch flip)
- [ ] Event annotations
  - Auto-generate descriptions
  - Display on timeline
  - Include in star history

### Succession & Collapse Mechanics (Week 7)

#### Empire Stability
- [ ] Capital stability tracking
  - Rulers need consistent power advantage
  - If power drops too low, subjects flee
- [ ] Cascading collapse
  - Ruler weakens → loses subjects
  - Lost subjects provided power → ruler weakens more
  - More subjects flee → death spiral
  - Simulates empire fragmentation
- [ ] Succession crisis events
  - When ruler falls, subjects compete
  - Brief period of chaos (growth penalties)
  - Strongest subject usually becomes new ruler

#### Loyalty System (Optional for later)
- [ ] Subject loyalty score
  - Based on length of rule
  - Based on ruler power trend
  - Based on centralization match
- [ ] Rebellion mechanics
  - Low loyalty = increased chance to switch rulers
  - Very low loyalty = temporary independence bonus
- [ ] Reconquest mechanics
  - Easier to reconquer former subjects
  - "Historical claims"

### Playback Controls (Week 7, Days 5-7)

#### Auto-Advance Mode
- [ ] Continuous phase advancement
  - Configurable speed (0.5x to 10x)
  - Pause/resume
  - Stop on major events (optional)
- [ ] Speed control slider
  - Real-time adjustment
  - Display current rate (phases/second)

#### Phase Navigation
- [ ] Skip forward X phases
  - Input: "advance 10 phases"
  - Show progress bar if slow
- [ ] Rewind capability
  - Step backward through history
  - Non-destructive (just viewing)
- [ ] Phase counter improvements
  - Display current phase prominently
  - Show total phases in history
  - Indicate if viewing past vs. live

### Galaxy Themes (Week 8)

#### Visual Themes
- [ ] Dark theme (current)
  - Black background, neon stars
  - High contrast
- [ ] Light theme
  - White/cream background
  - Softer colors
- [ ] Foundation theme
  - Art deco sci-fi aesthetic
  - Asimov book cover inspiration
  - Gold and deep blue
- [ ] Retro theme
  - ZX Spectrum tribute
  - Limited color palette
  - Blocky graphics
  - "Singleton Mode"

#### UI Improvements
- [ ] Layer toggles
  - Show/hide ruler arrows
  - Show/hide power glow
  - Show/hide labels
  - Show/hide grid
  - Reduces visual clutter
- [ ] Info density settings
  - Minimal (just stars)
  - Normal (current)
  - Detailed (all info)

### Deliverable
✅ **Deeper, more polished simulation**
- History is explorable
- Empires rise and fall dynamically
- Visual clarity and customization
- Playback controls for exploration

### Success Criteria
- [ ] Can explore full history easily
- [ ] Empire collapses feel dramatic
- [ ] Visual themes offer variety
- [ ] Auto-advance makes long-term observation easy
- [ ] Game feels polished and professional

---

## Phase 4: Scale Testing & Optimization (Week 9-10)

**Goal:** Determine optimal galaxy size based on Phase 2-3 learnings, implement tiering if needed

**Status:** 🚀 SCALING TEST - Data-driven decision on final scale

**Key Questions to Answer:**
- Do players naturally focus on ~10-20 favorite stars at 100?
- Are players overwhelmed or wanting more complexity?
- Should we implement tiering (Major/Regional/Minor stars)?
- What's the right balance: 100, 200, 500, or configurable?

### Player Feedback Analysis (Week 9, Days 1-2)

#### Evaluate Phase 2-3 Results
- [ ] Analyze which stars players focused on
  - How many stars do players know by name?
  - How many stars do players click/interact with regularly?
  - Which features drive attachment (traits, dynasties, events)?
- [ ] Survey player preferences
  - "Which 5 stars do you care about most?"
  - "Can you name 10 stars without looking?"
  - "Do you wish there were more stars or fewer?"
  - "Do you feel overwhelmed or want more complexity?"
- [ ] Identify patterns
  - Natural focus on ~10-20 stars? → Tiering makes sense
  - Players know all 100? → Maybe cap at 200-300
  - Players overwhelmed? → Reduce to 50

### Tiered Personality System (Week 9, Days 3-5) [If Needed]

**Implement only if players naturally focus on subset of stars**

#### Star Tiers
- [ ] Define tier system
  - **Major** (10-20 stars): Full personality, detailed history, dynasties, encyclopedia entries
  - **Regional** (30-50 stars): Moderate detail, basic traits, simplified history
  - **Minor** (remaining): Statistical background, minimal detail, aggregate into regions
- [ ] Tier assignment algorithm
  - Initial: Mark strategic positions as Major/Regional
  - Dynamic: Promote stars that become powerful or player clicks frequently
  - Player-controlled: Bookmark system promotes to Major
- [ ] Tier-based rendering
  - Major: Always show label, full details
  - Regional: Show label when zoomed in
  - Minor: Dots only, no labels unless selected

#### Aggregation System
- [ ] Region grouping for Minor stars
  - Group nearby minor stars into named regions
  - Display as colored blobs/clouds
  - Region-level stats (total strength, dominant epoch)
  - Click region to zoom and see individual stars
- [ ] Smart filtering
  - "Show only Major/Regional stars"
  - "Show independent stars only"
  - "Show stars with recent events"
  - Reduce visual clutter

### Galaxy Size Configuration (Week 9, Days 6-7)

#### Configurable Galaxy Sizes
- [ ] Implement size options
  - **Small**: 50 stars (intimate storytelling)
  - **Medium**: 100-200 stars (balanced)
  - **Large**: 300-500 stars (grand strategy)
  - **Epic**: 1000 stars (pure psychohistory) [Optional]
- [ ] Personality mode options
  - **All**: Every star has full personality
  - **Tiered**: Major/Regional/Minor system
  - **Minimal**: Gameplay stats only, no narrative
- [ ] Default recommendation
  - Medium galaxy (200 stars) with tiered personalities
  - 10 Major, 50 Regional, 140 Minor
  - Balance of scale and personal connection

### Performance Optimization (Week 10) [Only If Needed]

**Note:** At 100-200 stars, optimization is likely unnecessary. Implement only if performance targets aren't met.

#### Spatial Indexing (If targeting 500+ stars)
- [ ] Implement SpatialIndex class
  - Grid-based spatial partitioning
  - Efficient neighbor queries
- [ ] Integrate into influence calculations
  - Only check nearby stars
  - Configurable influence radius
- [ ] Benchmark improvement
  - Before/after timing
  - Document speedup

#### Rendering Optimization
- [ ] Viewport culling (already done in Phase 1)
- [ ] Level of Detail (LOD)
  - Zoomed out: simple dots
  - Medium: stars + labels (Regional+)
  - Zoomed in: full detail + effects (Major)
- [ ] Batch rendering (if needed)
  - Group draw calls
  - Reduce Canvas API overhead

### Stress Testing (Week 10, Final Days)

#### Test Scenarios (Scale to chosen size)
- [ ] Chosen galaxy size × 100 phases
  - Measure phase calculation time
  - Measure memory usage
  - Check for memory leaks
- [ ] Chosen galaxy size × 1000 phases
  - Long-term stability test
  - History storage stress test
- [ ] 100 stars × 10,000 phases
  - Extreme long game
  - History depth test

#### Performance Targets (Adjusted)
- [ ] Phase calculation < 50ms (200 stars), < 100ms (500 stars)
- [ ] Rendering > 30 FPS (with animations off)
- [ ] Memory usage < 300MB (after 1000 phases)
- [ ] No memory leaks (stable over time)

### Galaxy Generation Improvements (Week 10)

#### Galaxy Shapes
- [ ] Random (current)
- [ ] Spiral galaxy
  - Logarithmic spiral algorithm
  - Arms with star clusters
  - Dense core, sparse rim
- [ ] Elliptical
  - 3D ellipsoid
  - Even distribution
- [ ] Clustered
  - Multiple dense regions
  - Void regions between
  - Realistic galaxy clusters

#### Initial Conditions
- [ ] Presets
  - "All independent" start
  - "One empire" start (galactic emperor scenario)
  - "Cold War" (two superpowers)
  - "Warring states" (many small empires)
- [ ] Custom starting conditions
  - Set specific star as initial ruler
  - Configure initial strength distribution

### Deliverable
✅ **Optimal galaxy size determined and implemented**
- Performance meets targets at chosen scale
- Tiering system (if needed) creates manageable complexity
- Multiple galaxy size options available
- Players can focus on favorites while galaxy feels vast
- No stability issues

### Success Criteria
- [ ] Data-driven decision on galaxy size (100-500 stars)
- [ ] Tiering system (if implemented) focuses attention naturally
- [ ] Phase time meets targets for chosen scale
- [ ] Players report attachment to favorite stars
- [ ] Galaxy feels appropriately scaled (not too small, not overwhelming)
- [ ] No crashes or freezes
- [ ] Game remains playable and responsive

---

## Phase 5: Narrative & Encyclopedia (Week 11-12)

**Goal:** Procedurally generate rich historical narratives

**Status:** 📚 STORYTELLING - Makes psychohistory feel real

### Encyclopedia Galactica System (Week 11)

#### Entry Types
- [ ] Planet entries
  - Auto-generated summary of star's history
  - Written from future historian perspective
  - Past tense, retrospective
  - Includes dynasties, wars, golden ages
- [ ] Dynasty entries
  - History of ruling families
  - Notable rulers
  - Achievements and failures
- [ ] Event entries
  - Major battles/conquests
  - Seldon Crises
  - Revolutionary periods
- [ ] Era entries
  - "The Age of Trantor" (Phases 12-56)
  - "The Fragmentation" (Phases 57-89)
  - Auto-detect and name periods

#### Text Generation (Week 11, Days 3-7)
- [ ] Template system
  - Fill-in-the-blank templates
  - Variation through synonyms
  - Contextual language (formal, dramatic, analytical)
- [ ] Narrative arc detection
  - Rise (gaining power)
  - Peak (maximum extent)
  - Fall (collapse)
  - Renaissance (recovery)
- [ ] Relationship descriptions
  - Ancient rivals
  - Natural allies
  - Tragic conflicts
  - Unexpected alliances

#### Encyclopedia UI (Week 12, Days 1-3)
- [ ] Encyclopedia panel
  - Searchable index
  - Categorized entries
  - Cross-references ("See also...")
- [ ] Generated on-demand
  - Create entry when viewed
  - Cache for performance
- [ ] Export capability
  - Download as Markdown
  - Full history document
  - Share-worthy narratives

### Dynasty System (Week 12, Days 4-7)

#### Dynasty Mechanics
- [ ] Dynasty naming
  - Procedural generation (House X, The Y Dynasty)
  - Based on star name or traits
  - Cultural flavor (Imperial, Mercantile, etc.)
- [ ] Dynasty lifecycle
  - Founding (when star becomes independent/ruler)
  - Duration tracking
  - Ending (conquest, revolution, voluntary dissolution)
- [ ] Ruler succession
  - Individual rulers within dynasty
  - Procedural names (Emperor X, Empress Y)
  - Reign lengths based on centralization
  - Succession types (peaceful, crisis, revolution)

#### Dynasty Display
- [ ] Dynasty info in detail panel
  - Current dynasty name and age
  - Current ruler and reign length
  - List of past rulers
  - Achievements during dynasty
- [ ] Dynasty tree (optional)
  - Visual family tree
  - Succession lines
  - Branch dynasties

### Relationships & Rivalries (Week 12, Days 5-7)

#### Relationship Tracking
- [ ] Detect relationship patterns
  - Ancient rivals (frequent conflicts)
  - Natural allies (coexist peacefully)
  - Vassal loyalty (long-term subjects)
  - Liberation bonds (who freed whom)
- [ ] Relationship types
  - Rival (--)
  - Neutral (-)
  - Friendly (+)
  - Allied (++)
- [ ] Relationship history
  - Track all interactions
  - Conflicts, alliances, trades

#### Relationship Display
- [ ] Relationship web diagram
  - Network graph showing connections
  - Color-coded by type
  - Thickness = strength of relationship
- [ ] Tooltips on stars
  - "Ancient rival of RIGEL"
  - "Ally of VEGA"
  - "Former subject of TRANTOR"

### Deliverable
✅ **Rich procedural narratives**
- Encyclopedia entries are compelling
- Dynasties feel like real histories
- Relationships create story arcs
- Game generates share-worthy content

### Success Criteria
- [ ] Encyclopedia entries are readable and interesting
- [ ] Different galaxies produce unique stories
- [ ] Dynasties are tracked accurately
- [ ] Relationships reflect actual game events
- [ ] Players want to share their encyclopedia

---

## Phase 6: Advanced Gameplay Features (Week 13-15)

**Goal:** Add strategic depth from "Gameplay Ideas.md"

**Status:** 🎲 STRATEGIC DEPTH - Make psychohistory interactive

### Foundation Mechanics (Week 13)

#### Seldon Crises (Days 1-4)
- [ ] Crisis types
  - Technological breakthrough
  - Plague/disaster
  - Economic collapse
  - Religious movement
  - Succession crisis
- [ ] Crisis triggers
  - Random (weighted probabilities)
  - Threshold-based (when conditions met)
  - Periodic (every N phases)
- [ ] Crisis effects
  - Growth rate changes
  - Centralization shifts
  - Power fluctuations
  - Special events
- [ ] Player choices (optional)
  - Multiple response options
  - Consequences based on choice
  - Right answer not obvious
- [ ] Crisis display
  - Visual indicator on affected star
  - Countdown timer
  - Description of crisis
  - Historical record after resolution

#### Foundation Placement (Days 5-7)
- [ ] Foundation mechanics
  - Player can place 1-3 Foundations
  - Strategic star locations
  - Preserve knowledge/technology
  - Provide stability bonuses
- [ ] Foundation effects
  - Growth bonus to nearby stars
  - Resistance to collapse
  - Technology preservation through dark ages
  - Influence spreading (cultural, not military)
- [ ] Second Foundation (optional)
  - Hidden placement
  - Mental influence (centralization manipulation)
  - Not visible to other players (if multiplayer)
- [ ] Foundation UI
  - Placement interface
  - Status display
  - Sphere of influence visualization

### Predicted vs. Actual Futures (Week 14)

#### Psychohistory Predictions (Days 1-4)
- [ ] Prediction algorithm
  - Run simulation forward N phases
  - Show probable outcomes
  - Multiple timeline branches
  - Confidence intervals
- [ ] Prediction display
  - Ghost overlay showing predicted positions
  - Probability cones (multiple possible futures)
  - Color-coded by likelihood
- [ ] Prediction accuracy
  - Compare prediction to reality
  - Score based on deviation
  - Seldon score: how well you predicted

#### "The Plan" Mode (Days 5-7)
- [ ] Player sets goal state
  - Define target configuration at Phase X
  - Desired number of empires
  - Desired stability level
  - Specific star configurations
- [ ] Plan tracking
  - Show deviation from plan
  - Real-time vs. predicted comparison
  - Adjust plan as needed
- [ ] Victory conditions
  - Achieve plan within margin of error
  - Minimize total deviation
  - Reach stable equilibrium

### Technology & Progression (Week 15)

#### Historical Eras (Days 1-3)
- [ ] Era system
  - Primitive (Phases 0-50)
  - Industrial (Phases 51-150)
  - Atomic (Phases 151-300)
  - Stellar (Phases 301-500)
  - Galactic (Phases 501+)
- [ ] Era effects
  - Interaction factor (Q) changes
  - Growth rate modifiers
  - New mechanics unlock
- [ ] Era transitions
  - Gradual (smooth progression)
  - Revolutionary (sudden jumps)
  - Can regress (dark ages)

#### Star Technologies (Days 4-7)
- [ ] Tech specializations
  - Hyperspace Navigation (range bonus)
  - Industrial Automation (growth bonus)
  - Social Psychology (centralization control)
  - Military Cybernetics (power projection)
  - Biotechnology (resilience)
- [ ] Tech development
  - Based on star traits
  - Evolves over time
  - Can be lost during collapse
  - Spreads to subjects
- [ ] Tech display
  - Tech tree visualization
  - Current specialization
  - Progress to next level
  - Effects explained

### Deliverable
✅ **Strategic depth matching Foundation themes**
- Crises create meaningful moments
- Predictions make player feel like Seldon
- Technologies add progression
- Multiple paths to "victory"

### Success Criteria
- [ ] Crises are dramatic and impactful
- [ ] Predictions are interesting even when wrong
- [ ] Technologies create strategic choices
- [ ] "The Plan" mode is engaging
- [ ] Game has replayability through different approaches

---

## Phase 7: 3D Visualization (Week 16-17) [OPTIONAL]

**Goal:** Add optional 3D galaxy view

**Status:** 🎨 VISUAL POLISH - Not required but impressive

**Note:** This entire phase is optional. 2D view is perfectly valid.

### Three.js Integration (Week 16, Days 1-3)

#### Setup
- [ ] Create GalaxyRenderer3D class
- [ ] Separate from 2D renderer (parallel implementation)
- [ ] Three.js scene setup
  - Scene, camera, renderer
  - Lighting
  - Background (starfield)
- [ ] Toggle 2D/3D views
  - Button to switch
  - Maintain state when switching

#### 3D Galaxy Generation (Week 16, Days 4-7)
- [ ] Spiral galaxy layout
  - Convert 2D positions to 3D
  - Spiral arm algorithm
  - Vertical thickness (thin disk)
  - Dense core, sparse rim
- [ ] Star rendering in 3D
  - Sphere geometry
  - Emissive materials (glow)
  - Size based on strength
  - Color based on type
- [ ] Camera controls
  - Orbit camera (rotate around galaxy)
  - Zoom in/out
  - Pan
  - Auto-rotation (slow)

### 3D Visual Effects (Week 17)

#### Power Flow in 3D (Days 1-3)
- [ ] Particle trails
  - Flow from subjects to rulers
  - 3D Bézier curves
  - Animated particles along paths
- [ ] Empire volumes
  - Colored clouds around empires
  - Volumetric rendering
  - Opacity based on cohesion

#### Advanced 3D Features (Days 4-7)
- [ ] Wormholes (if implemented)
  - 3D tubes connecting distant stars
  - Animated textures
  - Glow effects
- [ ] Monuments/Wonders
  - 3D models for special structures
  - Orbit around parent star
  - Special effects
- [ ] Nebula regions
  - Volumetric fog
  - Color variation
  - Affects visibility

### 3D Performance
- [ ] Level of Detail (LOD)
  - Distant stars = simple geometry
  - Close stars = detailed models
- [ ] Frustum culling
  - Don't render off-screen stars
  - Essential for 1000 stars
- [ ] Instanced rendering
  - Render many identical stars efficiently
  - GPU-accelerated

### Deliverable
✅ **Beautiful 3D galaxy view**
- Smooth camera controls
- Impressive visual effects
- Performs well even with many stars
- Optional alternative to 2D

### Success Criteria
- [ ] 3D view runs at 30+ FPS
- [ ] Camera controls feel good
- [ ] Easy to toggle between 2D and 3D
- [ ] Visual effects enhance understanding
- [ ] Doesn't break existing 2D functionality

---

## Phase 8: Polish & Release (Week 18-20)

**Goal:** Final polish, documentation, deployment

**Status:** 🚢 SHIP IT - Ready for public release

### Tutorial & Help (Week 18, Days 1-3)

#### Interactive Tutorial
- [ ] Step-by-step introduction
  - "This is your galaxy"
  - "Press Space to advance time"
  - "Watch how empires form"
  - "Click a star to see details"
- [ ] Contextual tooltips
  - Explain UI elements on hover
  - Dismiss after first view
- [ ] Help overlay
  - Keyboard shortcuts
  - Mouse controls
  - Concepts explained
  - Toggle with H key

#### Documentation
- [ ] In-game help
  - Psychohistory concepts
  - How growth works
  - How centralization works
  - How influence spreads
- [ ] External docs
  - README with screenshots
  - Gameplay guide
  - Development blog post
  - Technical architecture (already done!)

### Audio (Week 18, Days 4-7) [OPTIONAL]

#### Sound Effects
- [ ] Phase advance sound
  - Satisfying "tick"
  - Different for major events
- [ ] Ruler change sounds
  - Conquest (dramatic)
  - Liberation (triumphant)
- [ ] UI sounds
  - Click, hover, select
  - Subtle feedback

#### Star Songs (Optional, Experimental)
- [ ] Generative music system
  - Each star has unique tone
  - Based on power, growth, centralization
  - Web Audio API
- [ ] Galaxy soundscape
  - All stars playing simultaneously (quiet)
  - Selected star becomes prominent
  - "Hear" the psychohistory

### Export Features (Week 19, Days 1-3)

#### Data Export
- [ ] CSV export
  - All star stats
  - All phases
  - Import into Excel/Python
- [ ] JSON export
  - Full galaxy state
  - Shareable configurations
  - Custom scenarios

#### Visual Export
- [ ] Screenshot
  - Current galaxy view
  - High resolution option
- [ ] GIF animation
  - Last 50 phases
  - Configurable speed
  - Share on social media
- [ ] Video export (optional)
  - WebM recording
  - Full playthrough

### Multiple Save Slots (Week 19, Days 4-5)

#### Save Management
- [ ] Multiple save slots (5-10)
- [ ] Save metadata
  - Timestamp
  - Phase number
  - Star count
  - Screenshot thumbnail
- [ ] Save/load UI
  - Grid of save slots
  - Quick save/load
  - Delete saves
  - Export/import saves

### Final Optimization Pass (Week 19, Days 6-7)

#### Performance
- [ ] Profile and optimize bottlenecks
- [ ] Reduce bundle size
  - Tree shaking
  - Code splitting
  - Lazy loading
- [ ] Asset optimization
  - Compress images
  - Minify code
  - Gzip compression

#### Bug Fixing
- [ ] Test all features thoroughly
- [ ] Fix known issues
- [ ] Edge case handling
  - 0 stars (error)
  - 1 star (boring but shouldn't crash)
  - 10,000 stars (graceful degradation)
- [ ] Browser compatibility
  - Test Chrome, Firefox, Safari, Edge
  - Mobile browsers (basic support)

### Deployment (Week 20)

#### Build & Deploy
- [ ] Production build configuration
  - Minification
  - Source maps (for debugging)
  - Environment variables
- [ ] GitHub Pages setup
  - gh-pages branch
  - Custom domain (optional)
  - HTTPS enabled
- [ ] Alternative hosting
  - Netlify (backup)
  - itch.io (HTML5 game)

#### Release Preparation
- [ ] Version numbering (1.0.0)
- [ ] Changelog
- [ ] Screenshots for README
- [ ] Demo GIF/video
- [ ] Social media announcement
  - Twitter/X
  - Reddit (r/gamedev, r/asimov)
  - Hacker News (Show HN)

#### Post-Release
- [ ] Monitor for issues
- [ ] Collect feedback
- [ ] Plan v1.1 features
- [ ] Community engagement

### Deliverable
✅ **Public release v1.0**
- Polished, complete game
- Comprehensive documentation
- Deployed and accessible
- Ready for players

### Success Criteria
- [ ] No critical bugs
- [ ] Tutorial is clear
- [ ] Performance is good on target browsers
- [ ] Documentation is complete
- [ ] Game is live and shareable
- [ ] Positive initial feedback

---

## Phase 9: Post-Release Enhancements (Future)

**Goal:** Features for v1.1, v1.2, based on feedback

**Status:** 📋 BACKLOG - Ideas for later

### High-Priority Future Features

#### Mobile Optimization
- [ ] Touch controls
  - Pinch to zoom
  - Two-finger pan
  - Tap to select
- [ ] Mobile UI
  - Responsive layout
  - Portrait mode
  - Simplified controls
- [ ] Performance optimization for mobile
  - Lower detail settings
  - Reduced particle effects

#### Modding Support
- [ ] Custom scenarios
  - JSON-based format
  - User-created galaxy configurations
  - Share scenarios via export
- [ ] Custom traits
  - Define new personality traits
  - Custom effects
  - Modding API
- [ ] Workshop/gallery
  - Upload scenarios to server
  - Browse community content
  - Rating system

#### Advanced Analytics
- [ ] Statistical analysis tools
  - Power distribution graphs
  - Gini coefficient over time
  - Growth rate trends
  - Centralization evolution
- [ ] Comparative analysis
  - Compare multiple runs
  - A/B test different settings
  - Identify patterns
- [ ] Export to data science tools
  - Python/Jupyter notebook support
  - R integration
  - Research applications

### Experimental Features

#### Out-of-the-Box Ideas
- [ ] Star Songs (audio personality)
- [ ] Planetary consciousness (Gaia)
- [ ] Cultural DNA tracking
- [ ] Time crystals (repeating patterns)
- [ ] Ghost empires (historical echoes)
- [ ] Dream sequences (alternate timelines)
- [ ] Planetary moods (emotional states)

#### Multiplayer (Async)
- [ ] Seed sharing
- [ ] Leaderboards (best outcomes)
- [ ] Challenge mode
  - Shared scenario
  - Compare results
  - No real-time connection needed

#### AI-Generated Content
- [ ] LLM-powered encyclopedia
  - Richer narratives
  - Character backstories
  - Foundation-style prose
- [ ] Trade-offs
  - API costs
  - Latency
  - Determinism challenges
- [ ] Local LLM option
  - Client-side generation
  - Large download
  - Privacy-friendly

---

## Feature Matrix

### Must Have (MVP - Phases 0-4)
| Feature | Phase | Impact | Effort | Status |
|---------|-------|--------|--------|--------|
| TypeScript migration | 0 | Critical | Medium | 🎯 |
| 100 star support | 1 | Critical | Low | 🎯 |
| Star types | 2 | High | Low | 🌟 |
| Trait system | 2 | High | Medium | 🌟 |
| Historical tracking | 2 | High | Medium | 🌟 |
| Timeline scrubber | 3 | High | Medium | 🎮 |
| Empire collapse | 3 | High | Medium | 🎮 |
| Auto-advance | 3 | Medium | Low | 🎮 |
| Visual themes | 3 | Medium | Low | 🎮 |
| 1000 star support | 4 | Critical | Medium | 🚀 |

### Should Have (v1.0 - Phases 5-8)
| Feature | Phase | Impact | Effort | Status |
|---------|-------|--------|--------|--------|
| Encyclopedia | 5 | High | High | 📚 |
| Dynasties | 5 | High | Medium | 📚 |
| Seldon Crises | 6 | High | Medium | 🎲 |
| Predictions | 6 | High | High | 🎲 |
| Technologies | 6 | Medium | Medium | 🎲 |
| Tutorial | 8 | High | Medium | 🚢 |
| Export features | 8 | Medium | Medium | 🚢 |
| Multiple saves | 8 | Medium | Low | 🚢 |

### Could Have (v1.1+)
| Feature | Phase | Impact | Effort | Status |
|---------|-------|--------|--------|--------|
| 3D view | 7 | Medium | High | 🎨 Optional |
| Audio | 8 | Low | Medium | 🚢 Optional |
| Mobile optimization | 9 | Medium | High | 📋 Future |
| Modding support | 9 | Medium | High | 📋 Future |
| Advanced analytics | 9 | Low | High | 📋 Future |

### Won't Have (Experimental)
| Feature | Impact | Effort | Reasoning |
|---------|--------|--------|-----------|
| Real-time multiplayer | Medium | Very High | Out of scope |
| AI opponents | Low | High | "Opponent is history" |
| VR support | Low | Very High | Unnecessary complexity |
| Blockchain integration | Low | High | No value add |
| Native app (Electron) | Low | Medium | Browser is better |

---

## Development Philosophy

### Iteration Strategy

**Build → Test → Refine → Ship**

Each phase should:
1. Have clear, measurable goals
2. Result in a playable game
3. Be demonstrable to others
4. Inform the next phase

**Don't:**
- Gold-plate early phases
- Build features "just in case"
- Optimize prematurely
- Add features without testing

**Do:**
- Ship working software each phase
- Get feedback early and often
- Cut features that don't work
- Focus on core experience

### Quality Gates

**Before moving to next phase:**
- [ ] All planned features implemented
- [ ] No critical bugs
- [ ] Performance meets targets
- [ ] Code is documented
- [ ] Git commit with clear message
- [ ] Playable demo ready

**Can proceed with:**
- Minor bugs (track in issues)
- Missing polish (add in later phase)
- Optional features unfinished (move to backlog)

### Risk Management

**Highest Risk Items:**
1. **1000 star performance** (Phase 4)
   - Mitigation: Test early, optimize if needed, spatial indexing ready
2. **3D view complexity** (Phase 7)
   - Mitigation: Optional phase, 2D is perfectly valid
3. **Scope creep**
   - Mitigation: Strict phase boundaries, backlog for ideas
4. **Burnout**
   - Mitigation: Each phase ships a complete game, can stop anytime

**De-risking Strategy:**
- Phase 1 proves scaling works (early validation)
- Phase 2 proves personality works (core value prop)
- Phase 4 proves maximum scale (removes uncertainty)
- Phase 7 is optional (can skip if needed)

---

## Timeline Summary

**Optimistic (focused development):** 18 weeks (4.5 months)
**Realistic (part-time):** 30 weeks (7.5 months)
**Pessimistic (with breaks):** 50 weeks (1 year)

### Milestones

- **Week 2:** Ported to TypeScript ✅
- **Week 3:** 100 stars working ✅
- **Week 5:** Stars have personality ✅
- **Week 8:** Core enhancements complete ✅
- **Week 10:** 1000 stars validated ✅
- **Week 12:** Encyclopedia generating stories ✅
- **Week 15:** Strategic depth added ✅
- **Week 17:** 3D view (optional) ✅
- **Week 20:** v1.0 release 🚢

### Minimum Viable Product (MVP)

**Can ship after Phase 4 (Week 10):**
- ✅ TypeScript + Vite
- ✅ 100-1000 stars
- ✅ Star personalities
- ✅ Historical tracking
- ✅ Basic enhancements
- ✅ Save/load

**This is a complete, interesting game.**

Phases 5-8 add depth and polish, but aren't required for a satisfying experience.

---

## Success Metrics Revisited

### Technical Success
- ✅ 1000 stars run at < 100ms per phase
- ✅ Zero installation (browser-based)
- ✅ Deterministic (same seed = same result)
- ✅ Saves/loads reliably
- ✅ No crashes over 1000+ phase sessions
- ✅ Works on major browsers (Chrome, Firefox, Safari, Edge)

### User Experience Success
- ✅ Players understand psychohistory mechanics
- ✅ Each star feels distinct and memorable
- ✅ Emergent stories are compelling
- ✅ Players replay with different seeds
- ✅ Players share their galaxies
- ✅ Tutorial successfully onboards new players
- ✅ Players discover something new on each playthrough

### Community Success
- ✅ GitHub stars (interest indicator) - Target: 100+
- ✅ Player-created content (scenarios, seeds)
- ✅ Discussion of strategies (Reddit, forums)
- ✅ Educational use (students learning math/history)
- ✅ Foundation fans appreciate authenticity
- ✅ Featured on Hacker News, r/gamedev, etc.
- ✅ Positive reviews/feedback

### Personal Success
- ✅ Completed project (didn't abandon)
- ✅ Learned TypeScript/Vite/Three.js
- ✅ Portfolio piece
- ✅ Honored Mike Singleton's vision
- ✅ Brought psychohistory to life
- ✅ Created something share-worthy

---

## Flexibility & Adaptation

**This roadmap is a guide, not a contract.**

### When to Adapt

**Add features if:**
- Player feedback strongly requests
- Clear value proposition
- Low effort, high impact
- Fits coherently with existing features

**Cut features if:**
- Technical challenges too great
- Low player interest
- Better alternatives emerge
- Scope threatens timeline

**Reorder phases if:**
- Dependency discovered
- Risk needs earlier mitigation
- Inspiration strikes for different approach

### Decision Framework

**When considering changes, ask:**
1. Does this serve the core vision? (Psychohistory simulation)
2. Does this make stars more memorable? (Personality goal)
3. Does this respect Mike Singleton's design philosophy? (Emergence from simplicity)
4. Does this enhance understanding of Foundation? (Educational value)
5. Is this worth the time investment? (Impact vs. effort)

**If 3+ answers are "yes," consider it.**
**If 3+ answers are "no," skip it.**

---

## Final Thoughts

**The Goal:** Create a worthy tribute to Isaac Asimov's psychohistory and Mike Singleton's emergent design philosophy.

**The Path:** Incremental phases, each shipping a complete game, building toward a rich simulation of galactic history.

**The Philosophy:** Simple rules, complex emergence. Turn-based strategy where the opponent is history itself. Browser-accessible, zero installation, infinitely replayable.

**The Vision:** Players feel like Hari Seldon, watching civilizations rise and fall according to mathematical laws, yet still feeling the emotional weight of each empire's story. Where the line between determinism and chaos creates endless fascination.

---

*"You start with a problem, and you work toward a solution. You begin with the answer and work backward to the question."*

— Hari Seldon (paraphrased)

We know the answer: A browser-based psychohistory simulation with personality, depth, and authenticity.

Now we work backward to build it, phase by phase.

Let's begin.
