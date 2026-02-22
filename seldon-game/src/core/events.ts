import { GalaxyState, GalacticEvent, EventType } from './types';
import { SeededRandom } from '../utils/seed-random';

/**
 * Event Manager
 * Phase 7: Galactic Events
 * Handles generation and management of galaxy-wide events like Trade Booms, Plagues, etc.
 */
export class EventManager {
  private rng: SeededRandom;

  constructor(seed: number) {
    this.rng = new SeededRandom(seed);
  }

  /**
   * Check for new events to spawn
   */
  public generateEvents(galaxy: GalaxyState): GalacticEvent[] {
    const newEvents: GalacticEvent[] = [];
    
    // Chance for a new event: 5% per phase (approx once every 20 phases)
    if (this.rng.random() < 0.05) {
      const eventType = this.selectEventType();
      const event = this.createEvent(galaxy, eventType);
      if (event) {
        newEvents.push(event);
      }
    }

    return newEvents;
  }

  /**
   * Select a random event type based on weights
   */
  private selectEventType(): EventType {
    const roll = this.rng.random();
    if (roll < 0.25) return EventType.TradeBoom;
    if (roll < 0.45) return EventType.Plague;
    if (roll < 0.65) return EventType.TechBreakthrough;
    if (roll < 0.80) return EventType.DiplomaticIncident;
    if (roll < 0.90) return EventType.StellarFlare;
    if (roll < 0.95) return EventType.HyperlaneCollapse;
    return EventType.PirateRaid;
  }

  /**
   * Create a specific event instance
   */
  private createEvent(galaxy: GalaxyState, type: EventType): GalacticEvent | null {
    const stars = Array.from(galaxy.stars.values());
    if (stars.length === 0) return null;

    // Pick a primary target
    const targetStar = stars[Math.floor(this.rng.random() * stars.length)];
    const targetStar2 = stars[Math.floor(this.rng.random() * stars.length)];
    
    if (!targetStar || !targetStar2) return null;

    const id = `evt-${galaxy.phase}-${Math.floor(this.rng.random() * 10000)}`;
    let event: GalacticEvent | null = null;
    
    switch (type) {
      case EventType.TradeBoom:
        event = {
          id,
          type,
          title: 'Trade Boom',
          description: `${targetStar.name} is experiencing a surge in economic activity due to new trade routes.`,
          startPhase: galaxy.phase,
          duration: 10 + Math.floor(this.rng.random() * 10),
          targetStarIds: [targetStar.id],
          severity: 'low',
          resolved: false
        };
        break;

      case EventType.Plague:
        event = {
          id,
          type,
          title: 'Interstellar Plague',
          description: `A mysterious pathogen has broken out in ${targetStar.name}, causing mass casualties.`,
          startPhase: galaxy.phase,
          duration: 5 + Math.floor(this.rng.random() * 5), // Short but deadly
          targetStarIds: [targetStar.id],
          severity: 'critical', // Plague is critical
          resolved: false
        };
        break;

      case EventType.TechBreakthrough:
        event = {
          id,
          type,
          title: 'Technological Breakthrough',
          description: `Scientists on ${targetStar.name} have made a significant discovery that boosts efficiency.`,
          startPhase: galaxy.phase,
          duration: 20,
          targetStarIds: [targetStar.id],
          severity: 'medium',
          resolved: false
        };
        break;

      case EventType.DiplomaticIncident:
         if (targetStar.id === targetStar2.id) {
            event = null;
         } else {
             event = {
              id,
              type,
              title: 'Diplomatic Incident',
              description: `Tensions have risen between ${targetStar.name} and ${targetStar2.name} over border disputes.`,
              startPhase: galaxy.phase,
              duration: 5 + Math.floor(this.rng.random() * 5),
              targetStarIds: [targetStar.id, targetStar2.id],
              severity: 'medium',
              resolved: false
            };
         }
         break;

      case EventType.StellarFlare:
        event = {
          id,
          type,
          title: 'Stellar Flare',
          description: `Massive solar activity in ${targetStar.name} system is disrupting communications and travel.`,
          startPhase: galaxy.phase,
          duration: 3 + Math.floor(this.rng.random() * 3),
          targetStarIds: [targetStar.id],
          severity: 'medium',
          resolved: false
        };
        break;

      case EventType.HyperlaneCollapse:
        event = {
          id,
          type,
          title: 'Hyperlane Collapse',
          description: `Subspace routes to ${targetStar.name} have become unstable, isolating the system.`,
          startPhase: galaxy.phase,
          duration: 8 + Math.floor(this.rng.random() * 8),
          targetStarIds: [targetStar.id],
          severity: 'high',
          resolved: false
        };
        break;

      case EventType.PirateRaid:
        event = {
          id,
          type,
          title: 'Pirate Raid',
          description: `Space pirates are raiding trade convoys near ${targetStar.name}.`,
          startPhase: galaxy.phase,
          duration: 4 + Math.floor(this.rng.random() * 4),
          targetStarIds: [targetStar.id],
          severity: 'low',
          resolved: false
        };
        break;
    }

    // Log history if event created
    if (event) {
        for (const starId of event.targetStarIds) {
            const star = galaxy.stars.get(starId);
            if (star) {
                star.history.push({
                    type: event.type,
                    phase: galaxy.phase,
                    description: event.description,
                    relatedStars: event.targetStarIds.filter(id => id !== starId)
                });
            }
        }
    }

    return event;
  }

