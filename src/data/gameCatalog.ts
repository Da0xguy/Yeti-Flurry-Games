import type {
  ArenaMapSpec,
  ArenaObstacle,
  CareerQuest,
  GameModeId,
  GameModeSpec,
  MapId,
  YetiColorId,
  YetiColorway,
} from '../types';

export const ARENA_W = 2400;
export const ARENA_H = 1600;
export const ARENA_CENTER_X = ARENA_W / 2;
export const ARENA_CENTER_Y = ARENA_H / 2;
export const ARENA_INITIAL_RING_RADIUS = 740;
export const WELL_RITUAL_RADIUS = 135;

export const RACE_BOUNDS = {
  minX: ARENA_CENTER_X - 1950,
  maxX: ARENA_CENTER_X + 1950,
  minY: ARENA_CENTER_Y - 1950,
  maxY: ARENA_CENTER_Y + 1950,
};

export const GAME_MODES: GameModeSpec[] = [
  {
    id: 'survival',
    dimension: '3D',
    name: 'Arcade Survival',
    shortLabel: 'Survival 3D',
    subtitle: '5-Yeti Squad · Monster Ambush · 3 Waystones · Escape Gate',
    description:
      'Embark with a 5-Yeti squad! Fight off attacking Frost Stalkers, Brutes, and Abyssal Wraiths, awaken 3 Waystone Relics, and reach the Escape Portal alive.',
    controlsSummary: 'WASD / Arrows move · Space Dash · Click / J Throw · K Sword · 1/E Wave · 2/F Dance',
    supportsTunnel: true,
  },
  {
    id: 'car_racing',
    dimension: '3D',
    name: 'Snow Drifter Racing',
    shortLabel: 'Buggy 3D',
    subtitle: '3-Lap Beach Buggy Circuit · 4 Checkpoints · Track Power-Ups',
    description:
      'Tear down sweeping Beach-Buggy style coastal sweepers, canyon hairpins, and alpine straightaways. Hit Checkpoints 1–4, boost pads, and track power-up orbs over 3 laps.',
    controlsSummary: 'W / Up Throttle · A / D Steer · S / Down Brake · Space Nitro Boost',
    supportsTunnel: true,
  },
  {
    id: 'shooting',
    dimension: '3D',
    name: 'Frost Fire',
    shortLabel: 'Shooter 3D',
    subtitle: 'Wave Combat · Cryo Drones · Tri-Blaster & Frost Nova',
    description:
      'Aim your 3D Frost Blaster across the vast open arena to shatter Cryo Drones, spinning Ice Bullseyes, and rival Yeti sharpshooters while grabbing combat power-ups.',
    controlsSummary: 'WASD / Arrows Strafe · Mouse Aim · Click / J Rapid Fire · Space Frost Nova',
    supportsTunnel: false,
  },
  {
    id: 'stickman_wrestling',
    dimension: '2D',
    name: 'Shadow Bean: Level Raid',
    shortLabel: 'Bean Raid 2D',
    subtitle: 'Killer Bean Action · Twin Pistols · Slow-Mo Dive · Exit Gate',
    description:
      'Blast and gun-fu your way across 3 fortified compound stages as Lofi Bean! Fire twin pistols, dive in slow-motion over enemy tracers, shatter explosive barrels, and reach the Extraction Gate.',
    controlsSummary: 'A / D Move · W Jump (x2) · S Slide · J Twin Pistols · K Spin Kick · Space Slow-Mo Dive · L Super Shot',
    supportsTunnel: false,
  },
  {
    id: 'stickman_brawl',
    dimension: '2D',
    name: 'Frost Station Escape',
    shortLabel: 'Room Escape 2D',
    subtitle: 'Side-View Mystery · Search Rooms · Find Clues · Unlock Doors',
    description:
      'Explore interconnected station rooms in a side-view 2D cutaway! Search Cafeteria, Medbay, Lab, Reactor & Electrical for hidden Clues to unlock sealed doors, dodge vent Imposters, and escape through the Airlock.',
    controlsSummary: 'WASD / Arrows Move · E / J Inspect Clue or Stun · K Cryo Taser · Space Sprint · L Clue Radar',
    supportsTunnel: false,
  },
  {
    id: 'stickman_run',
    dimension: '2D',
    name: 'Stickman Glacier Run',
    shortLabel: 'Glacier Run 2D',
    subtitle: 'Fast 2D Platform Runner · Slide · Double Jump · Blasts',
    description:
      'Sprint as 2D Stickman Lofi across crumbling frozen cliffs, slide under icicle volleys, shatter ice crates with snowballs, and rack up Glacial Drops & Combo multipliers.',
    controlsSummary: 'W / Up / Space Jump (x2) · S / Down Slide · J Snowball Blast',
    supportsTunnel: false,
  },
];

export function getGameModeSpec(id?: GameModeId): GameModeSpec {
  return GAME_MODES.find((g) => g.id === id) || GAME_MODES[0];
}

export const YETI_COLORWAYS: YetiColorway[] = [
  {
    id: 'classic_lofi',
    name: 'Classic Lofi',
    furHex: '#f8fafc',
    skinHex: '#87c5ee',
    chinHex: '#b9def6',
    accentHex: '#38bdf8',
  },
  {
    id: 'glacier_mint',
    name: 'Glacier Mint',
    furHex: '#ecfdf5',
    skinHex: '#34d399',
    chinHex: '#a7f3d0',
    accentHex: '#10b981',
  },
  {
    id: 'aurora_violet',
    name: 'Aurora Violet',
    furHex: '#f5f3ff',
    skinHex: '#a78bfa',
    chinHex: '#ddd6fe',
    accentHex: '#c084fc',
  },
  {
    id: 'sunset_ember',
    name: 'Sunset Ember',
    furHex: '#fff7ed',
    skinHex: '#fb923c',
    chinHex: '#fed7aa',
    accentHex: '#f97316',
  },
  {
    id: 'midnight_cyan',
    name: 'Midnight Cyan',
    furHex: '#e0f2fe',
    skinHex: '#0284c7',
    chinHex: '#7dd3fc',
    accentHex: '#22d3ee',
  },
  {
    id: 'golden_frost',
    name: 'Golden Frost',
    furHex: '#fefce8',
    skinHex: '#f59e0b',
    chinHex: '#fde68a',
    accentHex: '#fbbf24',
  },
];

