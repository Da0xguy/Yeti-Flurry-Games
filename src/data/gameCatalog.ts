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

export const ARENA_W = 1500;
export const ARENA_H = 960;
export const ARENA_CENTER_X = ARENA_W / 2;
export const ARENA_CENTER_Y = ARENA_H / 2;
export const ARENA_INITIAL_RING_RADIUS = 460;
export const WELL_RITUAL_RADIUS = 115;

export const GAME_MODES: GameModeSpec[] = [
  {
    id: 'survival',
    name: 'Flurry Survival',
    shortLabel: 'Survival',
    subtitle: 'Central Well · Snowball Clash · Well Rituals',
    description:
      'Roam the expanded 3D arena, collect Glacial Drops, bank them at the Central Well, trigger Well Ritual emotes, and outlast rival Yetis.',
    controlsSummary: 'WASD / Arrows move · Space Dash · Click / J Throw · 1/E Wave · 2/F Dance',
    supportsTunnel: true,
  },
  {
    id: 'car_racing',
    name: 'Arctic Kart Racing',
    shortLabel: 'Kart Race',
    subtitle: '3-Lap 3D Circuit · Drift Physics · Nitro Boost',
    description:
      'Pilot a custom 3D Lofi Snow-Kart around the grand perimeter circuit, hit boost pads, drift icy corners, and beat 3 rival Yeti racers to the checkered arch.',
    controlsSummary: 'W / Up Throttle · A / D Steer · S / Down Brake · Space Nitro Boost',
    supportsTunnel: false,
  },
  {
    id: 'shooting',
    name: 'Frost Blaster Shooter',
    shortLabel: 'Shooter',
    subtitle: 'Wave Combat · Cryo Drones · Bullseye Combos',
    description:
      'Aim your 3D Frost Blaster across the open arena to shatter Cryo Drones, spinning Ice Bullseyes, and rival Yeti sharpshooters while building combo streaks.',
    controlsSummary: 'WASD / Arrows Strafe · Mouse Aim · Click / J Rapid Fire · Space Frost Nova',
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
        tag: 'High-Grip Asphalt',
        summary: 'Sharp corner traction, basalt canyon hairpins, and superheated turbo strips.',
      };
    }
    if (mapId === 'aurora_summit') {
      return {
        tag: 'Top-Speed Circuit',
        summary: 'Fastest straightaways (+15% speed), floating obelisk gates, and rapid nitro charge.',
      };
    }
    return {
      tag: 'Drift Ice Track',
      summary: 'Classic frozen lake sweepers with crisp drift slides and wide nitro chicanes.',
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
      { id: 'v1', x: cx - 235, y: cy - 165, radius: 34, kind: 'basalt_pillar', height: 2.8 },
      { id: 'v2', x: cx + 235, y: cy - 165, radius: 34, kind: 'basalt_pillar', height: 3.1 },
      { id: 'v3', x: cx - 245, y: cy + 165, radius: 36, kind: 'basalt_pillar', height: 2.6 },
      { id: 'v4', x: cx + 245, y: cy + 165, radius: 36, kind: 'basalt_pillar', height: 2.9 },
      { id: 'v5', x: cx, y: cy - 265, radius: 30, kind: 'basalt_pillar', height: 2.4 },
    ];
  }
  if (mapId === 'aurora_summit') {
    return [
      { id: 'a1', x: cx, y: cy - 245, radius: 32, kind: 'aurora_obelisk', height: 3.0 },
      { id: 'a2', x: cx + 255, y: cy - 40, radius: 34, kind: 'aurora_obelisk', height: 2.7 },
      { id: 'a3', x: cx - 255, y: cy - 40, radius: 34, kind: 'aurora_obelisk', height: 2.7 },
      { id: 'a4', x: cx + 175, y: cy + 215, radius: 30, kind: 'aurora_obelisk', height: 2.5 },
      { id: 'a5', x: cx - 175, y: cy + 215, radius: 30, kind: 'aurora_obelisk', height: 2.5 },
    ];
  }
  return [
    { id: 'g1', x: cx - 245, y: cy - 145, radius: 34, kind: 'iceberg', height: 2.7 },
    { id: 'g2', x: cx + 245, y: cy - 145, radius: 34, kind: 'iceberg', height: 2.5 },
    { id: 'g3', x: cx - 210, y: cy + 185, radius: 32, kind: 'iceberg', height: 2.4 },
    { id: 'g4', x: cx + 210, y: cy + 185, radius: 32, kind: 'iceberg', height: 2.8 },
  ];
}

export interface RaceWaypoint {
  x: number;
  y: number;
  hasBoostPad?: boolean;
}

/**
 * 8-waypoint closed circuit looping around the expanded 1500x960 arena,
 * keeping clean clearance from both the Central Well and inner obstacles.
 */
export function getRaceTrackWaypoints(mapId: MapId): RaceWaypoint[] {
  const cx = ARENA_CENTER_X;
  const cy = ARENA_CENTER_Y;

  if (mapId === 'volcanic_springs') {
    return [
      { x: cx, y: cy + 345 }, // Start/Finish South Straight
      { x: cx + 315, y: cy + 315, hasBoostPad: true },
      { x: cx + 425, y: cy + 70 },
      { x: cx + 355, y: cy - 250 },
      { x: cx + 70, y: cy - 375, hasBoostPad: true },
      { x: cx - 320, y: cy - 295 },
      { x: cx - 425, y: cy - 30 },
      { x: cx - 310, y: cy + 305, hasBoostPad: true },
    ];
  }

  if (mapId === 'aurora_summit') {
    return [
      { x: cx, y: cy + 350 },
      { x: cx + 345, y: cy + 280, hasBoostPad: true },
      { x: cx + 415, y: cy },
      { x: cx + 310, y: cy - 295, hasBoostPad: true },
      { x: cx, y: cy - 375 },
      { x: cx - 310, y: cy - 295 },
      { x: cx - 415, y: cy, hasBoostPad: true },
      { x: cx - 345, y: cy + 280 },
    ];
  }

  // glacier_well sweeping circuit
  return [
    { x: cx, y: cy + 345 },
    { x: cx + 335, y: cy + 290, hasBoostPad: true },
    { x: cx + 420, y: cy + 15 },
    { x: cx + 330, y: cy - 285 },
    { x: cx, y: cy - 360, hasBoostPad: true },
    { x: cx - 330, y: cy - 285 },
    { x: cx - 420, y: cy + 15, hasBoostPad: true },
    { x: cx - 335, y: cy + 290 },
  ];
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

export const CAREER_QUESTS: CareerQuest[] = [
  {
    id: 'quest_well_guardian',
    title: 'Clean Water Steward',
    description: 'Contribute 25 Glacial Drops across any arena runs to fund community wells.',
    metric: 'wellDrops',
    target: 25,
    rewardGems: 25,
    rewardXp: 120,
  },
  {
    id: 'quest_snowball_ace',
    title: 'Frost Marksman',
    description: 'Land 12 hits across Survival Snowball or Frost Blaster Shooter runs.',
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
