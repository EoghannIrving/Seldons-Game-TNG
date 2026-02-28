export type NarrativeRenderMode = 'recent' | 'long';

export const TEMPLATE_POOLS: Record<string, string[]> = {
  conquest: [
    '{star} pressed outward and absorbed {target}.',
    '{target} was folded into {star}\'s sphere after a forceful campaign.',
    '{star} expanded its frontier, taking control of {target}.',
    '{star} asserted dominance and annexed {target}.',
  ],
  conquest_conquered: [
    '{star} fell under foreign rule as {conquerorName} completed the conquest.',
    '{star} was absorbed by {conquerorName}, ending local self-governance.',
    '{star} lost its independence to {conquerorName}\'s advancing campaign.',
    '{star} came under the direct control of {conquerorName}.',
  ],
  liberation: [
    '{star} regained breathing room as {target} broke from foreign control.',
    'Political momentum shifted when {target} was liberated around {star}.',
    '{star} saw local order recalibrated as {target} returned to self-rule.',
    'Power arrangements loosened when {target} was freed near {star}.',
  ],
  liberation_liberated: [
    '{star} reclaimed independence after a period of foreign rule.',
    '{star} had self-governance restored once outside control was lifted.',
    '{star} broke free from occupation and restored local authority.',
    '{star} shed foreign occupation and returned to autonomous rule.',
  ],
  war: [
    '{star} entered a high-friction phase marked by direct conflict.',
    'War pressure escalated around {star}, straining existing alliances.',
    '{star} moved into open hostilities that altered regional stability.',
    'Conflict widened around {star}, redirecting political attention to survival.',
  ],
  war_defender: [
    '{star} came under attack as {counterpartName} opened hostilities.',
    '{counterpartName} brought war to {star}\'s borders.',
    '{star} moved into a defensive posture as {counterpartName} pressed forward.',
    '{star} faced invasion as {counterpartName}\'s forces advanced.',
  ],
  peace: [
    '{star} and {counterpartName} concluded a {resultQuality} settlement, ending the conflict.',
    '{star} ended the conflict with {counterpartName} on {resultQuality} terms.',
    '{star} stepped back from the front and settled terms with {counterpartName}.',
    '{star} accepted {resultQuality} terms with {counterpartName} as the war wound down.',
  ],
  plague: [
    '{star} was struck by a {severityBand} plague, disrupting civilian and governance systems.',
    '{star} suffered a {severityBand} outbreak, with cascading effects on population and supply.',
    '{star} entered emergency posture as a {severityBand} pathogen spread through the system.',
    '{star} endured a {severityBand} plague that strained recovery capacity for cycles afterward.',
  ],
  hyperlane: [
    '{star} was cut off from regional transit as nearby hyperlane routes destabilized.',
    '{star} was isolated as hyperlane disruption compressed supply and movement channels.',
    '{star} entered a period of enforced isolation following hyperlane collapse.',
    '{star} lost regional connectivity as nearby hyperlane routes collapsed.',
  ],
  crisis: [
    '{star} confronted systemic crisis conditions with uncertain outcomes.',
    'A severe crisis wave reached {star}, forcing emergency responses.',
    '{star} entered a volatile period defined by crisis management.',
    'Crisis dynamics destabilized governance around {star}.',
  ],
  reform: [
    '{star} introduced institutional reforms to steady long-term administration.',
    'Policy reforms at {star} reworked local governance priorities.',
    '{star} revised administrative structures to address mounting pressures.',
    'Reform efforts at {star} aimed to recover political coherence.',
  ],
  prosperity: [
    '{star} benefited from a period of compounding prosperity.',
    'Commercial and civic conditions improved across {star}.',
    '{star} experienced a stabilizing upswing in prosperity.',
    'Economic momentum strengthened confidence around {star}.',
  ],
  decline: [
    '{star} entered a visible period of institutional decline.',
    'Decay pressures mounted around {star}, weakening prior gains.',
    '{star} faced cumulative decline across governance and cohesion.',
    'Structural decline around {star} reduced strategic flexibility.',
  ],
  diplomacy: [
    '{star} recalibrated diplomatic posture under changing regional pressures.',
    'Diplomatic ties around {star} shifted as priorities realigned.',
    '{star} adjusted alliance expectations amid uncertain trust dynamics.',
    'Negotiated balances around {star} were redrawn by new pressures.',
  ],
  general: [
    '{star} recorded a {eventLabel} event that pushed conditions toward {direction}.',
    'A {eventLabel} development at {star} moved the system toward {direction}.',
    '{star} entered a {eventLabel}-driven turn, with outcomes trending {direction}.',
    'Records show {star} reacting to {eventLabel} pressures, leaning toward {direction}.',
  ],
  succession: [
    'The reign of {fromDynastName} of House {houseName} ended. {toDynastName} ascended to the throne of {star}.',
    'At {star}, the mantle of leadership passed from {fromDynastName} to {toDynastName} of House {houseName}.',
    'House {houseName} consolidated its rule over {star} as {toDynastName} succeeded {fromDynastName}.',
    'A new chapter for {star} began as {toDynastName} took over from {fromDynastName} of House {houseName}.',
  ],
  government_transition: [
    '{star}\'s {oldGov} collapsed under sustained ideological pressure. A {endReason} established a new {newGov}.',
    'Political upheaval at {star} ended the {oldGov} era. The {newGov} now holds power following a {endReason}.',
    'After {star}\'s institutions drifted beyond recovery, a {endReason} replaced the {oldGov} with a {newGov}.',
    'The {oldGov} at {star} gave way to a {newGov}. The transition, driven by a {endReason}, reshaped local governance.',
  ],
  religious_conversion: [
    'Without a single soldier, {converter} reshaped {star}. The {oldGov} dissolved as the population embraced the Theocracy.',
    'Faith spread farther than any army. {star}\'s {oldGov} peacefully gave way to the Theocracy, drawn by the influence of {converter}.',
    'The cultural reach of {converter} proved decisive. {star} abandoned its {oldGov} and joined the Theocratic fold.',
    'Missionaries and merchants from {converter} had long walked {star}\'s streets. When the conversion came, it was a quiet dawn - not a battle cry.',
  ],
  quiet: [
    '{star} spent this phase consolidating prior gains without major rupture.',
    'No major upheaval touched {star}; governance remained steady.',
    '{star} held a quiet line while larger currents moved elsewhere.',
    'This phase marked relative calm and consolidation for {star}.',
  ],
  consequence: [
    'The period closed with momentum running {powerTrend}, and the underlying stability held at a {stabilityState} level.',
    'The capacity to govern held at a {adminState} level, even as power moved {powerTrend} through the period.',
    'Those paying attention saw a {stabilityState} base beneath a surface moving {powerTrend}.',
    'The underlying resilience of the system registered as {stabilityState}, and the trajectory of power drifted {powerTrend}.',
  ],
};