export const ARENA_MAPS: ArenaMapSpec[] = [
  {
    id: 'glacier_well',
    name: 'Glacier Well',
    subtitle: 'Frozen Lake & Iceberg Spires',
    description:
      'Classic Lofi sanctuary with slick mirror ice, sculpted glacial icebergs, and falling snow shards.',
    friction: 0.91,
    speedMult: 1.0,
    accentHex: '#38bdf8',
    hazardName: 'Falling Icicles',
    obstacleLabel: 'Glacial Icebergs',
    landmarkName: 'Crystal Water Well',
  },
  {
    id: 'volcanic_springs',
    name: 'Volcanic Spring',
    subtitle: 'Basalt Caldera & Steam Vents',
    description:
      'High-traction volcanic rock ringed by hot springs, basalt pillars, and rising thermal steam geysers.',
    friction: 0.82,
    speedMult: 1.08,
    accentHex: '#fb923c',
    hazardName: 'Thermal Geysers',
    obstacleLabel: 'Basalt Pillars',
    landmarkName: 'Geothermal Well',
  },
  {
    id: 'aurora_summit',
    name: 'Aurora Summit',
    subtitle: 'High-Altitude Crystal Plateau',
    description:
      'Low-gravity alpine crest with floating aurora obelisks, faster Yeti dashes, and richer Gem spawns.',
    friction: 0.87,
    speedMult: 1.15,
    accentHex: '#2dd4bf',
    hazardName: 'Cryo Prisms',
    obstacleLabel: 'Aurora Obelisks',
    landmarkName: 'Prism Shrine Well',
  },
  {
    id: 'orbital_rift',
    name: 'Orbital Rift',
    subtitle: 'Deep-Space Station & Starway',
    description:
      'Zero-gravity cryo station orbiting an icy ringed planet, packed with asteroid monoliths, cosmic boost rails, and meteor hazards.',
    friction: 0.93,
    speedMult: 1.2,
    accentHex: '#818cf8',
    hazardName: 'Meteor Strikes',
    obstacleLabel: 'Asteroid Monoliths',
    landmarkName: 'Singularity Core Well',
  },
];

export function getMapModeDetails(mapId: MapId, gameMode: GameModeId): {
  tag: string;
  summary: string;
} {
  if (gameMode === 'car_racing') {
    if (mapId === 'volcanic_springs') {
      return {
        tag: 'Canyon Switchback Circuit',
        summary: 'Technical lava switchbacks packed with dual barrel gauntlets, canyon launch ramps, and cryo spinners.',
      };
    }
    if (mapId === 'aurora_summit') {
      return {
        tag: 'Aurora Figure-Ridge Rally',
        summary: 'High-speed figure-ridge sweepers featuring split-lane boost ramps, twin spinner chicanes, and cryo barriers.',
      };
    }
    if (mapId === 'orbital_rift') {
      return {
        tag: 'Starlight Hyper-Loop Circuit',
        summary: 'Zero-G cosmic track around asteroid bends with slingshot launch ramps, plasma spinners, and +20% thruster speed.',
      };
    }
    return {
      tag: 'Glacier Coastal Speedway',
      summary: 'Wide frozen-shore sweepers with staggered apex barriers, coastal jump ramps, and snow chicanes.',
    };
  }
  if (gameMode === 'survival') {
    if (mapId === 'volcanic_springs') {
      return {
        tag: 'Caldera Diagonal Gauntlet',
        summary: 'Staggered basalt bridge columns lead to NW/NE/SW Ember Waystones and the East Rim Escape Gate.',
      };
    }
    if (mapId === 'aurora_summit') {
      return {
        tag: 'Hexagonal Crystal Sanctuary',
        summary: 'Eight-spire sky ring guarding outer Sky Relics with a West Rim Escape Portal.',
      };
    }
    if (mapId === 'orbital_rift') {
      return {
        tag: 'Orbital Cryo-Ring Sector',
        summary: 'Asteroid monoliths flank zero-g Waystone consoles leading to the South-East Airlock Escape Portal.',
      };
    }
    return {
      tag: 'Twin Bastion Ring',
      summary: 'Perimeter glacier bastions shield 3 quadrant Waystones and the North Rim Escape Portal.',
    };
  }
  if (gameMode === 'shooting') {
    if (mapId === 'volcanic_springs') {
      return {
        tag: 'Zigzag Trench Alley',
        summary: 'Staggered diagonal basalt trenches force peek-and-fire angles across canyon crossfire lanes.',
      };
    }
    if (mapId === 'aurora_summit') {
      return {
        tag: 'Prism Star-Ring Range',
        summary: 'Wide outer crystal ring opens fast strafe lanes (+15% speed) with 6 diamond Frost Bullseyes.',
      };
    }
    if (mapId === 'orbital_rift') {
      return {
        tag: 'Zero-G Asteroid Range',
        summary: 'Twin orbital shield bunkers frame a 5-star constellation range with +20% thruster agility.',
      };
    }
    return {
      tag: 'Curved Bunker Arc',
      summary: 'Semicircular iceberg firing bunkers with long-range gallery bullseyes across the northern range.',
    };
  }
  if (gameMode === 'stickman_wrestling') {
    if (mapId === 'volcanic_springs') {
      return {
        tag: 'Basalt Foundry Raid',
        summary: 'Fight across magma steel catwalks, explosive fuel barrels, and syndicate hitmen to reach the Vault Gate.',
      };
    }
    if (mapId === 'aurora_summit') {
      return {
        tag: 'Aurora Skybridge Raid',
        summary: 'High-altitude skybridge infiltration with sniper patrols, slow-mo drops, and rooftop extraction.',
      };
    }
    if (mapId === 'orbital_rift') {
      return {
        tag: 'Orbital Hangar Raid',
        summary: 'Zero-g docking bay shootout along starship gantries, plasma barrels, and the Airlock Extraction Gate.',
      };
    }
    return {
      tag: 'Frozen Warehouse Raid',
      summary: 'Classic Killer-Bean style depot shootout with dual frost pistols, crate cover, and extraction gates.',
    };
  }
  if (gameMode === 'stickman_brawl') {
    if (mapId === 'volcanic_springs') {
      return {
        tag: 'Caldera Outpost Deck',
        summary: 'Navigate locked thermal reactor rooms, decode clues, and dodge red Imposters to reach the Airlock.',
      };
    }
    if (mapId === 'aurora_summit') {
      return {
        tag: 'Aurora Research Wing',
        summary: 'Search Medbay, Lab, and Security for encrypted keycards while evading vent ambushes.',
      };
    }
    if (mapId === 'orbital_rift') {
      return {
        tag: 'Deep-Space Citadel',
        summary: 'Climb multi-deck starship quarters, scan encrypted data logs, and unlock the Escape Shuttle.',
      };
    }
    return {
      tag: 'Cryo Station Alpha',
      summary: 'Explore 12 connected station rooms, scan clues to unlock blast doors, and escape before Imposters catch you.',
    };
  }
  if (gameMode === 'stickman_run') {
    if (mapId === 'volcanic_springs') {
      return {
        tag: 'Caldera Cliff Sprint',
        summary: 'Blistering pace across volcanic spires with tighter gaps and double gem streaks.',
      };
    }
    if (mapId === 'aurora_summit') {
      return {
        tag: 'Aurora Sky Dash',
        summary: 'Floaty double-jumps between glowing crystal platforms under northern lights.',
      };
    }
    if (mapId === 'orbital_rift') {
      return {
        tag: 'Orbital Truss Sprint',
        summary: 'High-velocity hull run across starlight catwalks under meteor showers.',
      };
    }
    return {
      tag: 'Glacier Ridge Sprint',
      summary: 'Classic frozen canyon sprint with snow ramps, ice crates, and sweeping platforms.',
    };
  }
  const spec = getMapSpec(mapId);
  return {
    tag: spec.obstacleLabel,
    summary: spec.description,
  };
}

