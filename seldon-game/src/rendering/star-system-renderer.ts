/**
 * Star System Renderer - Procedural generation of realistic star system visuals
 * Creates unique, deterministic stellar imagery based on star properties
 */

import { Star, Trait, StarType } from '../core/types';
import { SeededRandom } from '../utils/seed-random';
import { STAR_TYPE_PROPERTIES } from '../core/star-properties';
import { Theme } from './theme';

/**
 * Hash a string to a number seed
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a procedural planet name
 */
function generatePlanetName(starName: string, planetIndex: number, rng: SeededRandom): string {
  const prefixes = [
    'New', 'Outer', 'Inner', 'Greater', 'Lesser', 'Alpha', 'Beta', 'Gamma',
    'Prime', 'Proxima', 'Ultima', 'Nova', 'Old', 'Far'
  ];

  const suffixes = [
    'Terra', 'Mundus', 'Haven', 'Reach', 'Hold', 'Watch', 'Rest',
    'Point', 'Station', 'Minor', 'Major', 'Prime', 'Secundus', 'Tertius'
  ];

  // 50% chance to use star name derivative
  if (rng.random() > 0.5) {
    const designation = String.fromCharCode(98 + planetIndex); // b, c, d...
    return `${starName} ${designation}`;
  }

  // Otherwise generate a compound name
  if (rng.random() > 0.3) {
    const prefix = prefixes[rng.randomInt(0, prefixes.length)];
    const suffix = suffixes[rng.randomInt(0, suffixes.length)];
    return `${prefix} ${suffix}`;
  }

  // Or just use suffix
  return suffixes[rng.randomInt(0, suffixes.length)]!;
}

/**
 * Get atmospheric composition based on planet type
 */
function getAtmosphere(type: 'rocky' | 'gas' | 'ice' | 'lava', rng: SeededRandom): string {
  switch (type) {
    case 'lava':
      const lavaAtmos = ['CO₂-rich', 'Sulfuric', 'No atmosphere', 'Volcanic'];
      return lavaAtmos[rng.randomInt(0, lavaAtmos.length)]!;

    case 'gas':
      const gasAtmos = ['H₂-He', 'H₂-CH₄', 'NH₃-rich', 'H₂O clouds'];
      return gasAtmos[rng.randomInt(0, gasAtmos.length)]!;

    case 'ice':
      const iceAtmos = ['N₂-thin', 'CH₄-trace', 'No atmosphere', 'CO-ice'];
      return iceAtmos[rng.randomInt(0, iceAtmos.length)]!;

    case 'rocky':
      const rockyAtmos = ['N₂-O₂', 'CO₂-N₂', 'Thin', 'No atmosphere', 'O₂-rich'];
      return rockyAtmos[rng.randomInt(0, rockyAtmos.length)]!;

    default:
      return 'Unknown';
  }
}

interface Planet {
  orbit: number;
  size: number;
  color: string;
  angle: number;
  type: 'rocky' | 'gas' | 'ice' | 'lava';
  hasMoon: boolean;
  moonAngle?: number;
  name?: string;
  atmosphere?: string;
}

export interface PlanetInventoryEntry {
  orbitIndex: number;
  name: string;
  type: Planet['type'];
}

export interface StarSystemInventory {
  totalPlanets: number;
  byType: Record<Planet['type'], number>;
  planets: PlanetInventoryEntry[];
}

interface AsteroidBelt {
  orbit: number;
  density: number;
}

