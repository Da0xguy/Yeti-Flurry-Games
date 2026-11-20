import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Crosshair,
  Droplets,
  Flame,
  Gem,
  Heart,
  Home,
  KeyRound,
  Maximize2,
  Menu,
  Minimize2,
  Pause,
  Play,
  Radar,
  RotateCcw,
  Shield,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type {
  GameModeId,
  MapId,
  RunSummary,
  YetiColorId,
  YetiObject,
} from '../types';
import {
  ARENA_MAPS,
  GAME_MODES,
  getGameModeSpec,
  getMapModeDetails,
  getMapSpec,
  YETI_COLORWAYS,
} from '../data/gameCatalog';
import { soundEngine } from '../lib/sound';
import {
  drawArcticOutpostParallax,
  drawExtractionBunker,
  drawPowerUpIcon,
  drawRaidObstacle2D,
  drawRaidParallaxBuildings,
  drawRaidPlatformSupports,
  drawRunnerHazard2D,
  drawRunnerPlatformFoundations,
  drawStationHazard2D,
  drawStationRoomArchitecture,
  drawStickmanCharacter,
  type StickmanPose,
} from '../lib/stickmanRenderer';
import { ArenaGameOverOverlay } from './ArenaGameOverOverlay';

interface StickmanArcadeCanvasProps {
  yeti: YetiObject | null;
  playerName: string;
  selectedGameMode: GameModeId;
  onChangeGameMode: (mode: GameModeId) => void;
  selectedMapId: MapId;
  onChangeMapId: (mapId: MapId) => void;
  selectedColorway: YetiColorId;
  onChangeColorway: (c: YetiColorId) => void;
  autoLaunchMode: 'launcher' | 'choose_map' | 'tunnel' | null;
  onAutoLaunchHandled: () => void;
  onMintPrompt: () => void;
  onRecordRun: (summary: RunSummary) => Promise<void>;
  onShareRun: (summary: RunSummary) => void;
  onReturnHome: () => void;
}

type ArcadePhase = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

const CANVAS_W = 1200;
const CANVAS_H = 675;
const RAID_FLOOR = 565;

// Top-Down Station Map Constants (Among Us Style 12-Room Facility Escape)
const STATION_W = 2520;
const STATION_H = 1540;
const WING_B_CLUES_REQUIRED = 2;
const AIRLOCK_POD_X = 2230;
const AIRLOCK_POD_Y = 1250;

interface StationRoom {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  floor: string;
  accent: string;
}

interface WallRect {
  x: number;
  y: number;
  w: number;
  h: number;
  doorId?: 'wing_b' | 'airlock';
}

interface StationEdge {
  to: string;
  doorX: number;
  doorY: number;
  requires?: 'wing_b' | 'airlock';
}

const STATION_ROOMS: StationRoom[] = [
  { id: 'cryo_bay', name: 'CRYO BAY', x: 80, y: 80, w: 540, h: 420, floor: '#0d2238', accent: '#38bdf8' },
  { id: 'medbay', name: 'MEDBAY', x: 680, y: 80, w: 540, h: 420, floor: '#0f273d', accent: '#2dd4bf' },
  { id: 'lab', name: 'RESEARCH LAB', x: 1280, y: 80, w: 540, h: 420, floor: '#132444', accent: '#60a5fa' },
  { id: 'electrical', name: 'ELECTRICAL', x: 1880, y: 80, w: 560, h: 420, floor: '#251d3a', accent: '#f59e0b' },
  { id: 'quarters', name: 'CREW QUARTERS', x: 80, y: 560, w: 540, h: 420, floor: '#12203b', accent: '#818cf8' },
  { id: 'cafeteria', name: 'CAFETERIA HUB', x: 680, y: 560, w: 540, h: 420, floor: '#11253e', accent: '#38bdf8' },
  { id: 'reactor', name: 'REACTOR CORE', x: 1280, y: 560, w: 540, h: 420, floor: '#1c1b38', accent: '#c084fc' },
  { id: 'security', name: 'SECURITY HUB', x: 1880, y: 560, w: 560, h: 420, floor: '#231730', accent: '#fb7185' },
  { id: 'storage', name: 'STORAGE BAY', x: 80, y: 1040, w: 540, h: 420, floor: '#182234', accent: '#fb923c' },
  { id: 'comms', name: 'COMMS ARRAY', x: 680, y: 1040, w: 540, h: 420, floor: '#0e253f', accent: '#38bdf8' },
  { id: 'oxygen', name: 'OXYGEN PLANT', x: 1280, y: 1040, w: 540, h: 420, floor: '#0e2a35', accent: '#34d399' },
  { id: 'airlock', name: 'AIRLOCK EXIT', x: 1880, y: 1040, w: 560, h: 420, floor: '#0d2b30', accent: '#34d399' },
];

const STATION_VENTS = [
  { id: 'v_cryo', x: 520, y: 155, room: 'cryo_bay' },
  { id: 'v_med', x: 760, y: 155, room: 'medbay' },
  { id: 'v_lab', x: 1735, y: 150, room: 'lab' },
  { id: 'v_elec', x: 2350, y: 155, room: 'electrical' },
  { id: 'v_react', x: 1735, y: 905, room: 'reactor' },
  { id: 'v_stor', x: 155, y: 1385, room: 'storage' },
  { id: 'v_oxy', x: 1735, y: 1110, room: 'oxygen' },
];

// Solid bulkheads + locked Blast Doors ('wing_b' at x=1820 and 'airlock' guarding Airlock Exit)
const STATION_WALLS: WallRect[] = [
  // Outer Hull (2520x1540)
  { x: 40, y: 40, w: 2440, h: 40 },
  { x: 40, y: 1460, w: 2440, h: 40 },
  { x: 40, y: 80, w: 40, h: 1380 },
  { x: 2440, y: 80, w: 40, h: 1380 },

  // Vertical Divider 1 (x: 620..680) with 140px doorways (220..360, 700..840, 1180..1320)
  { x: 620, y: 80, w: 60, h: 140 },
  { x: 620, y: 360, w: 60, h: 340 },
  { x: 620, y: 840, w: 60, h: 340 },
  { x: 620, y: 1320, w: 60, h: 140 },

  // Vertical Divider 2 (x: 1220..1280) with 140px doorways (220..360, 700..840, 1180..1320)
  { x: 1220, y: 80, w: 60, h: 140 },
  { x: 1220, y: 360, w: 60, h: 340 },
  { x: 1220, y: 840, w: 60, h: 340 },
  { x: 1220, y: 1320, w: 60, h: 140 },

  // Vertical Divider 3 (x: 1820..1880): East Wing Blast Doors ('wing_b') & Airlock Door ('airlock')
  { x: 1820, y: 80, w: 60, h: 140 },
  { x: 1820, y: 220, w: 60, h: 140, doorId: 'wing_b' },
  { x: 1820, y: 360, w: 60, h: 340 },
  { x: 1820, y: 700, w: 60, h: 140, doorId: 'wing_b' },
  { x: 1820, y: 840, w: 60, h: 340 },
  { x: 1820, y: 1180, w: 60, h: 140, doorId: 'airlock' },
  { x: 1820, y: 1320, w: 60, h: 140 },

  // Horizontal Divider 1 (y: 500..560) with 140px doorways (280..420, 880..1020, 1480..1620, 2090..2230)
  { x: 80, y: 500, w: 200, h: 60 },
  { x: 420, y: 500, w: 460, h: 60 },
  { x: 1020, y: 500, w: 460, h: 60 },
  { x: 1620, y: 500, w: 470, h: 60 },
  { x: 2230, y: 500, w: 210, h: 60 },

  // Horizontal Divider 2 (y: 980..1040) with 140px doorways + South Airlock Blast Door
  { x: 80, y: 980, w: 200, h: 60 },
  { x: 420, y: 980, w: 460, h: 60 },
  { x: 1020, y: 980, w: 460, h: 60 },
  { x: 1620, y: 980, w: 470, h: 60 },
  { x: 2090, y: 980, w: 140, h: 60, doorId: 'airlock' },
  { x: 2230, y: 980, w: 210, h: 60 },
];

const STATION_GRAPH: Record<string, StationEdge[]> = {
  cryo_bay: [
    { to: 'medbay', doorX: 650, doorY: 290 },
    { to: 'quarters', doorX: 350, doorY: 530 },
  ],
  medbay: [
    { to: 'cryo_bay', doorX: 650, doorY: 290 },
    { to: 'lab', doorX: 1250, doorY: 290 },
    { to: 'cafeteria', doorX: 950, doorY: 530 },
  ],
  lab: [
    { to: 'medbay', doorX: 1250, doorY: 290 },
    { to: 'electrical', doorX: 1850, doorY: 290, requires: 'wing_b' },
    { to: 'reactor', doorX: 1550, doorY: 530 },
  ],
  electrical: [
    { to: 'lab', doorX: 1850, doorY: 290, requires: 'wing_b' },
    { to: 'security', doorX: 2160, doorY: 530 },
  ],
  quarters: [
    { to: 'cryo_bay', doorX: 350, doorY: 530 },
    { to: 'cafeteria', doorX: 650, doorY: 770 },
    { to: 'storage', doorX: 350, doorY: 1010 },
  ],
  cafeteria: [
    { to: 'medbay', doorX: 950, doorY: 530 },
    { to: 'quarters', doorX: 650, doorY: 770 },
    { to: 'reactor', doorX: 1250, doorY: 770 },
    { to: 'comms', doorX: 950, doorY: 1010 },
  ],
  reactor: [
    { to: 'lab', doorX: 1550, doorY: 530 },
    { to: 'cafeteria', doorX: 1250, doorY: 770 },
    { to: 'security', doorX: 1850, doorY: 770, requires: 'wing_b' },
    { to: 'oxygen', doorX: 1550, doorY: 1010 },
  ],
  security: [
    { to: 'electrical', doorX: 2160, doorY: 530 },
    { to: 'reactor', doorX: 1850, doorY: 770, requires: 'wing_b' },
    { to: 'airlock', doorX: 2160, doorY: 1010, requires: 'airlock' },
  ],
  storage: [
    { to: 'quarters', doorX: 350, doorY: 1010 },
    { to: 'comms', doorX: 650, doorY: 1250 },
  ],
  comms: [
    { to: 'cafeteria', doorX: 950, doorY: 1010 },
    { to: 'storage', doorX: 650, doorY: 1250 },
    { to: 'oxygen', doorX: 1250, doorY: 1250 },
  ],
  oxygen: [
    { to: 'reactor', doorX: 1550, doorY: 1010 },
    { to: 'comms', doorX: 1250, doorY: 1250 },
    { to: 'airlock', doorX: 1850, doorY: 1250, requires: 'airlock' },
  ],
  airlock: [
    { to: 'oxygen', doorX: 1850, doorY: 1250, requires: 'airlock' },
    { to: 'security', doorX: 2160, doorY: 1010, requires: 'airlock' },
  ],
};

function getStationRoomAt(x: number, y: number): StationRoom {
  const exact = STATION_ROOMS.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  if (exact) return exact;
  let best = STATION_ROOMS[0];
  let bestD = Infinity;
  for (const r of STATION_ROOMS) {
    const d = Math.hypot(x - (r.x + r.w * 0.5), y - (r.y + r.h * 0.5));
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

function getNextStationWaypoint(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  wingBOpen: boolean,
  airlockOpen: boolean
): { x: number; y: number; sameRoom: boolean; reachable: boolean } {
  const startRoom = getStationRoomAt(fromX, fromY);
  const goalRoom = getStationRoomAt(toX, toY);
  if (startRoom.id === goalRoom.id) {
    return { x: toX, y: toY, sameRoom: true, reachable: true };
  }
  const visited = new Set<string>([startRoom.id]);
  const queue: { id: string; firstDoor?: { x: number; y: number } }[] = [{ id: startRoom.id }];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const edges = STATION_GRAPH[cur.id] || [];
    for (const edge of edges) {
      if (edge.requires === 'wing_b' && !wingBOpen) continue;
      if (edge.requires === 'airlock' && !airlockOpen) continue;
      if (visited.has(edge.to)) continue;
      const firstDoor = cur.firstDoor || { x: edge.doorX, y: edge.doorY };
      if (edge.to === goalRoom.id) {
        return { x: firstDoor.x, y: firstDoor.y, sameRoom: false, reachable: true };
      }
      visited.add(edge.to);
      queue.push({ id: edge.to, firstDoor });
    }
  }
  return {
    x: startRoom.x + startRoom.w * 0.5,
    y: startRoom.y + startRoom.h * 0.5,
    sameRoom: false,
    reachable: false,
  };
}

interface FighterEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  knockVx?: number;
  knockVy?: number;
  facing: 1 | -1;
  aimY?: number;
  hp: number;
  maxHp: number;
  pose: StickmanPose;
  actionTimer: number;
  actionDuration: number;
  dashTimer: number;
  dashCooldown: number;
  coyoteTimer: number;
  jumpBufferTimer: number;
  hitCooldown: number;
  invulnTimer: number;
  flashTimer: number;
  grounded: boolean;
  jumpsLeft: number;
  stamina: number;
  finisher: number;
  shieldUntil: number;
  rageUntil: number;
  magnetUntil: number;
  dropThroughUntil: number;
  stunnedUntil: number;
  ropeBoostUntil: number;
  slowUntil?: number;
  hasHitCurrentSwing: boolean;
  id?: string;
  name?: string;
  stroke?: string;
  accent?: string;
  colorway?: YetiColorId;
  speed?: number;
  aggro?: number;
  isBoss?: boolean;
  aiCooldown?: number;
  bossPhaseCd?: number;
  bossState?: 'idle' | 'leap' | 'dash' | 'guard';
  summonedHalf?: boolean;
  patrolMinX?: number;
  patrolMaxX?: number;
  patrolTargetX?: number;
  patrolTargetY?: number;
  alertedUntil?: number;
  ventCooldown?: number;
}

interface RaidPlatform {
  x: number;
  y: number;
  w: number;
}

interface RaidBarrel {
  id: string;
  x: number;
  y: number;
  hp: number;
}

interface RaidObstacle {
  id: string;
  x: number;
  y: number;
  targetY: number;
  vy: number;
  w: number;
  h: number;
  kind: 'laser_barrier' | 'airdrop_crate' | 'cryo_mine';
  hp: number;
  maxHp: number;
  falling?: boolean;
  hitCooldown?: number;
}

interface EscapeClue {
  id: string;
  x: number;
  y: number;
  room: string;
  label: string;
  collected: boolean;
  scanProgress: number;
}

interface StationHazard {
  id: string;
  x: number;
  y: number;
  radius: number;
  kind: 'cryo_spill' | 'shock_wire' | 'cargo_block' | 'sabotage_mine';
  hp: number;
  maxHp: number;
  cooldownUntil?: number;
}

interface Pickup2D {
  id: string;
  x: number;
  y: number;
  vy: number;
  kind: 'drop' | 'gem' | 'medkit' | 'shield' | 'rage' | 'magnet';
}

interface Projectile2D {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: 'player' | 'enemy';
  color: string;
  radius: number;
  damage?: number;
  piercing?: boolean;
  stunOnly?: boolean;
  life?: number;
}