export function getYetiColorway(id?: YetiColorId): YetiColorway {
  return YETI_COLORWAYS.find((c) => c.id === id) || YETI_COLORWAYS[0];
}

export function getMapSpec(id?: MapId): ArenaMapSpec {
  return ARENA_MAPS.find((m) => m.id === id) || ARENA_MAPS[0];
}

export interface MapLayoutTransform {
  seed: number;
  slot: number;
  angleRad: number;
  mirrorX: boolean;
  radialScale: number;
  obstacleShift: number;
  scenicOffset: number;
  skyAzimuthOffset: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const activeMapLayoutSeeds: Record<MapId, number> = {
  glacier_well: 0,
  volcanic_springs: 0,
  aurora_summit: 0,
  orbital_rift: 0,
};

const lastMapRotationSlots: Record<MapId, number> = {
  glacier_well: 0,
  volcanic_springs: 0,
  aurora_summit: 0,
  orbital_rift: 0,
};

const obstacleCache = new Map<string, ArenaObstacle[]>();
const raceWaypointCache = new Map<string, RaceWaypoint[]>();
const raceObstacleCache = new Map<string, RaceTrackObstacle[]>();

export function getActiveMapLayoutSeed(mapId: MapId): number {
  return activeMapLayoutSeeds[mapId] ?? 0;
}

export function setActiveMapLayoutSeed(mapId: MapId, seed: number): void {
  activeMapLayoutSeeds[mapId] = Math.max(0, Math.floor(seed)) >>> 0;
}

/**
 * Generates a fresh pseudo-random session seed for the given mapId,
 * guaranteeing consecutive sessions land on different rotation sectors.
 */
export function rotateMapLayoutSeed(mapId: MapId): number {
  const prevSlot = lastMapRotationSlots[mapId] ?? 0;
  const candidateSlot = ((prevSlot + 1 + Math.floor(Math.random() * 6)) % 7) + 1; // 1..7, never repeats prevSlot
  lastMapRotationSlots[mapId] = candidateSlot;
  const entropy = (Math.floor(Math.random() * 0x1fffff) << 3) | candidateSlot;
  const seed = ((entropy ^ (Date.now() & 0xfffff8)) >>> 0) || candidateSlot;
  activeMapLayoutSeeds[mapId] = seed;
  return seed;
}

export function getMapLayoutTransform(mapId: MapId, seedOverride?: number): MapLayoutTransform {
  const seed = seedOverride !== undefined ? seedOverride : getActiveMapLayoutSeed(mapId);
  if (!seed) {
    return {
      seed: 0,
      slot: 0,
      angleRad: 0,
      mirrorX: false,
      radialScale: 1,
      obstacleShift: 0,
      scenicOffset: 0,
      skyAzimuthOffset: 0,
    };
  }
  const slot = (seed & 7) || 1;
  const rng = mulberry32(seed ^ (mapId.length * 0x9e3779b1));
  const sectorAngle = slot * (Math.PI / 4); // 45-deg steps across all 7 non-zero compass sectors
  const jitter = (rng() - 0.5) * 0.26;
  const mirrorX = rng() > 0.45;
  const radialScale = 0.93 + rng() * 0.13;
  const obstacleShift = Math.floor(rng() * 13);
  const scenicOffset = Math.floor(rng() * 36);
  const skyAzimuthOffset = sectorAngle + (rng() - 0.5) * 0.6;
  return {
    seed,
    slot,
    angleRad: sectorAngle + jitter,
    mirrorX,
    radialScale,
    obstacleShift,
    scenicOffset,
    skyAzimuthOffset,
  };
}

function transformLayoutPoint(
  x: number,
  y: number,
  tf: MapLayoutTransform,
  scaleOverride = 1
): { x: number; y: number } {
  if (!tf.seed) return { x, y };
  let dx = (x - ARENA_CENTER_X) * scaleOverride;
  let dy = (y - ARENA_CENTER_Y) * scaleOverride;
  if (tf.mirrorX) dx = -dx;
  const cosA = Math.cos(tf.angleRad);
  const sinA = Math.sin(tf.angleRad);
  return {
    x: ARENA_CENTER_X + dx * cosA - dy * sinA,
    y: ARENA_CENTER_Y + dx * sinA + dy * cosA,
  };
}

export function getMapObstacles(
  mapId: MapId,
  gameMode: GameModeId = 'survival',
  seedOverride?: number
): ArenaObstacle[] {
  const resolvedSeed = seedOverride !== undefined ? seedOverride : getActiveMapLayoutSeed(mapId);
  const cacheKey = `${mapId}:${gameMode}:${resolvedSeed}`;
  const cached = obstacleCache.get(cacheKey);
  if (cached) return cached;

  const cx = ARENA_CENTER_X;
  const cy = ARENA_CENTER_Y;
  let base: ArenaObstacle[];

  if (gameMode === 'shooting') {
    if (mapId === 'volcanic_springs') {
      base = [
        { id: 'vs1', x: cx - 310, y: cy - 355, radius: 44, kind: 'basalt_pillar', height: 3.3 },
        { id: 'vs2', x: cx + 255, y: cy - 215, radius: 42, kind: 'basalt_pillar', height: 3.0 },
        { id: 'vs3', x: cx - 260, y: cy - 45, radius: 44, kind: 'basalt_pillar', height: 3.2 },
        { id: 'vs4', x: cx + 315, y: cy + 125, radius: 42, kind: 'basalt_pillar', height: 2.9 },
        { id: 'vs5', x: cx - 335, y: cy + 285, radius: 44, kind: 'basalt_pillar', height: 3.1 },
        { id: 'vs6', x: cx + 225, y: cy + 390, radius: 38, kind: 'basalt_pillar', height: 2.8 },
        { id: 'vs7', x: cx + 10, y: cy - 455, radius: 38, kind: 'basalt_pillar', height: 2.7 },
      ];
    } else if (mapId === 'aurora_summit') {
      base = [
        { id: 'as1', x: cx, y: cy - 470, radius: 38, kind: 'aurora_obelisk', height: 3.3 },
        { id: 'as2', x: cx + 485, y: cy - 235, radius: 40, kind: 'aurora_obelisk', height: 3.1 },
        { id: 'as3', x: cx - 485, y: cy - 235, radius: 40, kind: 'aurora_obelisk', height: 3.1 },
        { id: 'as4', x: cx + 485, y: cy + 235, radius: 40, kind: 'aurora_obelisk', height: 3.0 },
        { id: 'as5', x: cx - 485, y: cy + 235, radius: 40, kind: 'aurora_obelisk', height: 3.0 },
        { id: 'as6', x: cx, y: cy + 455, radius: 38, kind: 'aurora_obelisk', height: 2.8 },
      ];
    } else if (mapId === 'orbital_rift') {
      base = [
        { id: 'os1', x: cx - 220, y: cy - 180, radius: 42, kind: 'asteroid_monolith', height: 3.1 },
        { id: 'os2', x: cx + 220, y: cy - 180, radius: 42, kind: 'asteroid_monolith', height: 3.1 },
        { id: 'os3', x: cx - 490, y: cy + 110, radius: 44, kind: 'asteroid_monolith', height: 3.3 },
        { id: 'os4', x: cx + 490, y: cy + 110, radius: 44, kind: 'asteroid_monolith', height: 3.3 },
        { id: 'os5', x: cx - 260, y: cy + 390, radius: 38, kind: 'asteroid_monolith', height: 2.8 },
        { id: 'os6', x: cx + 260, y: cy + 390, radius: 38, kind: 'asteroid_monolith', height: 2.8 },
      ];
    } else {
      base = [
        { id: 'gs1', x: cx - 355, y: cy - 205, radius: 42, kind: 'iceberg', height: 2.9 },
        { id: 'gs2', x: cx - 155, y: cy - 355, radius: 40, kind: 'iceberg', height: 2.7 },
        { id: 'gs3', x: cx + 155, y: cy - 355, radius: 40, kind: 'iceberg', height: 2.7 },
        { id: 'gs4', x: cx + 355, y: cy - 205, radius: 42, kind: 'iceberg', height: 2.9 },
        { id: 'gs5', x: cx - 445, y: cy + 225, radius: 42, kind: 'iceberg', height: 3.0 },
        { id: 'gs6', x: cx + 445, y: cy + 225, radius: 42, kind: 'iceberg', height: 3.0 },
      ];
    }
  } else if (mapId === 'volcanic_springs') {
    base = [
      { id: 'v1', x: cx - 430, y: cy - 320, radius: 44, kind: 'basalt_pillar', height: 3.2 },
      { id: 'v2', x: cx - 175, y: cy - 160, radius: 40, kind: 'basalt_pillar', height: 2.9 },
      { id: 'v3', x: cx + 185, y: cy + 165, radius: 40, kind: 'basalt_pillar', height: 2.9 },
      { id: 'v4', x: cx + 435, y: cy + 325, radius: 44, kind: 'basalt_pillar', height: 3.2 },
      { id: 'v5', x: cx - 495, y: cy + 235, radius: 42, kind: 'basalt_pillar', height: 3.0 },
      { id: 'v6', x: cx + 490, y: cy - 235, radius: 42, kind: 'basalt_pillar', height: 3.0 },
      { id: 'v7', x: cx, y: cy - 455, radius: 38, kind: 'basalt_pillar', height: 2.8 },
    ];
  } else if (mapId === 'aurora_summit') {
    base = [
      { id: 'a1', x: cx - 305, y: cy - 285, radius: 38, kind: 'aurora_obelisk', height: 3.1 },
      { id: 'a2', x: cx + 305, y: cy - 285, radius: 38, kind: 'aurora_obelisk', height: 3.1 },
      { id: 'a3', x: cx - 305, y: cy + 285, radius: 38, kind: 'aurora_obelisk', height: 3.0 },
      { id: 'a4', x: cx + 305, y: cy + 285, radius: 38, kind: 'aurora_obelisk', height: 3.0 },
      { id: 'a5', x: cx, y: cy - 455, radius: 40, kind: 'aurora_obelisk', height: 3.4 },
      { id: 'a6', x: cx, y: cy + 445, radius: 40, kind: 'aurora_obelisk', height: 3.2 },
      { id: 'a7', x: cx + 525, y: cy, radius: 40, kind: 'aurora_obelisk', height: 3.2 },
      { id: 'a8', x: cx - 525, y: cy, radius: 40, kind: 'aurora_obelisk', height: 3.2 },
    ];
  } else if (mapId === 'orbital_rift') {
    base = [
      { id: 'o1', x: cx, y: cy - 350, radius: 42, kind: 'asteroid_monolith', height: 3.2 },
      { id: 'o2', x: cx + 350, y: cy - 115, radius: 42, kind: 'asteroid_monolith', height: 3.1 },
      { id: 'o3', x: cx - 350, y: cy - 115, radius: 42, kind: 'asteroid_monolith', height: 3.1 },
      { id: 'o4', x: cx + 245, y: cy + 315, radius: 44, kind: 'asteroid_monolith', height: 3.3 },
      { id: 'o5', x: cx - 245, y: cy + 315, radius: 44, kind: 'asteroid_monolith', height: 3.3 },
      { id: 'o6', x: cx - 535, y: cy + 215, radius: 38, kind: 'asteroid_monolith', height: 2.9 },
      { id: 'o7', x: cx + 535, y: cy - 325, radius: 38, kind: 'asteroid_monolith', height: 2.9 },
    ];
  } else {
    base = [
      { id: 'g1', x: cx - 460, y: cy - 190, radius: 44, kind: 'iceberg', height: 3.1 },
      { id: 'g2', x: cx - 460, y: cy + 190, radius: 44, kind: 'iceberg', height: 2.9 },
      { id: 'g3', x: cx + 460, y: cy - 190, radius: 44, kind: 'iceberg', height: 2.9 },
      { id: 'g4', x: cx + 460, y: cy + 190, radius: 44, kind: 'iceberg', height: 3.1 },
      { id: 'g5', x: cx - 190, y: cy - 430, radius: 40, kind: 'iceberg', height: 2.8 },
      { id: 'g6', x: cx + 190, y: cy + 415, radius: 40, kind: 'iceberg', height: 3.0 },
    ];
  }

  let result = base;
  if (resolvedSeed) {
    const tf = getMapLayoutTransform(mapId, resolvedSeed);
    const rng = mulberry32(resolvedSeed ^ 0x517cc1b7);
    result = base.map((obs) => {
      const localJitter = (rng() - 0.5) * 0.22;
      const cosJ = Math.cos(localJitter);
      const sinJ = Math.sin(localJitter);
      const pt = transformLayoutPoint(obs.x, obs.y, tf, tf.radialScale);
      const rdx = pt.x - cx;
      const rdy = pt.y - cy;
      let fx = cx + rdx * cosJ - rdy * sinJ;
      let fy = cy + rdx * sinJ + rdy * cosJ;
      const dist = Math.hypot(fx - cx, fy - cy) || 1;
      const clampedDist = Math.max(215, Math.min(555, dist));
      fx = cx + ((fx - cx) / dist) * clampedDist;
      fy = cy + ((fy - cy) / dist) * clampedDist;
      return {
        ...obs,
        x: Math.round(fx),
        y: Math.round(fy),
        radius: Math.round(obs.radius + (rng() - 0.5) * 6),
        height: Number((obs.height + (rng() - 0.5) * 0.5).toFixed(2)),
      };
    });
  }

  if (obstacleCache.size > 48) obstacleCache.clear();
  obstacleCache.set(cacheKey, result);
  return result;
}

export interface SurvivalQuestLayout {
  relicPoints: { x: number; y: number }[];
  portalPoint: { x: number; y: number };
}

export function getSurvivalQuestLayout(
  mapId: MapId,
  seedOverride?: number
): SurvivalQuestLayout {
  const cx = ARENA_CENTER_X;
  const cy = ARENA_CENTER_Y;
  let layout: SurvivalQuestLayout;

  if (mapId === 'volcanic_springs') {
    layout = {
      relicPoints: [
        { x: cx - 505, y: cy - 385 },
        { x: cx + 465, y: cy - 115 },
        { x: cx - 375, y: cy + 405 },
      ],
      portalPoint: { x: cx + 565, y: cy + 40 },
    };
  } else if (mapId === 'aurora_summit') {
    layout = {
      relicPoints: [
        { x: cx - 470, y: cy + 325 },
        { x: cx + 15, y: cy - 505 },
        { x: cx + 495, y: cy + 280 },
      ],
      portalPoint: { x: cx - 565, y: cy - 15 },
    };
  } else if (mapId === 'orbital_rift') {
    layout = {
      relicPoints: [
        { x: cx - 455, y: cy - 315 },
        { x: cx + 445, y: cy - 220 },
        { x: cx - 340, y: cy + 455 },
      ],
      portalPoint: { x: cx + 465, y: cy + 375 },
    };
  } else {
    layout = {
      relicPoints: [
        { x: cx - 495, y: cy + 135 },
        { x: cx + 505, y: cy - 145 },
        { x: cx + 95, y: cy + 485 },
      ],
      portalPoint: { x: cx, y: cy - 555 },
    };
  }

  const tf = getMapLayoutTransform(mapId, seedOverride);
  if (!tf.seed) return layout;

  const rng = mulberry32(tf.seed ^ 0xa24baed4);
  const portalSpin = (rng() - 0.5) * 0.5;
  const rotPortal = transformLayoutPoint(layout.portalPoint.x, layout.portalPoint.y, tf);
  const pdx = rotPortal.x - cx;
  const pdy = rotPortal.y - cy;
  const cosP = Math.cos(portalSpin);
  const sinP = Math.sin(portalSpin);

  return {
    relicPoints: layout.relicPoints.map((rp) => {
      const p = transformLayoutPoint(rp.x, rp.y, tf, 0.96 + rng() * 0.08);
      return { x: Math.round(p.x), y: Math.round(p.y) };
    }),
    portalPoint: {
      x: Math.round(cx + pdx * cosP - pdy * sinP),
      y: Math.round(cy + pdx * sinP + pdy * cosP),
    },
  };
}

export interface ShooterGalleryLayout {
  bullseyePoints: { x: number; y: number }[];
  rivalPoints: { x: number; y: number }[];
  bossPoint: { x: number; y: number };
}

export function getShooterGalleryLayout(
  mapId: MapId,
  seedOverride?: number
): ShooterGalleryLayout {
  const cx = ARENA_CENTER_X;
  const cy = ARENA_CENTER_Y;
  let layout: ShooterGalleryLayout;

  if (mapId === 'volcanic_springs') {
    layout = {
      bullseyePoints: [
        { x: cx - 460, y: cy - 310 },
        { x: cx + 455, y: cy - 320 },
        { x: cx - 475, y: cy + 260 },
        { x: cx + 465, y: cy + 250 },
      ],
      rivalPoints: [
        { x: cx - 395, y: cy - 135 },
        { x: cx + 385, y: cy + 15 },
        { x: cx + 40, y: cy - 410 },
      ],
      bossPoint: { x: cx + 425, y: cy - 340 },
    };
  } else if (mapId === 'aurora_summit') {
    layout = {
      bullseyePoints: [
        { x: cx, y: cy - 415 },
        { x: cx + 385, y: cy - 235 },
        { x: cx + 385, y: cy + 225 },
        { x: cx, y: cy + 405 },
        { x: cx - 385, y: cy + 225 },
        { x: cx - 385, y: cy - 235 },
      ],
      rivalPoints: [
        { x: cx - 320, y: cy - 340 },
        { x: cx + 320, y: cy - 340 },
        { x: cx, y: cy + 360 },
      ],
      bossPoint: { x: cx, y: cy - 420 },
    };
  } else if (mapId === 'orbital_rift') {
    layout = {
      bullseyePoints: [
        { x: cx, y: cy - 455 },
        { x: cx + 440, y: cy - 125 },
        { x: cx + 285, y: cy + 390 },
        { x: cx - 285, y: cy + 390 },
        { x: cx - 440, y: cy - 125 },
      ],
      rivalPoints: [
        { x: cx - 355, y: cy - 295 },
        { x: cx + 355, y: cy - 295 },
        { x: cx, y: cy + 420 },
      ],
      bossPoint: { x: cx, y: cy - 445 },
    };
  } else {
    layout = {
      bullseyePoints: [
        { x: cx - 430, y: cy - 365 },
        { x: cx - 150, y: cy - 455 },
        { x: cx + 150, y: cy - 455 },
        { x: cx + 430, y: cy - 365 },
      ],
      rivalPoints: [
        { x: cx - 450, y: cy - 80 },
        { x: cx + 450, y: cy - 80 },
        { x: cx, y: cy - 430 },
      ],
      bossPoint: { x: cx - 380, y: cy - 350 },
    };
  }

  const tf = getMapLayoutTransform(mapId, seedOverride);
  if (!tf.seed) return layout;

  return {
    bullseyePoints: layout.bullseyePoints.map((pt) => transformLayoutPoint(pt.x, pt.y, tf)),
    rivalPoints: layout.rivalPoints.map((pt) => transformLayoutPoint(pt.x, pt.y, tf)),
    bossPoint: transformLayoutPoint(layout.bossPoint.x, layout.bossPoint.y, tf),
  };
}

export interface RaceWaypoint {
  x: number;
  y: number;
  hasBoostPad?: boolean;
  isCheckpoint?: boolean;
  checkpointNum?: number;
}

export interface RunnerRouteWaypoint {
  x: number;
  y: number;
  turn: 'left' | 'right' | 'straight';
}

export function getRunnerRouteWaypoints(
  mapId: MapId,
  seedOverride?: number
): RunnerRouteWaypoint[] {
  const cx = ARENA_CENTER_X;
  const cy = ARENA_CENTER_Y;
  let route: RunnerRouteWaypoint[];

  if (mapId === 'volcanic_springs') {
    route = [
      { x: cx, y: cy + 635, turn: 'straight' },
      { x: cx + 225, y: cy + 485, turn: 'right' },
      { x: cx - 195, y: cy + 325, turn: 'left' },
      { x: cx + 275, y: cy + 145, turn: 'right' },
      { x: cx - 245, y: cy - 55, turn: 'left' },
      { x: cx + 205, y: cy - 265, turn: 'right' },
      { x: cx - 145, y: cy - 455, turn: 'left' },
      { x: cx, y: cy - 635, turn: 'straight' },
    ];
  } else if (mapId === 'aurora_summit') {
    route = [
      { x: cx, y: cy + 635, turn: 'straight' },
      { x: cx - 255, y: cy + 475, turn: 'left' },
      { x: cx + 230, y: cy + 305, turn: 'right' },
      { x: cx - 285, y: cy + 115, turn: 'left' },
      { x: cx + 255, y: cy - 95, turn: 'right' },
      { x: cx - 210, y: cy - 295, turn: 'left' },
      { x: cx + 155, y: cy - 465, turn: 'right' },
      { x: cx, y: cy - 635, turn: 'straight' },
    ];
  } else if (mapId === 'orbital_rift') {
    route = [
      { x: cx, y: cy + 635, turn: 'straight' },
      { x: cx - 210, y: cy + 455, turn: 'left' },
      { x: cx - 265, y: cy + 205, turn: 'left' },
      { x: cx + 245, y: cy + 45, turn: 'right' },
      { x: cx + 265, y: cy - 205, turn: 'right' },
      { x: cx - 165, y: cy - 425, turn: 'left' },
      { x: cx, y: cy - 635, turn: 'straight' },
    ];
  } else {
    route = [
      { x: cx, y: cy + 635, turn: 'straight' },
      { x: cx + 235, y: cy + 480, turn: 'right' },
      { x: cx - 220, y: cy + 315, turn: 'left' },
      { x: cx + 250, y: cy + 135, turn: 'right' },
      { x: cx - 235, y: cy - 60, turn: 'left' },
      { x: cx + 195, y: cy - 255, turn: 'right' },
      { x: cx - 165, y: cy - 445, turn: 'left' },
      { x: cx, y: cy - 635, turn: 'straight' },
    ];
  }

  const tf = getMapLayoutTransform(mapId, seedOverride);
  if (!tf.seed) return route;

  return route.map((wp) => {
    const p = transformLayoutPoint(wp.x, wp.y, tf);
    return {
      ...wp,
      x: Math.round(p.x),
      y: Math.round(p.y),
      turn: tf.mirrorX
        ? wp.turn === 'left'
          ? 'right'
          : wp.turn === 'right'
          ? 'left'
          : 'straight'
        : wp.turn,
    };
  });
}

/**
 * 14-waypoint long Beach-Buggy style coastal/canyon/summit/orbital racing tracks
 * with pseudo-random rotation, mirror inversion, and boost/obstacle layout shuffling per session.
 */
export function getRaceTrackWaypoints(mapId: MapId, seedOverride?: number): RaceWaypoint[] {
  const resolvedSeed = seedOverride !== undefined ? seedOverride : getActiveMapLayoutSeed(mapId);
  const cacheKey = `${mapId}:${resolvedSeed}`;
  const cached = raceWaypointCache.get(cacheKey);
  if (cached) return cached;

  const cx = ARENA_CENTER_X;
  const cy = ARENA_CENTER_Y;
  let base: RaceWaypoint[];

  if (mapId === 'volcanic_springs') {
    base = [
      { x: cx - 260, y: cy + 780 },
      { x: cx + 480, y: cy + 770, hasBoostPad: true },
      { x: cx + 1240, y: cy + 660 },
      { x: cx + 1560, y: cy + 250, isCheckpoint: true, checkpointNum: 1 },
      { x: cx + 1220, y: cy - 180, hasBoostPad: true },
      { x: cx + 620, y: cy - 120 },
      { x: cx + 480, y: cy - 680, isCheckpoint: true, checkpointNum: 2 },
      { x: cx + 1150, y: cy - 880, hasBoostPad: true },
      { x: cx + 420, y: cy - 960 },
      { x: cx - 440, y: cy - 780, isCheckpoint: true, checkpointNum: 3 },
      { x: cx - 1260, y: cy - 860, hasBoostPad: true },
      { x: cx - 1580, y: cy - 320 },
      { x: cx - 1340, y: cy + 360, isCheckpoint: true, checkpointNum: 4 },
      { x: cx - 860, y: cy + 730, hasBoostPad: true },
    ];
  } else if (mapId === 'aurora_summit') {
    base = [
      { x: cx - 180, y: cy + 800 },
      { x: cx + 650, y: cy + 790, hasBoostPad: true },
      { x: cx + 1460, y: cy + 560 },
      { x: cx + 1540, y: cy - 90, isCheckpoint: true, checkpointNum: 1 },
      { x: cx + 980, y: cy - 520, hasBoostPad: true },
      { x: cx + 320, y: cy - 320 },
      { x: cx - 180, y: cy - 780, isCheckpoint: true, checkpointNum: 2 },
      { x: cx - 840, y: cy - 920, hasBoostPad: true },
      { x: cx - 1480, y: cy - 580 },
      { x: cx - 1560, y: cy + 80, isCheckpoint: true, checkpointNum: 3 },
      { x: cx - 980, y: cy + 280 },
      { x: cx - 1220, y: cy + 720, hasBoostPad: true },
      { x: cx - 720, y: cy + 840, isCheckpoint: true, checkpointNum: 4 },
      { x: cx - 420, y: cy + 810 },
    ];
  } else if (mapId === 'orbital_rift') {
    base = [
      { x: cx - 240, y: cy + 790 },
      { x: cx + 620, y: cy + 800, hasBoostPad: true },
      { x: cx + 1440, y: cy + 520 },
      { x: cx + 1620, y: cy - 180, isCheckpoint: true, checkpointNum: 1 },
      { x: cx + 1140, y: cy - 780, hasBoostPad: true },
      { x: cx + 380, y: cy - 860 },
      { x: cx - 60, y: cy - 320, isCheckpoint: true, checkpointNum: 2 },
      { x: cx - 540, y: cy - 840, hasBoostPad: true },
      { x: cx - 1340, y: cy - 740 },
      { x: cx - 1620, y: cy - 120, isCheckpoint: true, checkpointNum: 3 },
      { x: cx - 1260, y: cy + 440, hasBoostPad: true },
      { x: cx - 760, y: cy + 360 },
      { x: cx - 860, y: cy + 780, isCheckpoint: true, checkpointNum: 4 },
      { x: cx - 520, y: cy + 800 },
    ];
  } else {
    base = [
      { x: cx - 220, y: cy + 790 },
      { x: cx + 560, y: cy + 790, hasBoostPad: true },
      { x: cx + 1350, y: cy + 640 },
      { x: cx + 1620, y: cy + 160, isCheckpoint: true, checkpointNum: 1 },
      { x: cx + 1360, y: cy - 460, hasBoostPad: true },
      { x: cx + 760, y: cy - 820 },
      { x: cx + 120, y: cy - 420, isCheckpoint: true, checkpointNum: 2 },
      { x: cx - 460, y: cy - 860, hasBoostPad: true },
      { x: cx - 1220, y: cy - 790 },
      { x: cx - 1600, y: cy - 260, isCheckpoint: true, checkpointNum: 3 },
      { x: cx - 1340, y: cy + 220 },
      { x: cx - 1460, y: cy + 680, hasBoostPad: true },
      { x: cx - 960, y: cy + 840, isCheckpoint: true, checkpointNum: 4 },
      { x: cx - 580, y: cy + 800 },
    ];
  }

  let result = base;
  if (resolvedSeed) {
    const tf = getMapLayoutTransform(mapId, resolvedSeed);
    const rng = mulberry32(resolvedSeed ^ 0xc4ceb9fe);
    result = base.map((wp, idx) => {
      const nudgeX = idx === 0 || idx === 1 ? 0 : (rng() - 0.5) * 95;
      const nudgeY = idx === 0 || idx === 1 ? 0 : (rng() - 0.5) * 85;
      const p = transformLayoutPoint(wp.x + nudgeX, wp.y + nudgeY, tf);
      return {
        ...wp,
        x: Math.round(p.x),
        y: Math.round(p.y),
      };
    });
  }

  if (raceWaypointCache.size > 48) raceWaypointCache.clear();
  raceWaypointCache.set(cacheKey, result);
  return result;
}

export function getDistanceToRaceTrack(
  x: number,
  y: number,
  mapId: MapId,
  seedOverride?: number
): number {
  const wps = getRaceTrackWaypoints(mapId, seedOverride);
  let minDistSq = Infinity;
  for (let i = 0; i < wps.length; i++) {
    const a = wps[i];
    const b = wps[(i + 1) % wps.length];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abLenSq = abx * abx + aby * aby || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / abLenSq));
    const px = a.x + abx * t;
    const py = a.y + aby * t;
    const dSq = (x - px) * (x - px) + (y - py) * (y - py);
    if (dSq < minDistSq) minDistSq = dSq;
  }
  return Math.sqrt(minDistSq);
}