export class StarSystemRenderer {
  /**
   * Render a procedurally generated star system
   */
  static renderStarSystem(
    ctx: CanvasRenderingContext2D,
    star: Star,
    x: number,
    y: number,
    width: number,
    height: number,
    theme: Theme
  ): void {
    // Split RNG streams so planet registry is stable and reusable outside render order.
    const visualRng = new SeededRandom(hashString(`${star.id}:visual`));
    const systemRng = new SeededRandom(hashString(`${star.id}:system`));

    // Clear area with theme background
    ctx.save();
    ctx.fillStyle = theme.colors.ui.panelBg;
    ctx.fillRect(x, y, width, height);

    // Calculate center and scale
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const scale = Math.min(width, height);

    // Draw deep space background with nebula
    this.drawStarfield(ctx, x, y, width, height, visualRng, theme);
    if (theme.effects.useGradients) {
      this.drawNebula(ctx, x, y, width, height, star, visualRng);
    }

    // Get star type properties
    const starProps = STAR_TYPE_PROPERTIES[star.starType];

    // Generate planets based on star type and traits
    const planets = this.generatePlanets(star, systemRng, theme);
    const asteroidBelts = this.generateAsteroidBelts(star, systemRng);

    // Draw orbits (behind everything)
    ctx.strokeStyle = theme.colors.dimText; // Use theme dimText for orbits
    ctx.lineWidth = 0.5 * theme.effects.lineWidthMultiplier;
    // Lower opacity for orbits unless it's ZX
    if (theme.name !== 'zx') {
      ctx.globalAlpha = 0.15;
    } else {
       // Stippled line for ZX orbits
       ctx.setLineDash([2, 4]); 
    }

    for (const planet of planets) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, planet.orbit * scale * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Reset context
    ctx.globalAlpha = 1.0;
    ctx.setLineDash([]);

    // Draw asteroid belts
    for (const belt of asteroidBelts) {
      this.drawAsteroidBelt(ctx, centerX, centerY, belt.orbit * scale * 0.4, belt.density, systemRng, theme);
    }

    // Draw planets
    for (const planet of planets) {
      this.drawPlanet(ctx, centerX, centerY, planet, scale, theme);
    }

    // Draw the central star (on top, with glow)
    this.drawStar(ctx, centerX, centerY, star, starProps, scale, theme);

    // Draw special features based on traits
    this.drawTraitFeatures(ctx, centerX, centerY, star, scale, visualRng, theme);

    // Draw lens flare effect on the star (only if gradients/glow allowed)
    if (theme.effects.useGradients && theme.effects.enableGlow) {
      this.drawLensFlare(ctx, centerX, centerY, starProps.color, scale);
    }

    // Draw planet labels
    this.drawPlanetLabels(ctx, centerX, centerY, planets, scale, theme);

    // Draw astrophotography overlay (camera info, filters, etc.)
    this.drawAstroOverlay(ctx, x, y, width, height, star, starProps, theme);

    ctx.restore();
  }

  static getSystemInventory(star: Star, theme: Theme): StarSystemInventory {
    const systemRng = new SeededRandom(hashString(`${star.id}:system`));
    const planets = this.generatePlanets(star, systemRng, theme);
    const byType: StarSystemInventory['byType'] = {
      rocky: 0,
      gas: 0,
      ice: 0,
      lava: 0,
    };

    const entries: PlanetInventoryEntry[] = planets.map((planet, index) => {
      byType[planet.type] += 1;
      return {
        orbitIndex: index + 1,
        name: planet.name || `${star.name} ${String.fromCharCode(98 + index)}`,
        type: planet.type,
      };
    });

    return {
      totalPlanets: planets.length,
      byType,
      planets: entries,
    };
  }

