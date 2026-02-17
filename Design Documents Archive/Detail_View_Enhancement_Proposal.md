# Detail View Enhancement Proposal
## Adding Crisis, Foundation, and Status Information

**Created:** 2026-02-17
**Status:** Proposed
**Priority:** High (improves discoverability of visual indicators)

---

## **CURRENT STATE**

### **What's Currently Shown:**
The detail view Encyclopedia Entry tab shows:

**Political Summary Section:**
- Status (Independent/Subject)
- Ruler name
- Subject count
- Vitality (percentage)
- Loyalty (if subject)

**Relations Summary Section:**
- Allies count
- Trade routes count
- Wars count
- Active events count
- **Active crises count** (just a number, no details)

**Capital Administration Section** (for capitals):
- Civic vitality band (Low/Medium/High)
- Admin capacity
- Regime stability
- Subject load

### **What's Missing:**
1. **Foundation Tier Status** - No indication if star has foundationTier > 0
2. **Crisis Details** - Only shows count, not which crises or their types/severity
3. **Decadence Status** - Shown visually (broken ring) but not in text
4. **Genius Leader Status** - Shown as crown icon but not detailed
5. **Dark Age Status** - Star has darkAge/severeDarkAge flags not displayed

---

## **PROPOSED ENHANCEMENTS**

### **Option 1: Add New "Status & Conditions" Section**

Add a dedicated section to the Encyclopedia Entry that appears near the top (high priority) showing critical status indicators.

**Location:** After Political Summary, before Ecology Profile

**Content:**
```
STATUS & CONDITIONS
-------------------
Foundation Status: Foundation Tier 1 ⭐
                  (Psychohistorically significant)

Active Crises: 2
  - Technological Crisis (Severity: High)
    Started Phase 42, 3 phases remaining
    "Neighboring empire achieved FTL breakthrough"

  - Economic Crisis (Severity: Moderate)
    Started Phase 45, 1 phase remaining
    "Trade routes collapsed due to regional conflict"

Empire Health:
  - Decadence: 72% 💔 (Crumbling)
  - Vitality: 45% ⚠️ (Declining)

Special Conditions:
  - Dark Age 🌑 (Scientific stagnation)
  - Genius Leader: Emperor Marcus VII 👑
    (Admin bonus: 2.5x, expires Phase 52)
```

**Implementation:**
1. Create new `buildStatusConditionsSection()` in `encyclopedia-entry.ts`
2. Include foundation tier, active crises with details, decadence, special flags
3. Add to entry sections with priority 25 (between political and ecology)

---

### **Option 2: Enhance Existing Sections**

Expand current sections to include missing information.

#### **2a. Enhance Political Summary:**
```
POLITICAL SUMMARY
-----------------
Status: Independent
Ruler: Self-Governed
Subjects: 3 stars
Vitality: 45% ⚠️ (Declining)
Decadence: 72% 💔 (Crumbling Empire)

Foundation Status: ⭐ Foundation Tier 1
  (Psychohistorically significant institution)

Leadership:
  Current Ruler: Emperor Marcus VII 👑
  Genius Leader Bonus: 2.5x admin capacity
  Reign Expires: Phase 52 (7 phases remaining)
```

#### **2b. Enhance Relations Summary:**
```
RELATIONS SUMMARY
-----------------
Allies: 2
Trade Routes: 5
Wars: 1
Active Events: 3
Active Crises: 2 🔴

CRISIS DETAILS:
  1. Technological Crisis (High Severity) 🔬
     - Started: Phase 42
     - Duration: 3 phases remaining
     - Description: "Neighboring empire achieved FTL breakthrough"
     - Impact: Tech race pressure, increased rivalry

  2. Economic Crisis (Moderate Severity) 💰
     - Started: Phase 45
     - Duration: 1 phase remaining
     - Description: "Trade routes collapsed due to regional conflict"
     - Impact: Revenue decline, stability strain
```

---

### **Option 3: Add Dedicated "Crisis Management" Tab**

Add a 6th tab to the detail view specifically for crisis/challenge information.

**Tab Name:** "Crises" or "Challenges"