export function resolveArenaObstacleCollision(
  x: number,
  y: number,
  vx: number,
  vy: number,
  actorRadius: number,
  mapId: MapId,
  gameMode: GameModeId = 'survival',
  seedOverride?: number
): { x: number; y: number; vx: number; vy: number } {
  let rx = x;
  let ry = y;
  let rvx = vx;
  let rvy = vy;

  const wellRadius = 34;
  const dxW = rx - ARENA_CENTER_X;
  const dyW = ry - ARENA_CENTER_Y;
  const distW = Math.hypot(dxW, dyW);
  const minW = wellRadius + actorRadius;
  if (distW < minW) {
    const nx = distW > 0.01 ? dxW / distW : 0;
    const ny = distW > 0.01 ? dyW / distW : 1;
    rx = ARENA_CENTER_X + nx * minW;
    ry = ARENA_CENTER_Y + ny * minW;
    const dot = rvx * nx + rvy * ny;
    if (dot < 0) {
      rvx -= dot * nx * 1.1;
      rvy -= dot * ny * 1.1;
    }
  }

  for (const obs of getMapObstacles(mapId, gameMode, seedOverride)) {
    const dx = rx - obs.x;
    const dy = ry - obs.y;
    const dist = Math.hypot(dx, dy);
    const minDist = obs.radius + actorRadius;
    if (dist < minDist) {
      const nx = dist > 0.01 ? dx / dist : 1;
      const ny = dist > 0.01 ? dy / dist : 0;
      rx = obs.x + nx * minDist;
      ry = obs.y + ny * minDist;
      const dot = rvx * nx + rvy * ny;
      if (dot < 0) {
        rvx -= dot * nx * 1.15;
        rvy -= dot * ny * 1.15;
      }
    }
  }

  return { x: rx, y: ry, vx: rvx, vy: rvy };
}

