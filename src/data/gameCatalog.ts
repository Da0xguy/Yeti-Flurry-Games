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
  minX: ARENA_CENTER_X - 1900,
  maxX: ARENA_CENTER_X + 1900,
  minY: ARENA_CENTER_Y - 1150,
  maxY: ARENA_CENTER_Y + 1150,
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
    subtitle: 'Among Us Mystery · Search Rooms · Find Clues · Unlock Doors',
    description:
      'Explore interconnected station rooms in top-down 2D! Search Cafeteria, Medbay, Lab, Reactor & Electrical for hidden Clues to unlock sealed doors, dodge vent Imposters, and escape through the Airlock.',
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
];

export function getMapModeDetails(mapId: MapId, gameMode: GameModeId): {
  tag: string;
  summary: string;
} {
  if (gameMode === 'car_racing') {
    if (mapId === 'volcanic_springs') {
      return {
        tag: 'Canyon Buggy Run',
        summary: 'Long off-road hairpins, basalt canyon jumps, and superheated turbo strips.',
      };
    }
    if (mapId === 'aurora_summit') {
      return {
        tag: 'Summit Coast Rally',
        summary: 'Long downhill straightaways, floating obelisk gates, and rapid nitro charge.',
      };
    }
    return {
      tag: 'Glacier Beach Buggy',
      summary: 'Wide frozen-shore sweepers, snow dunes, and long drift-friendly nitro chicanes.',
    };
  }
  if (gameMode === 'survival') {
    if (mapId === 'volcanic_springs') {
      return {
        tag: 'Caldera Escape Quest',
        summary: '5-Yeti squad quest through basalt cover, magma monsters, and 3 Ember Waystones to the Escape Gate.',
      };
    }
    if (mapId === 'aurora_summit') {
      return {
        tag: 'Aurora Escape Quest',
        summary: 'Sprint with 4 Yeti allies across glowing crystal ridges, awaken 3 Sky Relics, and extract alive.',
      };
    }
    return {
      tag: 'Glacier Escape Quest',
      summary: 'Lead your 5-Yeti party through monster ambushes, charge 3 Waystone Relics, and escape through the Portal.',
    };
  }
  if (gameMode === 'shooting') {
    if (mapId === 'volcanic_springs') {
      return {
        tag: 'Basalt Cover Arena',
        summary: 'Tall basalt columns provide tight peek-and-fire cover against Cryo Drones.',
      };
    }
    if (mapId === 'aurora_summit') {
      return {
        tag: 'Prism Bonus Waves',
        summary: 'Fast strafing speed (+15%) and extra high-value Frost Bullseye targets.',
      };
    }
    return {
      tag: 'Open Glacial Range',
      summary: 'Balanced iceberg cover and clear long-range sightlines around the Central Well.',
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
    return {
      tag: 'Cryo Station Alpha',
      summary: 'Explore 6 connected ship rooms, scan clues to unlock blast doors, and escape before Imposters catch you.',
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

export function getMapObstacles(mapId: MapId): ArenaObstacle[] {
  const cx = ARENA_CENTER_X;
  const cy = ARENA_CENTER_Y;

  if (mapId === 'volcanic_springs') {
    return [
      { id: 'v1', x: cx - 375, y: cy - 255, radius: 42, kind: 'basalt_pillar', height: 3.1 },
      { id: 'v2', x: cx + 375, y: cy - 255, radius: 42, kind: 'basalt_pillar', height: 3.3 },
      { id: 'v3', x: cx - 390, y: cy + 255, radius: 44, kind: 'basalt_pillar', height: 2.8 },
      { id: 'v4', x: cx + 390, y: cy + 255, radius: 44, kind: 'basalt_pillar', height: 3.0 },
      { id: 'v5', x: cx, y: cy - 420, radius: 38, kind: 'basalt_pillar', height: 2.7 },
      { id: 'v6', x: cx - 540, y: cy + 15, radius: 38, kind: 'basalt_pillar', height: 2.9 },
      { id: 'v7', x: cx + 540, y: cy + 15, radius: 38, kind: 'basalt_pillar', height: 2.9 },
    ];
  }
  if (mapId === 'aurora_summit') {
    return [
      { id: 'a1', x: cx, y: cy - 395, radius: 40, kind: 'aurora_obelisk', height: 3.2 },
      { id: 'a2', x: cx + 415, y: cy - 60, radius: 42, kind: 'aurora_obelisk', height: 2.9 },
      { id: 'a3', x: cx - 415, y: cy - 60, radius: 42, kind: 'aurora_obelisk', height: 2.9 },
      { id: 'a4', x: cx + 285, y: cy + 345, radius: 38, kind: 'aurora_obelisk', height: 2.7 },
      { id: 'a5', x: cx - 285, y: cy + 345, radius: 38, kind: 'aurora_obelisk', height: 2.7 },
      { id: 'a6', x: cx + 295, y: cy - 310, radius: 36, kind: 'aurora_obelisk', height: 2.8 },
      { id: 'a7', x: cx - 295, y: cy - 310, radius: 36, kind: 'aurora_obelisk', height: 2.8 },
    ];
  }
  return [
    { id: 'g1', x: cx - 390, y: cy - 235, radius: 42, kind: 'iceberg', height: 3.0 },
    { id: 'g2', x: cx + 390, y: cy - 235, radius: 42, kind: 'iceberg', height: 2.8 },
    { id: 'g3', x: cx - 340, y: cy + 285, radius: 40, kind: 'iceberg', height: 2.7 },
    { id: 'g4', x: cx + 340, y: cy + 285, radius: 40, kind: 'iceberg', height: 3.1 },
    { id: 'g5', x: cx - 545, y: cy + 20, radius: 38, kind: 'iceberg', height: 2.9 },
    { id: 'g6', x: cx + 545, y: cy + 20, radius: 38, kind: 'iceberg', height: 2.9 },
  ];
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

export function getRunnerRouteWaypoints(mapId: MapId): RunnerRouteWaypoint[] {
  const cx = ARENA_CENTER_X;
  const cy = ARENA_CENTER_Y;

  if (mapId === 'volcanic_springs') {
    return [
      { x: cx, y: cy + 635, turn: 'straight' },
      { x: cx + 225, y: cy + 485, turn: 'right' },
      { x: cx - 195, y: cy + 325, turn: 'left' },
      { x: cx + 275, y: cy + 145, turn: 'right' },
      { x: cx - 245, y: cy - 55, turn: 'left' },
      { x: cx + 205, y: cy - 265, turn: 'right' },
      { x: cx - 145, y: cy - 455, turn: 'left' },
      { x: cx, y: cy - 635, turn: 'straight' },
    ];
  }
  if (mapId === 'aurora_summit') {
    return [
      { x: cx, y: cy + 635, turn: 'straight' },
      { x: cx - 255, y: cy + 475, turn: 'left' },
      { x: cx + 230, y: cy + 305, turn: 'right' },
      { x: cx - 285, y: cy + 115, turn: 'left' },
      { x: cx + 255, y: cy - 95, turn: 'right' },
      { x: cx - 210, y: cy - 295, turn: 'left' },
      { x: cx + 155, y: cy - 465, turn: 'right' },
      { x: cx, y: cy - 635, turn: 'straight' },
    ];
  }
  return [
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

/**
 * 14-waypoint long Beach-Buggy style coastal/canyon/summit racing tracks
 * spanning ~3300x1900 logical units with S-curves, hairpins, long straights,
 * boost strips, and 4 sequential Checkpoints per lap.
 */
export function getRaceTrackWaypoints(mapId: MapId): RaceWaypoint[] {
  const cx = ARENA_CENTER_X;
  const cy = ARENA_CENTER_Y;

  if (mapId === 'volcanic_springs') {
    // Canyon Buggy Run: technical lava switchbacks + scorching back straight
    return [
      { x: cx - 260, y: cy + 780 }, // 0: Start/Finish Grand Straight
      { x: cx + 480, y: cy + 770, hasBoostPad: true },
      { x: cx + 1240, y: cy + 660 },
      { x: cx + 1560, y: cy + 250, isCheckpoint: true, checkpointNum: 1 }, // CP 1
      { x: cx + 1220, y: cy - 180, hasBoostPad: true },
      { x: cx + 620, y: cy - 120 },
      { x: cx + 480, y: cy - 680, isCheckpoint: true, checkpointNum: 2 }, // CP 2
      { x: cx + 1150, y: cy - 880, hasBoostPad: true },
      { x: cx + 420, y: cy - 960 },
      { x: cx - 440, y: cy - 780, isCheckpoint: true, checkpointNum: 3 }, // CP 3
      { x: cx - 1260, y: cy - 860, hasBoostPad: true },
      { x: cx - 1580, y: cy - 320 },
      { x: cx - 1340, y: cy + 360, isCheckpoint: true, checkpointNum: 4 }, // CP 4
      { x: cx - 860, y: cy + 730, hasBoostPad: true },
    ];
  }

  if (mapId === 'aurora_summit') {
    // Summit Coast Rally: sweeping figure-ridge chicanes & high-speed straightaways
    return [
      { x: cx - 180, y: cy + 800 }, // 0: Start/Finish
      { x: cx + 650, y: cy + 790, hasBoostPad: true },
      { x: cx + 1460, y: cy + 560 },
      { x: cx + 1540, y: cy - 90, isCheckpoint: true, checkpointNum: 1 }, // CP 1
      { x: cx + 980, y: cy - 520, hasBoostPad: true },
      { x: cx + 320, y: cy - 320 },
      { x: cx - 180, y: cy - 780, isCheckpoint: true, checkpointNum: 2 }, // CP 2
      { x: cx - 840, y: cy - 920, hasBoostPad: true },
      { x: cx - 1480, y: cy - 580 },
      { x: cx - 1560, y: cy + 80, isCheckpoint: true, checkpointNum: 3 }, // CP 3
      { x: cx - 980, y: cy + 280 },
      { x: cx - 1220, y: cy + 720, hasBoostPad: true },
      { x: cx - 720, y: cy + 840, isCheckpoint: true, checkpointNum: 4 }, // CP 4
      { x: cx - 420, y: cy + 810 },
    ];
  }

  // Glacier Beach Buggy: wide coastal sweepers, bay hairpin & frozen causeway
  return [
    { x: cx - 220, y: cy + 790 }, // 0: Start/Finish Coastal Causeway
    { x: cx + 560, y: cy + 790, hasBoostPad: true },
    { x: cx + 1350, y: cy + 640 },
    { x: cx + 1620, y: cy + 160, isCheckpoint: true, checkpointNum: 1 }, // CP 1: East Lagoon
    { x: cx + 1360, y: cy - 460, hasBoostPad: true },
    { x: cx + 760, y: cy - 820 },
    { x: cx + 120, y: cy - 420, isCheckpoint: true, checkpointNum: 2 }, // CP 2: Mid Chicane
    { x: cx - 460, y: cy - 860, hasBoostPad: true },
    { x: cx - 1220, y: cy - 790 },
    { x: cx - 1600, y: cy - 260, isCheckpoint: true, checkpointNum: 3 }, // CP 3: West Cove
    { x: cx - 1340, y: cy + 220 },
    { x: cx - 1460, y: cy + 680, hasBoostPad: true },
    { x: cx - 960, y: cy + 840, isCheckpoint: true, checkpointNum: 4 }, // CP 4: South Boardwalk
    { x: cx - 580, y: cy + 800 },
  ];
}

export function getDistanceToRaceTrack(x: number, y: number, mapId: MapId): number {
  const wps = getRaceTrackWaypoints(mapId);
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
  mapId: MapId
): { x: number; y: number; vx: number; vy: number } {
  let rx = x;
  let ry = y;
  let rvx = vx;
  let rvy = vy;

  // Center Well solid stone curb (radius 34px around arena center)
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

  for (const obs of getMapObstacles(mapId)) {
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

export interface RaceTrackObstacle {
  id: string;
  x: number;
  y: number;
  radius: number;
  kind: 'rock' | 'cryo_pylon';
}

/**
 * Physical trackside boulders and glowing cryo pylons along curves and straights.
 * Positioned deliberately 48–76 logical units off centerline so clean racing lines remain passable.
 */
export function getRaceTrackObstacles(mapId: MapId): RaceTrackObstacle[] {
  const wps = getRaceTrackWaypoints(mapId);
  const offsets = [58, -56, 62, -60, 54, -64, 60, -54, 58, -62];
  const obs: RaceTrackObstacle[] = [];
  for (let idx = 1; idx < wps.length; idx++) {
    const prev = wps[idx - 1];
    const cur = wps[idx];
    const next = wps[(idx + 1) % wps.length];
    const dirX = next.x - prev.x;
    const dirY = next.y - prev.y;
    const len = Math.hypot(dirX, dirY) || 1;
    const perpX = -dirY / len;
    const perpY = dirX / len;

    // Place chicane pylon/rock halfway between cur and next for active dodging
    if (idx % 2 === 1 || idx === 6 || idx === 10) {
      const midX = (cur.x + next.x) * 0.5;
      const midY = (cur.y + next.y) * 0.5;
      const lateral = offsets[obs.length % offsets.length];
      obs.push({
        id: `race_obs_${mapId}_${idx}`,
        x: midX + perpX * lateral,
        y: midY + perpY * lateral,
        radius: obs.length % 3 === 0 ? 32 : 26,
        kind: obs.length % 2 === 0 ? 'rock' : 'cryo_pylon',
      });
    }
  }
  return obs;
}

export function resolveRaceObstacleCollision(
  x: number,
  y: number,
  vx: number,
  vy: number,
  kartRadius: number,
  mapId: MapId
): { x: number; y: number; vx: number; vy: number; hit: boolean } {
  let rx = x;
  let ry = y;
  let rvx = vx;
  let rvy = vy;
  let hit = false;

  for (const obs of getRaceTrackObstacles(mapId)) {
    const dx = rx - obs.x;
    const dy = ry - obs.y;
    const dist = Math.hypot(dx, dy);
    const minDist = obs.radius + kartRadius;
    if (dist < minDist) {
      hit = true;
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
  return { x: rx, y: ry, vx: rvx, vy: rvy, hit };
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
    description: 'Complete at least one run across all 3 maps (Glacier, Volcanic, Aurora).',
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