interface Particle2D {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface FloatingBanner {
  text: string;
  subtext?: string;
  color: string;
  until: number;
}

interface RunnerPlatform {
  x: number;
  y: number;
  w: number;
}

interface RunnerHazard {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'spike' | 'icicle' | 'crate' | 'falling_boulder' | 'sludge';
  hp: number;
  vy?: number;
  targetY?: number;
  landed?: boolean;
}

function getMapBackdropColors(mapId: MapId) {
  if (mapId === 'volcanic_springs') {
    return {
      skyTop: '#160b14',
      skyBot: '#3b1518',
      ridgeFar: '#271219',
      ridgeNear: '#431a1c',
      floorFill: '#241418',
      floorTrim: '#fb923c',
      accent: '#fb923c',
      particle: '#fdba74',
    };
  }
  if (mapId === 'aurora_summit') {
    return {
      skyTop: '#071426',
      skyBot: '#102f44',
      ridgeFar: '#0c243b',
      ridgeNear: '#133a54',
      floorFill: '#0e283e',
      floorTrim: '#2dd4bf',
      accent: '#2dd4bf',
      particle: '#a7f3d0',
    };
  }
  return {
    skyTop: '#061224',
    skyBot: '#0f2d4f',
    ridgeFar: '#0c213c',
    ridgeNear: '#13365e',
    floorFill: '#123154',
    floorTrim: '#38bdf8',
    accent: '#38bdf8',
    particle: '#bae6fd',
  };
}

function buildRaidStage(stage: number, colorwayForBoss: YetiColorId) {
  const levelEndX = 4150 + (stage - 1) * 650;
  const platforms: RaidPlatform[] = [];
  const barrels: RaidBarrel[] = [];
  const obstacles: RaidObstacle[] = [];
  const enemies: FighterEntity[] = [];
  const pickups: Pickup2D[] = [];

  for (let x = 520; x < levelEndX - 420; x += 480) {
    const h = 425 - ((Math.floor(x / 480) % 2) * 85);
    const w = 230 + (Math.floor(x / 300) % 2) * 60;
    platforms.push({ x, y: h, w });

    if (Math.random() < 0.75) {
      barrels.push({
        id: `br_${stage}_${x}`,
        x: x + w * 0.55,
        y: Math.random() < 0.45 ? h : RAID_FLOOR,
        hp: 25,
      });
    }

    const obsRoll = Math.floor(x / 480) % 3;
    if (obsRoll === 0) {
      obstacles.push({
        id: `ro_${stage}_${x}`,
        x: x + 90,
        y: RAID_FLOOR,
        targetY: RAID_FLOOR,
        vy: 0,
        w: 30,
        h: 92,
        kind: 'laser_barrier',
        hp: 50,
        maxHp: 50,
      });
    } else if (obsRoll === 1) {
      obstacles.push({
        id: `ro_${stage}_${x}`,
        x: x + w * 0.3,
        y: RAID_FLOOR,
        targetY: RAID_FLOOR,
        vy: 0,
        w: 56,
        h: 54,
        kind: 'airdrop_crate',
        hp: 45,
        maxHp: 45,
      });
    } else {
      obstacles.push({
        id: `ro_${stage}_${x}`,
        x: x + 135,
        y: RAID_FLOOR,
        targetY: RAID_FLOOR,
        vy: 0,
        w: 36,
        h: 16,
        kind: 'cryo_mine',
        hp: 20,
        maxHp: 20,
      });
    }

    const puKinds: Pickup2D['kind'][] = ['drop', 'gem', 'medkit', 'shield', 'rage', 'magnet'];
    pickups.push({
      id: `rpk_${stage}_${x}`,
      x: x + w * 0.4,
      y: h - 32,
      vy: 0,
      kind: puKinds[Math.floor(x / 480) % puKinds.length],
    });
  }

  const gruntCount = 6 + stage * 2;
  for (let i = 0; i < gruntCount; i++) {
    const ex = 640 + i * ((levelEndX - 1050) / gruntCount);
    const onPlat = i % 3 === 1;
    const ey = onPlat ? 425 : RAID_FLOOR;
    enemies.push({
      x: ex,
      y: ey,
      vx: 0,
      vy: 0,
      facing: -1,
      hp: 48 + stage * 14,
      maxHp: 48 + stage * 14,
      pose: 'idle',
      actionTimer: 0,
      actionDuration: 0.25,
      dashTimer: 0,
      dashCooldown: 0,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      hitCooldown: 0,
      invulnTimer: 0,
      flashTimer: 0,
      grounded: true,
      jumpsLeft: 1,
      stamina: 100,
      finisher: 0,
      shieldUntil: 0,
      rageUntil: 0,
      magnetUntil: 0,
      dropThroughUntil: 0,
      stunnedUntil: 0,
      ropeBoostUntil: 0,
      hasHitCurrentSwing: false,
      name: i % 2 === 0 ? 'Syndicate Hitman' : 'Bean Enforcer',
      stroke: i % 2 === 0 ? '#fb7185' : '#fb923c',
      accent: '#facc15',
      speed: 185 + stage * 22,
      aggro: 0.78 + stage * 0.08,
      aiCooldown: 0.7 + (i % 3) * 0.25,
      patrolMinX: ex - 160,
      patrolMaxX: ex + 160,
    });
  }

  // Hard Multi-Phase End-of-Level Syndicate Boss guarding Extraction Bunker
  enemies.push({
    x: levelEndX - 280,
    y: RAID_FLOOR,
    vx: 0,
    vy: 0,
    facing: -1,
    hp: 280 + stage * 80,
    maxHp: 280 + stage * 80,
    pose: 'guard',
    actionTimer: 0,
    actionDuration: 0.35,
    dashTimer: 0,
    dashCooldown: 0,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    hitCooldown: 0,
    invulnTimer: 0,
    flashTimer: 0,
    grounded: true,
    jumpsLeft: 1,
    stamina: 100,
    finisher: 0,
    shieldUntil: 0,
    rageUntil: 0,
    magnetUntil: 0,
    dropThroughUntil: 0,
    stunnedUntil: 0,
    ropeBoostUntil: 0,
    hasHitCurrentSwing: false,
    isBoss: true,
    name: stage === 3 ? 'Shadow Bean Overlord' : `Gate Warlord Lv.${stage}`,
    stroke: '#f43f5e',
    accent: '#fde047',
    colorway: colorwayForBoss,
    speed: 245 + stage * 22,
    aggro: 0.98,
    aiCooldown: 0.65,
    bossPhaseCd: 2.2,
    bossState: 'idle',
    summonedHalf: false,
    patrolMinX: levelEndX - 620,
    patrolMaxX: levelEndX - 110,
  });

  return { levelEndX, platforms, barrels, obstacles, enemies, pickups };
}

function buildEscapeSector(sector: number) {
  const clueTemplates: { x: number; y: number; room: string; label: string }[] = [
    { x: 270, y: 280, room: 'CRYO BAY', label: 'Biometric Cryo Key' },
    { x: 1410, y: 650, room: 'REACTOR CORE', label: 'Core Override Code' },
    { x: 1045, y: 1295, room: 'COMMS ARRAY', label: 'Encrypted Uplink Chip' },
    { x: 340, y: 1250, room: 'STORAGE BAY', label: 'Cargo Vault Pass' },
    { x: 2160, y: 245, room: 'ELECTRICAL', label: 'High-Volt Breaker Key' },
    { x: 1680, y: 225, room: 'RESEARCH LAB', label: 'Cryo Access Pad' },
    { x: 2040, y: 805, room: 'SECURITY HUB', label: 'Warden Override Seal' },
    { x: 1650, y: 1255, room: 'OXYGEN PLANT', label: 'Atmos Purge Token' },
  ];
  const cluesNeeded = Math.min(8, 4 + sector); // Sector 1 -> 5 clues, Sector 2 -> 6, Sector 3 -> 7
  const clues: EscapeClue[] = clueTemplates.slice(0, cluesNeeded).map((c, idx) => ({
    id: `clue_${sector}_${idx}`,
    x: c.x,
    y: c.y,
    room: c.room,
    label: c.label,
    collected: false,
    scanProgress: 0,
  }));

  const imposterSpawns = [
    { x: 350, y: 290, name: 'Red Imposter' },
    { x: 1620, y: 260, name: 'Vent Stalker' },
    { x: 1660, y: 690, name: 'Reactor Phantom' },
    { x: 960, y: 1320, name: 'Comms Saboteur' },
    { x: 350, y: 1250, name: 'Cargo Lurker' },
    { x: 2160, y: 250, name: 'Volt Assassin' },
    { x: 2120, y: 780, name: 'Security Enforcer' },
  ];
  const impCount = Math.min(imposterSpawns.length, 4 + sector); // 5, 6, 7 imposters
  const imposters: FighterEntity[] = imposterSpawns.slice(0, impCount).map((sp, idx) => ({
    x: sp.x,
    y: sp.y,
    vx: 0,
    vy: 0,
    knockVx: 0,
    knockVy: 0,
    facing: idx % 2 === 0 ? -1 : 1,
    hp: 105 + sector * 22,
    maxHp: 105 + sector * 22,
    pose: 'idle',
    actionTimer: 0,
    actionDuration: 0.25,
    dashTimer: 0,
    dashCooldown: 0,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    hitCooldown: 0,
    invulnTimer: 0,
    flashTimer: 0,
    grounded: true,
    jumpsLeft: 1,
    stamina: 100,
    finisher: 0,
    shieldUntil: 0,
    rageUntil: 0,
    magnetUntil: 0,
    dropThroughUntil: 0,
    stunnedUntil: 0,
    ropeBoostUntil: 0,
    hasHitCurrentSwing: false,
    name: sp.name,
    stroke: '#ef4444',
    accent: '#fb7185',
    speed: 172 + sector * 18 + (idx % 3) * 8,
    aggro: 0.85,
    aiCooldown: 0.8 + (idx % 3) * 0.25,
    bossPhaseCd: 3.5 + idx * 0.7,
    ventCooldown: 8 + idx * 2.5,
  }));

  // Hard End-of-Level Boss guarding the Airlock Escape Shuttle inside Room 12 (AIRLOCK EXIT)
  imposters.push({
    x: 2050,
    y: 1250,
    vx: 0,
    vy: 0,
    knockVx: 0,
    knockVy: 0,
    facing: -1,
    hp: 340 + sector * 110,
    maxHp: 340 + sector * 110,
    pose: 'idle',
    actionTimer: 0,
    actionDuration: 0.3,
    dashTimer: 0,
    dashCooldown: 0,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    hitCooldown: 0,
    invulnTimer: 0,
    flashTimer: 0,
    grounded: true,
    jumpsLeft: 1,
    stamina: 100,
    finisher: 0,
    shieldUntil: 0,
    rageUntil: 0,
    magnetUntil: 0,
    dropThroughUntil: 0,
    stunnedUntil: 0,
    ropeBoostUntil: 0,
    hasHitCurrentSwing: false,
    isBoss: true,
    name: sector === 3 ? 'Apex Imposter Overlord' : `Airlock Warden Lv.${sector}`,
    stroke: '#f43f5e',
    accent: '#fde047',
    speed: 210 + sector * 18,
    aggro: 0.98,
    aiCooldown: 1.0,
    bossPhaseCd: 2.5,
    summonedHalf: false,
    ventCooldown: 999,
  });

  // Sabotaged Room/Corridor Obstacles & Traps across the 12-Room Facility
  const hazards: StationHazard[] = [
    { id: `sh_1_${sector}`, x: 460, y: 245, radius: 44, kind: 'cryo_spill', hp: 99, maxHp: 99 },
    { id: `sh_2_${sector}`, x: 950, y: 265, radius: 26, kind: 'cargo_block', hp: 50, maxHp: 50 },
    { id: `sh_3_${sector}`, x: 1620, y: 295, radius: 34, kind: 'shock_wire', hp: 99, maxHp: 99 },
    { id: `sh_4_${sector}`, x: 2150, y: 315, radius: 34, kind: 'shock_wire', hp: 99, maxHp: 99 },
    { id: `sh_5_${sector}`, x: 350, y: 690, radius: 44, kind: 'cryo_spill', hp: 99, maxHp: 99 },
    { id: `sh_6_${sector}`, x: 1410, y: 840, radius: 26, kind: 'cargo_block', hp: 50, maxHp: 50 },
    { id: `sh_7_${sector}`, x: 1690, y: 830, radius: 22, kind: 'sabotage_mine', hp: 20, maxHp: 20 },
    { id: `sh_8_${sector}`, x: 2120, y: 695, radius: 24, kind: 'sabotage_mine', hp: 20, maxHp: 20 },
    { id: `sh_9_${sector}`, x: 420, y: 1180, radius: 26, kind: 'cargo_block', hp: 50, maxHp: 50 },
    { id: `sh_10_${sector}`, x: 950, y: 1140, radius: 44, kind: 'cryo_spill', hp: 99, maxHp: 99 },
    { id: `sh_11_${sector}`, x: 1550, y: 1320, radius: 34, kind: 'shock_wire', hp: 99, maxHp: 99 },
    { id: `sh_12_${sector}`, x: 1990, y: 1250, radius: 22, kind: 'sabotage_mine', hp: 20, maxHp: 20 },
  ];

  const pickups: Pickup2D[] = [
    { id: `ep_1_${sector}`, x: 760, y: 740, vy: 0, kind: 'drop' },
    { id: `ep_2_${sector}`, x: 195, y: 400, vy: 0, kind: 'shield' },
    { id: `ep_3_${sector}`, x: 1120, y: 240, vy: 0, kind: 'medkit' },
    { id: `ep_4_${sector}`, x: 1410, y: 220, vy: 0, kind: 'gem' },
    { id: `ep_5_${sector}`, x: 2280, y: 190, vy: 0, kind: 'rage' },
    { id: `ep_6_${sector}`, x: 480, y: 860, vy: 0, kind: 'magnet' },
    { id: `ep_7_${sector}`, x: 1670, y: 1140, vy: 0, kind: 'shield' },
    { id: `ep_8_${sector}`, x: 2040, y: 890, vy: 0, kind: 'medkit' },
  ];

  return { clues, imposters, hazards, pickups };
}

export const StickmanArcadeCanvas: React.FC<StickmanArcadeCanvasProps> = ({
  yeti,
  playerName,
  selectedGameMode,
  onChangeGameMode,
  selectedMapId,
  onChangeMapId,
  selectedColorway,
  onChangeColorway,
  autoLaunchMode,
  onAutoLaunchHandled,
  onMintPrompt,
  onRecordRun,
  onShareRun,
  onReturnHome,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<ArcadePhase>('MENU');
  const [menuStep, setMenuStep] = useState<'game' | 'map'>('game');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [muted, setMuted] = useState(soundEngine.muted);
  const [claimStatus, setClaimStatus] = useState<'idle' | 'claiming' | 'claimed'>('idle');
  const [summary, setSummary] = useState<RunSummary | null>(null);

  const [hud, setHud] = useState({
    hp: 100,
    maxHp: 100,
    finisher: 0,
    stamina: 100,
    enemyHp: 0,
    enemyMaxHp: 100,
    enemyName: '',
    score: 0,
    drops: 0,
    gems: 0,
    combo: 0,
    waveOrBout: 1,
    timeLeft: 180,
    shieldLeft: 0,
    rageLeft: 0,
    magnetLeft: 0,
    cluesFound: 0,
    cluesTotal: 3,
    currentRoom: 'CAFETERIA HUB',
    wingBOpen: false,
    airlockOpen: false,
    exitProgress: 0,
    nearClueLabel: '',
    slowMoActive: false,
  });

  const keysRef = useRef<Record<string, boolean>>({});
  const stateRef = useRef<{
    phase: ArcadePhase;
    mode: GameModeId;
    mapId: MapId;
    elapsed: number;
    timeLeft: number;
    score: number;
    drops: number;
    gems: number;
    hitsLanded: number;
    cratesSmashed: number;
    knockouts: number;
    combo: number;
    comboTimer: number;
    waveOrBout: number;
    shake: number;
    cameraX: number;
    cameraY: number;
    levelEndX: number;
    slowMoUntil: number;
    radarPingUntil: number;
    pickupSpawnTimer: number;
    airdropCooldown: number;
    runnerHeavyCd: number;
    runnerSpeed: number;
    runnerScroll: number;
    player: FighterEntity;
    enemies: FighterEntity[];
    raidPlatforms: RaidPlatform[];
    raidBarrels: RaidBarrel[];
    raidObstacles: RaidObstacle[];
    escapeClues: EscapeClue[];
    stationHazards: StationHazard[];
    pickups: Pickup2D[];
    projectiles: Projectile2D[];
    particles: Particle2D[];
    runnerPlatforms: RunnerPlatform[];
    runnerHazards: RunnerHazard[];
    banner: FloatingBanner | null;
    ambientFlakes: { x: number; y: number; s: number; spd: number }[];
  } | null>(null);

  const makeInitialFighter = (isPlayer: boolean, x: number, y: number): FighterEntity => ({
    x,
    y,
    vx: 0,
    vy: 0,
    facing: isPlayer ? 1 : -1,
    aimY: 0,
    hp: 100,
    maxHp: 100,
    pose: 'idle',
    actionTimer: 0,
    actionDuration: 0.2,
    dashTimer: 0,
    dashCooldown: 0,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    hitCooldown: 0,
    invulnTimer: 0,
    flashTimer: 0,
    grounded: true,
    jumpsLeft: 2,
    stamina: 100,
    finisher: isPlayer ? 30 : 0,
    shieldUntil: 0,
    rageUntil: 0,
    magnetUntil: 0,
    dropThroughUntil: 0,
    stunnedUntil: 0,
    ropeBoostUntil: 0,
    slowUntil: 0,
    hasHitCurrentSwing: false,
    colorway: isPlayer ? selectedColorway : 'classic_lofi',
  });

  const spawnParticles = (
    x: number,
    y: number,
    color: string,
    count = 10,
    speed = 240
  ) => {
    const st = stateRef.current;
    if (!st) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.85) * speed;
      st.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 50,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        color,
        size: 3 + Math.random() * 4,
      });
    }
  };

  const showBanner = (text: string, subtext: string | undefined, color: string, ms = 1800) => {
    if (!stateRef.current) return;
    stateRef.current.banner = {
      text,
      subtext,
      color,
      until: performance.now() + ms,
    };
  };

  const initMatchState = useCallback(
    (mode: GameModeId, mapId: MapId) => {
      const ambientFlakes = Array.from({ length: 42 }, () => ({
        x: Math.random() * CANVAS_W,
        y: Math.random() * CANVAS_H,
        s: 1.5 + Math.random() * 2.5,
        spd: 35 + Math.random() * 65,
      }));

      let player = makeInitialFighter(true, 180, RAID_FLOOR);
      let enemies: FighterEntity[] = [];
      let raidPlatforms: RaidPlatform[] = [];
      let raidBarrels: RaidBarrel[] = [];
      let raidObstacles: RaidObstacle[] = [];
      let escapeClues: EscapeClue[] = [];
      let stationHazards: StationHazard[] = [];
      let pickups: Pickup2D[] = [];
      let levelEndX = 4150;
      let runnerPlatforms: RunnerPlatform[] = [];

      if (mode === 'stickman_wrestling') {
        const built = buildRaidStage(1, 'sunset_ember');
        levelEndX = built.levelEndX;
        raidPlatforms = built.platforms;
        raidBarrels = built.barrels;
        raidObstacles = built.obstacles;
        enemies = built.enemies;
        pickups = built.pickups;
        player = makeInitialFighter(true, 160, RAID_FLOOR);
      } else if (mode === 'stickman_brawl') {
        const built = buildEscapeSector(1);
        escapeClues = built.clues;
        stationHazards = built.hazards;
        enemies = built.imposters;
        pickups = built.pickups;
        player = makeInitialFighter(true, 930, 770);
      } else {
        player = makeInitialFighter(true, 240, 470);
        runnerPlatforms = [
          { x: 0, y: 470, w: 680 },
          { x: 760, y: 440, w: 460 },
          { x: 1300, y: 390, w: 360 },
          { x: 1740, y: 470, w: 540 },
        ];
      }

      const totalTime = mode === 'stickman_wrestling' ? 210 : mode === 'stickman_brawl' ? 260 : 180;

      stateRef.current = {
        phase: 'PLAYING',
        mode,
        mapId,
        elapsed: 0,
        timeLeft: totalTime,
        score: 0,
        drops: 0,
        gems: 0,
        hitsLanded: 0,
        cratesSmashed: 0,
        knockouts: 0,
        combo: 0,
        comboTimer: 0,
        waveOrBout: 1,
        shake: 0,
        cameraX: mode === 'stickman_brawl' ? Math.max(0, Math.min(STATION_W - CANVAS_W, player.x - CANVAS_W * 0.5)) : 0,
        cameraY: mode === 'stickman_brawl' ? Math.max(0, Math.min(STATION_H - CANVAS_H, player.y - CANVAS_H * 0.5)) : 0,
        levelEndX,
        slowMoUntil: 0,
        radarPingUntil: performance.now() + 2600,
        pickupSpawnTimer: 4.5,
        airdropCooldown: 3.6,
        runnerHeavyCd: 0,
        runnerSpeed: 370,
        runnerScroll: 0,
        player,
        enemies,
        raidPlatforms,
        raidBarrels,
        raidObstacles,
        escapeClues,
        stationHazards,
        pickups,
        projectiles: [],
        particles: [],
        runnerPlatforms,
        runnerHazards: [],
        banner: null,
        ambientFlakes,
      };

      if (mode === 'stickman_wrestling') {
        soundEngine.playBell(1);
        showBanner(
          'STAGE 1: COMPOUND BREACH',
          'Blast Syndicate guards (J), Slow-Mo Dive (Space), Reach EXIT Gate!',
          '#fbbf24',
          2400
        );
      } else if (mode === 'stickman_brawl') {
        soundEngine.playBell(1);
        showBanner(
          'SECTOR 1: FIND 5 CLUES ACROSS 12 ROOMS',
          'Find 2 Clues to unlock East Wing, stun Imposters (K), reach Airlock!',
          '#2dd4bf',
          2800
        );
      } else {
        soundEngine.playBoost();
        showBanner('LEVEL 1: GLACIER RUN!', 'Double-Jump (W/Space), Slide (S), Blast Crates (J)', '#2dd4bf', 2000);
      }

      setSummary(null);
      setClaimStatus('idle');
      setPhase('PLAYING');
    },
    [selectedColorway]
  );

  const finishMatch = useCallback((victory: boolean) => {
    const st = stateRef.current;
    if (!st || st.phase === 'GAME_OVER') return;
    st.phase = 'GAME_OVER';
    setPhase('GAME_OVER');

    soundEngine.playRoundEnd(victory);

    const cleanDrops = Math.max(1, st.drops + (victory ? 8 : 2));
    const cleanGems = Math.max(1, st.gems + (victory ? 5 : 1));
    const cleanScore = Math.max(50, Math.round(st.score + (victory ? 400 : 0)));
    const tasksDone = Math.min(
      3,
      (st.hitsLanded >= 6 ? 1 : 0) +
        (cleanDrops >= 6 ? 1 : 0) +
        (st.knockouts >= 2 || st.cratesSmashed >= 3 ? 1 : 0)
    );

    setSummary({
      score: cleanScore,
      wellDrops: cleanDrops,
      frostGems: cleanGems,
      knockouts: st.knockouts,
      survivalSeconds: Math.max(1, Math.round(st.elapsed)),
      mode: 'solo',
      gameMode: st.mode,
      mapId: st.mapId,
      hitsLanded: st.hitsLanded,
      cratesSmashed: st.cratesSmashed,
      wellBanks: 0,
      tasksDone,
      rank: victory ? 1 : st.player.hp <= 0 ? 4 : 2,
      totalContenders: st.mode === 'stickman_wrestling' ? 3 : 6,
      xpEarned: Math.round(cleanScore / 5) + 25 + tasksDone * 20,
      extraStatLabel:
        st.mode === 'stickman_wrestling'
          ? 'Stage Reached'
          : st.mode === 'stickman_brawl'
          ? 'Sector Cleared'
          : 'Distance (m)',
      extraStatValue:
        st.mode === 'stickman_run'
          ? `${Math.round(st.runnerScroll / 16)}m`
          : `${st.waveOrBout}/3`,
    });
  }, []);

  const enterFullscreenSafe = useCallback(async () => {
    const el = containerRef.current;
    if (!el || document.fullscreenElement) return;
    try {
      await el.requestFullscreen();
    } catch {
      // Browser gesture or sandboxed iframe fallback
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    } else {
      await enterFullscreenSafe();
    }
  }, [enterFullscreenSafe]);

  const handleExitToLanding = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
    onReturnHome();
  }, [onReturnHome]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const handleStartFromMenu = useCallback(async () => {
    await enterFullscreenSafe();
    initMatchState(selectedGameMode, selectedMapId);
  }, [enterFullscreenSafe, initMatchState, selectedGameMode, selectedMapId]);

  useEffect(() => {
    if (!autoLaunchMode) return;
    setMenuStep(autoLaunchMode === 'choose_map' ? 'map' : 'game');
    setPhase('MENU');
    if (stateRef.current) stateRef.current.phase = 'MENU';
    onAutoLaunchHandled();
  }, [autoLaunchMode, onAutoLaunchHandled]);

  const collectEscapeClue = useCallback((clue: EscapeClue) => {
    const st = stateRef.current;
    if (!st || clue.collected) return;
    clue.collected = true;
    clue.scanProgress = 1;
    st.cratesSmashed += 1;
    st.drops += 3;
    st.gems += 1;
    st.score += 180;
    soundEngine.playPickup('gem');
    spawnParticles(clue.x, clue.y - 20, '#fde047', 16, 220);

    const found = st.escapeClues.filter((c) => c.collected).length;
    const total = st.escapeClues.length;
    if (found === WING_B_CLUES_REQUIRED && total > WING_B_CLUES_REQUIRED) {
      soundEngine.playBoost();
      showBanner(
        `CLUE ${found}/${total}: ${clue.label.toUpperCase()}`,
        'EAST SECURITY WING UNLOCKED!',
        '#38bdf8',
        2100
      );
    } else if (found >= total) {
      soundEngine.playBell(2);
      showBanner('ALL CLUES FOUND!', 'AIRLOCK ESCAPE DOOR OPEN! DEFEAT WARDEN & ESCAPE!', '#34d399', 2600);
    } else {
      showBanner(`CLUE ${found}/${total} FOUND!`, `${clue.label} uploaded`, '#fde047', 1500);
    }
  }, []);

  // Responsive Action Triggers
  const triggerAction = useCallback(
    (action: 'jump' | 'jab' | 'heavy' | 'special' | 'dash' | 'interact' | 'wave') => {
      const st = stateRef.current;
      if (!st || st.phase !== 'PLAYING') return;
      const p = st.player;
      const now = performance.now();

      // === AMONG US MULTI-ROOM ESCAPE ACTIONS ===
      if (st.mode === 'stickman_brawl') {
        if (action === 'dash') {
          if (p.stamina < 20 || p.dashCooldown > 0) return;
          p.stamina = Math.max(0, p.stamina - 22);
          p.dashTimer = 0.22;
          p.dashCooldown = 0.45;
          p.invulnTimer = Math.max(p.invulnTimer, 0.26);
          const dx = (keysRef.current['d'] || keysRef.current['arrowright'] ? 1 : 0) -
            (keysRef.current['a'] || keysRef.current['arrowleft'] ? 1 : 0);
          const dy = (keysRef.current['s'] || keysRef.current['arrowdown'] ? 1 : 0) -
            (keysRef.current['w'] || keysRef.current['arrowup'] ? 1 : 0);
          const len = Math.hypot(dx, dy);
          if (len > 0) {
            p.vx = (dx / len) * 620;
            p.vy = (dy / len) * 620;
          } else {
            p.vx = p.facing * 620;
            p.vy = (p.aimY || 0) * 620;
          }
          soundEngine.playDash();
          spawnParticles(p.x, p.y - 30, '#2dd4bf', 10, 170);
          return;
        }

        if (action === 'special') {
          st.radarPingUntil = now + 2600;
          soundEngine.playPickup('power');
          const found = st.escapeClues.filter((c) => c.collected).length;
          const allFound = found >= st.escapeClues.length;
          showBanner(
            allFound ? 'RADAR: FOLLOW GREEN ARROW TO AIRLOCK!' : 'RADAR PING: FOLLOW GOLD ARROW TO CLUE!',
            undefined,
            allFound ? '#34d399' : '#fde047',
            1300
          );
          return;
        }

        if (action === 'interact' || action === 'jab') {
          const nearClue = st.escapeClues.find(
            (c) => !c.collected && Math.hypot(c.x - p.x, c.y - p.y) < 82
          );
          if (nearClue) {
            p.pose = 'jab';
            p.actionTimer = 0.22;
            p.actionDuration = 0.22;
            collectEscapeClue(nearClue);
            return;
          }
        }

        if (action === 'heavy' || action === 'jab') {
          if (p.hitCooldown > 0) return;
          const isHeavy = action === 'heavy';
          p.hitCooldown = isHeavy ? 0.45 : 0.28;
          p.pose = isHeavy ? 'heavy' : 'jab';
          p.actionTimer = 0.22;
          p.actionDuration = 0.22;
          const dirX = p.facing;
          const dirY = p.aimY || 0;
          const mag = Math.hypot(dirX, dirY) || 1;
          st.projectiles.push({
            x: p.x + (dirX / mag) * 26,
            y: p.y - 38 + (dirY / mag) * 18,
            vx: (dirX / mag) * (isHeavy ? 760 : 690),
            vy: (dirY / mag) * (isHeavy ? 760 : 690),
            owner: 'player',
            color: isHeavy ? '#fbbf24' : '#2dd4bf',
            radius: isHeavy ? 11 : 8,
            damage: isHeavy ? 38 : 22,
            stunOnly: isHeavy,
            life: isHeavy ? 0.78 : 0.65,
          });
          soundEngine.playThrow();
        }
        return;
      }

      // === JUMP (Killer Bean Raid & Glacier Run) ===
      if (action === 'jump') {
        if (p.grounded || p.coyoteTimer > 0 || p.jumpsLeft > 0) {
          const isFirstJump = p.grounded || p.coyoteTimer > 0;
          p.vy = isFirstJump ? -645 : -565;
          p.grounded = false;
          p.coyoteTimer = 0;
          p.jumpsLeft = isFirstJump ? 1 : 0;
          p.dashTimer = 0;
          p.pose = 'jump';
          soundEngine.playDash();
          spawnParticles(p.x, p.y, '#bae6fd', 6, 120);
        } else {
          p.jumpBufferTimer = 0.14;
        }
        return;
      }

      if (action === 'dash') {
        if (st.mode === 'stickman_run') {
          triggerAction('jump');
          return;
        }
        // Killer Bean Slow-Motion Bullet-Time Dive!
        if (p.stamina < 18 || p.dashCooldown > 0) return;
        p.stamina = Math.max(0, p.stamina - 22);
        p.dashTimer = 0.24;
        p.dashCooldown = 0.42;
        p.actionTimer = 0.24;
        p.actionDuration = 0.24;
        p.pose = 'slide';
        p.vx = p.facing * 720;
        p.vy = Math.min(p.vy, -190);
        p.invulnTimer = Math.max(p.invulnTimer, 0.34);
        st.slowMoUntil = now + 820;
        soundEngine.playDash();
        spawnParticles(p.x, p.y - 36, '#38bdf8', 12, 180);
        showBanner('SLOW-MO BULLET DIVE!', undefined, '#38bdf8', 750);
        return;
      }

      if (st.mode === 'stickman_run') {
        if (action === 'special') {
          if (p.finisher < 100) {
            showBanner('NEED 100% MEGA CHARGE!', 'Hit crates & boss to charge', '#94a3b8', 900);
            return;
          }
          p.finisher = 0;
          p.pose = 'finisher';
          p.actionTimer = 0.3;
          p.actionDuration = 0.3;
          st.shake = 10;
          st.projectiles.push({
            x: p.x + 30,
            y: p.y - 48,
            vx: 1020,
            vy: 0,
            owner: 'player',
            color: '#fbbf24',
            radius: 17,
            damage: 95,
            piercing: true,
          });
          soundEngine.playSlam();
          showBanner('GLACIER MEGA-BEAM!', undefined, '#fbbf24', 950);
          return;
        }
        if (action === 'heavy') {
          if (st.runnerHeavyCd > 0) return;
          st.runnerHeavyCd = 1.05;
          p.pose = 'heavy';
          p.actionTimer = 0.22;
          p.actionDuration = 0.22;
          st.projectiles.push({
            x: p.x + 28,
            y: p.y - 48,
            vx: 920,
            vy: 0,
            owner: 'player',
            color: '#fbbf24',
            radius: 14,
            damage: 58,
            piercing: true,
          });
          soundEngine.playPunch(true);
          return;
        }
        if (action === 'jab') {
          if (p.hitCooldown > 0) return;
          p.hitCooldown = 0.2;
          p.pose = 'jab';
          p.actionTimer = 0.18;
          p.actionDuration = 0.18;
          st.projectiles.push({
            x: p.x + 28,
            y: p.y - 48,
            vx: 840,
            vy: 0,
            owner: 'player',
            color: '#67e8f9',
            radius: 10,
            damage: 28,
          });
          soundEngine.playThrow();
        }
        return;
      }

      if (action === 'wave') {
        p.pose = 'wave';
        p.actionTimer = 0.65;
        p.actionDuration = 0.65;
        soundEngine.playEmote('wave');
        st.drops += 1;
        st.score += 15;
        showBanner('LOFI SALUTE! +1 DROP', undefined, '#38bdf8', 900);
        return;
      }

      // === KILLER BEAN LEVEL RAID COMBAT ===
      if (action === 'jab') {
        if (p.hitCooldown > 0) return;
        p.hitCooldown = 0.17;
        p.pose = 'jab';
        p.actionTimer = 0.16;
        p.actionDuration = 0.16;
        // Fire crisp Twin Pistol Frost Bolt
        st.projectiles.push({
          x: p.x + p.facing * 26,
          y: p.y - 54,
          vx: p.facing * 940,
          vy: (Math.random() - 0.5) * 32,
          owner: 'player',
          color: now < p.rageUntil ? '#fb923c' : '#fde047',
          radius: 7,
          damage: now < p.rageUntil ? 32 : 22,
        });
        soundEngine.playThrow();
      } else if (action === 'heavy') {
        if (p.actionTimer > 0.08) return;
        p.pose = 'heavy';
        p.actionTimer = 0.28;
        p.actionDuration = 0.28;
        p.hasHitCurrentSwing = false;
        p.vx += p.facing * 180;
        p.vy = Math.min(p.vy, -170);
        soundEngine.playPunch(true);
        // Deflect nearby enemy bullets with Gun-Fu Spin Kick!
        for (let bi = st.projectiles.length - 1; bi >= 0; bi--) {
          const pr = st.projectiles[bi];
          if (pr.owner === 'enemy' && Math.hypot(pr.x - p.x, pr.y - (p.y - 45)) < 115) {
            pr.owner = 'player';
            pr.vx = p.facing * 880;
            pr.color = '#38bdf8';
            pr.damage = 30;
            spawnParticles(pr.x, pr.y, '#38bdf8', 8, 160);
          }
        }
      } else if (action === 'special') {
        if (p.finisher < 100) {
          showBanner('NEED 100% BEAN SHOT!', 'Hit enemies or barrels to charge', '#94a3b8', 900);
          return;
        }
        p.finisher = 0;
        p.pose = 'finisher';
        p.actionTimer = 0.36;
        p.actionDuration = 0.36;
        p.invulnTimer = 0.4;
        st.shake = 12;
        st.slowMoUntil = now + 600;
        st.projectiles.push({
          x: p.x + p.facing * 30,
          y: p.y - 54,
          vx: p.facing * 1120,
          vy: 0,
          owner: 'player',
          color: '#38bdf8',
          radius: 16,
          damage: 85,
          piercing: true,
        });
        soundEngine.playSlam();
        showBanner('PIERCING BEAN MEGA-SHOT!', undefined, '#38bdf8', 1100);
      }
    },
    [collectEscapeClue]
  );

  // Keyboard Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
        if (stateRef.current?.phase === 'PLAYING') e.preventDefault();
      }
      if (e.repeat) {
        keysRef.current[k] = true;
        return;
      }
      keysRef.current[k] = true;

      if (k === 'escape' || k === 'p') {
        const st = stateRef.current;
        if (st && (st.phase === 'PLAYING' || st.phase === 'PAUSED')) {
          const next = st.phase === 'PLAYING' ? 'PAUSED' : 'PLAYING';
          st.phase = next;
          setPhase(next);
        }
        return;
      }

      if (stateRef.current?.phase !== 'PLAYING') return;

      const isTopDown = stateRef.current.mode === 'stickman_brawl';
      if (!isTopDown && (k === 'w' || k === 'arrowup')) triggerAction('jump');
      else if (k === 'j') triggerAction('jab');
      else if (k === 'k') triggerAction('heavy');
      else if (k === 'l') triggerAction('special');
      else if (k === ' ') triggerAction('dash');
      else if (k === 'e') triggerAction('interact');
      else if (k === '1') triggerAction('wave');
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current[k] = false;
      const st = stateRef.current;
      if (st && st.mode !== 'stickman_brawl' && (k === 'w' || k === 'arrowup')) {
        if (st.player.vy < -220) {
          st.player.vy *= 0.64;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [triggerAction]);

  // Main 60FPS 2D Game Loop + Canvas Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTs = performance.now();
    let hudSyncAcc = 0;

    const handlePlayerDamage = (dmg: number, knockX: number, knockY = 0) => {
      const st = stateRef.current;
      if (!st) return;
      const p = st.player;
      const now = performance.now();
      if (p.invulnTimer > 0) return;

      const guarding = st.mode === 'stickman_wrestling' && p.pose === 'slide';
      if (now < p.shieldUntil) {
        spawnParticles(p.x, p.y - 45, '#38bdf8', 10, 180);
        soundEngine.playDash();
        return;
      }
      const finalDmg = guarding ? Math.max(2, Math.round(dmg * 0.35)) : dmg;
      p.hp = Math.max(0, p.hp - finalDmg);
      p.flashTimer = 0.18;
      p.invulnTimer = 0.6;
      p.vx = knockX;
      if (st.mode === 'stickman_brawl') p.vy = knockY;
      p.pose = 'hurt';
      p.actionTimer = 0.22;
      p.actionDuration = 0.22;
      st.combo = 0;
      st.shake = 9;
      soundEngine.playHit();
      spawnParticles(p.x, p.y - 42, '#ef4444', 10, 180);

      if (p.hp <= 0) {
        finishMatch(false);
      }
    };

    const damageEnemy = (e: FighterEntity, dmg: number, knockX: number, knockY = -140) => {
      const st = stateRef.current;
      if (!st) return;
      const now = performance.now();
      const mult = now < st.player.rageUntil ? 1.6 : 1;
      const dealt = Math.round(dmg * mult);
      e.hp = Math.max(0, e.hp - dealt);
      e.flashTimer = 0.16;
      if (st.mode === 'stickman_brawl') {
        e.knockVx = knockX;
        e.knockVy = Math.max(-180, Math.min(180, knockY));
        e.alertedUntil = now + 4500;
      } else {
        e.vx = knockX;
        if (knockY < -50) {
          e.vy = knockY;
          e.grounded = false;
        }
      }
      e.pose = e.hp <= 0 ? 'down' : 'hurt';
      e.actionTimer = 0.24;
      e.actionDuration = 0.24;

      st.hitsLanded += 1;
      st.combo += 1;
      st.comboTimer = 2.6;
      st.score += 30 + st.combo * 5;
      st.player.finisher = Math.min(100, st.player.finisher + 18);
      st.shake = Math.max(st.shake, 6);
      spawnParticles(e.x, e.y - 46, '#7dd3fc', 10, 210);
    };

    const spawnDropBurst = (x: number, y: number, count: number, includePowerUp = false) => {
      const st = stateRef.current;
      if (!st) return;
      for (let i = 0; i < count; i++) {
        st.pickups.push({
          id: `pk_${Math.random().toString(36).slice(2, 8)}`,
          x: x + (Math.random() - 0.5) * 60,
          y: y - 30,
          vy: st.mode === 'stickman_brawl' ? 0 : -150 - Math.random() * 110,
          kind: i === 0 && Math.random() < 0.45 ? 'gem' : 'drop',
        });
      }
      if (includePowerUp) {
        const kinds: Pickup2D['kind'][] = ['medkit', 'shield', 'shield', 'rage', 'magnet'];
        st.pickups.push({
          id: `pu_${Math.random().toString(36).slice(2, 8)}`,
          x,
          y: y - 40,
          vy: st.mode === 'stickman_brawl' ? 0 : -180,
          kind: kinds[Math.floor(Math.random() * kinds.length)],
        });
      }
    };

    const refillPlayerFullLife = (label: string, sublabel?: string) => {
      const st = stateRef.current;
      if (!st) return;
      st.player.hp = st.player.maxHp;
      spawnParticles(st.player.x, st.player.y - 46, '#4ade80', 18, 220);
      showBanner(label, sublabel || 'FULL HP RESTORED!', '#4ade80', 2200);
    };

    const collidesStationWall = (cx: number, cy: number, radius: number, st: NonNullable<typeof stateRef.current>) => {
      const cluesFound = st.escapeClues.filter((c) => c.collected).length;
      const wingBOpen = cluesFound >= WING_B_CLUES_REQUIRED;
      const airlockOpen = cluesFound >= st.escapeClues.length;
      for (const w of STATION_WALLS) {
        if (w.doorId === 'wing_b' && wingBOpen) continue;
        if (w.doorId === 'airlock' && airlockOpen) continue;
        if (
          cx + radius > w.x &&
          cx - radius < w.x + w.w &&
          cy + radius > w.y &&
          cy - radius < w.y + w.h
        ) {
          return true;
        }
      }
      for (const hz of st.stationHazards) {
        if (hz.kind === 'cargo_block' && hz.hp > 0) {
          const half = hz.radius * 0.72;
          if (Math.abs(cx - hz.x) < radius + half && Math.abs(cy - hz.y) < radius + half) {
            return true;
          }
        }
      }
      return false;
    };

    const hasStationLineOfSight = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      st: NonNullable<typeof stateRef.current>
    ) => {
      const d = Math.hypot(x2 - x1, y2 - y1);
      if (d < 24) return true;
      const steps = Math.ceil(d / 24);
      for (let sIdx = 1; sIdx < steps; sIdx++) {
        const t = sIdx / steps;
        if (collidesStationWall(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 6, st)) {
          return false;
        }
      }
      return true;
    };

    const moveStationEntity = (
      ent: FighterEntity,
      dxStep: number,
      dyStep: number,
      radius: number,
      st: NonNullable<typeof stateRef.current>
    ) => {
      let blockedX = false;
      let blockedY = false;

      if (Math.abs(dxStep) > 0.001) {
        const candX = ent.x + dxStep;
        if (!collidesStationWall(candX, ent.y, radius, st)) {
          ent.x = candX;
        } else {
          // Smooth corner slide around doorway frames
          let slid = false;
          for (const nudge of [6, -6, 12, -12]) {
            if (!collidesStationWall(candX, ent.y + nudge, radius, st)) {
              ent.x = candX;
              ent.y += nudge * 0.45;
              slid = true;
              break;
            }
          }
          if (!slid) blockedX = true;
        }
      }

      if (Math.abs(dyStep) > 0.001) {
        const candY = ent.y + dyStep;
        if (!collidesStationWall(ent.x, candY, radius, st)) {
          ent.y = candY;
        } else {
          let slid = false;
          for (const nudge of [6, -6, 12, -12]) {
            if (!collidesStationWall(ent.x + nudge, candY, radius, st)) {
              ent.y = candY;
              ent.x += nudge * 0.45;
              slid = true;
              break;
            }
          }
          if (!slid) blockedY = true;
        }
      }

      // Unstick safeguard if entity ever overlaps a wall or newly dropped crate
      if (collidesStationWall(ent.x, ent.y, radius - 1, st)) {
        const room = getStationRoomAt(ent.x, ent.y);
        const rx = room.x + room.w * 0.5;
        const ry = room.y + room.h * 0.5;
        const rd = Math.hypot(rx - ent.x, ry - ent.y) || 1;
        ent.x += ((rx - ent.x) / rd) * 8;
        ent.y += ((ry - ent.y) / rd) * 8;
      }

      return { blockedX, blockedY };
    };

    const stepPhysics = (dt: number) => {
      const st = stateRef.current;
      if (!st || st.phase !== 'PLAYING') return;
      const now = performance.now();
      const p = st.player;
      const keys = keysRef.current;

      const slowFactor = st.mode === 'stickman_wrestling' && now < st.slowMoUntil ? 0.38 : 1;

      st.elapsed += dt;
      st.timeLeft = Math.max(0, st.timeLeft - dt);
      if (st.timeLeft <= 0) {
        finishMatch(false);
        return;
      }

      if (st.comboTimer > 0) {
        st.comboTimer -= dt;
        if (st.comboTimer <= 0) st.combo = 0;
      }
      st.shake = Math.max(0, st.shake - dt * 32);

      p.stamina = Math.min(100, p.stamina + dt * 26);
      p.hitCooldown = Math.max(0, p.hitCooldown - dt);
      p.invulnTimer = Math.max(0, p.invulnTimer - dt);
      p.flashTimer = Math.max(0, p.flashTimer - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      p.dashCooldown = Math.max(0, p.dashCooldown - dt);
      p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
      p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);

      for (const fl of st.ambientFlakes) {
        fl.y += fl.spd * dt;
        fl.x -= 22 * dt;
        if (fl.y > CANVAS_H) fl.y = -10;
        if (fl.x < -10) fl.x = CANVAS_W + 10;
      }

      st.runnerHeavyCd = Math.max(0, st.runnerHeavyCd - dt);

      // Periodic randomized power-up loot drops (including Frost Shield) in Raid & Clue Escape
      if (st.mode === 'stickman_wrestling' || st.mode === 'stickman_brawl') {
        st.pickupSpawnTimer -= dt;
        if (st.pickupSpawnTimer <= 0) {
          st.pickupSpawnTimer = 11 + Math.random() * 5;
          if (st.pickups.length < 18) {
            const dropPool: Pickup2D['kind'][] = ['shield', 'medkit', 'rage', 'magnet', 'shield'];
            const kind = dropPool[Math.floor(Math.random() * dropPool.length)];
            if (st.mode === 'stickman_wrestling') {
              const dropX = Math.max(
                140,
                Math.min(st.levelEndX - 180, p.x + p.facing * (140 + Math.random() * 140))
              );
              st.pickups.push({
                id: `lpu_${Math.random().toString(36).slice(2, 8)}`,
                x: dropX,
                y: 80,
                vy: 40,
                kind,
              });
            } else {
              for (let attempt = 0; attempt < 8; attempt++) {
                const ang = Math.random() * Math.PI * 2;
                const r = 130 + Math.random() * 170;
                const candX = Math.max(90, Math.min(STATION_W - 90, p.x + Math.cos(ang) * r));
                const candY = Math.max(90, Math.min(STATION_H - 90, p.y + Math.sin(ang) * r));
                if (!collidesStationWall(candX, candY, 22, st)) {
                  st.pickups.push({
                    id: `spu_${Math.random().toString(36).slice(2, 8)}`,
                    x: candX,
                    y: candY,
                    vy: 0,
                    kind,
                  });
                  spawnParticles(candX, candY, '#38bdf8', 8, 130);
                  break;
                }
              }
            }
          }
        }
      }

      // === MODE 1: KILLER BEAN-STYLE SIDE-SCROLLING LEVEL RAID ('stickman_wrestling') ===
      if (st.mode === 'stickman_wrestling') {
        const moveLeft = Boolean(keys['a'] || keys['arrowleft']);
        const moveRight = Boolean(keys['d'] || keys['arrowright']);
        const sliding = Boolean(keys['s'] || keys['arrowdown']);
        const moveDir = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);

        if (sliding && p.grounded) {
          p.dropThroughUntil = now + 180;
        }

        const playerSlowed = now < (p.slowUntil || 0);
        const maxSpeed = 375 * (now < p.rageUntil ? 1.2 : 1) * (playerSlowed ? 0.56 : 1);
        if (p.dashTimer > 0) {
          p.vx *= Math.pow(0.24, dt);
          p.pose = 'slide';
          if (Math.random() < 0.7) spawnParticles(p.x, p.y - 36, '#38bdf8', 1, 60);
        } else {
          if (p.actionTimer > 0) p.actionTimer = Math.max(0, p.actionTimer - dt);
          const targetVx = moveDir * maxSpeed * (p.actionTimer > 0 ? 0.8 : 1);
          p.vx += (targetVx - p.vx) * Math.min(1, dt * (moveDir !== 0 ? 18 : 14));
          if (moveDir !== 0) p.facing = moveDir > 0 ? 1 : -1;
          if (p.actionTimer <= 0) {
            if (sliding && p.grounded) p.pose = 'slide';
            else if (!p.grounded) p.pose = p.vy < 0 ? 'jump' : 'fall';
            else if (Math.abs(p.vx) > 45) p.pose = 'run';
            else p.pose = 'idle';
          }
        }

        if (sliding && !p.grounded) p.vy += 880 * dt;
        p.vy += 1560 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const wasGrounded = p.grounded;
        p.grounded = false;
        if (p.vy >= 0 && now > p.dropThroughUntil) {
          for (const pl of st.raidPlatforms) {
            if (p.x >= pl.x && p.x <= pl.x + pl.w && p.y >= pl.y && p.y - p.vy * dt <= pl.y + 22) {
              p.y = pl.y;
              p.vy = 0;
              p.grounded = true;
              p.jumpsLeft = 2;
              p.coyoteTimer = 0.12;
            }
          }
        }
        if (p.y >= RAID_FLOOR) {
          p.y = RAID_FLOOR;
          p.vy = 0;
          p.grounded = true;
          p.jumpsLeft = 2;
          p.coyoteTimer = 0.12;
        }
        if (wasGrounded && !p.grounded && p.vy >= 0) p.coyoteTimer = 0.12;

        // Dynamic Syndicate Aerial Obstacle Drops ahead of player
        st.airdropCooldown -= dt;
        if (st.airdropCooldown <= 0 && p.x < st.levelEndX - 320 && st.raidObstacles.length < 22) {
          st.airdropCooldown = Math.max(2.1, 3.8 - st.waveOrBout * 0.4);
          const dropX = Math.max(140, Math.min(st.levelEndX - 180, p.x + p.facing * (120 + Math.random() * 150)));
          const isMine = Math.random() < 0.48;
          st.raidObstacles.push({
            id: `air_${Math.random().toString(36).slice(2, 8)}`,
            x: dropX,
            y: -40,
            targetY: RAID_FLOOR,
            vy: 60,
            w: isMine ? 34 : 52,
            h: isMine ? 22 : 48,
            kind: isMine ? 'cryo_mine' : 'airdrop_crate',
            hp: isMine ? 18 : 48,
            maxHp: isMine ? 18 : 48,
            falling: true,
          });
        }

        // Step & Collide Raid Obstacles (Laser Barriers, Airdrop Crates, Cryo Mines)
        for (let oi = st.raidObstacles.length - 1; oi >= 0; oi--) {
          const obs = st.raidObstacles[oi];
          obs.hitCooldown = Math.max(0, (obs.hitCooldown || 0) - dt);
          if (obs.hp <= 0) {
            st.cratesSmashed += 1;
            st.score += 55;
            spawnParticles(obs.x, obs.y - obs.h * 0.5, obs.kind === 'laser_barrier' ? '#fb7185' : '#fbbf24', 14, 210);
            spawnDropBurst(obs.x, obs.y, 1, Math.random() < 0.25);
            st.raidObstacles.splice(oi, 1);
            continue;
          }

          if (obs.falling) {
            obs.vy += 1080 * dt;
            obs.y += obs.vy * dt;
            if (
              Math.abs(p.x - obs.x) < obs.w * 0.5 + 16 &&
              p.y > obs.y - obs.h &&
              p.y - 72 < obs.y
            ) {
              handlePlayerDamage(18, (p.x >= obs.x ? 1 : -1) * 240);
              if (now >= p.shieldUntil) {
                p.slowUntil = now + 1300;
                showBanner('AIR-DROP IMPACT! SLOWED', undefined, '#fb923c', 850);
              }
            }
            if (obs.y >= obs.targetY) {
              obs.y = obs.targetY;
              obs.vy = 0;
              obs.falling = false;
              st.shake = Math.max(st.shake, 5);
              spawnParticles(obs.x, obs.y - 8, '#fbbf24', 8, 160);
            }
          }

          if (obs.kind === 'laser_barrier') {
            if (
              Math.abs(p.x - obs.x) < obs.w * 0.5 + 15 &&
              p.y > obs.y - obs.h + 6 &&
              p.y - 72 < obs.y &&
              p.dashTimer <= 0 &&
              (obs.hitCooldown || 0) <= 0
            ) {
              obs.hitCooldown = 0.75;
              handlePlayerDamage(14, (p.x >= obs.x ? 1 : -1) * 260);
              if (now >= p.shieldUntil) {
                p.slowUntil = now + 900;
                showBanner('LASER SHOCK! SHOOT OR KICK (K)', undefined, '#fb7185', 850);
              }
            }
          } else if (obs.kind === 'airdrop_crate' && !obs.falling) {
            const halfW = obs.w * 0.5 + 16;
            const topY = obs.y - obs.h;
            if (Math.abs(p.x - obs.x) < halfW) {
              if (p.vy >= 0 && p.y >= topY && p.y - p.vy * dt <= topY + 24) {
                p.y = topY;
                p.vy = 0;
                p.grounded = true;
                p.jumpsLeft = 2;
                p.coyoteTimer = 0.12;
              } else if (p.y > topY + 10 && p.y - 68 < obs.y) {
                p.x = p.x < obs.x ? obs.x - halfW : obs.x + halfW;
                p.vx = 0;
              }
            }
          } else if (obs.kind === 'cryo_mine' && !obs.falling) {
            if (Math.abs(p.x - obs.x) < obs.w * 0.5 + 16 && Math.abs(p.y - obs.y) < 34) {
              handlePlayerDamage(16, (p.x >= obs.x ? 1 : -1) * 280);
              if (now >= p.shieldUntil) {
                p.vy = -340;
                p.grounded = false;
                p.slowUntil = now + 1800;
                showBanner('CRYO MINE DETONATED! SLOWED', undefined, '#38bdf8', 950);
              }
              spawnParticles(obs.x, obs.y - 12, '#38bdf8', 18, 250);
              soundEngine.playSlam();
              st.raidObstacles.splice(oi, 1);
            }
          }
        }

        if (p.grounded && p.jumpBufferTimer > 0) {
          p.jumpBufferTimer = 0;
          p.vy = -645;
          p.grounded = false;
          p.jumpsLeft = 1;
          soundEngine.playDash();
        }

        p.x = Math.max(45, Math.min(st.levelEndX + 40, p.x));
        const targetCamX = Math.max(0, Math.min(st.levelEndX - CANVAS_W + 170, p.x - 360));
        st.cameraX += (targetCamX - st.cameraX) * Math.min(1, dt * 8.5);

        // Close-range Spin Kick Hitbox (K) — hits enemies, obstacles, and explosive barrels!
        if (p.pose === 'heavy' && !p.hasHitCurrentSwing && p.actionTimer < p.actionDuration * 0.78) {
          let landed = false;
          for (const e of st.enemies) {
            if (e.hp <= 0) continue;
            if (Math.abs(e.x - p.x) <= 105 && Math.abs(e.y - p.y) < 88) {
              const dmg = e.isBoss && e.bossState === 'guard' ? 18 : 34;
              damageEnemy(e, dmg, (e.x >= p.x ? 1 : -1) * 340, -240);
              landed = true;
            }
          }
          for (const obs of st.raidObstacles) {
            if (Math.abs(obs.x - p.x) <= 105 && Math.abs(obs.y - p.y) < 92) {
              obs.hp -= 40;
              landed = true;
            }
          }
          for (let bi = st.raidBarrels.length - 1; bi >= 0; bi--) {
            const br = st.raidBarrels[bi];
            if (Math.abs(br.x - p.x) <= 105 && Math.abs(br.y - p.y) < 88) {
              br.hp -= 45;
              landed = true;
              if (br.hp <= 0) {
                st.raidBarrels.splice(bi, 1);
                st.cratesSmashed += 1;
                st.score += 90;
                st.shake = 14;
                soundEngine.playSlam();
                spawnParticles(br.x, br.y - 24, '#fb923c', 22, 320);
                spawnDropBurst(br.x, br.y, 2, true);
                if (Math.hypot(p.x - br.x, p.y - br.y) < 110 && p.dashTimer <= 0) {
                  handlePlayerDamage(12, (p.x >= br.x ? 1 : -1) * 260);
                }
                for (const e of st.enemies) {
                  if (Math.hypot(e.x - br.x, e.y - br.y) < 190) {
                    damageEnemy(e, 75, (e.x >= br.x ? 1 : -1) * 320, -240);
                  }
                }
              }
            }
          }
          if (landed) {
            p.hasHitCurrentSwing = true;
            soundEngine.playPunch(true);
          }
        }

        // Enemy Syndicate AI & Tough Multi-Phase Gate Boss (slowed by slowMoUntil!)
        const eDt = dt * slowFactor;
        for (let i = st.enemies.length - 1; i >= 0; i--) {
          const e = st.enemies[i];
          e.flashTimer = Math.max(0, e.flashTimer - dt);
          if (e.actionTimer > 0) e.actionTimer = Math.max(0, e.actionTimer - eDt);
          e.aiCooldown = Math.max(0, (e.aiCooldown || 0) - eDt);
          e.bossPhaseCd = Math.max(0, (e.bossPhaseCd ?? 2.4) - eDt);

          if (e.hp <= 0) {
            st.knockouts += 1;
            st.drops += e.isBoss ? 8 : 2;
            st.gems += e.isBoss ? 4 : 1;
            st.score += e.isBoss ? 420 : 110;
            spawnDropBurst(e.x, e.y, e.isBoss ? 4 : 2, e.isBoss || Math.random() < 0.35);
            spawnParticles(e.x, e.y - 40, e.stroke || '#fb7185', 18, 250);
            if (e.isBoss) {
              showBanner('GATE BOSS DEFEATED!', 'EXTRACTION EXIT UNLOCKED!', '#34d399', 2000);
            }
            st.enemies.splice(i, 1);
            continue;
          }

          const dx = p.x - e.x;
          const dist = Math.abs(dx);

          if (e.isBoss && e.hp <= e.maxHp * 0.5 && !e.summonedHalf) {
            e.summonedHalf = true;
            showBanner('BOSS ENRAGED!', 'Reinforcements & Cryo Mines Deployed!', '#f43f5e', 1700);
            for (let si = 0; si < 2; si++) {
              const sx = Math.max(st.levelEndX - 650, Math.min(st.levelEndX - 130, e.x + (si === 0 ? -150 : 120)));
              st.enemies.push({
                x: sx,
                y: RAID_FLOOR,
                vx: 0,
                vy: 0,
                facing: -1,
                hp: 65 + st.waveOrBout * 15,
                maxHp: 65 + st.waveOrBout * 15,
                pose: 'idle',
                actionTimer: 0,
                actionDuration: 0.25,
                dashTimer: 0,
                dashCooldown: 0,
                coyoteTimer: 0,
                jumpBufferTimer: 0,
                hitCooldown: 0,
                invulnTimer: 0,
                flashTimer: 0,
                grounded: true,
                jumpsLeft: 1,
                stamina: 100,
                finisher: 0,
                shieldUntil: 0,
                rageUntil: 0,
                magnetUntil: 0,
                dropThroughUntil: 0,
                stunnedUntil: 0,
                ropeBoostUntil: 0,
                hasHitCurrentSwing: false,
                id: `boss_add_${Math.random().toString(36).slice(2, 7)}`,
                name: 'Syndicate Enforcer',
                stroke: '#fb7185',
                accent: '#fde047',
                speed: 205,
                aggro: 1,
                aiCooldown: 0.9,
              });
              st.raidObstacles.push({
                id: `bm_${Math.random().toString(36).slice(2, 7)}`,
                x: sx,
                y: -30,
                targetY: RAID_FLOOR,
                vy: 80,
                w: 34,
                h: 22,
                kind: 'cryo_mine',
                hp: 18,
                maxHp: 18,
                falling: true,
              });
            }
          }

          if (dist < 780) {
            e.facing = dx >= 0 ? 1 : -1;

            // Tough Boss Phase Attacks
            if (e.isBoss && (e.bossPhaseCd || 0) <= 0 && e.actionTimer <= 0) {
              e.bossPhaseCd = Math.max(1.75, 3.1 - st.waveOrBout * 0.35);
              const roll = Math.random();
              if (roll < 0.38) {
                // Jump-Slam + Cryo Mine Drop
                e.bossState = 'leap';
                e.vy = -560;
                e.vx = e.facing * 350;
                e.grounded = false;
                e.pose = 'jump';
                e.actionTimer = 0.55;
                e.actionDuration = 0.55;
                st.raidObstacles.push({
                  id: `bm_${Math.random().toString(36).slice(2, 7)}`,
                  x: Math.max(200, Math.min(st.levelEndX - 110, p.x + e.facing * 45)),
                  y: -35,
                  targetY: RAID_FLOOR,
                  vy: 90,
                  w: 34,
                  h: 22,
                  kind: 'cryo_mine',
                  hp: 18,
                  maxHp: 18,
                  falling: true,
                });
              } else if (roll < 0.72) {
                // 3-Round Crimson Fan Burst
                e.bossState = 'idle';
                e.pose = 'jab';
                e.actionTimer = 0.32;
                e.actionDuration = 0.32;
                for (const vySpread of [-135, 0, 135]) {
                  st.projectiles.push({
                    x: e.x + e.facing * 26,
                    y: e.y - 56,
                    vx: e.facing * 590,
                    vy: vySpread,
                    owner: 'enemy',
                    color: '#f43f5e',
                    radius: 8,
                    damage: 14,
                  });
                }
                soundEngine.playThrow();
              } else {
                // Tactical Guard Stance (50% bullet resistance for 1.3s)
                e.bossState = 'guard';
                e.pose = 'slide';
                e.actionTimer = 1.25;
                e.actionDuration = 1.25;
                e.vx = 0;
              }
            } else if (e.actionTimer <= 0) {
              if (e.bossState === 'guard') e.bossState = 'idle';
              if (dist > 320) {
                e.vx = e.facing * (e.speed || 185);
                e.pose = 'run';
              } else if (dist < 125) {
                e.vx = -e.facing * (e.speed || 165) * 0.72;
                e.pose = 'run';
              } else {
                e.vx *= Math.pow(0.05, eDt);
                e.pose = 'idle';
              }
              if ((e.aiCooldown || 0) <= 0 && dist < 660 && Math.abs(p.y - e.y) < 170) {
                e.pose = 'jab';
                e.actionTimer = 0.24;
                e.actionDuration = 0.24;
                e.aiCooldown = e.isBoss ? 0.78 : 1.3;
                st.projectiles.push({
                  x: e.x + e.facing * 24,
                  y: e.y - 54,
                  vx: e.facing * (e.isBoss ? 580 : 475),
                  vy: 0,
                  owner: 'enemy',
                  color: '#fb7185',
                  radius: 7,
                  damage: e.isBoss ? 15 : 10,
                });
                soundEngine.playThrow();
              }
            }
          } else {
            e.vx *= Math.pow(0.1, eDt);
            e.pose = 'idle';
          }

          const wasEnemyAirborne = !e.grounded;
          e.vy += 1560 * eDt;
          e.x += e.vx * eDt;
          e.y += e.vy * eDt;
          if (e.y >= RAID_FLOOR) {
            e.y = RAID_FLOOR;
            e.vy = 0;
            e.grounded = true;
            if (e.isBoss && e.bossState === 'leap' && wasEnemyAirborne) {
              e.bossState = 'idle';
              st.shake = Math.max(st.shake, 11);
              spawnParticles(e.x, e.y - 8, '#f43f5e', 18, 260);
              soundEngine.playSlam();
              if (Math.abs(p.x - e.x) < 145 && Math.abs(p.y - e.y) < 85) {
                handlePlayerDamage(20, (p.x >= e.x ? 1 : -1) * 310);
                if (now >= p.shieldUntil) p.slowUntil = now + 1100;
              }
            }
          }
          for (const pl of st.raidPlatforms) {
            if (e.vy >= 0 && e.x >= pl.x && e.x <= pl.x + pl.w && e.y >= pl.y && e.y - e.vy * eDt <= pl.y + 18) {
              e.y = pl.y;
              e.vy = 0;
              e.grounded = true;
            }
          }
          if (e.patrolMinX !== undefined && e.patrolMaxX !== undefined) {
            e.x = Math.max(e.patrolMinX, Math.min(e.patrolMaxX, e.x));
          }

          // Enemy Contact Check (Frost Shield deflects contact for 10s)
          if (Math.abs(p.x - e.x) < (e.isBoss ? 40 : 30) && Math.abs(p.y - e.y) < 62) {
            const pushDir = p.x >= e.x ? 1 : -1;
            if (now < p.shieldUntil) {
              e.vx = -pushDir * 260;
              e.x += -pushDir * 14;
              spawnParticles(p.x, p.y - 42, '#38bdf8', 10, 180);
              soundEngine.playDash();
            } else if (p.dashTimer <= 0) {
              handlePlayerDamage(e.isBoss ? 16 : 12, pushDir * 230);
            }
          }
        }

        // Check Reaching Extraction Exit Gate at End of Level -> AUTOMATIC FULL HP REFILL!
        const gateBossAlive = st.enemies.some((e) => e.isBoss);
        if (p.x >= st.levelEndX - 58) {
          if (gateBossAlive) {
            if (!st.banner || now >= st.banner.until) {
              showBanner('DEFEAT THE GATE BOSS TO EXIT!', undefined, '#f43f5e', 1100);
            }
          } else {
            st.score += 350;
            st.drops += 5;
            soundEngine.playBell(2);
            if (st.waveOrBout >= 3) {
              finishMatch(true);
              return;
            } else {
              st.waveOrBout += 1;
              const nextStage = buildRaidStage(
                st.waveOrBout,
                st.waveOrBout === 2 ? 'aurora_violet' : 'golden_frost'
              );
              st.levelEndX = nextStage.levelEndX;
              st.raidPlatforms = nextStage.platforms;
              st.raidBarrels = nextStage.barrels;
              st.raidObstacles = nextStage.obstacles;
              st.airdropCooldown = 2.6;
              st.enemies = nextStage.enemies;
              st.pickups = nextStage.pickups;
              st.projectiles = [];
              p.x = 160;
              p.y = RAID_FLOOR;
              p.vx = 0;
              p.vy = 0;
              p.slowUntil = 0;
              st.cameraX = 0;
              refillPlayerFullLife(
                `STAGE ${st.waveOrBout}: ${st.waveOrBout === 3 ? 'FINAL HQ RAID' : 'SKYBRIDGE ASSAULT'}!`,
                'EXIT CLEARED · FULL HP RESTORED!'
              );
            }
          }
        }
      } else if (st.mode === 'stickman_brawl') {
        // === MODE 2: AMONG US-STYLE TOP-DOWN MULTI-ROOM CLUE & ESCAPE ===
        const moveLeft = Boolean(keys['a'] || keys['arrowleft']);
        const moveRight = Boolean(keys['d'] || keys['arrowright']);
        const moveUp = Boolean(keys['w'] || keys['arrowup']);
        const moveDown = Boolean(keys['s'] || keys['arrowdown']);
        const dx = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
        const dy = (moveDown ? 1 : 0) - (moveUp ? 1 : 0);
        const len = Math.hypot(dx, dy);

        const playerSlowed = now < (p.slowUntil || 0);
        const speed = 295 * (now < p.rageUntil ? 1.25 : 1) * (playerSlowed ? 0.52 : 1);
        if (p.dashTimer > 0) {
          p.vx *= Math.pow(0.18, dt);
          p.vy *= Math.pow(0.18, dt);
          p.pose = 'run';
          if (Math.random() < 0.65) spawnParticles(p.x, p.y - 24, '#2dd4bf', 1, 55);
        } else {
          if (p.actionTimer > 0) p.actionTimer = Math.max(0, p.actionTimer - dt);
          const tvx = len > 0 ? (dx / len) * speed : 0;
          const tvy = len > 0 ? (dy / len) * speed : 0;
          p.vx += (tvx - p.vx) * Math.min(1, dt * 16);
          p.vy += (tvy - p.vy) * Math.min(1, dt * 16);
          if (dx !== 0) p.facing = dx > 0 ? 1 : -1;
          if (dy !== 0) p.aimY = dy;
          else if (dx !== 0) p.aimY = 0;
          if (p.actionTimer <= 0) {
            p.pose = Math.hypot(p.vx, p.vy) > 35 ? 'run' : 'idle';
          }
        }

        // Wall-sliding + doorway corner-nudge collision (keeps player gliding cleanly through 140px doors)
        moveStationEntity(p, p.vx * dt, p.vy * dt, 20, st);

        // Step Station Floor Obstacles (Cryo Spills, Shock Wires, Sabotage Mines)
        for (let hi = st.stationHazards.length - 1; hi >= 0; hi--) {
          const hz = st.stationHazards[hi];
          if (hz.kind === 'cargo_block' && hz.hp <= 0) {
            spawnParticles(hz.x, hz.y, '#fb923c', 14, 190);
            st.cratesSmashed += 1;
            st.score += 50;
            st.stationHazards.splice(hi, 1);
            continue;
          }
          const hDist = Math.hypot(p.x - hz.x, p.y - hz.y);
          if (hz.kind === 'cryo_spill' && hDist < hz.radius + 10) {
            if (now >= p.shieldUntil) {
              p.slowUntil = Math.max(p.slowUntil || 0, now + 1400);
            }
            if (Math.random() < 0.25) spawnParticles(p.x, p.y - 8, '#7dd3fc', 1, 55);
          } else if (hz.kind === 'shock_wire' && hDist < hz.radius + 12) {
            if (p.dashTimer <= 0 && now >= (hz.cooldownUntil || 0)) {
              hz.cooldownUntil = now + 1150;
              const d = hDist || 1;
              handlePlayerDamage(12, ((p.x - hz.x) / d) * 210, ((p.y - hz.y) / d) * 210);
              showBanner('HIGH-VOLTAGE WIRE!', undefined, '#fde047', 850);
            }
          } else if (hz.kind === 'sabotage_mine' && hDist < hz.radius + 16) {
            const d = hDist || 1;
            handlePlayerDamage(16, ((p.x - hz.x) / d) * 250, ((p.y - hz.y) / d) * 250);
            if (now >= p.shieldUntil) p.slowUntil = now + 1600;
            spawnParticles(hz.x, hz.y, '#ef4444', 18, 220);
            soundEngine.playSlam();
            showBanner('SABOTAGE MINE DETONATED! SLOWED', undefined, '#fb7185', 950);
            st.stationHazards.splice(hi, 1);
          }
        }

        const targetCamX = Math.max(0, Math.min(STATION_W - CANVAS_W, p.x - CANVAS_W * 0.5));
        const targetCamY = Math.max(0, Math.min(STATION_H - CANVAS_H, p.y - CANVAS_H * 0.5));
        st.cameraX += (targetCamX - st.cameraX) * Math.min(1, dt * 7);
        st.cameraY += (targetCamY - st.cameraY) * Math.min(1, dt * 7);

        const cluesFoundNow = st.escapeClues.filter((c) => c.collected).length;
        const wingBOpen = cluesFoundNow >= WING_B_CLUES_REQUIRED;
        const allCluesCollected = cluesFoundNow >= st.escapeClues.length;
        const playerRoom = getStationRoomAt(p.x, p.y);

        // Quick Proximity Scan on Clues (auto-scans within 52px OR instant on E/J)
        for (const clue of st.escapeClues) {
          if (clue.collected) continue;
          const dist = Math.hypot(clue.x - p.x, clue.y - p.y);
          if (dist < 52) {
            clue.scanProgress = Math.min(1, clue.scanProgress + dt * 1.65);
            if (clue.scanProgress >= 1) {
              collectEscapeClue(clue);
            }
          } else {
            clue.scanProgress = Math.max(0, clue.scanProgress - dt * 1.2);
          }
        }

        // Update Imposter & Airlock Warden Boss AI (BFS doorway routing + zero wall-glitching)
        for (let i = st.enemies.length - 1; i >= 0; i--) {
          const imp = st.enemies[i];
          imp.flashTimer = Math.max(0, imp.flashTimer - dt);
          if (imp.actionTimer > 0) imp.actionTimer = Math.max(0, imp.actionTimer - dt);
          imp.aiCooldown = Math.max(0, (imp.aiCooldown || 0) - dt);
          imp.hitCooldown = Math.max(0, (imp.hitCooldown || 0) - dt);
          imp.ventCooldown = Math.max(0, (imp.ventCooldown || 6) - dt);
          imp.bossPhaseCd = Math.max(0, (imp.bossPhaseCd ?? 2.8) - dt);
          imp.knockVx = (imp.knockVx || 0) * Math.pow(0.015, dt);
          imp.knockVy = (imp.knockVy || 0) * Math.pow(0.015, dt);
          if (Math.abs(imp.knockVx) < 4) imp.knockVx = 0;
          if (Math.abs(imp.knockVy) < 4) imp.knockVy = 0;

          if (imp.hp <= 0) {
            st.knockouts += 1;
            st.drops += imp.isBoss ? 10 : 2;
            st.gems += imp.isBoss ? 5 : 1;
            st.score += imp.isBoss ? 480 : 150;
            spawnDropBurst(imp.x, imp.y, imp.isBoss ? 5 : 2, imp.isBoss || Math.random() < 0.45);
            spawnParticles(imp.x, imp.y - 24, '#ef4444', 18, 220);
            if (imp.isBoss) {
              showBanner('AIRLOCK WARDEN DEFEATED!', 'ESCAPE POD READY IN AIRLOCK!', '#34d399', 2200);
            } else if (st.stationHazards.length < 18 && Math.random() < 0.55) {
              st.stationHazards.push({
                id: `sm_${Math.random().toString(36).slice(2, 7)}`,
                x: imp.x,
                y: imp.y,
                radius: 16,
                kind: 'sabotage_mine',
                hp: 15,
                maxHp: 15,
              });
            }
            st.enemies.splice(i, 1);
            continue;
          }

          const stunned = now < imp.stunnedUntil;
          if (stunned) {
            imp.pose = 'hurt';
            imp.vx = 0;
            imp.vy = 0;
            moveStationEntity(imp, (imp.knockVx || 0) * dt, (imp.knockVy || 0) * dt, 18, st);
            continue;
          }

          const dist = Math.hypot(p.x - imp.x, p.y - imp.y);
          const impRoom = getStationRoomAt(imp.x, imp.y);
          const hasLoS = dist < 520 && hasStationLineOfSight(imp.x, imp.y, p.x, p.y, st);

          if (imp.isBoss) {
            // Airlock Warden Boss stays inside AIRLOCK EXIT until Airlock blast door is unlocked!
            const bossActive = allCluesCollected || playerRoom.id === 'airlock';
            if (imp.hp <= imp.maxHp * 0.5 && !imp.summonedHalf && bossActive) {
              imp.summonedHalf = true;
              showBanner('AIRLOCK BOSS ENRAGED!', 'Reinforcements & Sabotage Mines Deployed!', '#f43f5e', 1800);
              const minionSpots = [
                { x: 1975, y: 1140, name: 'Vent Enforcer' },
                { x: 2335, y: 1355, name: 'Airlock Guard' },
              ];
              for (const ms of minionSpots) {
                if (!collidesStationWall(ms.x, ms.y, 18, st)) {
                  st.enemies.push({
                    x: ms.x,
                    y: ms.y,
                    vx: 0,
                    vy: 0,
                    knockVx: 0,
                    knockVy: 0,
                    facing: -1,
                    hp: 95 + st.waveOrBout * 18,
                    maxHp: 95 + st.waveOrBout * 18,
                    pose: 'idle',
                    actionTimer: 0,
                    actionDuration: 0.25,
                    dashTimer: 0,
                    dashCooldown: 0,
                    coyoteTimer: 0,
                    jumpBufferTimer: 0,
                    hitCooldown: 0,
                    invulnTimer: 0,
                    flashTimer: 0,
                    grounded: true,
                    jumpsLeft: 1,
                    stamina: 100,
                    finisher: 0,
                    shieldUntil: 0,
                    rageUntil: 0,
                    magnetUntil: 0,
                    dropThroughUntil: 0,
                    stunnedUntil: 0,
                    ropeBoostUntil: 0,
                    hasHitCurrentSwing: false,
                    id: `imp_add_${Math.random().toString(36).slice(2, 7)}`,
                    name: ms.name,
                    stroke: '#ef4444',
                    accent: '#38bdf8',
                    speed: 195 + st.waveOrBout * 14,
                    aggro: 1,
                    aiCooldown: 1.0,
                    ventCooldown: 99,
                  });
                }
              }
              for (const mx of [1990, 2310]) {
                st.stationHazards.push({
                  id: `bm_${Math.random().toString(36).slice(2, 7)}`,
                  x: mx,
                  y: 1180 + Math.random() * 140,
                  radius: 16,
                  kind: 'sabotage_mine',
                  hp: 15,
                  maxHp: 15,
                });
              }
            }

            if (bossActive) {
              const wp = getNextStationWaypoint(imp.x, imp.y, p.x, p.y, wingBOpen, allCluesCollected);
              if (wp.reachable) {
                const dxW = wp.x - imp.x;
                const dyW = wp.y - imp.y;
                const dw = Math.hypot(dxW, dyW) || 1;
                const surging = (imp.bossPhaseCd || 0) < 0.65;
                const spd = (imp.speed || 215) * (surging ? 1.45 : 1.0);
                imp.vx = (dxW / dw) * spd;
                imp.vy = (dyW / dw) * spd;
                if (Math.abs(dxW) > 12) imp.facing = dxW >= 0 ? 1 : -1;
              } else {
                imp.vx = 0;
                imp.vy = 0;
              }

              if ((imp.aiCooldown || 0) <= 0 && dist < 540 && hasLoS) {
                imp.aiCooldown = Math.max(1.05, 1.7 - st.waveOrBout * 0.18);
                imp.pose = 'jab';
                imp.actionTimer = 0.24;
                imp.actionDuration = 0.24;
                if (Math.abs(p.x - imp.x) > 10) imp.facing = p.x >= imp.x ? 1 : -1;
                const baseAng = Math.atan2(p.y - imp.y, p.x - imp.x);
                const fanOffsets = st.waveOrBout >= 2 ? [-0.32, -0.16, 0, 0.16, 0.32] : [-0.24, 0, 0.24];
                for (const off of fanOffsets) {
                  st.projectiles.push({
                    x: imp.x,
                    y: imp.y - 24,
                    vx: Math.cos(baseAng + off) * 440,
                    vy: Math.sin(baseAng + off) * 440,
                    owner: 'enemy',
                    color: '#f43f5e',
                    radius: 8,
                    damage: 14,
                    life: 1.35,
                  });
                }
                soundEngine.playThrow();
              }

              if ((imp.bossPhaseCd || 0) <= 0) {
                imp.bossPhaseCd = 3.5;
                if (st.stationHazards.length < 20 && !collidesStationWall(imp.x, imp.y, 16, st)) {
                  st.stationHazards.push({
                    id: `bm_${Math.random().toString(36).slice(2, 7)}`,
                    x: imp.x,
                    y: imp.y,
                    radius: 16,
                    kind: 'sabotage_mine',
                    hp: 15,
                    maxHp: 15,
                  });
                }
              }
            } else {
              // Calm patrol inside Airlock while Blast Door is locked
              const cx = 2050 + Math.cos(st.elapsed * 0.8) * 90;
              const cy = 1250 + Math.sin(st.elapsed * 0.8) * 85;
              const dxC = cx - imp.x;
              const dyC = cy - imp.y;
              const dc = Math.hypot(dxC, dyC) || 1;
              if (dc > 12) {
                imp.vx = (dxC / dc) * 95;
                imp.vy = (dyC / dc) * 95;
                if (Math.abs(dxC) > 8) imp.facing = dxC >= 0 ? 1 : -1;
              } else {
                imp.vx = 0;
                imp.vy = 0;
              }
            }
          } else {
            // Regular Imposter AI: line-of-sight detection OR proximity chase using BFS room-doorway routing!
            if (hasLoS && dist < 460) {
              imp.alertedUntil = now + 3800;
            } else if (dist < 260) {
              imp.alertedUntil = now + 2200;
            }

            const alerted = now < (imp.alertedUntil || 0);
            let chasingActive = false;

            if (alerted) {
              const wp = getNextStationWaypoint(imp.x, imp.y, p.x, p.y, wingBOpen, allCluesCollected);
              if (wp.reachable) {
                chasingActive = true;
                const dxW = wp.x - imp.x;
                const dyW = wp.y - imp.y;
                const dw = Math.hypot(dxW, dyW) || 1;
                const spd = (imp.speed || 175) * (impRoom.id === playerRoom.id ? 1.12 : 1.04);
                imp.vx = (dxW / dw) * spd;
                imp.vy = (dyW / dw) * spd;
                if (Math.abs(dxW) > 12) imp.facing = dxW >= 0 ? 1 : -1;

                // Ranged Sabotage Plasma Bolt when line-of-sight is clear
                if ((imp.aiCooldown || 0) <= 0 && dist < 430 && dist > 64 && hasLoS) {
                  imp.aiCooldown = Math.max(1.25, 2.15 - st.waveOrBout * 0.22);
                  imp.pose = 'jab';
                  imp.actionTimer = 0.2;
                  imp.actionDuration = 0.2;
                  if (Math.abs(p.x - imp.x) > 10) imp.facing = p.x >= imp.x ? 1 : -1;
                  const ang = Math.atan2(p.y - imp.y, p.x - imp.x);
                  st.projectiles.push({
                    x: imp.x + Math.cos(ang) * 20,
                    y: imp.y - 24 + Math.sin(ang) * 20,
                    vx: Math.cos(ang) * (385 + st.waveOrBout * 28),
                    vy: Math.sin(ang) * (385 + st.waveOrBout * 28),
                    owner: 'enemy',
                    color: '#fb7185',
                    radius: 6.5,
                    damage: 10 + st.waveOrBout * 2,
                    life: 1.25,
                  });
                  soundEngine.playThrow();
                }

                // Occasional Sabotage Mine drop in player's wake
                if ((imp.bossPhaseCd || 0) <= 0 && st.stationHazards.length < 18 && !collidesStationWall(imp.x, imp.y, 16, st)) {
                  imp.bossPhaseCd = 6.2 + Math.random() * 2.5;
                  st.stationHazards.push({
                    id: `sm_${Math.random().toString(36).slice(2, 7)}`,
                    x: imp.x,
                    y: imp.y,
                    radius: 16,
                    kind: 'sabotage_mine',
                    hp: 15,
                    maxHp: 15,
                  });
                }
              } else {
                imp.alertedUntil = 0;
              }
            }

            if (!chasingActive) {
              // Patrol inside walkable points in current or adjacent unlocked room
              const needNewTarget =
                imp.patrolTargetX === undefined ||
                imp.patrolTargetY === undefined ||
                Math.hypot(imp.patrolTargetX - imp.x, imp.patrolTargetY - imp.y) < 28 ||
                (imp.aiCooldown || 0) <= 0;

              if (needNewTarget) {
                imp.aiCooldown = 2.4 + Math.random() * 1.8;
                const candRoom =
                  Math.random() < 0.35
                    ? (() => {
                        const edges = (STATION_GRAPH[impRoom.id] || []).filter(
                          (e) =>
                            !(e.requires === 'wing_b' && !wingBOpen) &&
                            !(e.requires === 'airlock' && !allCluesCollected) &&
                            e.to !== 'airlock'
                        );
                        if (edges.length > 0) {
                          const picked = edges[Math.floor(Math.random() * edges.length)];
                          return STATION_ROOMS.find((r) => r.id === picked.to) || impRoom;
                        }
                        return impRoom;
                      })()
                    : impRoom;

                for (let tries = 0; tries < 6; tries++) {
                  const tx = candRoom.x + 85 + Math.random() * Math.max(80, candRoom.w - 170);
                  const ty = candRoom.y + 85 + Math.random() * Math.max(80, candRoom.h - 170);
                  if (!collidesStationWall(tx, ty, 22, st)) {
                    imp.patrolTargetX = tx;
                    imp.patrolTargetY = ty;
                    break;
                  }
                }
              }

              if (imp.patrolTargetX !== undefined && imp.patrolTargetY !== undefined) {
                const wp = getNextStationWaypoint(
                  imp.x,
                  imp.y,
                  imp.patrolTargetX,
                  imp.patrolTargetY,
                  wingBOpen,
                  allCluesCollected
                );
                if (wp.reachable) {
                  const dxP = wp.x - imp.x;
                  const dyP = wp.y - imp.y;
                  const dp = Math.hypot(dxP, dyP) || 1;
                  const pSpd = (imp.speed || 165) * 0.68;
                  imp.vx = (dxP / dp) * pSpd;
                  imp.vy = (dyP / dp) * pSpd;
                  if (Math.abs(dxP) > 12) imp.facing = dxP >= 0 ? 1 : -1;
                } else {
                  imp.patrolTargetX = undefined;
                  imp.vx = 0;
                  imp.vy = 0;
                }
              }

              // Occasionally vent ONLY to unlocked, non-airlock rooms when far from player
              if ((imp.ventCooldown || 0) <= 0 && dist > 520) {
                imp.ventCooldown = 10 + Math.random() * 6;
                const allowedVents = STATION_VENTS.filter(
                  (v) => v.room !== 'airlock' && (v.room !== 'electrical' || wingBOpen)
                );
                if (allowedVents.length > 0) {
                  const destVent = allowedVents[Math.floor(Math.random() * allowedVents.length)];
                  if (!collidesStationWall(destVent.x, destVent.y, 20, st)) {
                    spawnParticles(imp.x, imp.y - 24, '#ef4444', 10, 150);
                    imp.x = destVent.x;
                    imp.y = destVent.y;
                    imp.patrolTargetX = undefined;
                    imp.patrolTargetY = undefined;
                    spawnParticles(imp.x, imp.y - 24, '#ef4444', 12, 170);
                  }
                }
              }
            }
          }

          // Smooth NPC separation so imposters never stack & glitch on top of each other
          let sepX = 0;
          let sepY = 0;
          for (let j = 0; j < st.enemies.length; j++) {
            if (i === j) continue;
            const other = st.enemies[j];
            const sdx = imp.x - other.x;
            const sdy = imp.y - other.y;
            const sd = Math.hypot(sdx, sdy);
            if (sd > 0.1 && sd < 36) {
              sepX += (sdx / sd) * (36 - sd) * 3.5;
              sepY += (sdy / sd) * (36 - sd) * 3.5;
            }
          }

          const prevX = imp.x;
          const prevY = imp.y;
          const totalVx = imp.vx + (imp.knockVx || 0) + sepX;
          const totalVy = imp.vy + (imp.knockVy || 0) + sepY;
          const moveRes = moveStationEntity(imp, totalVx * dt, totalVy * dt, 18, st);
          if ((moveRes.blockedX || moveRes.blockedY) && now >= (imp.alertedUntil || 0)) {
            imp.patrolTargetX = undefined;
          }

          const movedDist = Math.hypot(imp.x - prevX, imp.y - prevY);
          if (imp.actionTimer <= 0) {
            imp.pose = movedDist > 0.35 ? 'run' : 'idle';
          }

          if (dist < (imp.isBoss ? 50 : 44)) {
            const d = dist || 1;
            if (now < p.shieldUntil) {
              const kx = (imp.x - p.x) / d;
              const ky = (imp.y - p.y) / d;
              imp.knockVx = kx * 310;
              imp.knockVy = ky * 310;
              moveStationEntity(imp, kx * 12, ky * 12, 18, st);
              if (imp.hitCooldown <= 0) {
                imp.hitCooldown = 0.45;
                spawnParticles(p.x, p.y - 34, '#38bdf8', 10, 180);
                soundEngine.playDash();
              }
            } else if (imp.hitCooldown <= 0) {
              imp.hitCooldown = 0.65;
              imp.pose = 'jab';
              imp.actionTimer = 0.22;
              imp.actionDuration = 0.22;
              handlePlayerDamage(imp.isBoss ? 22 : 18, ((p.x - imp.x) / d) * 260, ((p.y - imp.y) / d) * 260);
            }
          }
        }

        // Check Reaching Airlock Escape Pod inside Room 12 (after Clues collected & Warden Boss beaten!)
        const airlockBossAlive = st.enemies.some((e) => e.isBoss);
        if (allCluesCollected && Math.hypot(p.x - AIRLOCK_POD_X, p.y - AIRLOCK_POD_Y) < 70) {
          if (airlockBossAlive) {
            if (!st.banner || now >= st.banner.until) {
              showBanner('DEFEAT THE AIRLOCK WARDEN TO ESCAPE!', 'Shoot with J or K!', '#f43f5e', 1100);
            }
          } else {
            st.score += 420;
            st.drops += 8;
            st.gems += 3;
            soundEngine.playBell(2);
            if (st.waveOrBout >= 3) {
              finishMatch(true);
              return;
            } else {
              st.waveOrBout += 1;
              const nextSec = buildEscapeSector(st.waveOrBout);
              st.escapeClues = nextSec.clues;
              st.stationHazards = nextSec.hazards;
              st.enemies = nextSec.imposters;
              st.pickups = nextSec.pickups;
              st.projectiles = [];
              p.x = 930;
              p.y = 770;
              p.vx = 0;
              p.vy = 0;
              p.slowUntil = 0;
              st.radarPingUntil = now + 2600;
              refillPlayerFullLife(
                `SECTOR ${st.waveOrBout}: FIND ${st.escapeClues.length} CLUES!`,
                'AIRLOCK CLEARED · FULL HP RESTORED!'
              );
            }
          }
        }
      } else {
        // === MODE 3: STICKMAN GLACIER RUN (WITH DROPPED HAZARDS & END-OF-LEVEL BOSS) ===
        const playerSlowed = now < (p.slowUntil || 0);
        const turbo = now < p.rageUntil ? 1.35 : 1;
        st.runnerSpeed = Math.min(640, (370 + st.elapsed * 2.1) * turbo * (playerSlowed ? 0.68 : 1));
        st.runnerScroll += st.runnerSpeed * dt;
        st.score += st.runnerSpeed * dt * 0.04;

        const distMeters = Math.floor(st.runnerScroll / 16);
        const runnerBossAlive = st.enemies.some((e) => e.isBoss);
        if (!runnerBossAlive && distMeters >= st.waveOrBout * 560) {
          const bossHp = 240 + st.waveOrBout * 90;
          st.enemies.push({
            x: CANVAS_W + 70,
            y: 350,
            vx: 0,
            vy: 0,
            facing: -1,
            hp: bossHp,
            maxHp: bossHp,
            pose: 'idle',
            actionTimer: 0,
            actionDuration: 0.28,
            dashTimer: 0,
            dashCooldown: 0,
            coyoteTimer: 0,
            jumpBufferTimer: 0,
            hitCooldown: 0,
            invulnTimer: 0,
            flashTimer: 0,
            grounded: false,
            jumpsLeft: 1,
            stamina: 100,
            finisher: 0,
            shieldUntil: 0,
            rageUntil: 0,
            magnetUntil: 0,
            dropThroughUntil: 0,
            stunnedUntil: 0,
            ropeBoostUntil: 0,
            hasHitCurrentSwing: false,
            id: `runner_boss_${st.waveOrBout}`,
            name: st.waveOrBout >= 3 ? 'Cryo Mech Emperor' : `Frost Interceptor Lv.${st.waveOrBout}`,
            stroke: '#f43f5e',
            accent: '#fbbf24',
            isBoss: true,
            aiCooldown: 1.2,
            bossPhaseCd: 3.1,
            bossState: 'idle',
          });
          soundEngine.playBell(1);
          showBanner(
            `LEVEL ${st.waveOrBout} BOSS: ${st.waveOrBout >= 3 ? 'CRYO MECH EMPEROR!' : 'FROST INTERCEPTOR!'}`,
            'Blast with J (Rapid) · K (Heavy) · L (Mega Beam)',
            '#f43f5e',
            2200
          );
        }

        // Step Runner Level Boss NPC
        for (let bi = st.enemies.length - 1; bi >= 0; bi--) {
          const b = st.enemies[bi];
          b.flashTimer = Math.max(0, b.flashTimer - dt);
          if (b.actionTimer > 0) b.actionTimer = Math.max(0, b.actionTimer - dt);
          b.aiCooldown = Math.max(0, (b.aiCooldown || 0) - dt);
          b.bossPhaseCd = Math.max(0, (b.bossPhaseCd ?? 3.0) - dt);

          if (b.hp <= 0) {
            st.knockouts += 1;
            st.drops += 6;
            st.gems += 3;
            st.score += 450;
            spawnDropBurst(b.x, b.y, 4, true);
            spawnParticles(b.x, b.y - 45, '#fb7185', 24, 280);
            soundEngine.playBell(2);
            st.enemies.splice(bi, 1);
            if (st.waveOrBout >= 3) {
              finishMatch(true);
              return;
            } else {
              st.waveOrBout += 1;
              refillPlayerFullLife(
                `LEVEL ${st.waveOrBout} UNLOCKED!`,
                'BOSS DEFEATED · FULL HP RESTORED!'
              );
            }
            continue;
          }

          if (b.bossState === 'dash') {
            b.x -= 640 * dt;
            b.pose = 'heavy';
            if (Math.abs(b.x - p.x) < 42 && Math.abs(b.y - p.y) < 76) {
              if (now < p.shieldUntil) {
                b.bossState = 'idle';
                spawnParticles(p.x, p.y - 42, '#38bdf8', 12, 220);
                soundEngine.playDash();
              } else {
                handlePlayerDamage(18, -160);
              }
            }
            if (b.x < 170) b.bossState = 'idle';
          } else {
            const targetX = CANVAS_W - 185;
            b.x += (targetX - b.x) * Math.min(1, dt * 3.5);
            b.y = 355 + Math.sin(st.elapsed * 2.1) * 95;
            b.facing = -1;
            if (b.actionTimer <= 0) b.pose = 'jump';
          }

          if ((b.aiCooldown || 0) <= 0 && b.x < CANVAS_W - 40) {
            b.aiCooldown = Math.max(0.85, 1.45 - st.waveOrBout * 0.18);
            b.pose = 'jab';
            b.actionTimer = 0.22;
            b.actionDuration = 0.22;
            const aimVy = Math.max(-220, Math.min(220, ((p.y - 45) - (b.y - 48)) * 0.65));
            st.projectiles.push({
              x: b.x - 28,
              y: b.y - 48,
              vx: -540,
              vy: aimVy,
              owner: 'enemy',
              color: '#f43f5e',
              radius: 9,
              damage: 14,
            });
            soundEngine.playThrow();
          }

          if ((b.bossPhaseCd || 0) <= 0 && b.x < CANVAS_W - 40) {
            b.bossPhaseCd = Math.max(2.3, 3.6 - st.waveOrBout * 0.3);
            if (Math.random() < 0.34) {
              b.bossState = 'dash';
              showBanner('BOSS SURGE DASH! JUMP OVER!', undefined, '#fb923c', 850);
            } else {
              // Boss drops boulder or sludge onto track ahead of player
              const dropPlat = st.runnerPlatforms.find((pl) => pl.x + pl.w > 460) || st.runnerPlatforms[0];
              const targetY = dropPlat ? dropPlat.y : 440;
              if (Math.random() < 0.65) {
                st.runnerHazards.push({
                  id: `bb_${Math.random()}`,
                  x: 430 + Math.random() * 290,
                  y: -30,
                  w: 44,
                  h: 44,
                  kind: 'falling_boulder',
                  hp: 2,
                  vy: 45,
                  targetY,
                  landed: false,
                });
              } else if (dropPlat) {
                st.runnerHazards.push({
                  id: `bs_${Math.random()}`,
                  x: Math.max(460, Math.min(dropPlat.x + dropPlat.w - 110, 720)),
                  y: targetY,
                  w: 90,
                  h: 14,
                  kind: 'sludge',
                  hp: 99,
                });
              }
            }
          }
        }

        const sliding = Boolean(keys['s'] || keys['arrowdown']);
        if (sliding && !p.grounded) p.vy += 1100 * dt;
        p.pose = !p.grounded ? (p.vy < 0 ? 'jump' : 'fall') : sliding ? 'slide' : 'run';

        p.vy += 1580 * dt;
        p.y += p.vy * dt;

        for (const plat of st.runnerPlatforms) plat.x -= st.runnerSpeed * dt;
        for (const hz of st.runnerHazards) {
          hz.x -= st.runnerSpeed * dt;
          if (hz.kind === 'falling_boulder' && !hz.landed) {
            hz.vy = (hz.vy || 0) + 980 * dt;
            hz.y += hz.vy * dt;
            const ty = hz.targetY ?? 450;
            if (hz.y >= ty) {
              hz.y = ty;
              hz.vy = 0;
              hz.landed = true;
              st.shake = Math.max(st.shake, 5);
              spawnParticles(hz.x + hz.w * 0.5, hz.y, '#fb923c', 8, 160);
            }
          }
        }
        for (const pk of st.pickups) pk.x -= st.runnerSpeed * dt;

        st.runnerPlatforms = st.runnerPlatforms.filter((pl) => pl.x + pl.w > -120);
        const lastPlat = st.runnerPlatforms[st.runnerPlatforms.length - 1];
        if (lastPlat && lastPlat.x + lastPlat.w < CANVAS_W + 450) {
          const gap = runnerBossAlive ? 65 + Math.random() * 65 : 90 + Math.random() * 125;
          const nx = lastPlat.x + lastPlat.w + gap;
          const ny = runnerBossAlive
            ? 455
            : Math.max(310, Math.min(520, lastPlat.y + (Math.random() - 0.5) * 140));
          const nw = runnerBossAlive ? 420 : 280 + Math.random() * 340;
          st.runnerPlatforms.push({ x: nx, y: ny, w: nw });

          for (let px = nx + 55; px < nx + nw - 55; px += 65) {
            if (Math.random() < 0.7) {
              st.pickups.push({
                id: `rp_${Math.random()}`,
                x: px,
                y: ny - 48 - (Math.random() < 0.35 ? 55 : 0),
                vy: 0,
                kind: Math.random() < 0.22 ? 'gem' : 'drop',
              });
            }
          }
          if (Math.random() < 0.34) {
            const kinds: Pickup2D['kind'][] = ['medkit', 'shield', 'shield', 'rage', 'magnet'];
            st.pickups.push({
              id: `rpu_${Math.random()}`,
              x: nx + nw * 0.5,
              y: ny - 95,
              vy: 0,
              kind: kinds[Math.floor(Math.random() * kinds.length)],
            });
          }
          if (!runnerBossAlive && nw > 260 && Math.random() < 0.88) {
            const roll = Math.random();
            if (roll < 0.24) {
              st.runnerHazards.push({ id: `hz_${Math.random()}`, x: nx + nw * 0.55, y: ny, w: 38, h: 36, kind: 'spike', hp: 99 });
            } else if (roll < 0.46) {
              st.runnerHazards.push({ id: `hz_${Math.random()}`, x: nx + nw * 0.52, y: ny - 54, w: 58, h: 48, kind: 'icicle', hp: 99 });
            } else if (roll < 0.68) {
              st.runnerHazards.push({ id: `hz_${Math.random()}`, x: nx + nw * 0.62, y: ny, w: 44, h: 48, kind: 'crate', hp: 1 });
            } else if (roll < 0.85) {
              st.runnerHazards.push({
                id: `hz_${Math.random()}`,
                x: nx + nw * 0.5,
                y: -30,
                w: 44,
                h: 44,
                kind: 'falling_boulder',
                hp: 2,
                vy: 30,
                targetY: ny,
                landed: false,
              });
            } else {
              st.runnerHazards.push({ id: `hz_${Math.random()}`, x: nx + nw * 0.42, y: ny, w: 92, h: 14, kind: 'sludge', hp: 99 });
            }
          }
        }

        const wasGrounded = p.grounded;
        p.grounded = false;
        for (const pl of st.runnerPlatforms) {
          if (p.x >= pl.x - 14 && p.x <= pl.x + pl.w + 14 && p.vy >= 0) {
            if (p.y >= pl.y && p.y - p.vy * dt <= pl.y + 20) {
              p.y = pl.y;
              p.vy = 0;
              p.grounded = true;
              p.jumpsLeft = 2;
              p.coyoteTimer = 0.12;
              if (p.jumpBufferTimer > 0) {
                p.jumpBufferTimer = 0;
                p.vy = -645 * (playerSlowed ? 0.9 : 1);
                p.grounded = false;
                p.jumpsLeft = 1;
                soundEngine.playDash();
              }
            }
          }
        }
        if (wasGrounded && !p.grounded && p.vy >= 0) p.coyoteTimer = 0.12;

        if (p.y > CANVAS_H + 80) {
          handlePlayerDamage(25, 0);
          const safePlat = st.runnerPlatforms.find((pl) => pl.x + pl.w > 180) || st.runnerPlatforms[0];
          if (safePlat) {
            p.x = Math.max(180, Math.min(340, safePlat.x + 80));
            p.y = safePlat.y - 120;
            p.vy = 0;
          }
        }

        const playerTop = p.y - (sliding ? 34 : 78);
        st.runnerHazards = st.runnerHazards.filter((hz) => {
          if (hz.x + hz.w < -60) return false;
          const hzTop = hz.y - hz.h;
          const overlapX = Math.abs(p.x - (hz.x + hz.w / 2)) < hz.w / 2 + 16;
          const overlapY = p.y > hzTop + 4 && playerTop < hz.y - 4;
          if (overlapX && overlapY) {
            if (hz.kind === 'sludge') {
              if (now >= p.shieldUntil) p.slowUntil = Math.max(p.slowUntil || 0, now + 1500);
              if (Math.random() < 0.3) spawnParticles(p.x, p.y - 8, '#7dd3fc', 1, 70);
              return true;
            }
            if (hz.kind === 'crate' && now < p.rageUntil) {
              st.cratesSmashed += 1;
              st.score += 45;
              soundEngine.playPunch(true);
              spawnParticles(hz.x, hz.y - 24, '#7dd3fc', 12, 220);
              return false;
            }
            handlePlayerDamage(hz.kind === 'crate' ? 12 : 18, -140);
            if (now >= p.shieldUntil) {
              p.slowUntil = now + (hz.kind === 'crate' ? 1100 : 1350);
              p.vy = Math.min(p.vy, -230);
            }
            spawnParticles(hz.x, hz.y - 20, now < p.shieldUntil ? '#38bdf8' : '#ef4444', 10, 170);
            return false;
          }
          return true;
        });
      }

      // === PROJECTILES (Across All 3 Modes) ===
      for (let i = st.projectiles.length - 1; i >= 0; i--) {
        const pr = st.projectiles[i];
        const pDt = pr.owner === 'enemy' ? dt * slowFactor : dt;
        pr.x += pr.vx * pDt;
        pr.y += pr.vy * pDt;
        if (pr.life !== undefined) {
          pr.life -= dt;
          if (pr.life <= 0) {
            st.projectiles.splice(i, 1);
            continue;
          }
        }

        if (st.mode === 'stickman_wrestling') {
          if (pr.x < st.cameraX - 100 || pr.x > st.cameraX + CANVAS_W + 100) {
            st.projectiles.splice(i, 1);
            continue;
          }
        } else if (st.mode === 'stickman_brawl') {
          if (pr.owner === 'player') {
            let hitHazard = false;
            for (let hi = st.stationHazards.length - 1; hi >= 0; hi--) {
              const hz = st.stationHazards[hi];
              if (
                (hz.kind === 'cargo_block' || hz.kind === 'sabotage_mine') &&
                Math.hypot(pr.x - hz.x, pr.y - hz.y) < hz.radius + 10
              ) {
                hz.hp -= pr.damage || 22;
                spawnParticles(pr.x, pr.y, '#fb923c', 7, 130);
                if (hz.kind === 'sabotage_mine' && hz.hp <= 0) {
                  spawnParticles(hz.x, hz.y, '#ef4444', 14, 190);
                  st.stationHazards.splice(hi, 1);
                  st.score += 35;
                }
                hitHazard = true;
                break;
              }
            }
            if (hitHazard) {
              st.projectiles.splice(i, 1);
              continue;
            }
          }
          if (collidesStationWall(pr.x, pr.y, 4, st)) {
            spawnParticles(pr.x, pr.y, pr.color, 5, 110);
            st.projectiles.splice(i, 1);
            continue;
          }
        } else if (pr.x < -40 || pr.x > CANVAS_W + 40) {
          st.projectiles.splice(i, 1);
          continue;
        }

        let hit = false;
        if (st.mode === 'stickman_run') {
          if (pr.owner === 'enemy') {
            if (Math.abs(pr.x - p.x) < 26 && Math.abs(pr.y - (p.y - 45)) < 44) {
              handlePlayerDamage(pr.damage || 14, -140);
              hit = true;
            }
          } else {
            for (let j = st.runnerHazards.length - 1; j >= 0; j--) {
              const hz = st.runnerHazards[j];
              if (
                (hz.kind === 'crate' || hz.kind === 'falling_boulder') &&
                Math.abs(pr.x - (hz.x + hz.w / 2)) < hz.w / 2 + 12 &&
                Math.abs(pr.y - (hz.y - hz.h / 2)) < hz.h / 2 + 16
              ) {
                hz.hp -= pr.piercing ? 2 : 1;
                if (hz.hp <= 0) {
                  st.runnerHazards.splice(j, 1);
                  st.cratesSmashed += 1;
                  st.drops += 2;
                  st.score += 65;
                  soundEngine.playPunch(true);
                  spawnParticles(hz.x + hz.w * 0.5, hz.y - 24, '#67e8f9', 14, 240);
                } else {
                  spawnParticles(pr.x, pr.y, '#fb923c', 6, 120);
                }
                if (!pr.piercing) hit = true;
                break;
              }
            }
            if (!hit || pr.piercing) {
              for (const b of st.enemies) {
                if (Math.abs(pr.x - b.x) < 38 && Math.abs(pr.y - (b.y - 48)) < 62) {
                  damageEnemy(b, pr.damage || 28, 0, 0);
                  soundEngine.playPunch(Boolean(pr.piercing));
                  if (!pr.piercing) hit = true;
                  break;
                }
              }
            }
          }
        } else if (pr.owner === 'enemy') {
          if (Math.abs(pr.x - p.x) < 26 && Math.abs(pr.y - (p.y - 45)) < 46) {
            handlePlayerDamage(pr.damage || 10, Math.sign(pr.vx) * 200);
            hit = true;
          }
        } else {
          // Player shot -> check barrels & obstacles first (in Raid)
          if (st.mode === 'stickman_wrestling') {
            for (let oi = st.raidObstacles.length - 1; oi >= 0; oi--) {
              const obs = st.raidObstacles[oi];
              if (
                Math.abs(pr.x - obs.x) < obs.w * 0.5 + 10 &&
                pr.y > obs.y - obs.h - 10 &&
                pr.y < obs.y + 8
              ) {
                obs.hp -= pr.damage || 22;
                spawnParticles(pr.x, pr.y, '#fbbf24', 6, 120);
                if (!pr.piercing) hit = true;
                break;
              }
            }
            if (!hit || pr.piercing) {
              for (let bi = st.raidBarrels.length - 1; bi >= 0; bi--) {
                const br = st.raidBarrels[bi];
                if (Math.abs(pr.x - br.x) < 24 && Math.abs(pr.y - (br.y - 25)) < 32) {
                  br.hp -= pr.damage || 22;
                  if (!pr.piercing) hit = true;
                  if (br.hp <= 0) {
                    st.raidBarrels.splice(bi, 1);
                    st.cratesSmashed += 1;
                    st.score += 90;
                    st.shake = 14;
                    soundEngine.playSlam();
                    spawnParticles(br.x, br.y - 24, '#fb923c', 22, 320);
                    spawnDropBurst(br.x, br.y, 2, true);
                    if (Math.hypot(p.x - br.x, p.y - br.y) < 110 && p.dashTimer <= 0) {
                      handlePlayerDamage(12, (p.x >= br.x ? 1 : -1) * 260);
                    }
                    for (const e of st.enemies) {
                      if (Math.hypot(e.x - br.x, e.y - br.y) < 190) {
                        damageEnemy(e, 75, (e.x >= br.x ? 1 : -1) * 320, -240);
                      }
                    }
                  }
                  break;
                }
              }
            }
          }

          if (!hit || pr.piercing) {
            for (const e of st.enemies) {
              if (Math.abs(pr.x - e.x) < 34 && Math.abs(pr.y - (e.y - 44)) < 54) {
                const rawDmg = pr.damage || 22;
                const finalDmg =
                  e.isBoss && e.bossState === 'guard' && !pr.piercing
                    ? Math.round(rawDmg * 0.5)
                    : rawDmg;
                damageEnemy(e, finalDmg, Math.sign(pr.vx) * 190, -90);
                if (st.mode === 'stickman_brawl' && pr.stunOnly) {
                  e.stunnedUntil = now + (e.isBoss ? 550 : 2800);
                  soundEngine.playDash();
                  spawnParticles(e.x, e.y - 40, '#2dd4bf', 12, 180);
                } else {
                  soundEngine.playPunch(false);
                }
                if (!pr.piercing) hit = true;
                break;
              }
            }
          }
        }
        if (hit) st.projectiles.splice(i, 1);
      }

      // === PICKUPS ===
      for (let i = st.pickups.length - 1; i >= 0; i--) {
        const pk = st.pickups[i];
        if (st.mode === 'stickman_wrestling') {
          pk.vy += 680 * dt;
          pk.y += pk.vy * dt;
          if (pk.y >= RAID_FLOOR - 16) {
            pk.y = RAID_FLOOR - 16;
            pk.vy = 0;
          }
          for (const pl of st.raidPlatforms) {
            if (pk.vy >= 0 && pk.x >= pl.x && pk.x <= pl.x + pl.w && pk.y >= pl.y - 16 && pk.y - pk.vy * dt <= pl.y + 8) {
              pk.y = pl.y - 16;
              pk.vy = 0;
            }
          }
        }
        if (now < p.magnetUntil) {
          const dx = p.x - pk.x;
          const dy = p.y - 36 - pk.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < 360) {
            pk.x += (dx / d) * 480 * dt;
            pk.y += (dy / d) * 480 * dt;
          }
        }

        if (Math.hypot(pk.x - p.x, pk.y - (p.y - 34)) < 50) {
          if (pk.kind === 'drop') {
            st.drops += 1;
            st.score += 20;
            soundEngine.playPickup('drop');
          } else if (pk.kind === 'gem') {
            st.gems += 1;
            st.score += 45;
            soundEngine.playPickup('gem');
          } else if (pk.kind === 'medkit') {
            p.hp = Math.min(p.maxHp, p.hp + 35);
            soundEngine.playPickup('power');
            showBanner('+35 HP MEDKIT!', undefined, '#22c55e', 900);
          } else if (pk.kind === 'shield') {
            p.shieldUntil = now + 10000;
            soundEngine.playPickup('power');
            spawnParticles(pk.x, pk.y, '#38bdf8', 14, 210);
            showBanner('FROST SHIELD ACTIVE (10s)', 'Invulnerable to enemy contact!', '#38bdf8', 1100);
          } else if (pk.kind === 'rage') {
            p.rageUntil = now + 7000;
            soundEngine.playPickup('power');
            showBanner('YETI RAGE BOOST (7s)', undefined, '#fb923c', 900);
          } else if (pk.kind === 'magnet') {
            p.magnetUntil = now + 8000;
            soundEngine.playPickup('power');
            showBanner('DROP MAGNET (8s)', undefined, '#c084fc', 900);
          }
          spawnParticles(pk.x, pk.y, '#7dd3fc', 6, 120);
          st.pickups.splice(i, 1);
        }
      }

      // === PARTICLES ===
      for (let i = st.particles.length - 1; i >= 0; i--) {
        const pt = st.particles[i];
        pt.life -= dt;
        if (pt.life <= 0) {
          st.particles.splice(i, 1);
          continue;
        }
        pt.vy += (st.mode === 'stickman_brawl' ? 0 : 450) * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
      }
    };

    const drawScene = (nowMs: number) => {
      const st = stateRef.current;
      const mode = st ? st.mode : selectedGameMode;
      const mapId = st ? st.mapId : selectedMapId;
      const pal = getMapBackdropColors(mapId);

      ctx.save();
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      if (st && st.shake > 0.5) {
        ctx.translate(
          (Math.random() - 0.5) * st.shake * 1.4,
          (Math.random() - 0.5) * st.shake * 1.4
        );
      }

      if (mode === 'stickman_brawl') {
        // === TOP-DOWN MULTI-ROOM STATION RENDERER ===
        ctx.fillStyle = '#050d1a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const camX = st ? st.cameraX : 330;
        const camY = st ? st.cameraY : 430;
        ctx.save();
        ctx.translate(-camX, -camY);

        // Floor Rooms + Subtle Sci-Fi Deck Tiles
        for (const r of STATION_ROOMS) {
          ctx.fillStyle = r.floor;
          ctx.fillRect(r.x, r.y, r.w, r.h);

          ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
          ctx.lineWidth = 1;
          for (let gx = r.x; gx < r.x + r.w; gx += 46) {
            ctx.beginPath();
            ctx.moveTo(gx, r.y);
            ctx.lineTo(gx, r.y + r.h);
            ctx.stroke();
          }
          for (let gy = r.y; gy < r.y + r.h; gy += 46) {
            ctx.beginPath();
            ctx.moveTo(r.x, gy);
            ctx.lineTo(r.x + r.w, gy);
            ctx.stroke();
          }

          ctx.strokeStyle = r.accent;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.45;
          ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
          ctx.globalAlpha = 1;

          // Floor Room Watermark Label
          ctx.fillStyle = 'rgba(255,255,255,0.16)';
          ctx.font = '700 20px Oxanium, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(r.name, r.x + 20, r.y + 34);
        }

        const cluesFound = st ? st.escapeClues.filter((c) => c.collected).length : 0;
        const totalClues = st ? st.escapeClues.length : 5;
        const wingBOpen = cluesFound >= WING_B_CLUES_REQUIRED;
        const airlockOpen = cluesFound >= totalClues;
        const podX = AIRLOCK_POD_X;
        const podY = AIRLOCK_POD_Y;

        // Built Room Interiors for all 12 Frost Station rooms
        drawStationRoomArchitecture(ctx, airlockOpen, nowMs * 0.001);

        // Floor Vents
        for (const v of STATION_VENTS) {
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 2;
          ctx.fillRect(v.x - 22, v.y - 14, 44, 28);
          ctx.strokeRect(v.x - 22, v.y - 14, 44, 28);
          ctx.strokeStyle = '#0f172a';
          for (let sx = -14; sx <= 14; sx += 7) {
            ctx.beginPath();
            ctx.moveTo(v.x + sx, v.y - 10);
            ctx.lineTo(v.x + sx, v.y + 10);
            ctx.stroke();
          }
        }

        // Walls & Locked/Unlocked Blast Doors
        for (const w of STATION_WALLS) {
          const isHorizontal = w.w > w.h;
          if (w.doorId === 'wing_b') {
            ctx.fillStyle = wingBOpen ? 'rgba(56, 189, 248, 0.14)' : 'rgba(245, 158, 11, 0.72)';
            ctx.strokeStyle = wingBOpen ? '#38bdf8' : '#fbbf24';
            ctx.lineWidth = 3;
            if (isHorizontal) {
              ctx.fillRect(w.x, w.y + 18, w.w, 24);
              ctx.strokeRect(w.x, w.y + 18, w.w, 24);
            } else {
              ctx.fillRect(w.x + 18, w.y, 24, w.h);
              ctx.strokeRect(w.x + 18, w.y, 24, w.h);
            }
            ctx.font = '700 11px Oxanium, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(wingBOpen ? 'OPEN' : `${WING_B_CLUES_REQUIRED} CLUES`, w.x + w.w / 2, w.y + w.h / 2 + 4);
            continue;
          }
          if (w.doorId === 'airlock') {
            ctx.fillStyle = airlockOpen ? 'rgba(52, 211, 153, 0.14)' : 'rgba(244, 63, 94, 0.76)';
            ctx.strokeStyle = airlockOpen ? '#34d399' : '#fb7185';
            ctx.lineWidth = 3;
            if (isHorizontal) {
              ctx.fillRect(w.x, w.y + 18, w.w, 24);
              ctx.strokeRect(w.x, w.y + 18, w.w, 24);
            } else {
              ctx.fillRect(w.x + 18, w.y, 24, w.h);
              ctx.strokeRect(w.x + 18, w.y, 24, w.h);
            }
            ctx.font = '700 11px Oxanium, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(airlockOpen ? 'OPEN' : `${totalClues} CLUES`, w.x + w.w / 2, w.y + w.h / 2 + 4);
            continue;
          }

          ctx.fillStyle = '#09111e';
          ctx.fillRect(w.x, w.y, w.w, w.h);
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 2;
          ctx.strokeRect(w.x, w.y, w.w, w.h);
        }

        if (st) {
          // Clues inside Rooms
          for (const clue of st.escapeClues) {
            if (clue.collected) continue;
            const pulse = 20 + Math.sin(nowMs * 0.007) * 4;
            ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
            ctx.beginPath();
            ctx.arc(clue.x, clue.y, pulse, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fde047';
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2.5;
            ctx.fillRect(clue.x - 14, clue.y - 12, 28, 22);
            ctx.strokeRect(clue.x - 14, clue.y - 12, 28, 22);

            if (clue.scanProgress > 0) {
              ctx.strokeStyle = '#34d399';
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.arc(clue.x, clue.y, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clue.scanProgress);
              ctx.stroke();
            }

            ctx.font = '700 11px Oxanium, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fef08a';
            ctx.fillText(clue.label, clue.x, clue.y - 22);
          }

          // Station Floor Obstacles & Sabotage Traps
          for (const hz of st.stationHazards) {
            drawStationHazard2D(ctx, hz, nowMs * 0.001);
          }

          // Graphic Power-Ups
          for (const pk of st.pickups) {
            drawPowerUpIcon(ctx, pk.kind, pk.x, pk.y, nowMs * 0.001);
          }

          // Imposter Stickmen & Airlock Boss NPC
          for (const imp of st.enemies) {
            drawStickmanCharacter(ctx, {
              x: imp.x,
              y: imp.y + 12,
              facing: imp.facing,
              pose: imp.pose,
              animTime: st.elapsed + imp.x * 0.01,
              actionProgress: imp.actionDuration > 0 ? 1 - imp.actionTimer / imp.actionDuration : 0,
              scale: imp.isBoss ? 1.32 : 0.96,
              isLofiYeti: false,
              imposterVisor: true,
              bossAura: Boolean(imp.isBoss),
              customStroke: imp.stroke || '#ef4444',
              customAccent: imp.accent || '#fb7185',
              hp: imp.hp,
              maxHp: imp.maxHp,
              label: nowMs < imp.stunnedUntil ? 'STUNNED!' : imp.name,
              flashHit: imp.flashTimer > 0,
              weapon: imp.isBoss ? 'blaster' : 'sword',
            });
          }

          // Player Lofi Yeti Stickman
          const p = st.player;
          drawStickmanCharacter(ctx, {
            x: p.x,
            y: p.y + 14,
            facing: p.facing,
            pose: p.pose,
            animTime: st.elapsed,
            actionProgress: p.actionDuration > 0 ? 1 - p.actionTimer / p.actionDuration : 0,
            scale: 1.04,
            isLofiYeti: true,
            colorwayId: selectedColorway,
            hatId: yeti?.equipped.hat || 'hat_goggles',
            scarfId: yeti?.equipped.scarf || 'scarf_lofi',
            shielded: nowMs < p.shieldUntil,
            raged: nowMs < p.rageUntil,
            hp: p.hp,
            maxHp: p.maxHp,
            label: playerName,
            flashHit: p.flashTimer > 0,
            weapon: 'scanner',
          });

          // Directional Radar Beacon Arrow toward nearest Clue OR Airlock Shuttle
          if (nowMs < st.radarPingUntil || airlockOpen) {
            const target = airlockOpen
              ? { x: podX, y: podY, color: '#34d399' }
              : (() => {
                  let best: EscapeClue | null = null;
                  let bestD = Infinity;
                  for (const c of st.escapeClues) {
                    if (c.collected) continue;
                    const d = Math.hypot(c.x - p.x, c.y - p.y);
                    if (d < bestD) {
                      bestD = d;
                      best = c;
                    }
                  }
                  return best ? { x: best.x, y: best.y, color: '#fde047' } : null;
                })();
            if (target) {
              const ang = Math.atan2(target.y - p.y, target.x - p.x);
              const ax = p.x + Math.cos(ang) * 76;
              const ay = p.y + Math.sin(ang) * 76;
              ctx.save();
              ctx.translate(ax, ay);
              ctx.rotate(ang);
              ctx.fillStyle = target.color;
              ctx.beginPath();
              ctx.moveTo(14, 0);
              ctx.lineTo(-8, -8);
              ctx.lineTo(-4, 0);
              ctx.lineTo(-8, 8);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            }
          }

          // Projectiles & Particles in Station World Space
          for (const pr of st.projectiles) {
            ctx.fillStyle = pr.color;
            ctx.beginPath();
            ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          for (const pt of st.particles) {
            ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        } else {
          // Menu preview actors
          drawStickmanCharacter(ctx, {
            x: 930,
            y: 770,
            facing: 1,
            pose: 'run',
            animTime: nowMs * 0.001,
            isLofiYeti: true,
            colorwayId: selectedColorway,
            hatId: yeti?.equipped.hat || 'hat_goggles',
            hp: 100,
            maxHp: 100,
            label: playerName,
            scale: 1.05,
            weapon: 'scanner',
          });
        }

        ctx.restore();

        // === LIVE STATION MINI-MAP (Bottom Right Inside Canvas, above controls) ===
        if (st) {
          const mmW = 228;
          const mmH = 138;
          const mmX = CANVAS_W - mmW - 18;
          const mmY = CANVAS_H - mmH - 64;
          const sx = mmW / STATION_W;
          const sy = mmH / STATION_H;

          ctx.save();
          ctx.fillStyle = 'rgba(4, 12, 24, 0.88)';
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(mmX, mmY, mmW, mmH, 10);
          ctx.fill();
          ctx.stroke();

          for (const r of STATION_ROOMS) {
            ctx.fillStyle = 'rgba(30, 58, 95, 0.55)';
            ctx.strokeStyle = r.accent;
            ctx.lineWidth = 1;
            ctx.fillRect(mmX + r.x * sx, mmY + r.y * sy, r.w * sx, r.h * sy);
            ctx.strokeRect(mmX + r.x * sx, mmY + r.y * sy, r.w * sx, r.h * sy);
          }
          for (const c of st.escapeClues) {
            if (c.collected) continue;
            ctx.fillStyle = '#fde047';
            ctx.beginPath();
            ctx.arc(mmX + c.x * sx, mmY + c.y * sy, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = airlockOpen ? '#34d399' : '#64748b';
          ctx.beginPath();
          ctx.arc(mmX + AIRLOCK_POD_X * sx, mmY + AIRLOCK_POD_Y * sy, 4.5, 0, Math.PI * 2);
          ctx.fill();

          for (const imp of st.enemies) {
            if (Math.hypot(imp.x - st.player.x, imp.y - st.player.y) < 580) {
              ctx.fillStyle = '#ef4444';
              ctx.beginPath();
              ctx.arc(mmX + imp.x * sx, mmY + imp.y * sy, 3.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(mmX + st.player.x * sx, mmY + st.player.y * sy, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else {
        // === SIDE-SCROLLING BACKDROP (Killer Bean Raid & Glacier Run) ===
        const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
        sky.addColorStop(0, pal.skyTop);
        sky.addColorStop(1, pal.skyBot);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const camX = st ? st.cameraX : 0;
        const scrollRef = st ? (mode === 'stickman_run' ? st.runnerScroll : camX) : nowMs * 0.04;

        ctx.save();
        ctx.strokeStyle = pal.accent;
        ctx.globalAlpha = 0.16;
        ctx.lineWidth = 34;
        ctx.beginPath();
        ctx.moveTo(0, 120);
        for (let x = 0; x <= CANVAS_W; x += 80) {
          ctx.lineTo(x, 115 + Math.sin((x + scrollRef * 0.15) * 0.008) * 38);
        }
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = pal.ridgeFar;
        ctx.beginPath();
        ctx.moveTo(0, CANVAS_H);
        for (let x = 0; x <= CANVAS_W + 120; x += 140) {
          const h = 230 + Math.sin((x + scrollRef * 0.18) * 0.011 + 1.4) * 60;
          ctx.lineTo(x, h);
        }
        ctx.lineTo(CANVAS_W, CANVAS_H);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = pal.ridgeNear;
        ctx.beginPath();
        ctx.moveTo(0, CANVAS_H);
        for (let x = 0; x <= CANVAS_W + 100; x += 110) {
          const h = 320 + Math.cos((x + scrollRef * 0.35) * 0.014) * 52;
          ctx.lineTo(x, h);
        }
        ctx.lineTo(CANVAS_W, CANVAS_H);
        ctx.closePath();
        ctx.fill();

        if (st) {
          ctx.fillStyle = pal.particle;
          for (const fl of st.ambientFlakes) {
            ctx.globalAlpha = 0.45;
            ctx.beginPath();
            ctx.arc(fl.x, fl.y, fl.s, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        if (mode === 'stickman_wrestling') {
          // Parallax Skyline Towers & Syndicate Compound Buildings
          drawRaidParallaxBuildings(ctx, camX, CANVAS_W, RAID_FLOOR, pal.accent, nowMs * 0.001);

          ctx.save();
          ctx.translate(-camX, 0);

          // Warehouse Steel Columns & Spotlights
          const endX = st ? st.levelEndX : 4150;
          for (let bx = 240; bx < endX; bx += 360) {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
            ctx.fillRect(bx, 60, 26, RAID_FLOOR - 60);
            ctx.fillStyle = 'rgba(251, 191, 36, 0.07)';
            ctx.beginPath();
            ctx.moveTo(bx + 13, 80);
            ctx.lineTo(bx - 80, RAID_FLOOR);
            ctx.lineTo(bx + 106, RAID_FLOOR);
            ctx.closePath();
            ctx.fill();
          }

          // Compound Floor
          ctx.fillStyle = pal.floorFill;
          ctx.fillRect(0, RAID_FLOOR, endX + 400, CANVAS_H - RAID_FLOOR);
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(0, RAID_FLOOR, endX + 400, 6);

          if (st) {
            // Elevated Steel Catwalks with Truss Supports & Shipping Containers
            drawRaidPlatformSupports(ctx, st.raidPlatforms, RAID_FLOOR, pal.floorTrim);

            // Dropped Raid Obstacles (Laser Barriers, Airdrop Crates, Cryo Mines)
            for (const obs of st.raidObstacles) {
              drawRaidObstacle2D(ctx, obs, nowMs * 0.001);
            }

            // Explosive Barrels
            for (const br of st.raidBarrels) {
              ctx.fillStyle = '#dc2626';
              ctx.strokeStyle = '#fca5a5';
              ctx.lineWidth = 2.5;
              ctx.fillRect(br.x - 16, br.y - 48, 32, 48);
              ctx.strokeRect(br.x - 16, br.y - 48, 32, 48);
              ctx.fillStyle = '#facc15';
              ctx.fillRect(br.x - 16, br.y - 28, 32, 9);
            }

            // Armored Extraction Gatehouse Building
            const bossAlive = st.enemies.some((e) => e.isBoss);
            drawExtractionBunker(ctx, endX, RAID_FLOOR, bossAlive, nowMs * 0.001);

            for (const pk of st.pickups) {
              drawPowerUpIcon(ctx, pk.kind, pk.x, pk.y, nowMs * 0.001);
            }

            for (const e of st.enemies) {
              drawStickmanCharacter(ctx, {
                x: e.x,
                y: e.y,
                facing: e.facing,
                pose: e.pose,
                animTime: st.elapsed + e.x * 0.01,
                actionProgress: e.actionDuration > 0 ? 1 - e.actionTimer / e.actionDuration : 0,
                scale: e.isBoss ? 1.38 : 1.08,
                isLofiYeti: false,
                bossAura: Boolean(e.isBoss),
                shielded: Boolean(e.isBoss && e.bossState === 'guard'),
                customStroke: e.stroke || '#fb7185',
                customAccent: e.accent || '#facc15',
                hp: e.hp,
                maxHp: e.maxHp,
                label: e.name,
                flashHit: e.flashTimer > 0,
                weapon: 'pistols',
              });
            }

            const p = st.player;
            drawStickmanCharacter(ctx, {
              x: p.x,
              y: p.y,
              facing: p.facing,
              pose: p.pose,
              animTime: st.elapsed,
              actionProgress: p.actionDuration > 0 ? 1 - p.actionTimer / p.actionDuration : 0,
              scale: 1.18,
              isLofiYeti: true,
              colorwayId: selectedColorway,
              hatId: yeti?.equipped.hat || 'hat_goggles',
              scarfId: yeti?.equipped.scarf || 'scarf_lofi',
              shielded: nowMs < p.shieldUntil,
              raged: nowMs < p.rageUntil,
              finisherReady: p.finisher >= 100,
              hp: p.hp,
              maxHp: p.maxHp,
              label: playerName,
              flashHit: p.flashTimer > 0,
              weapon: 'pistols',
            });

            for (const pr of st.projectiles) {
              ctx.fillStyle = pr.color;
              ctx.beginPath();
              ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.stroke();
            }

            for (const pt of st.particles) {
              ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
              ctx.fillStyle = pt.color;
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          } else {
            drawStickmanCharacter(ctx, {
              x: 380,
              y: RAID_FLOOR,
              facing: 1,
              pose: 'idle',
              animTime: nowMs * 0.001,
              isLofiYeti: true,
              colorwayId: selectedColorway,
              hatId: yeti?.equipped.hat || 'hat_goggles',
              hp: 100,
              maxHp: 100,
              label: playerName,
              scale: 1.24,
              weapon: 'pistols',
            });
          }

          ctx.restore();
        } else if (mode === 'stickman_run' && st) {
          drawArcticOutpostParallax(ctx, scrollRef, CANVAS_W, 412, pal.accent, nowMs * 0.001);
          drawRunnerPlatformFoundations(ctx, st.runnerPlatforms, CANVAS_H, pal.floorFill, pal.floorTrim);
          for (const hz of st.runnerHazards) {
            drawRunnerHazard2D(ctx, hz, nowMs * 0.001);
          }

          for (const pk of st.pickups) {
            drawPowerUpIcon(ctx, pk.kind, pk.x, pk.y, nowMs * 0.001);
          }

          for (const b of st.enemies) {
            drawStickmanCharacter(ctx, {
              x: b.x,
              y: b.y,
              facing: -1,
              pose: b.pose,
              animTime: st.elapsed,
              actionProgress: b.actionDuration > 0 ? 1 - b.actionTimer / b.actionDuration : 0,
              scale: 1.38,
              isLofiYeti: false,
              bossAura: true,
              customStroke: b.stroke || '#f43f5e',
              customAccent: b.accent || '#fbbf24',
              hp: b.hp,
              maxHp: b.maxHp,
              label: b.name,
              flashHit: b.flashTimer > 0,
              weapon: 'blaster',
            });
          }

          const p = st.player;
          drawStickmanCharacter(ctx, {
            x: p.x,
            y: p.y,
            facing: p.facing,
            pose: p.pose,
            animTime: st.elapsed,
            actionProgress: p.actionDuration > 0 ? 1 - p.actionTimer / p.actionDuration : 0,
            scale: 1.18,
            isLofiYeti: true,
            colorwayId: selectedColorway,
            hatId: yeti?.equipped.hat || 'hat_goggles',
            scarfId: yeti?.equipped.scarf || 'scarf_lofi',
            shielded: nowMs < p.shieldUntil,
            raged: nowMs < p.rageUntil,
            hp: p.hp,
            maxHp: p.maxHp,
            label: playerName,
            flashHit: p.flashTimer > 0,
            weapon: 'blaster',
          });

          for (const pr of st.projectiles) {
            ctx.fillStyle = pr.color;
            ctx.beginPath();
            ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          for (const pt of st.particles) {
            ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }

      if (st && st.banner && nowMs < st.banner.until) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '700 26px "Pixel Forge", Oxanium, sans-serif';
        ctx.fillStyle = '#040c18';
        ctx.fillText(st.banner.text, CANVAS_W / 2 + 2, 146);
        ctx.fillStyle = st.banner.color;
        ctx.fillText(st.banner.text, CANVAS_W / 2, 144);
        if (st.banner.subtext) {
          ctx.font = '600 14px Oxanium, sans-serif';
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(st.banner.subtext, CANVAS_W / 2, 172);
        }
        ctx.restore();
      }

      ctx.restore();
    };

    const loop = (ts: number) => {
      const dt = Math.min(0.04, (ts - lastTs) / 1000);
      lastTs = ts;

      stepPhysics(dt);
      drawScene(ts);

      hudSyncAcc += dt;
      if (hudSyncAcc >= 0.08 && stateRef.current) {
        hudSyncAcc = 0;
        const st = stateRef.current;
        const p = st.player;
        const now = performance.now();
        const boss = st.enemies.find((e) => e.isBoss);
        const cluesFound = st.escapeClues.filter((c) => c.collected).length;
        const cluesTotal = st.escapeClues.length;
        const room =
          STATION_ROOMS.find(
            (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
          )?.name || 'CORRIDOR';
        const nearClue = st.escapeClues.find(
          (c) => !c.collected && Math.hypot(c.x - p.x, c.y - p.y) < 82
        );

        setHud({
          hp: Math.round(p.hp),
          maxHp: p.maxHp,
          finisher: Math.round(p.finisher),
          stamina: Math.round(p.stamina),
          enemyHp: boss ? Math.round(boss.hp) : 0,
          enemyMaxHp: boss ? boss.maxHp : 100,
          enemyName: boss?.name || '',
          score: Math.round(st.score),
          drops: st.drops,
          gems: st.gems,
          combo: st.combo,
          waveOrBout: st.waveOrBout,
          timeLeft: Math.ceil(st.timeLeft),
          shieldLeft: Math.max(0, Math.ceil((p.shieldUntil - now) / 1000)),
          rageLeft: Math.max(0, Math.ceil((p.rageUntil - now) / 1000)),
          magnetLeft: Math.max(0, Math.ceil((p.magnetUntil - now) / 1000)),
          cluesFound,
          cluesTotal,
          currentRoom: room,
          wingBOpen: cluesFound >= WING_B_CLUES_REQUIRED,
          airlockOpen: cluesTotal > 0 && cluesFound >= cluesTotal,
          exitProgress: Math.min(100, Math.max(0, Math.round((p.x / Math.max(1, st.levelEndX)) * 100))),
          nearClueLabel: nearClue?.label || '',
          slowMoActive: now < st.slowMoUntil,
        });
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [collectEscapeClue, finishMatch, playerName, selectedColorway, selectedGameMode, selectedMapId, yeti?.equipped.hat, yeti?.equipped.scarf]);

  const handleClaim = async () => {
    if (!summary || claimStatus !== 'idle') return;
    setClaimStatus('claiming');
    try {
      await onRecordRun(summary);
      setClaimStatus('claimed');
    } catch {
      setClaimStatus('idle');
    }
  };

  const gameSpec = getGameModeSpec(selectedGameMode);
  const mapSpec = getMapSpec(selectedMapId);
  const modes3D = GAME_MODES.filter((g) => g.dimension === '3D');
  const modes2D = GAME_MODES.filter((g) => g.dimension === '2D');

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const hpPct = Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100));
  const hpStateLabel = hud.hp > 50 ? 'STABLE' : hud.hp > 25 ? 'LOW' : 'CRITICAL';
  const enemyHpPct = Math.max(0, Math.min(100, (hud.enemyHp / Math.max(1, hud.enemyMaxHp)) * 100));

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-slate-800 bg-[#061224] shadow-2xl select-none"
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="h-full w-full block object-contain"
        />

        {/* === IN-GAME ARCADE MINI-HUD === */}
        {phase !== 'MENU' && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-3 p-3 sm:p-4 bg-gradient-to-b from-[#040c18]/85 via-[#040c18]/35 to-transparent">
            {/* Left: Player HP & Mode Progress */}
            <div className="pointer-events-auto min-w-[225px] arcade-hud px-3 py-2 space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs font-bold tabular-nums">
                <span className="text-sky-200 inline-flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-rose-400 fill-rose-400" />
                  {playerName}
                </span>
                <span className="font-mono text-[11px] text-slate-200">
                  {hud.hp}/{hud.maxHp} · {hpStateLabel}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-white/15">
                <div
                  className={`h-full transition-all duration-150 ${
                    hpPct > 50 ? 'bg-emerald-400' : hpPct > 25 ? 'bg-amber-400' : 'bg-rose-500'
                  }`}
                  style={{ width: `${hpPct}%` }}
                />
              </div>

              {selectedGameMode === 'stickman_wrestling' ? (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-amber-300 tabular-nums">
                    <span>STAGE {hud.waveOrBout}/3 · EXIT {hud.exitProgress}%</span>
                    <span>SHOT (L) {hud.finisher}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-950">
                    <div
                      className="h-full bg-amber-400 transition-all duration-150"
                      style={{ width: `${hud.exitProgress}%` }}
                    />
                  </div>
                </div>
              ) : selectedGameMode === 'stickman_brawl' ? (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-teal-300 tabular-nums">
                    <span>SECTOR {hud.waveOrBout}/3 · {hud.currentRoom}</span>
                    <span>CLUES {hud.cluesFound}/{hud.cluesTotal}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-950">
                    <div
                      className={`h-full transition-all duration-150 ${
                        hud.airlockOpen ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${(hud.cluesFound / Math.max(1, hud.cluesTotal)) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-300 tabular-nums">
                  <span>LVL {hud.waveOrBout}/3 · MEGA (L) {hud.finisher}%</span>
                  {hud.combo > 1 && <span className="text-amber-300">{hud.combo}× COMBO</span>}
                </div>
              )}

              {(hud.shieldLeft > 0 || hud.rageLeft > 0 || hud.magnetLeft > 0) && (
                <div className="flex flex-wrap gap-2 pt-0.5 text-[10px] font-bold">
                  {hud.shieldLeft > 0 && (
                    <span className="inline-flex items-center gap-1 text-sky-300">
                      <Shield className="h-3 w-3" /> Frost {hud.shieldLeft}s
                    </span>
                  )}
                  {hud.rageLeft > 0 && (
                    <span className="inline-flex items-center gap-1 text-orange-300">
                      <Flame className="h-3 w-3" /> {hud.rageLeft}s
                    </span>
                  )}
                  {hud.magnetLeft > 0 && (
                    <span className="inline-flex items-center gap-1 text-purple-300">
                      <Zap className="h-3 w-3" /> {hud.magnetLeft}s
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Center: Timer, Score, Drops & Gems */}
            <div className="pointer-events-auto flex items-center gap-4 arcade-hud px-4 py-2 text-xs tabular-nums">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Time</span>
                <span className="font-mono text-base font-bold text-white">{formatTime(hud.timeLeft)}</span>
              </div>
              <div className="h-6 w-px bg-slate-700" />
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Score</span>
                <span className="font-mono text-base font-bold text-sky-300">{hud.score}</span>
              </div>
              <div className="h-6 w-px bg-slate-700" />
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 font-mono font-bold text-cyan-300">
                  <Droplets className="h-3.5 w-3.5" />
                  {hud.drops}
                </span>
                <span className="inline-flex items-center gap-1 font-mono font-bold text-sky-200">
                  <Gem className="h-3.5 w-3.5" />
                  {hud.gems}
                </span>
              </div>
            </div>

            {/* Right: Navigation + Gate Boss / Clue Status */}
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExitToLanding}
                  className="arcade-hud inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-100 hover:border-sky-400 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Home className="h-3.5 w-3.5 text-sky-400" />
                  Home
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (stateRef.current) stateRef.current.phase = 'MENU';
                    setPhase('MENU');
                  }}
                  className="arcade-hud inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-sky-200 hover:border-sky-400 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Menu className="h-3.5 w-3.5 text-sky-400" />
                  Menu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!stateRef.current) return;
                    const next = stateRef.current.phase === 'PLAYING' ? 'PAUSED' : 'PLAYING';
                    stateRef.current.phase = next;
                    setPhase(next);
                  }}
                  className="arcade-hud inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white hover:border-sky-400 whitespace-nowrap shrink-0 cursor-pointer"
                  aria-label="Pause or resume"
                >
                  {phase === 'PAUSED' ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.muted = !muted;
                    setMuted(soundEngine.muted);
                  }}
                  className="arcade-hud p-1.5 text-slate-200 hover:border-sky-400 cursor-pointer"
                  aria-label="Toggle sound"
                >
                  {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="arcade-hud p-1.5 text-slate-200 hover:border-sky-400 cursor-pointer"
                  aria-label="Toggle fullscreen"
                >
                  {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
              </div>

              {hud.enemyName && (
                <div className="min-w-[205px] arcade-hud border-rose-500/45 px-3 py-1.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
                    <span className="text-orange-200">{hud.enemyName}</span>
                    <span className="font-mono text-slate-300">
                      {hud.enemyHp}/{hud.enemyMaxHp}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950">
                    <div
                      className="h-full bg-rose-500 transition-all duration-150"
                      style={{ width: `${enemyHpPct}%` }}
                    />
                  </div>
                </div>
              )}

              {selectedGameMode === 'stickman_brawl' && hud.nearClueLabel && (
                <div className="arcade-hud border-amber-400/60 px-3 py-1.5 text-[11px] font-bold text-amber-200">
                  PRESS [E] TO ANALYZE: {hud.nearClueLabel}
                </div>
              )}
            </div>
          </div>
        )}

        {/* === UNIFIED POINTER TOUCH / MOUSE GAMEPLAY CONTROLS === */}
        {phase === 'PLAYING' && (
          <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 p-2.5 bg-gradient-to-t from-[#040c18]/80 to-transparent">
            <div className="flex items-center gap-1.5">
              {selectedGameMode !== 'stickman_run' && (
                <>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      keysRef.current['a'] = true;
                    }}
                    onPointerUp={() => (keysRef.current['a'] = false)}
                    onPointerCancel={() => (keysRef.current['a'] = false)}
                    onPointerLeave={() => (keysRef.current['a'] = false)}
                    className="arcade-hud inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white active:bg-sky-500 active:text-slate-950 touch-none cursor-pointer"
                  >
                    <span className="arcade-kbd">A</span> Left
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      keysRef.current['d'] = true;
                    }}
                    onPointerUp={() => (keysRef.current['d'] = false)}
                    onPointerCancel={() => (keysRef.current['d'] = false)}
                    onPointerLeave={() => (keysRef.current['d'] = false)}
                    className="arcade-hud inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white active:bg-sky-500 active:text-slate-950 touch-none cursor-pointer"
                  >
                    Right <span className="arcade-kbd">D</span>
                  </button>
                </>
              )}
              {selectedGameMode === 'stickman_brawl' ? (
                <>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      keysRef.current['w'] = true;
                    }}
                    onPointerUp={() => (keysRef.current['w'] = false)}
                    onPointerCancel={() => (keysRef.current['w'] = false)}
                    onPointerLeave={() => (keysRef.current['w'] = false)}
                    className="arcade-hud inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-sky-200 active:bg-sky-500 active:text-slate-950 touch-none cursor-pointer"
                  >
                    <span className="arcade-kbd">W</span> Up
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      keysRef.current['s'] = true;
                    }}
                    onPointerUp={() => (keysRef.current['s'] = false)}
                    onPointerCancel={() => (keysRef.current['s'] = false)}
                    onPointerLeave={() => (keysRef.current['s'] = false)}
                    className="arcade-hud inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-200 active:bg-sky-500 active:text-slate-950 touch-none cursor-pointer"
                  >
                    <span className="arcade-kbd">S</span> Down
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      triggerAction('jump');
                    }}
                    className="arcade-hud inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-sky-200 active:bg-sky-500 active:text-slate-950 touch-none cursor-pointer"
                  >
                    <span className="arcade-kbd">W</span> Jump
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      keysRef.current['s'] = true;
                    }}
                    onPointerUp={() => (keysRef.current['s'] = false)}
                    onPointerCancel={() => (keysRef.current['s'] = false)}
                    onPointerLeave={() => (keysRef.current['s'] = false)}
                    className="arcade-hud inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-200 active:bg-sky-500 active:text-slate-950 touch-none cursor-pointer"
                  >
                    <span className="arcade-kbd">S</span> Slide
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  triggerAction('jab');
                }}
                className="rounded-lg border border-sky-400/50 bg-sky-500/20 px-2.5 py-1.5 text-xs font-bold text-sky-100 hover:bg-sky-500/35 whitespace-nowrap shrink-0 touch-none cursor-pointer inline-flex items-center gap-1"
              >
                <span className="arcade-kbd">J</span>{' '}
                {selectedGameMode === 'stickman_wrestling'
                  ? 'Pistols'
                  : selectedGameMode === 'stickman_brawl'
                  ? 'Clue / Zap'
                  : 'Blast'}
              </button>
              {selectedGameMode === 'stickman_run' ? (
                <>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      triggerAction('heavy');
                    }}
                    className="rounded-lg border border-amber-400/50 bg-amber-500/20 px-2.5 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-500/35 whitespace-nowrap shrink-0 touch-none cursor-pointer inline-flex items-center gap-1"
                  >
                    <span className="arcade-kbd">K</span> Heavy
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      triggerAction('special');
                    }}
                    className="rounded-lg border border-purple-400/50 bg-purple-500/20 px-2.5 py-1.5 text-xs font-bold text-purple-100 hover:bg-purple-500/35 whitespace-nowrap shrink-0 touch-none cursor-pointer inline-flex items-center gap-1"
                  >
                    <span className="arcade-kbd">L</span> {hud.finisher}%
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      triggerAction('heavy');
                    }}
                    className="rounded-lg border border-amber-400/50 bg-amber-500/20 px-2.5 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-500/35 whitespace-nowrap shrink-0 touch-none cursor-pointer inline-flex items-center gap-1"
                  >
                    <span className="arcade-kbd">K</span>{' '}
                    {selectedGameMode === 'stickman_wrestling' ? 'Spin Kick' : 'Stun Bolt'}
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      triggerAction('dash');
                    }}
                    className="rounded-lg border border-cyan-400/50 bg-cyan-500/20 px-2.5 py-1.5 text-xs font-bold text-cyan-100 hover:bg-cyan-500/35 whitespace-nowrap shrink-0 touch-none cursor-pointer inline-flex items-center gap-1"
                  >
                    <span className="arcade-kbd">SPC</span>{' '}
                    {selectedGameMode === 'stickman_wrestling' ? 'Slow-Mo' : 'Sprint'}
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      triggerAction('special');
                    }}
                    className="rounded-lg border border-purple-400/50 bg-purple-500/20 px-2.5 py-1.5 text-xs font-bold text-purple-100 hover:bg-purple-500/35 whitespace-nowrap shrink-0 touch-none cursor-pointer inline-flex items-center gap-1"
                  >
                    <span className="arcade-kbd">L</span>{' '}
                    {selectedGameMode === 'stickman_wrestling' ? `${hud.finisher}%` : 'Radar'}
                  </button>
                  {selectedGameMode === 'stickman_brawl' && (
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        triggerAction('interact');
                      }}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap shrink-0 touch-none cursor-pointer inline-flex items-center gap-1 ${
                        hud.nearClueLabel
                          ? 'bg-amber-400 text-slate-950'
                          : 'border border-emerald-400/45 bg-emerald-500/20 text-emerald-100'
                      }`}
                    >
                      <span className="arcade-kbd">E</span> Clue
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* === GAMISH 2D LAUNCHER OVERLAY === */}
        {phase === 'MENU' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#040B16]/80 p-3 sm:p-5 overflow-y-auto">
            <div className="w-full max-w-3xl arcade-panel p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-400/15 pb-3.5">
                <div className="flex items-center gap-3">
                  <h2 className="title-3d-game-sm text-2xl sm:text-3xl leading-none">
                    {gameSpec.name}
                  </h2>
                  <span className="rounded bg-amber-500/15 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    2D Stickman
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExitToLanding}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-sky-400 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Home className="h-3.5 w-3.5 text-sky-400" />
                    Home
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuStep('game')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                      menuStep === 'game'
                        ? 'bg-sky-400 text-slate-950'
                        : 'border border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
                    }`}
                  >
                    1 · Game
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuStep('map')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                      menuStep === 'map'
                        ? 'bg-sky-400 text-slate-950'
                        : 'border border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
                    }`}
                  >
                    2 · Stage
                  </button>
                </div>
              </div>

              {menuStep === 'game' ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {modes2D.map((gm) => {
                      const active = gm.id === selectedGameMode;
                      const Icon =
                        gm.id === 'stickman_wrestling'
                          ? Crosshair
                          : gm.id === 'stickman_brawl'
                          ? KeyRound
                          : Flame;
                      const grad =
                        gm.id === 'stickman_wrestling'
                          ? 'from-amber-500/25 via-rose-500/10 to-slate-900'
                          : gm.id === 'stickman_brawl'
                          ? 'from-teal-500/25 via-cyan-500/10 to-slate-900'
                          : 'from-emerald-500/25 via-sky-500/10 to-slate-900';
                      const quickTag =
                        gm.id === 'stickman_wrestling'
                          ? 'Bean Gun-Fu · Reach Exit'
                          : gm.id === 'stickman_brawl'
                          ? 'Rooms · Clues · Escape'
                          : 'Cliff Runner · Blasts';
                      return (
                        <button
                          key={gm.id}
                          type="button"
                          onClick={() => {
                            onChangeGameMode(gm.id);
                            setMenuStep('map');
                          }}
                          className={`overflow-hidden text-left rounded-xl border-2 transition-all cursor-pointer ${
                            active
                              ? 'border-sky-400 bg-sky-500/15 shadow-[0_0_20px_rgba(56,189,248,0.2)]'
                              : 'border-slate-700/80 bg-slate-900/90 hover:border-sky-400/60'
                          }`}
                        >
                          <div className={`bg-gradient-to-br ${grad} px-3.5 py-3 border-b border-white/10 flex items-center justify-between`}>
                            <Icon className="h-6 w-6 text-amber-300" />
                            <span className="rounded bg-slate-950/70 border border-amber-400/35 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                              2D
                            </span>
                          </div>
                          <div className="p-3.5 space-y-1.5">
                            <h3 className="font-display text-lg text-white leading-tight">{gm.name}</h3>
                            <span className="text-[11px] font-semibold text-sky-300 block">{quickTag}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3.5 py-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-300">
                      3D Games
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {modes3D.map((gm) => (
                        <button
                          key={gm.id}
                          type="button"
                          onClick={() => onChangeGameMode(gm.id)}
                          className="rounded-lg border border-sky-400/40 bg-[#081322] px-3 py-1.5 text-xs font-bold text-sky-200 hover:bg-sky-400 hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {gm.shortLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {ARENA_MAPS.map((m) => {
                      const active = m.id === selectedMapId;
                      const detail = getMapModeDetails(m.id, selectedGameMode);
                      const biomeGrad =
                        m.id === 'volcanic_springs'
                          ? 'from-orange-500/45 via-amber-500/20 to-slate-900'
                          : m.id === 'aurora_summit'
                          ? 'from-violet-500/45 via-fuchsia-500/20 to-slate-900'
                          : 'from-cyan-500/45 via-sky-500/20 to-slate-900';
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onChangeMapId(m.id)}
                          className={`overflow-hidden text-left rounded-xl border-2 transition-all cursor-pointer ${
                            active
                              ? 'border-sky-400 bg-sky-500/15 shadow-[0_0_20px_rgba(56,189,248,0.2)]'
                              : 'border-slate-700/80 bg-slate-900/90 hover:border-slate-500'
                          }`}
                        >
                          <div className={`h-10 w-full bg-gradient-to-r ${biomeGrad} px-3 flex items-center justify-between border-b border-white/10`}>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-950/75" style={{ color: m.accentHex }}>
                              {detail.tag}
                            </span>
                            {active && (
                              <span className="text-[10px] font-bold uppercase text-sky-300">Selected</span>
                            )}
                          </div>
                          <div className="p-3 space-y-1">
                            <span className="font-display text-lg text-white block leading-tight">{m.name}</span>
                            <span className="text-[11px] font-medium text-slate-400 block truncate">{m.subtitle}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Yeti:</span>
                      {YETI_COLORWAYS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onChangeColorway(c.id)}
                          title={c.name}
                          className={`h-6 w-6 rounded-md border-2 transition-transform cursor-pointer ${
                            selectedColorway === c.id
                              ? 'border-white scale-110'
                              : 'border-slate-700 opacity-75 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c.skinHex }}
                        />
                      ))}
                    </div>
                    {!yeti && (
                      <button
                        type="button"
                        onClick={onMintPrompt}
                        className="text-xs font-bold text-sky-400 hover:text-sky-300 underline underline-offset-4 cursor-pointer"
                      >
                        Mint Lofi Yeti
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-400/15 pt-3.5">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-300">
                  {selectedGameMode === 'stickman_run' ? (
                    <>
                      <span><span className="arcade-kbd">W</span> Jump</span>
                      <span><span className="arcade-kbd">S</span> Slide</span>
                      <span><span className="arcade-kbd">J</span> Blast</span>
                    </>
                  ) : selectedGameMode === 'stickman_brawl' ? (
                    <>
                      <span><span className="arcade-kbd">WASD</span> Rooms</span>
                      <span><span className="arcade-kbd">E</span> Clue</span>
                      <span><span className="arcade-kbd">K</span> Stun</span>
                      <span><span className="arcade-kbd">L</span> Radar</span>
                    </>
                  ) : (
                    <>
                      <span><span className="arcade-kbd">A/D</span> Move</span>
                      <span><span className="arcade-kbd">W</span> Jump</span>
                      <span><span className="arcade-kbd">J</span> Pistols</span>
                      <span><span className="arcade-kbd">K</span> Spin Kick</span>
                      <span><span className="arcade-kbd">SPC</span> Slow-Mo</span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleStartFromMenu}
                  className="arcade-btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Play Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === PAUSE OVERLAY === */}
        {phase === 'PAUSED' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#040B16]/82 p-4">
            <div className="w-full max-w-sm arcade-panel p-6 text-center space-y-4">
              <h3 className="title-3d-game-sm text-3xl">Paused</h3>
              <p className="text-xs font-semibold text-slate-300">
                {gameSpec.shortLabel} · {mapSpec.name}
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (stateRef.current) stateRef.current.phase = 'PLAYING';
                    setPhase('PLAYING');
                  }}
                  className="arcade-btn-primary inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Resume
                </button>
                <button
                  type="button"
                  onClick={() => initMatchState(selectedGameMode, selectedMapId)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restart
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (stateRef.current) stateRef.current.phase = 'MENU';
                    setPhase('MENU');
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-200 hover:text-white cursor-pointer"
                >
                  <Menu className="h-3.5 w-3.5" />
                  Menu
                </button>
                <button
                  type="button"
                  onClick={handleExitToLanding}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-4 py-2.5 text-xs font-bold text-sky-200 hover:bg-sky-500/25 cursor-pointer"
                >
                  <Home className="h-3.5 w-3.5" />
                  Home
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === GAME OVER / VICTORY OVERLAY === */}
        {phase === 'GAME_OVER' && summary && (
          <ArenaGameOverOverlay
            summary={summary}
            lifeDepleted={hud.hp <= 0}
            claimStatus={claimStatus}
            onClaimSummary={handleClaim}
            onRestart={() => initMatchState(selectedGameMode, selectedMapId)}
            onReturnToMenu={() => {
              if (stateRef.current) stateRef.current.phase = 'MENU';
              setPhase('MENU');
            }}
            onReturnHome={handleExitToLanding}
            onShare={() => onShareRun(summary)}
          />
        )}
      </div>

      {/* Compact Single-Row Keycap & Power-Up Console Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 arcade-hud px-3.5 py-2 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-2.5">
          {selectedGameMode === 'stickman_run' ? (
            <>
              <span><span className="arcade-kbd">W</span> Jump ×2</span>
              <span><span className="arcade-kbd">S</span> Slide</span>
              <span><span className="arcade-kbd">J</span> Blast</span>
              <span><span className="arcade-kbd">K</span> Heavy</span>
              <span><span className="arcade-kbd">L</span> Mega</span>
            </>
          ) : selectedGameMode === 'stickman_brawl' ? (
            <>
              <span><span className="arcade-kbd">WASD</span> Explore Rooms</span>
              <span><span className="arcade-kbd">E/J</span> Analyze Clue</span>
              <span><span className="arcade-kbd">K</span> Stun Imposter</span>
              <span><span className="arcade-kbd">SPC</span> Sprint</span>
              <span><span className="arcade-kbd">L</span> <Radar className="inline h-3 w-3" /> Radar</span>
            </>
          ) : (
            <>
              <span><span className="arcade-kbd">A/D</span> Move</span>
              <span><span className="arcade-kbd">W</span> Jump ×2</span>
              <span><span className="arcade-kbd">S</span> Slide</span>
              <span><span className="arcade-kbd">J</span> Twin Pistols</span>
              <span><span className="arcade-kbd">K</span> Spin Kick</span>
              <span><span className="arcade-kbd">SPC</span> Slow-Mo Dive</span>
              <span><span className="arcade-kbd">L</span> Mega-Shot</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] font-bold">
          <span className="inline-flex items-center gap-1 text-sky-300">
            <Shield className="h-3.5 w-3.5" /> Shield
          </span>
          <span className="inline-flex items-center gap-1 text-orange-300">
            <Flame className="h-3.5 w-3.5" /> Rage
          </span>
          <span className="inline-flex items-center gap-1 text-purple-300">
            <Zap className="h-3.5 w-3.5" /> Magnet
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-300">
            <Heart className="h-3.5 w-3.5" /> Heal
          </span>
        </div>
      </div>
    </div>
  );
};