export type RaceObstacleKind = 'jersey_barrier' | 'cryo_spinner' | 'fuel_barrel' | 'jump_ramp';

export interface RaceTrackObstacle {
  id: string;
  x: number;
  y: number;
  radius: number;
  yaw: number;
  kind: RaceObstacleKind;
}

export function getRaceTrackObstacles(
  mapId: MapId,
  seedOverride?: number
): RaceTrackObstacle[] {
  const resolvedSeed = seedOverride !== undefined ? seedOverride : getActiveMapLayoutSeed(mapId);
  const cacheKey = `${mapId}:${resolvedSeed}`;
  const cached = raceObstacleCache.get(cacheKey);
  if (cached) return cached;

  const wps = getRaceTrackWaypoints(mapId, resolvedSeed);
  const tf = getMapLayoutTransform(mapId, resolvedSeed);

  const lateralOffsets =
    mapId === 'volcanic_springs'
      ? [-74, 72, -32, 76, -68, 0, 74, -76, 62, -64, 34, -72, 70]
      : mapId === 'aurora_summit'
      ? [0, -76, 76, -42, 42, -74, 74, 0, -68, 68, -40, 72, -70]
      : mapId === 'orbital_rift'
      ? [64, -74, 0, 76, -68, 56, -74, 0, -66, 74, -52, 68, -64]
      : [72, -68, 0, -76, 74, 64, -72, 0, 78, -68, 66, -74, 58];

  const pattern: RaceObstacleKind[] =
    mapId === 'volcanic_springs'
      ? [
          'fuel_barrel',
          'cryo_spinner',
          'jump_ramp',
          'fuel_barrel',
          'jersey_barrier',
          'jump_ramp',
          'cryo_spinner',
          'fuel_barrel',
          'cryo_spinner',
          'jump_ramp',
          'fuel_barrel',
          'jersey_barrier',
          'jump_ramp',
        ]
      : mapId === 'aurora_summit'
      ? [
          'jump_ramp',
          'cryo_spinner',
          'cryo_spinner',
          'jump_ramp',
          'jersey_barrier',
          'fuel_barrel',
          'jump_ramp',
          'cryo_spinner',
          'jersey_barrier',
          'jump_ramp',
          'fuel_barrel',
          'cryo_spinner',
          'jump_ramp',
        ]
      : mapId === 'orbital_rift'
      ? [
          'jump_ramp',
          'cryo_spinner',
          'jersey_barrier',
          'jump_ramp',
          'fuel_barrel',
          'cryo_spinner',
          'jump_ramp',
          'jersey_barrier',
          'cryo_spinner',
          'jump_ramp',
          'fuel_barrel',
          'cryo_spinner',
          'jump_ramp',
        ]
      : [
          'jump_ramp',
          'jersey_barrier',
          'fuel_barrel',
          'cryo_spinner',
          'jump_ramp',
          'jersey_barrier',
          'fuel_barrel',
          'cryo_spinner',
          'jump_ramp',
          'fuel_barrel',
          'jersey_barrier',
          'cryo_spinner',
          'jump_ramp',
        ];

  const obs: RaceTrackObstacle[] = [];
  const laneFlip = tf.mirrorX ? -1 : 1;

  for (let idx = 1; idx < wps.length; idx++) {
    const cur = wps[idx];
    const next = wps[(idx + 1) % wps.length];
    const dirX = next.x - cur.x;
    const dirY = next.y - cur.y;
    const len = Math.hypot(dirX, dirY) || 1;
    const perpX = -dirY / len;
    const perpY = dirX / len;
    const yaw = Math.atan2(dirX, dirY);

    const midX = (cur.x + next.x) * 0.5;
    const midY = (cur.y + next.y) * 0.5;
    const kindIdx = (idx - 1 + tf.obstacleShift) % pattern.length;
    const kind = pattern[kindIdx];
    const baseLateral = lateralOffsets[(idx - 1 + tf.obstacleShift) % lateralOffsets.length] * laneFlip;
    const lateral =
      kind === 'jump_ramp'
        ? mapId === 'aurora_summit'
          ? idx % 2 === 0
            ? -44 * laneFlip
            : 44 * laneFlip
          : idx % 2 === 0
          ? -34 * laneFlip
          : 34 * laneFlip
        : baseLateral;

    obs.push({
      id: `race_obs_${mapId}_${idx}`,
      x: midX + perpX * lateral,
      y: midY + perpY * lateral,
      yaw,
      radius:
        kind === 'jump_ramp'
          ? 44
          : kind === 'cryo_spinner'
          ? 34
          : kind === 'jersey_barrier'
          ? 36
          : 28,
      kind,
    });
  }

  if (raceObstacleCache.size > 48) raceObstacleCache.clear();
  raceObstacleCache.set(cacheKey, obs);
  return obs;
}