  /**
   * Apply effects of active events to the galaxy state
   */
  public applyEventEffects(galaxy: GalaxyState) {
    // 1. Mark expired events as resolved
    for (const event of galaxy.events) {
      if (!event.resolved && galaxy.phase >= event.startPhase + event.duration) {
        event.resolved = true;
        // Log resolution
        for (const starId of event.targetStarIds) {
          const star = galaxy.stars.get(starId);
          if (star) {
            star.history.push({
              type: event.type, // Re-use type or add a 'resolved' suffix? Keeping type makes it easier to filter, but description should clarify
              phase: galaxy.phase,
              description: `${event.title} has ended.`,
              relatedStars: event.targetStarIds.filter(id => id !== starId)
            });
          }
        }
      }
    }

    // 2. Apply active effects
    // NOTE: star.strength AND star.power are both recalculated from population every phase
    // by applyGrowth + calculateAllPowers. Any write to star.strength is overwritten on the
    // next phase. All persistent effects MUST target star.infrastructureDamage (read as input
    // by applyGrowth's governanceFactor and I term, so it survives recalculation) or
    // star.administrativeTech / star.decadence.
    for (const event of galaxy.events) {
        if (event.resolved) continue;

        switch (event.type) {
            case EventType.TradeBoom:
                // Economic boom repairs supply chains — small infrastructure recovery per phase.
                // Negative damage = repair. Clamped to 0 in applyInfrastructureDamage.
                this.applyInfrastructureDamage(galaxy, event.targetStarIds, -0.01);
                break;
            case EventType.Plague:
                // Demographic and infrastructure collapse; population shock handled by applyGrowth.
                // Infrastructure damage reduces K and governanceFactor persistently.
                this.applyInfrastructureDamage(galaxy, event.targetStarIds, 0.03);
                break;
            case EventType.TechBreakthrough:
                // Small ongoing admin efficiency gain
                this.applyAdminTechModifier(galaxy, event.targetStarIds, 0.005);
                break;
            case EventType.StellarFlare:
                // Stellar radiation disrupts logistics networks and surface infrastructure.
                // Infrastructure damage persists after the event, representing repair backlogs.
                this.applyInfrastructureDamage(galaxy, event.targetStarIds, 0.05);
                break;
            case EventType.PirateRaid:
                // Pirates raid convoys and outposts — gradual infrastructure attrition.
                this.applyInfrastructureDamage(galaxy, event.targetStarIds, 0.012);
                break;
            case EventType.HyperlaneCollapse:
                // Isolation: supply disruption damages infrastructure each phase.
                this.applyInfrastructureDamage(galaxy, event.targetStarIds, 0.02);
                break;
            case EventType.DiplomaticIncident:
                // Tensions reduce loyalty between the two involved stars.
                // Implemented as a direct loyalty nudge on each target toward the other.
                this.applyDiplomaticPressure(galaxy, event.targetStarIds);
                break;
        }
    }
  }

  private applyAdminTechModifier(galaxy: GalaxyState, starIds: string[], amount: number) {
    for (const id of starIds) {
      const star = galaxy.stars.get(id);
      if (star) {
        star.administrativeTech = (star.administrativeTech || 1.0) + amount;
      }
    }
  }

  private applyInfrastructureDamage(galaxy: GalaxyState, starIds: string[], amount: number) {
    for (const id of starIds) {
      const star = galaxy.stars.get(id);
      if (star) {
        star.infrastructureDamage = Math.max(0, Math.min(1, (star.infrastructureDamage || 0) + amount));
      }
    }
  }

  private applyDiplomaticPressure(galaxy: GalaxyState, starIds: string[]) {
    // Each star in the incident loses a small amount of loyalty toward the other party.
    // If either is currently a subject of the other, the incident seeds future revolt.
    if (starIds.length < 2) return;
    for (const id of starIds) {
      const star = galaxy.stars.get(id);
      if (star) {
        star.loyalty = Math.max(-1.0, (star.loyalty || 0) - 0.05);
      }
    }
  }
}