export const RECENT_TEMPLATE_POOLS: Record<string, string[]> = {
  conquest: [
    '{star} pushed outward and took {target}.',
    '{target} fell under {star} after a bruising advance.',
    '{star} forced the border outward and folded in {target}.',
    '{star} committed to expansion and absorbed {target}.',
  ],
  conquest_conquered: [
    '{star} fell to {conquerorName}.',
    '{conquerorName} took {star} and installed direct rule.',
    '{star} was absorbed into {conquerorName}\'s domain.',
    '{star} lost its sovereignty to {conquerorName}\'s advance.',
  ],
  liberation: [
    '{target} broke from outside rule, loosening {star}\'s grip.',
    'Control around {star} thinned as {target} reclaimed self-rule.',
    '{star} took a setback when {target} slipped free.',
    '{target} walked out of enforced alignment, weakening {star}\'s hold.',
  ],
  liberation_liberated: [
    '{star} broke free and went independent.',
    '{star} regained local control after occupation.',
    '{star} regained autonomy as outside rule collapsed.',
    '{star} stepped out of foreign control.',
  ],
  war: [
    'War opened around {star}, and diplomacy gave way to force.',
    'Around {star}, warnings turned into volleys.',
    '{star} moved from brinkmanship into open conflict.',
    'Hostilities near {star} intensified and pulled everyone onto a wartime footing.',
  ],
  war_defender: [
    '{counterpartName} brought the war to {star}.',
    '{star} had war forced on it by {counterpartName}.',
    '{star} scrambled to defend as {counterpartName} struck.',
    '{star} came under attack from {counterpartName}.',
  ],
  peace: [
    '{star} and {counterpartName} settled terms, ending the war.',
    'The fight with {counterpartName} ended as {star} accepted a {resultQuality} deal.',
    '{star} stepped back from the front and closed out the conflict with {counterpartName}.',
    '{star} and {counterpartName} agreed terms and stepped back from the war.',
  ],
  plague: [
    '{star} took a {severityBand} plague hit, shaking civilian systems.',
    '{star} was hit by a {severityBand} outbreak, disrupting its population and governance.',
    '{star} reeled from a {severityBand} pathogen spreading across the system.',
    '{star} was struck by plague - {severityBand} in scale, with lasting effects.',
  ],
  hyperlane: [
    '{star} lost hyperlane access, cutting regional connections.',
    '{star} was cut off from supply and transit by a hyperlane collapse.',
    '{star} was isolated when local hyperlane routes failed.',
    '{star} lost regional links as the hyperlane collapsed.',
  ],
  crisis: [
    'A crisis hit {star}, and routine governance buckled.',
    '{star} entered emergency conditions under sustained systemic stress.',
    'At {star}, crisis pressure overtook normal policymaking.',
    '{star} was pushed into triage mode by escalating instability.',
  ],
  reform: [
    '{star} rewired institutions to steady a shaken order.',
    'Reforms at {star} aimed to recover day-to-day control.',
    '{star} enacted structural changes to stop policy drift.',
    'Governance at {star} shifted toward repair and consolidation.',
  ],
  prosperity: [
    '{star} entered a growth run across markets and civic systems.',
    'Prosperity expanded at {star}, with confidence and output both rising.',
    '{star} posted a broad upswing in commercial and social stability.',
    'Economic momentum at {star} translated into visible civic gains.',
  ],
  decline: [
    '{star} slipped into decline as institutional capacity thinned.',
    'Decay pressures at {star} eroded earlier gains.',
    '{star} lost strategic tempo under cumulative internal strain.',
    'Governance at {star} weakened as decline spread across sectors.',
  ],
  diplomacy: [
    '{star} redrafted alliances to match a harsher balance of power.',
    'Diplomatic terms around {star} were renegotiated under pressure.',
    '{star} shifted negotiating posture to protect regional leverage.',
    'Around {star}, alliance expectations were reset as trust realigned.',
  ],
  general: [
    'A {eventLabel} event at {star} nudged momentum {direction}.',
    '{star} hit a {eventLabel} turn and the trajectory bent {direction}.',
    '{star} absorbed a {eventLabel} jolt, with results trending {direction}.',
    '{star} moved through a {eventLabel} phase and came out leaning {direction}.',
  ],
  succession: [
    'Rule at {star} passed from {fromDynastName} to {toDynastName} of House {houseName}.',
    '{toDynastName} succeeded {fromDynastName}, keeping House {houseName} in command of {star}.',
    'A succession transfer at {star} elevated {toDynastName} over House {houseName}.',
    '{star} entered a new reign as {toDynastName} replaced {fromDynastName}.',
  ],
  government_transition: [
    'A {endReason} ended {star}\'s {oldGov}. A {newGov} took its place.',
    '{star} flipped from {oldGov} to {newGov} after a {endReason}.',
    'The {oldGov} at {star} fell. A {newGov} now holds power.',
    '{star}\'s political order broke. A {endReason} installed a {newGov}.',
  ],
  religious_conversion: [
    'The faith of {converter} reached {star}. The {oldGov} ended without violence.',
    '{star} joined the Theocracy peacefully, its {oldGov} dissolving under {converter}\'s influence.',
    'No war was needed. {converter}\'s reach brought {star}\'s {oldGov} to a quiet end.',
    'Cultural conversion from {converter} reshaped {star}\'s {oldGov} into a Theocracy.',
  ],
  quiet: [
    'No major rupture hit {star} in this phase.',
    '{star} held steady while larger currents moved elsewhere.',
    'It was a quiet interval for {star}, with no headline disruption.',
    '{star} passed this stretch without a major external shock.',
  ],
  consequence: [
    'The window closed with power trending {powerTrend} and the general confidence at a {stabilityState} level.',
    'Governance held together at a {adminState} level — not the headline, but it mattered.',
    'Underneath the {powerTrend} momentum, the system itself read as {stabilityState}.',
    'The administrative capacity read {adminState}, and the power trend moved {powerTrend}.',
  ],
};