export function resolveRaceObstacleCollision(
  x: number,
  y: number,
  vx: number,
  vy: number,
  kartRadius: number,
  mapId: MapId,
  skipIds?: Set<string>,
  seedOverride?: number
): { x: number; y: number; vx: number; vy: number; hitObs: RaceTrackObstacle | null } {
  let rx = x;
  let ry = y;
  let rvx = vx;
  let rvy = vy;
  let hitObs: RaceTrackObstacle | null = null;

  for (const obs of getRaceTrackObstacles(mapId, seedOverride)) {
    if (obs.kind === 'jump_ramp') continue;
    if (skipIds?.has(obs.id)) continue;
    const dx = rx - obs.x;
    const dy = ry - obs.y;
    const dist = Math.hypot(dx, dy);
    const minDist = obs.radius + kartRadius;
    if (dist < minDist) {
      hitObs = obs;
      const nx = dist > 0.01 ? dx / dist : 1;
      const ny = dist > 0.01 ? dy / dist : 0;
      rx = obs.x + nx * minDist;
      ry = obs.y + ny * minDist;
      const dot = rvx * nx + rvy * ny;
      if (dot < 0) {
        rvx -= dot * nx * 1.25;
        rvy -= dot * ny * 1.25;
      }
    }
  }
  return { x: rx, y: ry, vx: rvx, vy: rvy, hitObs };
}

