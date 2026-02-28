export type EncyclopediaEventCategoryKey =
  | 'all'
  | 'war'
  | 'crisis'
  | 'rebellion'
  | 'plague'
  | 'leader'
  | 'succession';

export function mapEventTypeToEncyclopediaCategory(eventTypeRaw: string): EncyclopediaEventCategoryKey {
  const eventType = eventTypeRaw.toLowerCase();
  if (eventType.includes('war') || eventType.includes('conquest') || eventType.includes('peace')) return 'war';
  if (eventType.includes('crisis') || eventType.includes('anarchy') || eventType.includes('mule') || eventType.includes('external')) return 'crisis';
  if (eventType.includes('rebellion') || eventType.includes('revolution') || eventType.includes('liberation') || eventType.includes('collapse')) return 'rebellion';
  if (eventType.includes('plague')) return 'plague';
  if (eventType.includes('leader') || eventType.includes('great-person') || eventType.includes('dynasty')) return 'leader';
  if (eventType.includes('succession')) return 'succession';
  return 'all';
}

export function eventMatchesCategory(
  eventTypeRaw: string,
  category: EncyclopediaEventCategoryKey
): boolean {
  if (category === 'all') return true;
  return mapEventTypeToEncyclopediaCategory(eventTypeRaw) === category;
}