  /**
   * Draw background starfield
   */
  private static drawStarfield(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    rng: SeededRandom,
    theme: Theme
  ): void {
    const starCount = theme.name === 'zx' ? 40 : 80; // Fewer stars in ZX
    ctx.fillStyle = theme.name === 'zx' ? '#FFFFFF' : '#ffffff';

    for (let i = 0; i < starCount; i++) {
      const sx = x + rng.random() * width;
      const sy = y + rng.random() * height;
      // ZX stars are just 1px dots usually
      const size = theme.name === 'zx' ? 1 : rng.random() * 1.5; 
      const alpha = theme.name === 'zx' ? 1.0 : (0.3 + rng.random() * 0.6);

      ctx.globalAlpha = alpha;
      ctx.fillRect(sx, sy, size, size);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Generate planets for the system
   */
  private static generatePlanets(star: Star, rng: SeededRandom, theme: Theme): Planet[] {
    const planets: Planet[] = [];

    // Planet count based on star type
    let basePlanetCount = 4;
    if (star.starType === StarType.BlueGiant) basePlanetCount = 2; // Fewer planets
    if (star.starType === StarType.RedDwarf) basePlanetCount = 5; // More planets, closer
    if (star.starType === StarType.YellowDwarf) basePlanetCount = 6; // Sol-like

    // Traits modify planet count
    if (star.traits.includes(Trait.Agrarian)) basePlanetCount -= 1;
    if (star.traits.includes(Trait.Mercantile)) basePlanetCount += 2;

    const planetCount = Math.max(2, Math.min(8, basePlanetCount + rng.randomInt(-1, 2)));

    for (let i = 0; i < planetCount; i++) {
      // Orbital distance (exponential spacing)
      const orbit = 0.2 + Math.pow(i / planetCount, 0.8) * 0.6;

      // Planet size
      const isGasGiant = i > planetCount / 2 && rng.random() > 0.6;
      const size = isGasGiant
        ? 3 + rng.random() * 4
        : 1.5 + rng.random() * 2.5;

      // Planet type based on orbit and star type
      let type: Planet['type'];
      if (orbit < 0.25 && star.starType !== StarType.RedDwarf) {
        type = 'lava'; // Hot inner planets
      } else if (isGasGiant) {
        type = 'gas';
      } else if (orbit > 0.6) {
        type = 'ice'; // Cold outer planets
      } else {
        type = rng.random() > 0.5 ? 'rocky' : 'ice';
      }

      // Planet color based on type
      const color = this.getPlanetColor(type, star, rng, theme);

      // Random starting angle
      const angle = rng.random() * Math.PI * 2;

      // Moon chance
      const hasMoon = size > 2 && rng.random() > 0.6;
      const moonAngle = hasMoon ? rng.random() * Math.PI * 2 : undefined;

      // Generate planet name and atmosphere
      const name = generatePlanetName(star.name, i, rng);
      const atmosphere = getAtmosphere(type, rng);

      planets.push({ orbit, size, color, angle, type, hasMoon, moonAngle, name, atmosphere });
    }

    return planets;
  }

  /**
   * Generate asteroid belts
   */
  private static generateAsteroidBelts(star: Star, rng: SeededRandom): AsteroidBelt[] {
    const belts: AsteroidBelt[] = [];

    // Mercantile systems have asteroid belts (resource-rich)
    if (star.traits.includes(Trait.Mercantile) || rng.random() > 0.7) {
      const orbit = 0.35 + rng.random() * 0.25;
      const density = 30 + rng.randomInt(0, 40);
      belts.push({ orbit, density });
    }

    return belts;
  }

  /**
   * Get planet color based on type
   */
  private static getPlanetColor(type: Planet['type'], _star: Star, rng: SeededRandom, theme: Theme): string {
    const variance = () => rng.randomInt(-20, 20);

    // ZX Palette overrides
    if (theme.name === 'zx') {
        switch (type) {
            case 'rocky': return '#00D700'; // Green
            case 'gas': return '#D700D7';   // Magenta
            case 'ice': return '#00FFFF';   // Cyan
            case 'lava': return '#D70000';  // Red
            default: return '#FFFFFF';
        }
    }

    switch (type) {
      case 'rocky':
        // Browns, grays, tans
        const r = 120 + variance();
        const g = 100 + variance();
        const b = 80 + variance();
        return `rgb(${r}, ${g}, ${b})`;

      case 'gas':
        // Blues, oranges, beiges (Jupiter/Saturn-like)
        if (rng.random() > 0.5) {
          // Blue gas giant
          return `rgb(${140 + variance()}, ${160 + variance()}, ${200 + variance()})`;
        } else {
          // Orange/tan gas giant
          return `rgb(${200 + variance()}, ${170 + variance()}, ${130 + variance()})`;
        }

      case 'ice':
        // Pale blues, whites
        const iceBase = 180 + variance();
        return `rgb(${iceBase}, ${iceBase + 10}, ${iceBase + 30})`;

      case 'lava':
        // Reds, oranges
        return `rgb(${200 + variance()}, ${80 + variance()}, ${40 + variance()})`;

      default:
        return '#888888';
    }
  }

  /**
   * Draw the central star
   */
  private static drawStar(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    star: Star,
    starProps: any,
    scale: number,
    theme: Theme
  ): void {
    // Star size based on type
    let starSize = scale * 0.08 * theme.effects.starSizeMultiplier;
    if (star.starType === StarType.BlueGiant) starSize *= 1.8;
    if (star.starType === StarType.RedGiant) starSize *= 2.2;
    if (star.starType === StarType.RedDwarf) starSize *= 0.6;
    if (star.starType === StarType.WhiteDwarf) starSize *= 0.4;
    if (star.starType === StarType.Binary) starSize *= 0.8;

    // Get color from star properties or theme override
    const starColor = theme.colors.starColors[star.starType] || starProps.color;

    // ZX Mode: Simple solid circle or concentric rings
    if (theme.name === 'zx' || !theme.effects.useGradients) {
        ctx.fillStyle = starColor;
        ctx.beginPath();
        ctx.arc(centerX, centerY, starSize, 0, Math.PI * 2);
        ctx.fill();

        // Optional: Dither/Stipple effect for larger stars? 
        // For now, just a solid circle.
        
        // Binary star indicator (second circle)
        if (star.starType === StarType.Binary) {
             ctx.beginPath();
             ctx.arc(centerX + starSize * 0.5, centerY, starSize * 0.6, 0, Math.PI * 2);
             ctx.fill();
        }
        return;
    }

    // Modern Mode: Gradients and glows
    // Draw outer glow (corona)
    if (theme.effects.enableGlow) {
        const coronaLayers = 4;
        for (let i = coronaLayers; i >= 1; i--) {
        const glowRadius = starSize * (1 + i * 0.4);
        const gradient = ctx.createRadialGradient(
            centerX, centerY, starSize * 0.5,
            centerX, centerY, glowRadius
        );

        const alpha = 0.15 / i;
        gradient.addColorStop(0, this.addAlpha(starColor, alpha * 2));
        gradient.addColorStop(1, this.addAlpha(starColor, 0));

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
        ctx.fill();
        }
    }

    // Draw main star body with gradient
    const starGradient = ctx.createRadialGradient(
      centerX - starSize * 0.2, centerY - starSize * 0.2, starSize * 0.1,
      centerX, centerY, starSize
    );

    // Bright core
    starGradient.addColorStop(0, '#ffffff');
    starGradient.addColorStop(0.3, this.lightenColor(starColor, 0.8));
    starGradient.addColorStop(0.7, starColor);
    starGradient.addColorStop(1, this.darkenColor(starColor, 0.3));

    ctx.fillStyle = starGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, starSize, 0, Math.PI * 2);
    ctx.fill();

    // Add surface detail for larger stars
    if (star.starType === StarType.RedGiant || star.starType === StarType.YellowDwarf) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = this.darkenColor(starColor, 0.4);

      // Sunspots/surface features
      const rng = new SeededRandom(hashString(star.id + '_surface'));
      const featureCount = 3 + rng.randomInt(0, 4);
      for (let i = 0; i < featureCount; i++) {
        const angle = rng.random() * Math.PI * 2;
        const dist = rng.random() * starSize * 0.6;
        const fx = centerX + Math.cos(angle) * dist;
        const fy = centerY + Math.sin(angle) * dist;
        const fsize = starSize * (0.1 + rng.random() * 0.15);

        ctx.beginPath();
        ctx.arc(fx, fy, fsize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Intense glow for binary systems
    if (star.starType === StarType.Binary && theme.effects.enableGlow) {
      ctx.save();
      ctx.shadowBlur = 30;
      ctx.shadowColor = starColor;
      ctx.strokeStyle = starColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, starSize * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Draw a planet
   */
  private static drawPlanet(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    planet: Planet,
    scale: number,
    theme: Theme
  ): void {
    // Calculate position
    const orbitRadius = planet.orbit * scale * 0.4;
    const px = centerX + Math.cos(planet.angle) * orbitRadius;
    const py = centerY + Math.sin(planet.angle) * orbitRadius;
    const size = planet.size * scale * 0.012 * theme.effects.starSizeMultiplier;

    // ZX Mode: Simple solid circle
    if (theme.name === 'zx' || !theme.effects.useGradients) {
        ctx.fillStyle = planet.color;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();

        // Rings (simple line)
        if (planet.type === 'gas' && planet.size > 4) {
             ctx.strokeStyle = planet.color;
             ctx.lineWidth = 1;
             ctx.beginPath();
             ctx.ellipse(px, py, size * 2, size * 0.5, 0, 0, Math.PI * 2);
             ctx.stroke();
        }
        
        // Moon
        if (planet.hasMoon && planet.moonAngle !== undefined) {
             const moonDist = size * 2.5;
             const mx = px + Math.cos(planet.moonAngle) * moonDist;
             const my = py + Math.sin(planet.moonAngle) * moonDist;
             ctx.fillStyle = '#FFFFFF';
             ctx.beginPath();
             ctx.arc(mx, my, size * 0.3, 0, Math.PI * 2);
             ctx.fill();
        }
        return;
    }

    // Modern Mode
    // Draw planet with gradient (sphere effect)
    const planetGradient = ctx.createRadialGradient(
      px - size * 0.3, py - size * 0.3, size * 0.1,
      px, py, size
    );

    planetGradient.addColorStop(0, this.lightenColor(planet.color, 0.6));
    planetGradient.addColorStop(0.6, planet.color);
    planetGradient.addColorStop(1, this.darkenColor(planet.color, 0.5));

    ctx.fillStyle = planetGradient;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();

    // Add subtle atmosphere for gas giants
    if (planet.type === 'gas') {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = this.lightenColor(planet.color, 0.4);
      ctx.lineWidth = size * 0.15;
      ctx.beginPath();
      ctx.arc(px, py, size * 1.1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Draw rings for some gas giants
    if (planet.type === 'gas' && planet.size > 4) {
      this.drawPlanetaryRings(ctx, px, py, size);
    }

    // Draw moon if present
    if (planet.hasMoon && planet.moonAngle !== undefined) {
      const moonDist = size * 2.5;
      const mx = px + Math.cos(planet.moonAngle) * moonDist;
      const my = py + Math.sin(planet.moonAngle) * moonDist;
      const moonSize = size * 0.3;

      ctx.fillStyle = '#888888';
      ctx.beginPath();
      ctx.arc(mx, my, moonSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Draw planetary rings
   */
  private static drawPlanetaryRings(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    planetSize: number
  ): void {
    ctx.save();
    ctx.globalAlpha = 0.7;

    const ringInner = planetSize * 1.4;
    const ringOuter = planetSize * 2;

    // Create gradient for rings
    const gradient = ctx.createRadialGradient(x, y, ringInner, x, y, ringOuter);
    gradient.addColorStop(0, 'rgba(180, 160, 140, 0.8)');
    gradient.addColorStop(0.3, 'rgba(200, 180, 160, 0.6)');
    gradient.addColorStop(0.6, 'rgba(160, 140, 120, 0.4)');
    gradient.addColorStop(1, 'rgba(140, 120, 100, 0.2)');

    ctx.fillStyle = gradient;

    // Draw elliptical rings (viewed at angle)
    ctx.beginPath();
    ctx.ellipse(x, y, ringOuter, ringOuter * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cut out inner part
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(x, y, ringInner, ringInner * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  /**
   * Draw asteroid belt
   */
  private static drawAsteroidBelt(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    density: number,
    rng: SeededRandom,
    theme: Theme
  ): void {
    ctx.fillStyle = theme.name === 'zx' ? '#FFFFFF' : 'rgba(140, 120, 100, 0.6)';

    for (let i = 0; i < density; i++) {
      const angle = rng.random() * Math.PI * 2;
      const dist = radius + (rng.random() - 0.5) * radius * 0.15;
      const ax = centerX + Math.cos(angle) * dist;
      const ay = centerY + Math.sin(angle) * dist;
      const size = (0.5 + rng.random() * 1.5) * theme.effects.starSizeMultiplier;

      if (theme.name !== 'zx') {
         ctx.globalAlpha = 0.4 + rng.random() * 0.4;
      }
      ctx.fillRect(ax, ay, size, size);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Draw special features based on star traits
   */
  private static drawTraitFeatures(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    star: Star,
    scale: number,
    rng: SeededRandom,
    theme: Theme
  ): void {
    const time = Date.now() * 0.001; // Local animation time

    // Militaristic: Defense stations
    if (star.traits.includes(Trait.Militaristic)) {
      const stationCount = 3 + rng.randomInt(0, 3);
      ctx.strokeStyle = theme.name === 'zx' ? theme.colors.war : 'rgba(255, 80, 80, 0.8)';
      ctx.fillStyle = theme.name === 'zx' ? theme.colors.war : 'rgba(200, 60, 60, 0.9)';
      const orbitDist = scale * 0.35;

      for (let i = 0; i < stationCount; i++) {
        const angle = (i / stationCount) * Math.PI * 2 + (time * 0.1); // Slow rotation
        const sx = centerX + Math.cos(angle) * orbitDist;
        const sy = centerY + Math.sin(angle) * orbitDist;

        if (theme.name === 'zx') {
            // ZX: "X" markers
            const size = 4;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx - size, sy - size);
            ctx.lineTo(sx + size, sy + size);
            ctx.moveTo(sx + size, sy - size);
            ctx.lineTo(sx - size, sy + size);
            ctx.stroke();
        } else {
            // Modern: Shield stations
            ctx.fillRect(sx - 2, sy - 2, 4, 4);
            ctx.beginPath();
            ctx.arc(sx, sy, 6, 0, Math.PI * 2);
            ctx.stroke();
        }
      }
    }

    // Ambitious: Ships in orbit
    if (star.traits.includes(Trait.Ambitious)) {
      const shipCount = 4 + rng.randomInt(0, 4);
      ctx.strokeStyle = theme.name === 'zx' ? theme.colors.accent : 'rgba(80, 200, 255, 0.7)';
      ctx.lineWidth = 1.5;

      for (let i = 0; i < shipCount; i++) {
        const angle = rng.random() * Math.PI * 2 + (time * 0.2 * (i % 2 === 0 ? 1 : -1));
        const dist = scale * (0.15 + rng.random() * 0.15);
        const sx = centerX + Math.cos(angle) * dist;
        const sy = centerY + Math.sin(angle) * dist;

        if (theme.name === 'zx') {
            // ZX: Pixel Arrow
            ctx.beginPath();
            // Pointing in direction of orbit (tangent)
            const dir = angle + Math.PI / 2; 
            const headLen = 5;
            ctx.moveTo(sx + Math.cos(dir) * headLen, sy + Math.sin(dir) * headLen);
            ctx.lineTo(sx + Math.cos(dir + 2.5) * headLen, sy + Math.sin(dir + 2.5) * headLen);
            ctx.moveTo(sx + Math.cos(dir) * headLen, sy + Math.sin(dir) * headLen);
            ctx.lineTo(sx + Math.cos(dir - 2.5) * headLen, sy + Math.sin(dir - 2.5) * headLen);
            ctx.stroke();
        } else {
            // Modern: Sleek ship
            ctx.beginPath();
            ctx.moveTo(sx - 3, sy);
            ctx.lineTo(sx + 3, sy);
            ctx.stroke();
        }
      }
    }

    // Industrial: Orbital structures
    if (star.traits.includes(Trait.Industrial)) {
      const structureCount = 3 + rng.randomInt(0, 2);
      ctx.strokeStyle = theme.name === 'zx' ? theme.colors.tradeRoute : 'rgba(200, 180, 100, 0.8)';
      ctx.fillStyle = theme.name === 'zx' ? '#000' : 'rgba(200, 180, 100, 0.2)';
      ctx.lineWidth = 1;
      const orbitDist = scale * 0.28;

      for (let i = 0; i < structureCount; i++) {
        const angle = (i / structureCount) * Math.PI * 2 + Math.PI / 4;
        const sx = centerX + Math.cos(angle) * orbitDist;
        const sy = centerY + Math.sin(angle) * orbitDist;

        if (theme.name === 'zx') {
            // ZX: Hollow squares
            ctx.strokeRect(sx - 4, sy - 4, 8, 8);
        } else {
            // Modern: Filled platforms
            ctx.fillRect(sx - 5, sy - 5, 10, 10);
            ctx.strokeRect(sx - 5, sy - 5, 10, 10);
            // Connect to center?
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(sx, sy);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }
      }
    }

    // Mercantile: Trade Hubs
    if (star.traits.includes(Trait.Mercantile)) {
        const hubCount = 2;
        ctx.strokeStyle = theme.name === 'zx' ? theme.colors.ui.success : 'rgba(100, 255, 100, 0.6)';
        const orbitDist = scale * 0.45;
        
        for (let i = 0; i < hubCount; i++) {
            const angle = (i / hubCount) * Math.PI * 2 + (time * -0.05);
            const sx = centerX + Math.cos(angle) * orbitDist;
            const sy = centerY + Math.sin(angle) * orbitDist;

            if (theme.name === 'zx') {
                // ZX: Diamond shape
                ctx.beginPath();
                ctx.moveTo(sx, sy - 5);
                ctx.lineTo(sx + 5, sy);
                ctx.lineTo(sx, sy + 5);
                ctx.lineTo(sx - 5, sy);
                ctx.closePath();
                ctx.stroke();
            } else {
                // Modern: Double circle
                ctx.beginPath();
                ctx.arc(sx, sy, 6, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(sx, sy, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Scholarly: Research Stations
    if (star.traits.includes(Trait.Scholarly)) {
        // High polar orbit
        const angle = time * 0.15;
        const orbitDist = scale * 0.2; // Close orbit
        const sx = centerX + Math.cos(angle) * orbitDist;
        const sy = centerY + Math.sin(angle) * orbitDist;
        
        ctx.strokeStyle = theme.name === 'zx' ? theme.colors.text : 'rgba(200, 200, 255, 0.9)';

        if (theme.name === 'zx') {
            // ZX: Plus sign
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx - 4, sy);
            ctx.lineTo(sx + 4, sy);
            ctx.moveTo(sx, sy - 4);
            ctx.lineTo(sx, sy + 4);
            ctx.stroke();
        } else {
            // Modern: Atom symbol
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(sx, sy, 8, 3, angle * 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(sx, sy, 8, 3, angle * 2 + Math.PI/2, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
  }

  /**
   * Draw nebula background for astrophotography feel
   */
  private static drawNebula(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    star: Star,
    rng: SeededRandom
  ): void {
    // Different nebula colors based on star type
    let nebulaHue = 240; // Blue default
    if (star.starType === StarType.RedGiant || star.starType === StarType.RedDwarf) {
      nebulaHue = 0; // Red/orange
    } else if (star.starType === StarType.YellowDwarf) {
      nebulaHue = 280; // Purple/pink
    } else if (star.starType === StarType.BlueGiant) {
      nebulaHue = 200; // Cyan
    }

    // Draw multiple nebula clouds
    const cloudCount = 2 + rng.randomInt(0, 2);
    ctx.globalCompositeOperation = 'screen';

    for (let i = 0; i < cloudCount; i++) {
      const cloudX = x + rng.random() * width;
      const cloudY = y + rng.random() * height;
      const cloudSize = Math.max(width, height) * (0.4 + rng.random() * 0.6);

      const gradient = ctx.createRadialGradient(
        cloudX, cloudY, 0,
        cloudX, cloudY, cloudSize
      );

      const hueVariance = rng.randomInt(-30, 30);
      const adjustedHue = (nebulaHue + hueVariance + 360) % 360;

      gradient.addColorStop(0, `hsla(${adjustedHue}, 70%, 30%, 0.15)`);
      gradient.addColorStop(0.4, `hsla(${adjustedHue}, 60%, 20%, 0.08)`);
      gradient.addColorStop(1, `hsla(${adjustedHue}, 50%, 10%, 0)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, width, height);
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Draw lens flare effect
   */
  private static drawLensFlare(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    starColor: string,
    scale: number
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Main flare spikes (4 directional)
    const spikeLength = scale * 0.25;
    const spikeWidth = 2;

    ctx.strokeStyle = starColor;
    ctx.lineWidth = spikeWidth;
    ctx.globalAlpha = 0.4;

    // Vertical spike
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - spikeLength);
    ctx.lineTo(centerX, centerY + spikeLength);
    ctx.stroke();

    // Horizontal spike
    ctx.beginPath();
    ctx.moveTo(centerX - spikeLength, centerY);
    ctx.lineTo(centerX + spikeLength, centerY);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw planet labels
   */
  private static drawPlanetLabels(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    planets: Planet[],
    scale: number,
    theme: Theme
  ): void {
    ctx.save();
    const fontSize = Math.floor(10 * theme.effects.fontSizeMultiplier);
    ctx.font = `${fontSize}px ${theme.effects.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = theme.colors.dimText;

    for (const planet of planets) {
        if (!planet.name) continue;

        const orbitRadius = planet.orbit * scale * 0.4;
        const px = centerX + Math.cos(planet.angle) * orbitRadius;
        const py = centerY + Math.sin(planet.angle) * orbitRadius;
        const size = planet.size * scale * 0.012;

        // Show name on hover? Or just show all names?
        // For now, let's show names for larger planets or randomly to avoid clutter
        // Or show all names but small
        
        // Simple label below planet
        ctx.fillText(planet.name, px, py - size - 4);
    }
    ctx.restore();
  }

  /**
   * Draw astrophotography overlay
   */
  private static drawAstroOverlay(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    star: Star,
    starProps: any,
    theme: Theme
  ): void {
    ctx.save();
    const fontSize = Math.floor(12 * theme.effects.fontSizeMultiplier);
    ctx.font = `${fontSize}px ${theme.effects.font}`;
    ctx.fillStyle = theme.colors.dimText;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    const padding = 10;
    const rightEdge = x + width - padding;
    const topEdge = y + padding;

    // Technical readout style
    ctx.fillText(`TARGET: ${star.name.toUpperCase()}`, rightEdge, topEdge);
    ctx.fillText(`TYPE: ${starProps.name.toUpperCase()}`, rightEdge, topEdge + 15);
    const luminosity = (starProps.glowIntensity * 10).toFixed(2);
    ctx.fillText(`MAGNITUDE: ${luminosity}`, rightEdge, topEdge + 30);
    
    // Crosshairs
    ctx.strokeStyle = theme.colors.dimText;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    
    // Corner brackets
    const bracketSize = 20;
    
    // Top-left
    ctx.beginPath();
    ctx.moveTo(x + padding, y + padding + bracketSize);
    ctx.lineTo(x + padding, y + padding);
    ctx.lineTo(x + padding + bracketSize, y + padding);
    ctx.stroke();
    
    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + width - padding - bracketSize, y + padding);
    ctx.lineTo(x + width - padding, y + padding);
    ctx.lineTo(x + width - padding, y + padding + bracketSize);
    ctx.stroke();
    
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x + padding, y + height - padding - bracketSize);
    ctx.lineTo(x + padding, y + height - padding);
    ctx.lineTo(x + padding + bracketSize, y + height - padding);
    ctx.stroke();
    
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + width - padding - bracketSize, y + height - padding);
    ctx.lineTo(x + width - padding, y + height - padding);
    ctx.lineTo(x + width - padding, y + height - padding - bracketSize);
    ctx.stroke();

    ctx.restore();
  }

  // Color helpers (duplicated from GalaxyRenderer, ideally should be in utils)
  private static hexToRgb(hex: string): string | undefined {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return undefined;
    const r = result[1] || '00';
    const g = result[2] || '00';
    const b = result[3] || '00';
    return `${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}`;
  }

  private static addAlpha(hex: string, alpha: number): string {
    return `rgba(${this.hexToRgb(hex)}, ${alpha})`;
  }

  private static lightenColor(hex: string, percent: number): string {
    const rgbStr = this.hexToRgb(hex);
    if (!rgbStr) return hex;
    const rgb = rgbStr.split(',').map(Number);
    if (rgb.length < 3) return hex;
    
    const r = Math.min(255, Math.floor((rgb[0] || 0) + (255 - (rgb[0] || 0)) * percent));
    const g = Math.min(255, Math.floor((rgb[1] || 0) + (255 - (rgb[1] || 0)) * percent));
    const b = Math.min(255, Math.floor((rgb[2] || 0) + (255 - (rgb[2] || 0)) * percent));
    return `rgb(${r}, ${g}, ${b})`;
  }

  private static darkenColor(hex: string, percent: number): string {
    const rgbStr = this.hexToRgb(hex);
    if (!rgbStr) return hex;
    const rgb = rgbStr.split(',').map(Number);
    if (rgb.length < 3) return hex;
    
    const r = Math.max(0, Math.floor((rgb[0] || 0) * (1 - percent)));
    const g = Math.max(0, Math.floor((rgb[1] || 0) * (1 - percent)));
    const b = Math.max(0, Math.floor((rgb[2] || 0) * (1 - percent)));
    return `rgb(${r}, ${g}, ${b})`;
  }
}