**Content:**
- List all active crises affecting the star
- Show crisis timeline (start, duration, resolution)
- Display crisis severity and type
- Show historical crises (resolved ones)
- Link to related events in history
- Show crisis resolution outcomes

**Pros:**
- Dedicated space for important crisis information
- Can show more detail without cluttering other tabs
- Clearly separates crisis data from general info

**Cons:**
- Adds another navigation layer
- Information is one more click away
- May go undiscovered by users

---

## **RECOMMENDED APPROACH**

**Hybrid: Option 2b + Limited Option 1**

1. **Enhance Relations Summary** to show crisis details (Option 2b)
   - Keep it in familiar location
   - Expand active crisis count into detailed list
   - Show type, severity, timeline, description

2. **Add Foundation/Empire Health to Political Summary** (Option 2a)
   - Foundation tier status
   - Decadence level with visual indicator
   - Genius leader information (already partially there)
   - Dark age flags

3. **DON'T add a new top-level section** (reject full Option 1)
   - Keeps existing structure familiar
   - Avoids information overload
   - Users already know where to find political and relations info

---

## **IMPLEMENTATION DETAILS**

### **Step 1: Enhance Relations Summary Section**

**File:** `src/core/encyclopedia-entry.ts`

**Changes to `buildRelationsSummarySection()`:**

```typescript
export interface RelationsSummaryPayload {
  allies: number;
  tradeRoutes: number;
  wars: number;
  activeEventCount: number;
  activeCrisisCount: number;
  // NEW: Add crisis details
  activeCrises?: Array<{
    id: string;
    type: CrisisType;
    severity: number;
    startPhase: number;
    duration: number;
    remainingPhases: number;
    description: string;
  }>;
}

export function buildRelationsSummarySection(
  star: Star,
  galaxyState: GalaxyState
): EntrySection<RelationsSummaryPayload> {
  const activeEventCount = galaxyState.events.filter(
    (event) => !event.resolved && event.targetStarIds.includes(star.id)
  ).length;

  const starActiveCrises = galaxyState.activeCrises.filter(
    (crisis) => !crisis.resolved && crisis.targetStarId === star.id
  );

  const activeCrisisCount = starActiveCrises.length;

  return {
    id: 'relations-summary',
    title: 'Relations Summary',
    kind: 'relations_summary',
    priority: 30,
    dataVersion: 1,
    dataState: 'complete',
    payload: {
      allies: star.allies.length,
      tradeRoutes: star.tradeRoutes.length,
      wars: star.atWarWith.length,
      activeEventCount,
      activeCrisisCount,
      // NEW: Include full crisis details
      activeCrises: starActiveCrises.map(c => ({
        id: c.id,
        type: c.type,
        severity: c.severity,
        startPhase: c.startPhase,
        duration: c.duration,
        remainingPhases: c.duration - (galaxyState.phase - c.startPhase),
        description: c.description,
      })),
    },
  };
}
```

### **Step 2: Update Detail View Renderer**

**File:** `src/rendering/galaxy-renderer.ts`

**Changes to relations_summary rendering (around line 2039-2051):**