export const QUIET_PHASE_POOLS: Record<string, string[]> = {
  war_active: [
    'the war was still going — it just did not come here this phase',
    'the front held without new fighting, but no one felt the quiet as safety',
    'no fighting reached here, though the knowledge of the war settled over everything',
    'life moved to the rhythm of a war still in progress, even as the fighting stayed elsewhere',
    'the pressure of the unresolved conflict shaped each decision, even when no battle was recorded',
    'the positions froze without new casualties — a pause that offered neither side real relief',
  ],
  trade_active: [
    'merchants and envoys kept things moving while the political calendar went quiet',
    'commerce held its pattern, and the absence of disruption was itself a kind of achievement',
    'the rhythm of trade carried the period — ships came and went, accounts balanced, nothing broke',
    'no crisis arrived to interrupt the usual flow of goods and diplomacy',
    'what the phase lacked in headline events it made up for in the unbroken continuity of trade',
    'the steady traffic of commerce was the most consequential thing that happened — which is to say, nothing much happened at all',
  ],
  neutral: [
    'the phase passed without incident — the routine work of keeping a world running took precedence',
    'earlier disruptions had left things to repair, and the quiet gave room for that',
    'people went about their lives without a defining event to mark the interval — and that, for once, was enough',
    'nothing pushed from outside, and the internal work of governance and recovery continued without interruption',
    'with no new shock arriving, what had been strained found room to settle',
    'the quiet was not emptiness — it was the space in which ordinary life resumed and small repairs got made',
  ],
};

