/**
 * Player Feedback System
 * Phase 4: Focus Analysis
 * 
 * Tracks player interaction with stars to determine interest.
 * Used to inform the Tiered Personality System (promoting stars the player looks at).
 */

export interface InteractionEvent {
  starId: string;
  type: 'select' | 'hover' | 'zoom' | 'details';
  timestamp: number;
  duration?: number; // ms
}

export class PlayerFeedbackSystem {
  private interactions: InteractionEvent[] = [];
  private starScores: Map<string, number> = new Map();
  
  // Weights for different actions
  private readonly WEIGHTS = {
    'select': 10,
    'details': 5,
    'hover': 1,
    'zoom': 2
  };

  /**
   * Record a player interaction
   */
  record(starId: string, type: 'select' | 'hover' | 'zoom' | 'details', duration: number = 0) {
    this.interactions.push({
      starId,
      type,
      timestamp: Date.now(),
      duration
    });

    // Update score immediately
    let score = this.WEIGHTS[type];
    if (duration > 0) {
      // Add point per second of focus
      score += Math.floor(duration / 1000);
    }

    const current = this.starScores.get(starId) || 0;
    this.starScores.set(starId, current + score);
    
    // Limit history size
    if (this.interactions.length > 1000) {
      this.interactions.shift();
    }
  }

  /**
   * Get interest score for a star
   */
  getScore(starId: string): number {
    return this.starScores.get(starId) || 0;
  }

  /**
   * Get top N most interesting stars
   */
  getTopStars(count: number): string[] {
    return Array.from(this.starScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(entry => entry[0]);
  }

  /**
   * Clear data (new game)
   */
  clear() {
    this.interactions = [];
    this.starScores.clear();
  }
}

// Global instance
export const feedbackSystem = new PlayerFeedbackSystem();