```typescript
} else if (section.kind === 'relations_summary') {
  const payload = section.payload as {
    allies: number;
    tradeRoutes: number;
    wars: number;
    activeEventCount: number;
    activeCrisisCount: number;
    activeCrises?: Array<{
      id: string;
      type: string;
      severity: number;
      startPhase: number;
      duration: number;
      remainingPhases: number;
      description: string;
    }>;
  };
  compactRow('Allies', String(payload.allies), payload.allies > 0 ? theme.colors.ui.success : undefined, x);
  compactRow('Trade Routes', String(payload.tradeRoutes), payload.tradeRoutes > 0 ? theme.colors.ui.warning : undefined, x);
  compactRow('Wars', String(payload.wars), payload.wars > 0 ? theme.colors.ui.danger : undefined, x);
  compactRow('Active Events', String(payload.activeEventCount), payload.activeEventCount > 0 ? theme.colors.ui.info : undefined, x);
  compactRow('Active Crises', String(payload.activeCrisisCount), payload.activeCrisisCount > 0 ? theme.colors.ui.danger : undefined, x);

  // NEW: Show crisis details if any
  if (payload.activeCrises && payload.activeCrises.length > 0) {
    iy += Math.floor(lblSize * 1.2); // Extra spacing

    for (const crisis of payload.activeCrises) {
      const crisisIcon = crisis.type === 'technological' ? '🔬' :
                        crisis.type === 'economic' ? '💰' :
                        crisis.type === 'religious' ? '⛪' :
                        crisis.type === 'succession' ? '👑' :
                        crisis.type === 'external' ? '👽' : '⚠️';

      const severityLabel = crisis.severity > 0.7 ? 'Critical' :
                           crisis.severity > 0.4 ? 'High' : 'Moderate';
      const severityColor = crisis.severity > 0.7 ? theme.colors.ui.danger :
                           crisis.severity > 0.4 ? '#ff6600' : theme.colors.ui.warning;

      const crisisName = crisis.type.charAt(0).toUpperCase() + crisis.type.slice(1);

      // Crisis header
      this.ctx.fillStyle = severityColor;
      this.ctx.font = 'bold ' + valSize + 'px ' + theme.effects.font;
      this.ctx.fillText(`${crisisIcon} ${crisisName} Crisis (${severityLabel})`, x, iy);
      iy += Math.floor(lblSize * 1.6);

      // Crisis details (indented)
      this.ctx.fillStyle = theme.colors.dimText;
      this.ctx.font = lblSize + 'px ' + theme.effects.font;
      this.ctx.fillText(`  Started Phase ${crisis.startPhase}, ${crisis.remainingPhases} phases remaining`, x, iy);
      iy += Math.floor(lblSize * 1.6);

      // Description (wrapped)
      const descLines = this.wrapText(`  "${crisis.description}"`, leftColW - 10, lblSize);
      for (const line of descLines) {
        this.ctx.fillText(line, x, iy);
        iy += Math.floor(lblSize * 1.6);
      }

      iy += Math.floor(lblSize * 0.8); // Space between crises
    }
  }
}
```

### **Step 3: Enhance Political Summary Section**

**Changes to `buildPoliticalSummarySection()` in `encyclopedia-entry.ts`:**

```typescript
export interface PoliticalSummaryPayload {
  isIndependent: boolean;
  rulerName: string;
  subjectCount: number;
  vitality: number;
  loyalty?: number;
  // NEW: Add foundation and health info
  foundationTier?: number;
  decadence?: number;
  geniusLeader?: {
    name: string;
    bonusMultiplier: number;
    expiresAt: number;
    remainingPhases: number;
  };
  darkAge?: boolean;
  severeDarkAge?: boolean;
}

export function buildPoliticalSummarySection(
  star: Star,
  galaxyState: GalaxyState
): EntrySection<PoliticalSummaryPayload> {
  const isIndependent = star.ruler === star.id;
  const ruler = star.ruler ? galaxyState.stars.get(star.ruler) : null;
  const rulerName = isIndependent ? 'Self-Governed' : ruler?.name || 'Unknown';

  return {
    id: 'political-summary',
    title: 'Political Summary',
    kind: 'political_summary',
    priority: 20,
    dataVersion: 1,
    dataState: 'complete',
    payload: {
      isIndependent,
      rulerName,
      subjectCount: star.subjects.length,
      vitality: star.vitality,
      loyalty: isIndependent ? undefined : star.loyalty,
      // NEW
      foundationTier: star.foundationTier > 0 ? star.foundationTier : undefined,
      decadence: star.decadence,
      geniusLeader: star.geniusLeader ? {
        name: star.geniusLeader.name,
        bonusMultiplier: star.geniusLeader.bonusMultiplier,
        expiresAt: star.geniusLeader.expiresAt,
        remainingPhases: star.geniusLeader.expiresAt - galaxyState.phase,
      } : undefined,
      darkAge: star.darkAge,
      severeDarkAge: star.severeDarkAge,
    },
  };
}
```

**Render updates (around line 1996-2002):**