export const ARC_INTRO_PHRASES: Partial<Record<string, string>> = {
  quiet_continuity: 'administrative continuity rather than any defining rupture',
  consolidation: 'deliberate consolidation of earlier gains without new extension',
  expansion: 'outward reach and extending commitments on multiple fronts',
  overreach: 'ambition that began to outpace the available support',
  contested_recovery: 'hard-won recovery contested on multiple fronts simultaneously',
  managed_decline: 'constrained choices accumulating under sustained pressure',
  fragmentation_pressure: 'dispersed pressure with no single organizing shock',
  brittle_prosperity: 'surface-level gains concealing structural fragility beneath',
  institutional_reconfiguration: 'deep institutional change without full downstream stabilization',
  unpredicted_rupture: 'events that defied prior pattern and standard expectation',
};

export function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function fillTemplate(template: string, values: Record<string, string>): string {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return output;
}

export function pickTemplate(
  family: string,
  seed: number,
  starId: string,
  phase: number,
  typeKey: string,
  mode: NarrativeRenderMode
): string {
  const pool = (mode === 'recent'
    ? RECENT_TEMPLATE_POOLS[family]
    : undefined)
    ?? TEMPLATE_POOLS[family]
    ?? TEMPLATE_POOLS.general
    ?? ['{star} recorded a notable event with mixed outcomes.'];
  const hash = stableHash(`${seed}|${starId}|${phase}|${typeKey}|${mode}|${family}`);
  return pool[(hash + (phase % pool.length)) % pool.length]!;
}