export const CAREER_QUESTS: CareerQuest[] = [
  {
    id: 'quest_well_guardian',
    title: 'Glacial Drop Collector',
    description: 'Gather 25 Glacial Drops across any 3D or 2D Lofi Arcade runs.',
    metric: 'wellDrops',
    target: 25,
    rewardGems: 25,
    rewardXp: 120,
  },
  {
    id: 'quest_snowball_ace',
    title: 'Frost Marksman',
    description: 'Land 12 hits across Arcade Survival or Frost Fire runs.',
    metric: 'hitsLanded',
    target: 12,
    rewardGems: 20,
    rewardXp: 100,
  },
  {
    id: 'quest_crate_breaker',
    title: 'Icebreaker Runner',
    description: 'Smash 8 Frost Crates or target objectives during arena runs.',
    metric: 'cratesSmashed',
    target: 8,
    rewardGems: 20,
    rewardXp: 100,
  },
  {
    id: 'quest_world_explorer',
    title: 'Arctic Cartographer',
    description: 'Complete runs across 3 different battlegrounds (Glacier, Volcanic, Aurora, or Orbital Rift).',
    metric: 'mapsVisited',
    target: 3,
    rewardGems: 40,
    rewardXp: 180,
  },
  {
    id: 'quest_task_master',
    title: 'Sui Task Specialist',
    description: 'Complete 6 in-match arena tasks across your career.',
    metric: 'tasksCompleted',
    target: 6,
    rewardGems: 35,
    rewardXp: 160,
  },
];