```typescript
} else if (section.kind === 'political_summary') {
  const payload = section.payload as {
    isIndependent: boolean;
    rulerName: string;
    subjectCount: number;
    vitality: number;
    loyalty?: number;
    foundationTier?: number;
    decadence?: number;
    geniusLeader?: {
      name: string;
      bonusMultiplier: number;
      expiresAt: number;
      remainingPhases: number;
    };
    darkAge?: boolean;
    severeDarkAge?: boolean;
  };

  compactRow('Status', payload.isIndependent ? 'Independent' : 'Subject', payload.isIndependent ? theme.colors.ui.success : theme.colors.ui.warning, x);
  compactRow('Ruler', payload.rulerName, undefined, x);
  compactRow('Subjects', String(payload.subjectCount), payload.subjectCount > 0 ? theme.colors.ui.info : undefined, x);

  // Vitality with health indicator
  const vitalityLabel = `${Math.round(payload.vitality * 100)}%`;
  const vitalityStatus = payload.vitality < 0.3 ? ' ⚠️ (Declining)' :
                        payload.vitality < 0.6 ? ' (Moderate)' : ' (Healthy)';
  compactRow('Vitality', vitalityLabel + vitalityStatus,
            payload.vitality < 0.3 ? theme.colors.ui.danger : theme.colors.ui.warning, x);

  // Decadence
  if (payload.decadence !== undefined && payload.decadence > 0.6) {
    const decadenceLabel = `${Math.round(payload.decadence * 100)}% 💔`;
    const decadenceStatus = payload.decadence > 0.8 ? ' (Collapsing)' : ' (Crumbling)';
    compactRow('Decadence', decadenceLabel + decadenceStatus, theme.colors.ui.danger, x);
  }

  if (!payload.isIndependent && payload.loyalty !== undefined) {
    compactRow('Loyalty', `${Math.round(payload.loyalty * 100)}%`, theme.colors.ui.warning, x);
  }

  // NEW: Foundation status
  if (payload.foundationTier) {
    compactRow('Foundation Status', `⭐ Tier ${payload.foundationTier}`, '#FFD700', x);
    this.ctx.fillStyle = theme.colors.dimText;
    this.ctx.font = lblSize + 'px ' + theme.effects.font;
    this.ctx.fillText('  (Psychohistorically significant)', x, iy);
    iy += Math.floor(lblSize * 1.6);
  }

  // NEW: Genius leader
  if (payload.geniusLeader) {
    compactRow('Current Leader', `👑 ${payload.geniusLeader.name}`, '#FFD700', x);
    compactRow('Admin Bonus', `${payload.geniusLeader.bonusMultiplier}x capacity`, theme.colors.ui.success, x);
    compactRow('Reign Duration', `${payload.geniusLeader.remainingPhases} phases remaining`, theme.colors.dimText, x);
  }

  // NEW: Dark age
  if (payload.severeDarkAge) {
    compactRow('Dark Age', '🌑 Severe (Scientific stagnation)', theme.colors.ui.danger, x);
  } else if (payload.darkAge) {
    compactRow('Dark Age', '🌑 Active', theme.colors.ui.warning, x);
  }
}
```

---

## **EXPECTED IMPACT**

### **Benefits:**
1. **Visual indicators explained** - Users can now understand what the gold rings, broken rings, and crisis shapes mean
2. **Crisis awareness** - Players see specific threats and their severity, not just a count
3. **Foundation prominence** - Psychohistorically significant stars are highlighted in detail
4. **Better decision-making** - Full crisis info helps users prioritize responses
5. **Consistency** - Tooltip indicators now have corresponding detail view info

### **User Experience:**
- **Tooltip**: Quick glance shows "🔬 Technological Crisis"
- **Detail View**: Full context shows type, severity, timeline, description, impact
- **Discoverability**: Users who click to learn more get complete information

---

## **IMPLEMENTATION PRIORITY**

**Phase:** B (Quick Wins) or C (Core Navigation)
**Effort:** 2-4 hours
**Risk:** Low (additive changes, no breaking changes)

**Order:**
1. Enhance Relations Summary with crisis details (highest value)
2. Add Foundation/Decadence to Political Summary (medium value)
3. Add Genius Leader details (low value, nice-to-have)

---

**End of Proposal**
