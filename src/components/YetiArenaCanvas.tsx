import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Pause,
  Shield,
  Zap,
  Droplets,
  Gem,
  Users,
  User,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Snowflake,
  Wind,
  CheckCircle2,
  Target,
  Hand,
  Music,
  Car,
  Crosshair,
  ChevronLeft,
  Menu,
  Maximize2,
  Minimize2,
  Heart,
  Magnet,
  Flame,
  Home,
} from 'lucide-react';
import type {
  ArenaTaskProgress,
  GameModeId,
  MapId,
  RunSummary,
  TunnelRoomSnapshot,
  WellImpactState,
  YetiColorId,
  YetiEmoteKind,
  YetiObject,
} from '../types';
import { soundEngine } from '../lib/sound';
import { COSMETICS_CATALOG } from '../data/moveContracts';
import {
  ARENA_CENTER_X,
  ARENA_CENTER_Y,
  ARENA_H,
  ARENA_INITIAL_RING_RADIUS,
  ARENA_MAPS,
  ARENA_W,
  GAME_MODES,
  RACE_BOUNDS,
  WELL_RITUAL_RADIUS,
  YETI_COLORWAYS,
  getDistanceToRaceTrack,
  getGameModeSpec,
  getMapModeDetails,
  getMapObstacles,
  getMapSpec,
  getRaceTrackWaypoints,
  getYetiColorway,
  resolveArenaObstacleCollision,
} from '../data/gameCatalog';
import { animateYetiWalk, buildYetiRig, type YetiRigParts } from '../three/yetiBuilder';
import {
  buildArcticEnvironment,
  type ArenaEnvironmentHandles,
} from '../three/arenaEnvironment';
import {
  animateYetiKart,
  buildAimReticle,
  buildHealthBar3D,
  buildShooterTargetMesh,
  buildYetiKartRig,
  updateHealthBar3D,
  type HealthBar3D,
  type ShooterTargetMesh,
  type YetiKartRigParts,
} from '../three/kartAndShooter';
import { ArenaMiniMap, type MiniMapDot } from './ArenaMiniMap';
import { ArenaGameOverOverlay } from './ArenaGameOverOverlay';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
type PlayMode = 'solo' | 'tunnel';
type LauncherStep = 'choose_game' | 'choose_map';

interface YetiArenaCanvasProps {
  yeti: YetiObject | null;
  playerName: string;
  selectedGameMode: GameModeId;
  onChangeGameMode: (gm: GameModeId) => void;
  selectedMapId: MapId;
  onChangeMapId: (mapId: MapId) => void;
  selectedColorway: YetiColorId;
  onChangeColorway: (colorway: YetiColorId) => void;
  wellImpact: WellImpactState;
  onWellImpactUpdate: (wi: WellImpactState) => void;
  autoLaunchMode?: 'launcher' | 'choose_map' | 'tunnel' | null;
  onAutoLaunchHandled?: () => void;
  onMintPrompt: () => void;
  onRecordRun: (summary: RunSummary) => Promise<void>;
  onShareRun: (summary: RunSummary) => void;
  onReturnHome: () => void;
}

const W = ARENA_W;
const H = ARENA_H;
const WORLD_SCALE = 1 / 25;

// Pre-allocated math helpers (zero GC inside animation loop)
const _v3A = new THREE.Vector3();
const _v3B = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function toWorldX(lx: number): number {
  return (lx - ARENA_CENTER_X) * WORLD_SCALE;
}
function toWorldZ(ly: number): number {
  return (ly - ARENA_CENTER_Y) * WORLD_SCALE;
}

function nudgeOutsideObstacles(
  lx: number,
  ly: number,
  clearance: number,
  mapId: MapId
): { x: number; y: number } {
  const res = resolveArenaObstacleCollision(lx, ly, 0, 0, clearance, mapId);
  return {
    x: Math.max(60, Math.min(W - 60, res.x)),
    y: Math.max(60, Math.min(H - 60, res.y)),
  };
}

interface LocalYeti {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  score: number;
  wellDrops: number;
  carriedDrops: number;
  frostGems: number;
  knockouts: number;
  isBot: boolean;
  hat: string;
  scarf: string;
  trail: string;
  colorway: YetiColorId;
  dashCd: number;
  dashTime: number;
  throwCd: number;
  throwPulse: number;
  shieldUntil: number;
  boostUntil: number;
  hurtUntil: number;
  facingX: number;
  facingY: number;
  eliminated: boolean;
  emote: YetiEmoteKind;
  emoteUntil: number;
  gatherAtWellUntil?: number;
  magnetUntil: number;
  tripleUntil: number;
}

interface Pickup {
  id: string;
  kind: 'drop' | 'gem' | 'shield' | 'boost' | 'magnet' | 'triple' | 'medkit';
  x: number;
  y: number;
  bobOffset: number;
  respawnAt?: number;
}

type DestructiblePropKind = 'ice_pillar' | 'frozen_barrel' | 'ice_crate';

interface CrateProp {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp?: number;
  kind?: DestructiblePropKind;
  radius?: number;
  hitFlashUntil?: number;
}

interface Snowball {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  isBlaster?: boolean;
  isEnemyOrb?: boolean;
}

interface IcicleHazard {
  id: string;
  x: number;
  y: number;
  radius: number;
  timer: number;
  maxTimer: number;
}

interface BeaconState {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  timeLeft: number;
  nextIn: number;
  tickAccum: number;
}

interface KartRacer {
  id: string;
  name: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // radians, 0 = +X, PI/2 = +Y
  speed: number;
  steerInput: number;
  nitro: number; // 0..100
  boostUntil: number;
  shieldUntil: number;
  tripleUntil: number;
  magnetUntil: number;
  lap: number; // 1..3
  nextWp: number;
  nextCheckpoint: number; // 1..4
  checkpointsCleared: number;
  totalProgress: number;
  colorway: YetiColorId;
  hat: string;
  scarf: string;
  finished: boolean;
  finishTime: number;
  dropsCollected: number;
  gemsCollected: number;
  score: number;
  aiSpeedBias: number;
  aiLaneOffset: number;
}

interface ShooterEnemy {
  id: string;
  kind: 'drone' | 'bullseye' | 'yeti_rival' | 'boss_yeti';
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  fireCd: number;
  orbitAngle: number;
  colorway: YetiColorId;
}

interface BurstParticle3D {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface ShockwaveRing3D {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  maxScale: number;
}

function getCosmeticColor(id: string, fallback: string): string {
  return COSMETICS_CATALOG.find((c) => c.id === id)?.colorHex || fallback;
}

function createTasksForMode(gm: GameModeId): ArenaTaskProgress[] {
  if (gm === 'car_racing') {
    return [
      {
        id: 'race_laps',
        title: 'Complete 3 Circuit Laps',
        progress: 0,
        target: 3,
        rewardGems: 8,
        completed: false,
      },
      {
        id: 'race_pads',
        title: 'Hit 4 Track Boost Pads',
        progress: 0,
        target: 4,
        rewardGems: 5,
        completed: false,
      },
      {
        id: 'race_podium',
        title: 'Finish Top 2 on Podium',
        progress: 0,
        target: 1,
        rewardGems: 7,
        completed: false,
      },
    ];
  }
  if (gm === 'shooting') {
    return [
      {
        id: 'shoot_elims',
        title: 'Shatter 10 Targets / Drones',
        progress: 0,
        target: 10,
        rewardGems: 6,
        completed: false,
      },
      {
        id: 'shoot_combo',
        title: 'Reach 4x Combo Streak',
        progress: 0,
        target: 4,
        rewardGems: 5,
        completed: false,
      },
      {
        id: 'shoot_bull',
        title: 'Hit 3 Ice Bullseyes',
        progress: 0,
        target: 3,
        rewardGems: 6,
        completed: false,
      },
    ];
  }
  return [
    {
      id: 'task_bank',
      title: 'Bank Drops at Central Well',
      progress: 0,
      target: 1,
      rewardGems: 4,
      completed: false,
    },
    {
      id: 'task_hits',
      title: 'Land 3 Snowball Hits',
      progress: 0,
      target: 3,
      rewardGems: 4,
      completed: false,
    },
    {
      id: 'task_crates',
      title: 'Smash 3 Crates or Capture Beacon',
      progress: 0,
      target: 3,
      rewardGems: 5,
      completed: false,
    },
  ];
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

function getPowerUpRadarColor(kind: string): string {
  if (kind === 'shield') return '#22d3ee';
  if (kind === 'magnet') return '#f43f5e';
  if (kind === 'triple') return '#c084fc';
  if (kind === 'medkit') return '#34d399';
  return '#2dd4bf';
}

export const YetiArenaCanvas: React.FC<YetiArenaCanvasProps> = ({
  yeti,
  playerName,
  selectedGameMode,
  onChangeGameMode,
  selectedMapId,
  onChangeMapId,
  selectedColorway,
  onChangeColorway,
  wellImpact,
  onWellImpactUpdate,
  autoLaunchMode,
  onAutoLaunchHandled,
  onMintPrompt,
  onRecordRun,
  onShareRun,
  onReturnHome,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [launcherStep, setLauncherStep] = useState<LauncherStep>('choose_game');
  const [playMode, setPlayMode] = useState<PlayMode>('solo');
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tunnelConnected, setTunnelConnected] = useState(false);
  const [tunnelPlayersCount, setTunnelPlayersCount] = useState(1);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [lifeDepleted, setLifeDepleted] = useState(false);
  const [claimStatus, setClaimStatus] = useState<'idle' | 'claiming' | 'claimed'>('idle');
  const [webglFallback, setWebglFallback] = useState(false);
  const [tasks, setTasks] = useState<ArenaTaskProgress[]>(() => createTasksForMode(selectedGameMode));
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const [hud, setHud] = useState({
    score: 0,
    wellDrops: 0,
    carriedDrops: 0,
    frostGems: 0,
    hp: 100,
    maxHp: 100,
    timeLeft: 150,
    wave: 1,
    shieldSec: 0,
    boostSec: 0,
    magnetSec: 0,
    tripleSec: 0,
    shieldActive: false,
    boostActive: false,
    dashReady: true,
    beaconActive: false,
    nearWell: false,
    blessingLeft: 0,
    ritualReady: true,
    // Racing telemetry
    lap: 1,
    totalLaps: 3,
    checkpoint: 0,
    totalCheckpoints: 4,
    racePos: 1,
    speedKmh: 0,
    nitroPct: 100,
    countdown: 0,
    offRoad: false,
    // Shooter telemetry
    elims: 0,
    combo: 1,
    novaReady: true,
  });

  const [minimapData, setMinimapData] = useState<{
    dots: MiniMapDot[];
    ringRadius: number;
    playerAngle: number;
    nextCheckpoint: number;
    checkpointsCleared: number;
  }>({
    dots: [],
    ringRadius: ARENA_INITIAL_RING_RADIUS,
    playerAngle: 0,
    nextCheckpoint: 1,
    checkpointsCleared: 0,
  });

  // Refs synced for 3D render loop
  const keysRef = useRef<Record<string, boolean>>({});
  const pointerDownRef = useRef(false);
  const aimLogicalRef = useRef({ x: ARENA_CENTER_X, y: ARENA_CENTER_Y - 120 });
  const touchDirRef = useRef({ dx: 0, dy: 0 });
  const gameStateRef = useRef<GameState>('TITLE_MENU');
  const gameModeRef = useRef<GameModeId>(selectedGameMode);
  const playModeRef = useRef<PlayMode>('solo');
  const mapIdRef = useRef<MapId>(selectedMapId);
  const mapDirtyRef = useRef(true);
  const colorwayRef = useRef<YetiColorId>(selectedColorway);
  const yetiPropRef = useRef<YetiObject | null>(yeti);
  const wellImpactRef = useRef<WellImpactState>(wellImpact);
  const rigVersionDirtyRef = useRef(true);

  const wsRef = useRef<WebSocket | null>(null);
  const tunnelPlayerIdRef = useRef<string>('');
  const tunnelSnapshotRef = useRef<TunnelRoomSnapshot | null>(null);
  const tunnelStartTimeRef = useRef<number>(0);

  const simRef = useRef({
    timeLeft: 75,
    elapsed: 0,
    ringRadius: ARENA_INITIAL_RING_RADIUS,
    shake: 0,
    hitsLanded: 0,
    cratesSmashed: 0,
    wellBanks: 0,
    beaconTicks: 0,
    tasks: createTasksForMode('survival'),
    entities: [] as LocalYeti[],
    pickups: [] as Pickup[],
    crates: [] as CrateProp[],
    snowballs: [] as Snowball[],
    hazards: [] as IcicleHazard[],
    beacon: {
      active: false,
      x: ARENA_CENTER_X,
      y: ARENA_CENTER_Y,
      radius: 64,
      timeLeft: 0,
      nextIn: 7.5,
      tickAccum: 0,
    } as BeaconState,
    nextHazardIn: 4.2,
    blessingUntil: 0,
    ritualCooldownUntil: 0,
    lastTunnelBlessingUntil: 0,
    // Car Racing simulation state
    karts: [] as KartRacer[],
    raceCountdown: 0,
    racePadsHit: 0,
    // Shooting simulation state
    shooterWave: 1,
    shooterElims: 0,
    shooterBullseyes: 0,
    shooterCombo: 1,
    shooterMaxCombo: 1,
    shooterComboTimer: 0,
    shooterNovaCd: 0,
    meleeCd: 0,
    shooterEnemies: [] as ShooterEnemy[],
    pendingBursts: [] as { x: number; z: number; color: string; count: number }[],
    pendingRings: [] as { x: number; z: number; color: string; maxScale: number }[],
  });

  const flashBanner = useCallback((msg: string) => {
    setBannerMsg(msg);
    setTimeout(() => {
      setBannerMsg((prev) => (prev === msg ? null : prev));
    }, 2400);
  }, []);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (gameModeRef.current !== selectedGameMode) {
      gameModeRef.current = selectedGameMode;
      mapDirtyRef.current = true;
      rigVersionDirtyRef.current = true;
    }
  }, [selectedGameMode]);

  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  useEffect(() => {
    if (mapIdRef.current !== selectedMapId) {
      mapIdRef.current = selectedMapId;
      mapDirtyRef.current = true;
    }
  }, [selectedMapId]);

  useEffect(() => {
    if (colorwayRef.current !== selectedColorway) {
      colorwayRef.current = selectedColorway;
      rigVersionDirtyRef.current = true;
    }
  }, [selectedColorway]);

  useEffect(() => {
    yetiPropRef.current = yeti;
    rigVersionDirtyRef.current = true;
  }, [yeti]);

  useEffect(() => {
    wellImpactRef.current = wellImpact;
  }, [wellImpact]);

  const queueBurst = useCallback((lx: number, ly: number, color: string, count: number) => {
    simRef.current.pendingBursts.push({
      x: toWorldX(lx),
      z: toWorldZ(ly),
      color,
      count,
    });
  }, []);

  const queueRing = useCallback((lx: number, ly: number, color: string, maxScale = 2.6) => {
    simRef.current.pendingRings.push({
      x: toWorldX(lx),
      z: toWorldZ(ly),
      color,
      maxScale,
    });
  }, []);

  const spawnPickup = useCallback((idx: number, mapId: MapId): Pickup => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 105 + Math.random() * Math.max(150, simRef.current.ringRadius - 105);
    const roll = Math.random();
    const gemLimit = mapId === 'aurora_summit' ? 0.72 : 0.68;
    let kind: Pickup['kind'] = 'drop';
    if (roll < 0.42) kind = 'drop';
    else if (roll < gemLimit) kind = 'gem';
    else if (roll < 0.78) kind = 'shield';
    else if (roll < 0.85) kind = 'boost';
    else if (roll < 0.91) kind = 'magnet';
    else if (roll < 0.96) kind = 'triple';
    else kind = 'medkit';

    const pos = nudgeOutsideObstacles(
      ARENA_CENTER_X + Math.cos(angle) * dist,
      ARENA_CENTER_Y + Math.sin(angle) * dist,
      18,
      mapId
    );
    return {
      id: `pk_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      kind,
      x: pos.x,
      y: pos.y,
      bobOffset: Math.random() * Math.PI * 2,
    };
  }, []);

  const spawnCrate = useCallback((idx: number, mapIdOverride?: MapId): CrateProp => {
    const activeMapId = mapIdOverride || mapIdRef.current;
    const angle = Math.random() * Math.PI * 2;
    const maxDist = Math.max(190, Math.min(460, simRef.current.ringRadius - 90));
    const dist = 145 + Math.random() * (maxDist - 145);
    const pos = nudgeOutsideObstacles(
      ARENA_CENTER_X + Math.cos(angle) * dist,
      ARENA_CENTER_Y + Math.sin(angle) * dist,
      28,
      activeMapId
    );
    const roll = Math.random();
    const kind: DestructiblePropKind =
      roll < 0.42 ? 'ice_pillar' : roll < 0.8 ? 'frozen_barrel' : 'ice_crate';
    const maxHp = kind === 'ice_pillar' ? 3 : 2;
    const radius = kind === 'ice_pillar' ? 23 : 21;
    return {
      id: `cr_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
      x: pos.x,
      y: pos.y,
      hp: maxHp,
      maxHp,
      kind,
      radius,
      hitFlashUntil: 0,
    };
  }, []);

  const spawnShooterWave = useCallback((waveNum: number, mapId: MapId) => {
    const s = simRef.current;
    const droneCount = 4 + Math.min(6, waveNum);
    const bullseyeCount = mapId === 'aurora_summit' ? 5 : 4;
    const enemies: ShooterEnemy[] = [];
    const rivalColors: YetiColorId[] = ['glacier_mint', 'sunset_ember', 'aurora_violet'];

    for (let i = 0; i < droneCount; i++) {
      const a = (i / droneCount) * Math.PI * 2 + Math.random() * 0.4;
      const d = 290 + Math.random() * 320;
      const pos = nudgeOutsideObstacles(
        ARENA_CENTER_X + Math.cos(a) * d,
        ARENA_CENTER_Y + Math.sin(a) * d,
        24,
        mapId
      );
      enemies.push({
        id: `dr_${waveNum}_${i}_${Math.random().toString(36).slice(2, 5)}`,
        kind: 'drone',
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        hp: waveNum >= 3 ? 2 : 1,
        maxHp: waveNum >= 3 ? 2 : 1,
        fireCd: 1.5 + Math.random() * 1.6,
        orbitAngle: a,
        colorway: 'midnight_cyan',
      });
    }

    for (let i = 0; i < bullseyeCount; i++) {
      const a = (i / bullseyeCount) * Math.PI * 2 + 0.5;
      const d = 240 + Math.random() * 340;
      const pos = nudgeOutsideObstacles(
        ARENA_CENTER_X + Math.cos(a) * d,
        ARENA_CENTER_Y + Math.sin(a) * d,
        24,
        mapId
      );
      enemies.push({
        id: `bull_${waveNum}_${i}_${Math.random().toString(36).slice(2, 5)}`,
        kind: 'bullseye',
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        hp: 1,
        maxHp: 1,
        fireCd: 99,
        orbitAngle: a,
        colorway: 'golden_frost',
      });
    }

    // Add 1-3 Rival Yeti Sharpshooters per wave
    const rivalTotal = waveNum >= 2 ? Math.min(3, 1 + Math.floor(waveNum / 2)) : 1;
    for (let r = 0; r < rivalTotal; r++) {
      const a = Math.PI * 0.25 + (r / rivalTotal) * Math.PI * 2;
      const pos = nudgeOutsideObstacles(
        ARENA_CENTER_X + Math.cos(a) * 440,
        ARENA_CENTER_Y + Math.sin(a) * 340,
        24,
        mapId
      );
      enemies.push({
        id: `rv_${waveNum}_${r}_${Math.random().toString(36).slice(2, 5)}`,
        kind: 'yeti_rival',
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        hp: 3 + Math.floor(waveNum / 2),
        maxHp: 3 + Math.floor(waveNum / 2),
        fireCd: 1.4 + r * 0.6,
        orbitAngle: a,
        colorway: rivalColors[(waveNum + r) % rivalColors.length],
      });
    }

    if (waveNum % 3 === 0) {
      const bossAngle = Math.PI * 0.75;
      const bossPos = nudgeOutsideObstacles(
        ARENA_CENTER_X + Math.cos(bossAngle) * 430,
        ARENA_CENTER_Y + Math.sin(bossAngle) * 350,
        34,
        mapId
      );
      const bossHp = 18 + waveNum * 3;
      enemies.push({
        id: `boss_${waveNum}_${Math.random().toString(36).slice(2, 6)}`,
        kind: 'boss_yeti',
        x: bossPos.x,
        y: bossPos.y,
        vx: 0,
        vy: 0,
        hp: bossHp,
        maxHp: bossHp,
        fireCd: 1.2,
        orbitAngle: bossAngle,
        colorway: 'golden_frost',
      });
    }

    s.shooterEnemies = enemies;
  }, []);

  const updateTaskProgress = useCallback(
    (taskId: string, newVal: number, player?: LocalYeti) => {
      const s = simRef.current;
      const t = s.tasks.find((item) => item.id === taskId);
      if (!t || t.completed) return;
      t.progress = Math.min(t.target, newVal);
      if (t.progress >= t.target) {
        t.completed = true;
        if (player) {
          player.frostGems += t.rewardGems;
          player.score += 80;
          queueBurst(player.x, player.y, '#34d399', 14);
          queueRing(player.x, player.y, '#34d399', 3.2);
        }
        soundEngine.playPickup('power');
        flashBanner(`Task Complete: ${t.title} (+${t.rewardGems} Gems)`);
      }
      setTasks(s.tasks.map((x) => ({ ...x })));
    },
    [flashBanner, queueBurst, queueRing]
  );

  const initSoloMatch = useCallback(
    (overrideGameMode?: GameModeId) => {
      const s = simRef.current;
      const gm = overrideGameMode || gameModeRef.current;
      const mapId = mapIdRef.current;
      const currentYeti = yetiPropRef.current;

      s.elapsed = 0;
      s.shake = 0;
      s.hitsLanded = 0;
      s.cratesSmashed = 0;
      s.wellBanks = 0;
      s.beaconTicks = 0;
      s.snowballs = [];
      s.hazards = [];
      s.pendingBursts = [];
      s.pendingRings = [];
      s.blessingUntil = 0;
      s.ritualCooldownUntil = 0;
      s.tasks = createTasksForMode(gm);
      setTasks(s.tasks.map((x) => ({ ...x })));

      const playerYeti: LocalYeti = {
        id: 'player',
        name: currentYeti?.name || playerName || 'Lofi Cub',
        x: ARENA_CENTER_X,
        y: ARENA_CENTER_Y + 185,
        vx: 0,
        vy: 0,
        hp: 100,
        maxHp: 100,
        score: 0,
        wellDrops: 0,
        carriedDrops: 0,
        frostGems: 0,
        knockouts: 0,
        isBot: false,
        hat: currentYeti?.equipped.hat || 'hat_goggles',
        scarf: currentYeti?.equipped.scarf || 'scarf_lofi',
        trail: currentYeti?.equipped.trail || 'trail_powder',
        colorway: colorwayRef.current,
        dashCd: 0,
        dashTime: 0,
        throwCd: 0,
        throwPulse: 0,
        shieldUntil: 0,
        boostUntil: 0,
        magnetUntil: 0,
        tripleUntil: 0,
        hurtUntil: 0,
        facingX: 0,
        facingY: -1,
        eliminated: false,
        emote: 'none',
        emoteUntil: 0,
      };

      if (gm === 'car_racing') {
        s.timeLeft = 180;
        s.ringRadius = ARENA_INITIAL_RING_RADIUS;
        s.raceCountdown = 1.8;
        s.racePadsHit = 0;
        const wps = getRaceTrackWaypoints(mapId);
        const start = wps[0];
        const next = wps[1];
        const trackAngle = Math.atan2(next.y - start.y, next.x - start.x);
        const perpX = -Math.sin(trackAngle);
        const perpY = Math.cos(trackAngle);

        const racerSpecs: {
          id: string;
          name: string;
          isBot: boolean;
          colorway: YetiColorId;
          hat: string;
          scarf: string;
          bias: number;
          lane: number;
          rowBack: number;
        }[] = [
          {
            id: 'player',
            name: currentYeti?.name || playerName || 'Lofi Cub',
            isBot: false,
            colorway: colorwayRef.current,
            hat: currentYeti?.equipped.hat || 'hat_goggles',
            scarf: currentYeti?.equipped.scarf || 'scarf_lofi',
            bias: 1.0,
            lane: -26,
            rowBack: 22,
          },
          {
            id: 'kart_mira',
            name: 'Mira Kart',
            isBot: true,
            colorway: colorwayRef.current === 'glacier_mint' ? 'midnight_cyan' : 'glacier_mint',
            hat: 'hat_beanie',
            scarf: 'scarf_aurora',
            bias: 0.96,
            lane: 26,
            rowBack: 22,
          },
          {
            id: 'kart_taro',
            name: 'Taro Kart',
            isBot: true,
            colorway: colorwayRef.current === 'sunset_ember' ? 'golden_frost' : 'sunset_ember',
            hat: 'hat_crown',
            scarf: 'scarf_crimson',
            bias: 0.91,
            lane: -26,
            rowBack: 64,
          },
          {
            id: 'kart_pip',
            name: 'Pip Kart',
            isBot: true,
            colorway: colorwayRef.current === 'aurora_violet' ? 'classic_lofi' : 'aurora_violet',
            hat: 'hat_goggles',
            scarf: 'scarf_lofi',
            bias: 0.87,
            lane: 26,
            rowBack: 64,
          },
        ];

        s.karts = racerSpecs.map((rs) => ({
          id: rs.id,
          name: rs.name,
          isBot: rs.isBot,
          x: start.x - Math.cos(trackAngle) * rs.rowBack + perpX * rs.lane,
          y: start.y - Math.sin(trackAngle) * rs.rowBack + perpY * rs.lane,
          vx: 0,
          vy: 0,
          angle: trackAngle,
          speed: 0,
          steerInput: 0,
          nitro: 100,
          boostUntil: 0,
          shieldUntil: 0,
          tripleUntil: 0,
          magnetUntil: 0,
          lap: 1,
          nextWp: 1,
          nextCheckpoint: 1,
          checkpointsCleared: 0,
          totalProgress: 0,
          colorway: rs.colorway,
          hat: rs.hat,
          scarf: rs.scarf,
          finished: false,
          finishTime: 0,
          dropsCollected: 0,
          gemsCollected: 0,
          score: 0,
          aiSpeedBias: rs.bias,
          aiLaneOffset: rs.lane * 0.45,
        }));
        s.entities = [playerYeti];

        // Spawn glowing Beach-Buggy Power-Up Orbs along the 14-waypoint long track
        const racePowerKinds: Pickup['kind'][] = ['boost', 'triple', 'shield', 'magnet', 'gem', 'boost', 'triple', 'drop', 'shield'];
        const trackOrbs: Pickup[] = [];
        wps.forEach((wp, idx) => {
          if (idx === 0) return;
          if (idx % 2 === 1 || wp.isCheckpoint) {
            const pKind = racePowerKinds[idx % racePowerKinds.length];
            trackOrbs.push({
              id: `rk_${idx}_${Math.random().toString(36).slice(2, 5)}`,
              kind: pKind,
              x: wp.x + (idx % 2 === 0 ? 22 : -22),
              y: wp.y + (idx % 3 === 0 ? 18 : -18),
              bobOffset: idx * 0.7,
              respawnAt: 0,
            });
          }
        });
        s.pickups = trackOrbs;
        s.crates = [];
      } else if (gm === 'shooting') {
        s.timeLeft = 135;
        s.ringRadius = ARENA_INITIAL_RING_RADIUS;
        s.shooterWave = 1;
        s.shooterElims = 0;
        s.shooterBullseyes = 0;
        s.shooterCombo = 1;
        s.shooterMaxCombo = 1;
        s.shooterComboTimer = 0;
        s.shooterNovaCd = 0;
        s.karts = [];
        s.entities = [playerYeti];
        s.pickups = Array.from({ length: 16 }, (_, i) => spawnPickup(i, mapId));
        s.crates = Array.from({ length: 8 }, (_, i) => spawnCrate(i, mapId));
        spawnShooterWave(1, mapId);
      } else {
        // Survival Flurry (Expanded 2400x1600 Map · 150s)
        s.timeLeft = 150;
        s.ringRadius = ARENA_INITIAL_RING_RADIUS;
        s.nextHazardIn = 4.2;
        s.karts = [];
        s.shooterEnemies = [];
        s.beacon = {
          active: false,
          x: ARENA_CENTER_X,
          y: ARENA_CENTER_Y,
          radius: 78,
          timeLeft: 0,
          nextIn: 9.0,
          tickAccum: 0,
        };

        const botSpecs: {
          id: string;
          name: string;
          hat: string;
          scarf: string;
          colorway: YetiColorId;
          angle: number;
        }[] = [
          { id: 'bot_mira', name: 'Mira', hat: 'hat_beanie', scarf: 'scarf_aurora', colorway: 'glacier_mint', angle: -0.6 },
          { id: 'bot_taro', name: 'Taro', hat: 'hat_crown', scarf: 'scarf_crimson', colorway: 'sunset_ember', angle: 2.2 },
          { id: 'bot_pip', name: 'Pip', hat: 'hat_goggles', scarf: 'scarf_lofi', colorway: 'aurora_violet', angle: 3.8 },
        ];

        const bots: LocalYeti[] = botSpecs.map((b) => ({
          id: b.id,
          name: b.name,
          x: ARENA_CENTER_X + Math.cos(b.angle) * 340,
          y: ARENA_CENTER_Y + Math.sin(b.angle) * 260,
          vx: 0,
          vy: 0,
          hp: 100,
          maxHp: 100,
          score: 0,
          wellDrops: 0,
          carriedDrops: 0,
          frostGems: 0,
          knockouts: 0,
          isBot: true,
          hat: b.hat,
          scarf: b.scarf,
          trail: 'trail_powder',
          colorway: b.colorway === colorwayRef.current ? 'midnight_cyan' : b.colorway,
          dashCd: 0,
          dashTime: 0,
          throwCd: 1.5 + Math.random(),
          throwPulse: 0,
          shieldUntil: 0,
          boostUntil: 0,
          magnetUntil: 0,
          tripleUntil: 0,
          hurtUntil: 0,
          facingX: 1,
          facingY: 0,
          eliminated: false,
          emote: 'none',
          emoteUntil: 0,
        }));

        s.entities = [playerYeti, ...bots];
        s.pickups = Array.from({ length: 28 }, (_, i) => spawnPickup(i, mapId));
        s.crates = Array.from({ length: 10 }, (_, i) => spawnCrate(i, mapId));
      }

      rigVersionDirtyRef.current = true;
    },
    [playerName, spawnCrate, spawnPickup, spawnShooterWave]
  );

  useEffect(() => {
    initSoloMatch();
  }, [initSoloMatch]);

  const disconnectTunnel = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setTunnelConnected(false);
    tunnelSnapshotRef.current = null;
  }, []);

  const connectTunnel = useCallback((mode: GameModeId = 'survival') => {
    disconnectTunnel();
    const pid = `p_${Math.random().toString(36).slice(2, 8)}`;
    tunnelPlayerIdRef.current = pid;
    tunnelStartTimeRef.current = Date.now();
    const mapId = mapIdRef.current;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({
      room: `${mode === 'car_racing' ? 'tunnel-race' : 'tunnel'}-${mapId}`,
      map: mapId,
      mode,
      playerId: pid,
      name: yeti?.name || playerName || 'Lofi Explorer',
      hat: yeti?.equipped.hat || 'hat_goggles',
      scarf: yeti?.equipped.scarf || 'scarf_lofi',
      colorway: colorwayRef.current,
    });

    const ws = new WebSocket(`${proto}//${window.location.host}/ws/tunnel?${params.toString()}`);
    wsRef.current = ws;

    ws.onopen = () => setTunnelConnected(true);

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === 'tunnel:state' && data.snapshot) {
          const snap: TunnelRoomSnapshot = data.snapshot;
          if (snap.mode === 'car_racing') gameModeRef.current = 'car_racing';
          tunnelSnapshotRef.current = snap;
          setTunnelPlayersCount(snap.players.filter((p) => !p.isBot).length);

          const now = Date.now();
          if (
            snap.blessingUntil &&
            snap.blessingUntil > now &&
            snap.blessingUntil > simRef.current.lastTunnelBlessingUntil
          ) {
            simRef.current.lastTunnelBlessingUntil = snap.blessingUntil;
            queueRing(ARENA_CENTER_X, ARENA_CENTER_Y, '#fde047', 4.8);
            queueRing(ARENA_CENTER_X, ARENA_CENTER_Y, '#22d3ee', 3.6);
            queueBurst(ARENA_CENTER_X, ARENA_CENTER_Y, '#fde047', 22);
            soundEngine.playWellRitual();
            flashBanner(
              `Well Ritual Blessed! +${snap.globalBonusDrops || 25} Global Well Drops Bonus & 2x Drops (15s)!`
            );
          }

          if (typeof snap.globalWellDrops === 'number') {
            const cur = wellImpactRef.current;
            const nextBless = snap.blessingUntil || 0;
            if (
              cur.totalDropsCollected !== snap.globalWellDrops ||
              (cur.blessingUntil || 0) !== nextBless
            ) {
              onWellImpactUpdate({
                ...cur,
                totalDropsCollected: snap.globalWellDrops,
                wellsFunded: Math.floor(snap.globalWellDrops / cur.dropsPerWellMilestone),
                activeBonusDrops: snap.globalBonusDrops || 0,
                blessingUntil: nextBless,
              });
            }
          }

          const me = snap.players.find((p) => p.id === tunnelPlayerIdRef.current);
          if (me) {
            if (snap.mode === 'car_racing') {
              const s = simRef.current;
                s.karts = snap.players.map((p) => ({
                id: p.id,
                name: p.name,
                isBot: p.isBot,
                x: p.x,
                y: p.y,
                vx: p.vx,
                vy: p.vy,
                angle: p.angle || 0,
                speed: p.speed || 0,
                steerInput: 0,
                nitro: p.nitro || 0,
                boostUntil: p.boostUntil || 0,
                shieldUntil: p.shieldUntil || 0,
                tripleUntil: p.tripleUntil || 0,
                magnetUntil: p.magnetUntil || 0,
                lap: p.lap || 1,
                nextWp: p.nextWp || 1,
                nextCheckpoint: p.nextCheckpoint || 1,
                checkpointsCleared: p.checkpointsCleared || 0,
                totalProgress: p.totalProgress || 0,
                score: p.score,
                colorway: p.colorway,
                hat: p.hat,
                scarf: p.scarf,
                finished: p.finished || false,
                finishTime: p.finishTime || 0,
                dropsCollected: p.dropsCollected || 0,
                gemsCollected: p.gemsCollected || 0,
                aiSpeedBias: 1,
                aiLaneOffset: 0,
              }));
              const playerKart = s.karts.find((k) => k.id === tunnelPlayerIdRef.current);
              if (playerKart) {
                const sorted = [...s.karts].sort((a, b) => b.totalProgress - a.totalProgress);
                setHud((prev) => ({
                  ...prev,
                  score: playerKart.score,
                  lap: Math.min(3, playerKart.lap),
                  checkpoint: playerKart.checkpointsCleared,
                  totalCheckpoints: 4,
                  racePos: sorted.findIndex((k) => k.id === playerKart.id) + 1,
                  speedKmh: Math.round(Math.abs(playerKart.speed) * 0.36),
                  nitroPct: Math.round(playerKart.nitro),
                  boostActive: Date.now() < playerKart.boostUntil,
                  countdown: 0,
                }));
                setMinimapData({
                  dots: [
                    ...snap.pickups.map((pk) => ({
                      x: pk.x,
                      y: pk.y,
                      kind: 'powerup' as const,
                      color: getPowerUpRadarColor(pk.kind),
                    })),
                    ...s.karts.map((k) => ({
                      x: k.x,
                      y: k.y,
                      kind: (k.id === tunnelPlayerIdRef.current ? 'player' : 'bot') as MiniMapDot['kind'],
                      color: getYetiColorway(k.colorway).accentHex,
                    })),
                  ],
                  ringRadius: snap.ringRadius,
                  playerAngle: playerKart.angle,
                  nextCheckpoint: playerKart.nextCheckpoint,
                  checkpointsCleared: playerKart.checkpointsCleared,
                });
              }
              if (me.finished && gameStateRef.current === 'PLAYING') {
                const sorted = [...snap.players].sort((a, b) => {
                  if (a.finished && b.finished) return (a.finishTime || 0) - (b.finishTime || 0);
                  if (a.finished) return -1;
                  if (b.finished) return 1;
                  return (b.totalProgress || 0) - (a.totalProgress || 0);
                });
                const rank = sorted.findIndex((p) => p.id === me.id) + 1;
                const runSum: RunSummary = {
                  score: me.score + (rank === 1 ? 420 : rank === 2 ? 260 : 60),
                  wellDrops: (me.dropsCollected || 0) + (rank === 1 ? 10 : rank === 2 ? 7 : 4),
                  frostGems: (me.gemsCollected || 0) + (rank === 1 ? 14 : rank === 2 ? 9 : 5),
                  knockouts: 0,
                  survivalSeconds: Math.max(1, Math.round(me.finishTime || 1)),
                  mode: 'tunnel',
                  gameMode: 'car_racing',
                  mapId: snap.mapId,
                  hitsLanded: 0,
                  cratesSmashed: Math.max(0, (me.lap || 1) - 1),
                  wellBanks: 1,
                  tasksDone: 0,
                  rank,
                  totalContenders: snap.players.length,
                  xpEarned: Math.round(me.score / 5) + 30,
                  extraStatLabel: 'Finish / Laps',
                  extraStatValue: `#${rank} · 3/3 Laps`,
                };
                setSummary(runSum);
                setLifeDepleted(false);
                setClaimStatus('idle');
                setGameState('GAME_OVER');
                soundEngine.playRoundEnd(rank <= 2);
              }
            }
            const distWell = Math.hypot(me.x - ARENA_CENTER_X, me.y - ARENA_CENTER_Y);
            const blessingLeft =
              snap.blessingUntil && snap.blessingUntil > now
                ? Math.ceil((snap.blessingUntil - now) / 1000)
                : 0;
            setHud((prev) => ({
              ...prev,
              score: me.score,
              wellDrops: me.wellDrops,
              carriedDrops: me.carriedDrops,
              frostGems: Math.floor(me.score / 25),
              hp: me.hp,
              maxHp: me.maxHp || 100,
              timeLeft: snap.timeLeft,
              wave: Math.max(1, Math.ceil((150 - snap.timeLeft) / 25)),
              shieldSec: me.shieldUntil > now ? Math.ceil((me.shieldUntil - now) / 1000) : 0,
              boostSec: me.boostUntil > now ? Math.ceil((me.boostUntil - now) / 1000) : 0,
              magnetSec: (me.magnetUntil || 0) > now ? Math.ceil(((me.magnetUntil || 0) - now) / 1000) : 0,
              tripleSec: (me.tripleUntil || 0) > now ? Math.ceil(((me.tripleUntil || 0) - now) / 1000) : 0,
              shieldActive: now < me.shieldUntil,
              boostActive: now < me.boostUntil,
              dashReady: true,
              beaconActive: snap.beacon.active,
              nearWell: distWell <= WELL_RITUAL_RADIUS,
              blessingLeft,
              ritualReady: blessingLeft <= 0,
            }));
            if (snap.mode !== 'car_racing') {
              const pHeading =
                Math.hypot(me.vx, me.vy) > 10 ? Math.atan2(me.vy, me.vx) : -Math.PI / 2;
              setMinimapData({
                dots: [
                  { x: ARENA_CENTER_X, y: ARENA_CENTER_Y, kind: 'well' },
                  ...(snap.beacon.active ? [{ x: snap.beacon.x, y: snap.beacon.y, kind: 'beacon' as const }] : []),
                  ...snap.crates.map((cr) => ({ x: cr.x, y: cr.y, kind: 'crate' as const })),
                  ...snap.pickups
                    .filter((pk) => pk.kind !== 'drop' && pk.kind !== 'gem')
                    .map((pk) => ({
                      x: pk.x,
                      y: pk.y,
                      kind: 'powerup' as const,
                      color: getPowerUpRadarColor(pk.kind),
                    })),
                  ...snap.players
                    .filter((p) => !p.eliminated)
                    .map((p) => ({
                      x: p.x,
                      y: p.y,
                      kind: (p.id === tunnelPlayerIdRef.current ? 'player' : 'bot') as MiniMapDot['kind'],
                      color: getYetiColorway(p.colorway).accentHex,
                    })),
                ],
                ringRadius: snap.ringRadius,
                playerAngle: pHeading,
                nextCheckpoint: 1,
                checkpointsCleared: 0,
              });
            }

            if (snap.mode !== 'car_racing' && me.eliminated && gameStateRef.current === 'PLAYING') {
              const survived = Math.max(5, Math.round((Date.now() - tunnelStartTimeRef.current) / 1000));
              const sorted = [...snap.players].sort((a, b) => b.score - a.score);
              const rank = sorted.findIndex((p) => p.id === me.id) + 1;
              const runSum: RunSummary = {
                score: me.score,
                wellDrops: me.wellDrops,
                frostGems: Math.max(8, Math.floor(me.score / 20)),
                knockouts: 0,
                survivalSeconds: survived,
                mode: 'tunnel',
                gameMode: 'survival',
                mapId: snap.mapId,
                hitsLanded: Math.floor(me.score / 60),
                cratesSmashed: 1,
                wellBanks: Math.floor(me.wellDrops / 3),
                tasksDone: me.wellDrops >= 3 ? 1 : 0,
                rank: rank || 1,
                totalContenders: snap.players.length,
                xpEarned: Math.round(me.score / 5) + 25,
              };
              setSummary(runSum);
              setLifeDepleted(true);
              setClaimStatus('idle');
              setGameState('GAME_OVER');
              soundEngine.playRoundEnd(rank === 1);
            }
          }
        }
      } catch {
        // Ignore malformed packets
      }
    };

    ws.onclose = () => setTunnelConnected(false);
  }, [disconnectTunnel, flashBanner, onWellImpactUpdate, playerName, queueBurst, queueRing, yeti]);

  useEffect(() => {
    return () => disconnectTunnel();
  }, [disconnectTunnel]);

  const finishSoloMatch = useCallback((player: LocalYeti) => {
    const s = simRef.current;
    const gm = gameModeRef.current;
    const tasksDone = s.tasks.filter((t) => t.completed).length;

    if (gm === 'car_racing') {
      const sortedKarts = [...s.karts].sort((a, b) => {
        if (a.finished && b.finished) return a.finishTime - b.finishTime;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.totalProgress - a.totalProgress;
      });
      const playerKart = s.karts.find((k) => k.id === 'player')!;
      const rank = Math.max(1, sortedKarts.findIndex((k) => k.id === 'player') + 1);
      const podiumPts = rank === 1 ? 420 : rank === 2 ? 260 : rank === 3 ? 140 : 60;
      const podiumDrops = rank === 1 ? 10 : rank === 2 ? 7 : 4;
      const podiumGems = rank === 1 ? 14 : rank === 2 ? 9 : 5;
      const finalScore = playerKart.score + podiumPts;
      const finalDrops = playerKart.dropsCollected + podiumDrops;
      const finalGems = playerKart.gemsCollected + podiumGems;

      const runSum: RunSummary = {
        score: finalScore,
        wellDrops: finalDrops,
        frostGems: finalGems,
        knockouts: 0,
        survivalSeconds: Math.max(1, Math.round(s.elapsed)),
        mode: 'solo',
        gameMode: 'car_racing',
        mapId: mapIdRef.current,
        hitsLanded: s.racePadsHit,
        cratesSmashed: playerKart.lap - 1,
        wellBanks: 1,
        tasksDone,
        rank,
        totalContenders: s.karts.length,
        xpEarned: Math.round(finalScore / 5) + 30 + tasksDone * 20,
        extraStatLabel: 'Finish / Laps',
        extraStatValue: `#${rank} · ${Math.min(3, playerKart.lap)}/3 Laps`,
      };
      setSummary(runSum);
      setLifeDepleted(false);
      setClaimStatus('idle');
      setGameState('GAME_OVER');
      soundEngine.playRoundEnd(rank <= 2);
      return;
    }

    if (gm === 'shooting') {
      const finalScore = player.score + s.shooterMaxCombo * 25;
      const defeated = player.eliminated || player.hp <= 0;
      const runSum: RunSummary = {
        score: finalScore,
        wellDrops: player.wellDrops,
        frostGems: Math.max(4, player.frostGems),
        knockouts: s.shooterElims,
        survivalSeconds: Math.max(1, Math.round(s.elapsed)),
        mode: 'solo',
        gameMode: 'shooting',
        mapId: mapIdRef.current,
        hitsLanded: s.hitsLanded,
        cratesSmashed: s.shooterBullseyes,
        wellBanks: s.shooterWave,
        tasksDone,
        rank: defeated ? 2 : 1,
        totalContenders: 1,
        xpEarned: Math.round(finalScore / 5) + 30 + tasksDone * 20,
        extraStatLabel: 'Elims / Streak',
        extraStatValue: `${s.shooterElims} · ${s.shooterMaxCombo}×`,
      };
      if (defeated) {
        setHud((prev) => ({ ...prev, hp: 0 }));
      }
      setSummary(runSum);
      setLifeDepleted(defeated);
      setClaimStatus('idle');
      setGameState('GAME_OVER');
      soundEngine.playRoundEnd(!defeated);
      return;
    }

    // Survival
    const sorted = [...s.entities].sort((a, b) => b.score - a.score);
    const rank = sorted.findIndex((e) => e.id === 'player') + 1;
    const defeated = player.eliminated || player.hp <= 0;
    const runSum: RunSummary = {
      score: player.score,
      wellDrops: player.wellDrops,
      frostGems: player.frostGems,
      knockouts: player.knockouts,
      survivalSeconds: Math.max(1, Math.round(s.elapsed)),
      mode: 'solo',
      gameMode: 'survival',
      mapId: mapIdRef.current,
      hitsLanded: s.hitsLanded,
      cratesSmashed: s.cratesSmashed,
      wellBanks: s.wellBanks,
      tasksDone,
      rank: rank || 1,
      totalContenders: s.entities.length,
      xpEarned: Math.round(player.score / 5) + 25 + tasksDone * 20,
    };
    if (defeated) {
      setHud((prev) => ({ ...prev, hp: 0 }));
    }
    setSummary(runSum);
    setLifeDepleted(defeated);
    setClaimStatus('idle');
    setGameState('GAME_OVER');
    soundEngine.playRoundEnd(rank === 1 && !defeated);
  }, []);

  const triggerDashOrSpecial = useCallback(() => {
    if (gameStateRef.current !== 'PLAYING') return;
    const s = simRef.current;

    if (gameModeRef.current === 'car_racing') {
      const pk = s.karts.find((k) => k.id === 'player');
      if (!pk || s.raceCountdown > 0) return;
      const now = Date.now();
      if (pk.nitro >= 22 && now >= pk.boostUntil) {
        pk.nitro = Math.max(0, pk.nitro - 35);
        pk.boostUntil = now + 1500;
        soundEngine.playBoost();
        queueBurst(pk.x, pk.y, '#22d3ee', 14);
        queueRing(pk.x, pk.y, '#22d3ee', 3.0);
      }
      return;
    }

    if (gameModeRef.current === 'shooting') {
      const player = s.entities.find((e) => e.id === 'player');
      if (!player || player.eliminated || s.shooterNovaCd > 0) return;
      s.shooterNovaCd = 2.4;
      soundEngine.playBoost();
      queueBurst(player.x, player.y, '#38bdf8', 18);
      queueRing(player.x, player.y, '#22d3ee', 5.4);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        s.snowballs.push({
          id: `nova_${Date.now()}_${i}`,
          ownerId: 'player',
          x: player.x + Math.cos(a) * 20,
          y: player.y + Math.sin(a) * 20,
          vx: Math.cos(a) * 520,
          vy: Math.sin(a) * 520,
          ttl: 0.72,
          isBlaster: true,
        });
      }
      return;
    }

    if (playModeRef.current === 'tunnel') {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'dash' }));
        soundEngine.playDash();
      }
      return;
    }

    const player = s.entities.find((e) => e.id === 'player');
    if (!player || player.eliminated || player.dashCd > 0) return;

    const dirX = Math.abs(player.vx) > 8 || Math.abs(player.vy) > 8 ? player.vx : player.facingX;
    const dirY = Math.abs(player.vx) > 8 || Math.abs(player.vy) > 8 ? player.vy : player.facingY;
    const mag = Math.hypot(dirX, dirY) || 1;
    player.vx = (dirX / mag) * 510;
    player.vy = (dirY / mag) * 510;
    player.dashCd = 1.45;
    player.dashTime = 0.26;
    player.emote = 'none';
    player.emoteUntil = 0;
    soundEngine.playDash();
    const trailCol = getCosmeticColor(player.trail, getYetiColorway(player.colorway).accentHex);
    queueBurst(player.x, player.y, trailCol, 12);
    queueRing(player.x, player.y, trailCol, 2.8);
  }, [queueBurst, queueRing]);

  const damageDestructibleProp = useCallback(
    (
      index: number,
      damage: number,
      attacker?: LocalYeti | null,
      impactLabel?: string
    ): boolean => {
      const s = simRef.current;
      const cr = s.crates[index];
      if (!cr) return false;
      const nowMs = Date.now();
      const mapId = mapIdRef.current;
      const propKind: DestructiblePropKind = cr.kind || 'ice_crate';

      cr.hp -= damage;
      cr.hitFlashUntil = nowMs + 220;

      const primaryCol =
        mapId === 'volcanic_springs'
          ? propKind === 'ice_pillar'
            ? '#fb923c'
            : propKind === 'frozen_barrel'
            ? '#f97316'
            : '#fbbf24'
          : mapId === 'aurora_summit'
          ? propKind === 'ice_pillar'
            ? '#2dd4bf'
            : propKind === 'frozen_barrel'
            ? '#c084fc'
            : '#67e8f9'
          : propKind === 'ice_pillar'
          ? '#7dd3fc'
          : propKind === 'frozen_barrel'
          ? '#38bdf8'
          : '#fde047';

      const secondaryCol =
        propKind === 'ice_pillar'
          ? '#e0f2fe'
          : propKind === 'frozen_barrel'
          ? '#fde047'
          : '#ffffff';

      if (cr.hp > 0) {
        queueBurst(cr.x, cr.y, primaryCol, 8);
        queueBurst(cr.x, cr.y, secondaryCol, 4);
        queueRing(cr.x, cr.y, primaryCol, 1.5);
        if (attacker && !attacker.isBot) {
          soundEngine.playPunch(false);
          s.shake = Math.max(s.shake, 0.14);
        }
        return false;
      }

      queueBurst(cr.x, cr.y, primaryCol, propKind === 'ice_pillar' ? 18 : 15);
      queueBurst(cr.x, cr.y, secondaryCol, 10);
      queueRing(cr.x, cr.y, primaryCol, propKind === 'ice_pillar' ? 3.2 : 2.6);
      queueRing(cr.x, cr.y, secondaryCol, 1.9);

      const powerPool: Pickup['kind'][] =
        propKind === 'ice_pillar'
          ? ['shield', 'triple', 'magnet', 'boost', 'medkit', 'gem']
          : propKind === 'frozen_barrel'
          ? ['boost', 'shield', 'triple', 'medkit', 'magnet', 'gem']
          : ['gem', 'shield', 'boost', 'magnet', 'triple', 'medkit'];
      const droppedKind = powerPool[Math.floor(Math.random() * powerPool.length)];
      s.pickups.push({
        id: `prop_pk_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
        kind: droppedKind,
        x: cr.x,
        y: cr.y,
        bobOffset: Math.random() * Math.PI * 2,
      });

      if (propKind === 'frozen_barrel') {
        const splashAngle = Math.random() * Math.PI * 2;
        s.pickups.push({
          id: `prop_drop_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
          kind: 'drop',
          x: cr.x + Math.cos(splashAngle) * 26,
          y: cr.y + Math.sin(splashAngle) * 26,
          bobOffset: Math.random() * Math.PI * 2,
        });
      }

      s.crates.splice(index, 1);

      if (attacker) {
        const pts = propKind === 'ice_pillar' ? 75 : propKind === 'frozen_barrel' ? 65 : 55;
        attacker.score += pts;
        if (!attacker.isBot) {
          s.cratesSmashed += 1;
          s.shake = Math.max(s.shake, 0.34);
          soundEngine.playSlam();
          soundEngine.playPickup('gem');
          if (gameModeRef.current === 'survival') {
            updateTaskProgress('task_crates', s.cratesSmashed + s.beaconTicks, attacker);
          }
          const propName =
            propKind === 'ice_pillar'
              ? mapId === 'volcanic_springs'
                ? 'Magma Pillar'
                : mapId === 'aurora_summit'
                ? 'Prism Pillar'
                : 'Ice Pillar'
              : propKind === 'frozen_barrel'
              ? mapId === 'volcanic_springs'
                ? 'Ember Barrel'
                : 'Frozen Barrel'
              : 'Supply Crate';
          const dropLabel =
            droppedKind === 'shield'
              ? 'Cryo Shield'
              : droppedKind === 'boost'
              ? 'Turbo Surge'
              : droppedKind === 'magnet'
              ? 'Drop Magnet'
              : droppedKind === 'triple'
              ? 'Tri-Shot'
              : droppedKind === 'medkit'
              ? 'Medkit (+30 HP)'
              : 'Frost Gem';
          flashBanner(
            `${impactLabel ? `${impactLabel}: ` : ''}${propName} Shattered! Dropped ${dropLabel}`
          );
        }
      }
      return true;
    },
    [flashBanner, queueBurst, queueRing, updateTaskProgress]
  );

  const triggerMelee = useCallback(() => {
    if (gameStateRef.current !== 'PLAYING' || gameModeRef.current === 'car_racing') return;
    if (playModeRef.current === 'tunnel') {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'melee' }));
        soundEngine.playHit();
      }
      return;
    }

    const s = simRef.current;
    if (s.meleeCd > 0) return;
    const player = s.entities.find((e) => e.id === 'player');
    if (!player || player.eliminated) return;
    s.meleeCd = 0.55;
    player.throwPulse = 0.28;
    player.facingX = player.facingX || 0;
    player.facingY = player.facingY || -1;
    const hitX = player.x + player.facingX * 78;
    const hitY = player.y + player.facingY * 78;
    let hitCount = 0;

    if (gameModeRef.current === 'shooting') {
      for (const enemy of s.shooterEnemies) {
        if (Math.hypot(enemy.x - hitX, enemy.y - hitY) < (enemy.kind === 'boss_yeti' ? 62 : 48)) {
          enemy.hp -= enemy.kind === 'boss_yeti' ? 2 : 3;
          hitCount += 1;
          if (enemy.hp <= 0) {
            s.shooterElims += 1;
            player.score += enemy.kind === 'boss_yeti' ? 500 : 100;
          }
        }
      }
      s.shooterEnemies = s.shooterEnemies.filter((enemy) => enemy.hp > 0);
    } else {
      for (const enemy of s.entities) {
        if (enemy.id !== 'player' && !enemy.eliminated && Math.hypot(enemy.x - hitX, enemy.y - hitY) < 52) {
          enemy.hp = Math.max(0, enemy.hp - 35);
          enemy.hurtUntil = Date.now() + 450;
          enemy.eliminated = enemy.hp === 0;
          player.score += enemy.eliminated ? 90 : 25;
          hitCount += 1;
        }
      }
    }

    let brokeProp = false;
    for (let c = s.crates.length - 1; c >= 0; c--) {
      const cr = s.crates[c];
      const propRadius = cr.radius || 22;
      if (
        Math.hypot(cr.x - hitX, cr.y - hitY) < propRadius + 38 ||
        Math.hypot(cr.x - player.x, cr.y - player.y) < propRadius + 30
      ) {
        hitCount += 1;
        const destroyed = damageDestructibleProp(c, 2, player, 'Sword Smash');
        if (destroyed) brokeProp = true;
      }
    }

    queueBurst(hitX, hitY, '#facc15', hitCount ? 14 : 6);
    queueRing(hitX, hitY, '#facc15', 2.2);
    if (hitCount && !brokeProp) flashBanner(`Yeti Sword Strike! ${hitCount} hit${hitCount === 1 ? '' : 's'}`);
  }, [damageDestructibleProp, flashBanner, queueBurst, queueRing]);

  const triggerThrowOrFire = useCallback((aimLogicalX?: number, aimLogicalY?: number) => {
    if (gameStateRef.current !== 'PLAYING') return;
    if (gameModeRef.current === 'car_racing') return;

    if (playModeRef.current === 'tunnel') {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const me = tunnelSnapshotRef.current?.players.find(
          (p) => p.id === tunnelPlayerIdRef.current
        );
        const dx = aimLogicalX !== undefined && me ? aimLogicalX - me.x : undefined;
        const dy = aimLogicalY !== undefined && me ? aimLogicalY - me.y : undefined;
        wsRef.current.send(JSON.stringify({ type: 'throw', aimX: dx, aimY: dy }));
        soundEngine.playThrow();
      }
      return;
    }

    const player = simRef.current.entities.find((e) => e.id === 'player');
    if (!player || player.eliminated || player.throwCd > 0) return;

    const isShooter = gameModeRef.current === 'shooting';
    let dirX = player.facingX;
    let dirY = player.facingY;
    const tx = aimLogicalX ?? (isShooter ? aimLogicalRef.current.x : undefined);
    const ty = aimLogicalY ?? (isShooter ? aimLogicalRef.current.y : undefined);
    if (tx !== undefined && ty !== undefined) {
      const dx = tx - player.x;
      const dy = ty - player.y;
      const mag = Math.hypot(dx, dy);
      if (mag > 4) {
        dirX = dx / mag;
        dirY = dy / mag;
        player.facingX = dirX;
        player.facingY = dirY;
      }
    }

    const boostMult = Date.now() < player.boostUntil ? 0.55 : 1;
    player.throwCd = (isShooter ? 0.17 : 0.4) * boostMult;
    player.throwPulse = 0.2;
    player.emote = 'none';
    player.emoteUntil = 0;

    const boltSpeed = isShooter ? 680 : 480;
    const baseAngle = Math.atan2(dirY, dirX);
    const hasTriple = Date.now() < player.tripleUntil;
    const spreadAngles = hasTriple ? [-0.18, 0, 0.18] : [0];

    spreadAngles.forEach((off, idx) => {
      const ang = baseAngle + off;
      const sx = Math.cos(ang);
      const sy = Math.sin(ang);
      simRef.current.snowballs.push({
        id: `sb_${Date.now()}_${idx}_${Math.random()}`,
        ownerId: player.id,
        x: player.x + sx * 22,
        y: player.y + sy * 22,
        vx: sx * boltSpeed,
        vy: sy * boltSpeed,
        ttl: isShooter ? 1.25 : 1.45,
        isBlaster: isShooter,
      });
    });
    if (isShooter) soundEngine.playBlaster();
    else soundEngine.playThrow();
  }, []);

  const triggerWellRitualBlessing = useCallback(
    (kind: 'wave' | 'dance', participants: LocalYeti[]) => {
      const s = simRef.current;
      const nowMs = Date.now();
      s.blessingUntil = nowMs + 15000;
      s.ritualCooldownUntil = nowMs + 16000;

      for (const participant of participants) {
        participant.wellDrops += 2;
        participant.score += 65;
        participant.hp = Math.min(participant.maxHp, participant.hp + 25);
      }

      queueRing(ARENA_CENTER_X, ARENA_CENTER_Y, '#fde047', 4.8);
      queueRing(ARENA_CENTER_X, ARENA_CENTER_Y, '#22d3ee', 3.6);
      queueBurst(ARENA_CENTER_X, ARENA_CENTER_Y, '#fde047', 22);
      soundEngine.playWellRitual();

      const bonusDrops = kind === 'dance' ? 30 : 25;
      flashBanner(
        `Well Ritual Blessed! +${bonusDrops} Global Well Drops Bonus & 2x Drops (15s)!`
      );

      fetch('/api/well/ritual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.wellImpact) {
            onWellImpactUpdate(data.wellImpact);
          }
        })
        .catch(() => {});
    },
    [flashBanner, onWellImpactUpdate, queueBurst, queueRing]
  );

  const triggerEmote = useCallback(
    (kind: 'wave' | 'dance') => {
      if (gameStateRef.current !== 'PLAYING' || gameModeRef.current !== 'survival') return;

      if (playModeRef.current === 'tunnel') {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'emote', emote: kind }));
          soundEngine.playEmote(kind);
          flashBanner(kind === 'wave' ? 'You wave to nearby Yetis!' : 'Frost Groove Dance!');
        }
        return;
      }

      const player = simRef.current.entities.find((e) => e.id === 'player');
      if (!player || player.eliminated) return;

      const nowMs = Date.now();
      player.emote = kind;
      player.emoteUntil = nowMs + (kind === 'dance' ? 3200 : 2400);

      const accent = getYetiColorway(player.colorway).accentHex;
      queueBurst(player.x, player.y, accent, kind === 'dance' ? 12 : 8);
      queueRing(player.x, player.y, accent, kind === 'dance' ? 2.8 : 2.1);
      soundEngine.playEmote(kind);

      const playerNearWell =
        Math.hypot(player.x - ARENA_CENTER_X, player.y - ARENA_CENTER_Y) <= WELL_RITUAL_RADIUS;
      const responders: string[] = [];
      for (const other of simRef.current.entities) {
        if (!other.isBot || other.eliminated) continue;
        const nearPlayer = Math.hypot(other.x - player.x, other.y - player.y) < 260;
        const nearWellCall =
          playerNearWell &&
          Math.hypot(other.x - ARENA_CENTER_X, other.y - ARENA_CENTER_Y) < 320;
        if (nearPlayer || nearWellCall) {
          other.emote = kind;
          other.emoteUntil = nowMs + 2800;
          if (playerNearWell) {
            other.gatherAtWellUntil = nowMs + 2400;
          }
          responders.push(other.name);
          queueBurst(other.x, other.y, getYetiColorway(other.colorway).accentHex, 6);
        }
      }

      if (playerNearWell && responders.length > 0) {
        flashBanner(`Well Ritual started! ${responders.join(' & ')} gathering at the Well...`);
      } else if (responders.length > 0) {
        flashBanner(
          kind === 'wave'
            ? `You waved! ${responders.join(' & ')} waved back!`
            : `Frost Groove Dance! ${responders.join(' & ')} joined in!`
        );
      } else {
        flashBanner(kind === 'wave' ? 'You wave to nearby Yetis!' : 'Frost Groove Dance!');
      }
    },
    [flashBanner, queueBurst, queueRing]
  );

  const startGame = useCallback(
    (selectedMode: PlayMode, gmOverride?: GameModeId) => {
      const gm = gmOverride || gameModeRef.current;
      const effectiveMode: PlayMode =
        selectedMode === 'tunnel' && (gm === 'survival' || gm === 'car_racing') ? 'tunnel' : 'solo';
      setPlayMode(effectiveMode);
      playModeRef.current = effectiveMode;
      setSummary(null);
      setLifeDepleted(false);
      setClaimStatus('idle');
      if (effectiveMode === 'solo') {
        disconnectTunnel();
        initSoloMatch(gm);
      } else {
        connectTunnel(gm);
      }
      setGameState('PLAYING');
      gameStateRef.current = 'PLAYING';
      const viewport = viewportRef.current;
      if (viewport && document.fullscreenEnabled && !document.fullscreenElement) {
        void viewport.requestFullscreen().catch(() => {
          flashBanner('Fullscreen unavailable — continuing in windowed mode');
        });
      }
      if (gm === 'car_racing') {
        flashBanner('Beach Buggy Circuit! Clear Checkpoints 1–4 & Grab Orbs');
      } else if (gm === 'shooting') {
        flashBanner('Wave 1: Aim with Mouse, Grab Power-Ups & Shatter Drones!');
      } else {
        flashBanner('2:30 Match: Collect Power-Ups & Bank Drops at the Well!');
      }
    },
    [connectTunnel, disconnectTunnel, flashBanner, initSoloMatch]
  );

  const toggleFullscreen = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !document.fullscreenEnabled) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void viewport.requestFullscreen().catch(() => {
        flashBanner('Fullscreen unavailable in this browser window');
      });
    }
  }, [flashBanner]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const openGameMapLauncher = useCallback((step: LauncherStep = 'choose_game') => {
    disconnectTunnel();
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    setLauncherStep(step);
    setGameState('TITLE_MENU');
    gameStateRef.current = 'TITLE_MENU';
  }, [disconnectTunnel]);

  // Keyboard Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        if (gameStateRef.current === 'PLAYING') e.preventDefault();
      }
      keysRef.current[e.key.toLowerCase()] = true;

      if (e.key === ' ') {
        triggerDashOrSpecial();
      } else if (e.key.toLowerCase() === 'j' || e.key === 'Enter') {
        if (gameStateRef.current === 'PLAYING') triggerThrowOrFire();
      } else if (e.key.toLowerCase() === 'k') {
        if (!e.repeat) triggerMelee();
      } else if (e.key === '1' || e.key.toLowerCase() === 'e') {
        if (!e.repeat) triggerEmote('wave');
      } else if (e.key === '2' || e.key.toLowerCase() === 'f') {
        if (!e.repeat) triggerEmote('dance');
      } else if (e.key.toLowerCase() === 'p' || e.key === 'Escape') {
        if (gameStateRef.current === 'PLAYING' && playModeRef.current === 'solo') {
          setGameState('PAUSED');
        } else if (gameStateRef.current === 'PAUSED') {
          setGameState('PLAYING');
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [triggerDashOrSpecial, triggerEmote, triggerMelee, triggerThrowOrFire]);

  // Send Tunnel inputs at 20Hz
  useEffect(() => {
    if (playMode !== 'tunnel' || gameState !== 'PLAYING') return;
    const timer = setInterval(() => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      const k = keysRef.current;
      let dx = touchDirRef.current.dx;
      let dy = touchDirRef.current.dy;
      if (k['w'] || k['arrowup']) dy -= 1;
      if (k['s'] || k['arrowdown']) dy += 1;
      if (k['a'] || k['arrowleft']) dx -= 1;
      if (k['d'] || k['arrowright']) dx += 1;
      if (gameModeRef.current === 'car_racing') {
        wsRef.current.send(JSON.stringify({ type: 'input', steer: dx, throttle: -dy }));
      } else {
        wsRef.current.send(JSON.stringify({ type: 'input', dx, dy }));
      }
    }, 50);
    return () => clearInterval(timer);
  }, [playMode, gameState]);

  // ==================== THREE.JS 3D SCENE LIFECYCLE ====================
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFallback(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || 960, container.clientHeight || 540);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFallback(true);
    };
    const onContextRestored = () => {
      setWebglFallback(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071324');
    scene.fog = new THREE.FogExp2('#071324', 0.01);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      48,
      (container.clientWidth || 960) / (container.clientHeight || 540),
      0.2,
      200
    );
    camera.position.set(0, 16.5, 20.5);
    camera.lookAt(0, 0.8, 0);

    // Three-point studio lighting
    const hemiLight = new THREE.HemisphereLight('#bae6fd', '#0f2942', 0.82);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#fff7ed', 1.5);
    keyLight.position.set(18, 28, 20);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 90;
    keyLight.shadow.camera.left = -32;
    keyLight.shadow.camera.right = 32;
    keyLight.shadow.camera.top = 32;
    keyLight.shadow.camera.bottom = -32;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#38bdf8', 0.88);
    rimLight.position.set(-18, 12, -18);
    scene.add(rimLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    let envHandles: ArenaEnvironmentHandles | null = null;
    const envContainer = new THREE.Group();
    scene.add(envContainer);

    const rebuildMapEnvironment = (mId: MapId, gm: GameModeId) => {
      if (envHandles) {
        envHandles.group.traverse((obj) => {
          const anyObj = obj as THREE.Mesh | THREE.Points;
          if (anyObj.geometry) anyObj.geometry.dispose();
          const mat = (anyObj as THREE.Mesh).material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose());
          } else if (mat) {
            mat.dispose();
          }
        });
        envContainer.remove(envHandles.group);
      }
      envHandles = buildArcticEnvironment(maxAniso, isSoftwareGl, mId, gm);
      envContainer.add(envHandles.group);
      scene.background = new THREE.Color(envHandles.skyColorHex);
      scene.fog = new THREE.FogExp2(envHandles.skyColorHex, 0.0095);

      if (mId === 'volcanic_springs') {
        hemiLight.color.set('#fed7aa');
        hemiLight.groundColor.set('#291714');
        rimLight.color.set('#fb923c');
      } else if (mId === 'aurora_summit') {
        hemiLight.color.set('#99f6e4');
        hemiLight.groundColor.set('#1e1b4b');
        rimLight.color.set('#a855f7');
      } else {
        hemiLight.color.set('#bae6fd');
        hemiLight.groundColor.set('#0f2942');
        rimLight.color.set('#38bdf8');
      }
    };
    rebuildMapEnvironment(mapIdRef.current, gameModeRef.current);
    mapDirtyRef.current = false;

    // Scene Entity Groups
    const actorsGroup = new THREE.Group();
    const kartsGroup = new THREE.Group();
    const shooterGroup = new THREE.Group();
    const pickupsGroup = new THREE.Group();
    const cratesGroup = new THREE.Group();
    const snowballsGroup = new THREE.Group();
    const hazardsGroup = new THREE.Group();
    const burstsGroup = new THREE.Group();
    const ringsGroup = new THREE.Group();
    scene.add(
      actorsGroup,
      kartsGroup,
      shooterGroup,
      pickupsGroup,
      cratesGroup,
      snowballsGroup,
      hazardsGroup,
      burstsGroup,
      ringsGroup
    );

    const aimReticle = buildAimReticle();
    aimReticle.visible = false;
    scene.add(aimReticle);

    // Shrine Beacon 3D Mesh
    const beaconGroup = new THREE.Group();
    const beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(2.1, 2.5, 36),
      new THREE.MeshBasicMaterial({
        color: '#fbbf24',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.y = 0.04;
    const beaconBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 5.2, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#fde047',
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beaconBeam.position.y = 2.6;
    beaconGroup.add(beaconRing, beaconBeam);
    beaconGroup.visible = false;
    scene.add(beaconGroup);

    const yetiRigs = new Map<string, YetiRigParts>();
    const kartRigs = new Map<string, YetiKartRigParts>();
    const shooterMeshes = new Map<string, ShooterTargetMesh | YetiRigParts>();
    const pickupMeshes = new Map<string, THREE.Object3D>();
    const crateMeshes = new Map<string, THREE.Group>();
    const snowballMeshes = new Map<string, THREE.Mesh>();
    const hazardMeshes = new Map<string, { group: THREE.Group; spike: THREE.Mesh; ring: THREE.Mesh }>();
    const activeBursts: BurstParticle3D[] = [];
    const activeRings: ShockwaveRing3D[] = [];

    // Shared Pickup, Crate, Projectile Geometries
    const dropGeo = new THREE.OctahedronGeometry(0.34, 0);
    dropGeo.scale(0.85, 1.35, 0.85);
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 0.55,
      roughness: 0.12,
      clearcoat: 1.0,
    });

    const gemGeo = new THREE.OctahedronGeometry(0.38, 0);
    const gemMat = new THREE.MeshPhysicalMaterial({
      color: '#67e8f9',
      emissive: '#0ea5e9',
      emissiveIntensity: 0.7,
      roughness: 0.08,
      metalness: 0.15,
      clearcoat: 1.0,
    });

    const shieldPkGeo = new THREE.TorusKnotGeometry(0.26, 0.085, 36, 8);
    const shieldPkMat = new THREE.MeshStandardMaterial({
      color: '#22d3ee',
      emissive: '#0891b2',
      emissiveIntensity: 0.55,
      roughness: 0.2,
    });

    const boostPkGeo = new THREE.ConeGeometry(0.3, 0.66, 5);
    const boostPkMat = new THREE.MeshStandardMaterial({
      color: '#2dd4bf',
      emissive: '#0d9488',
      emissiveIntensity: 0.55,
      roughness: 0.2,
    });

    const magnetPkGeo = new THREE.TorusGeometry(0.3, 0.09, 12, 24);
    const magnetPkMat = new THREE.MeshStandardMaterial({
      color: '#f43f5e',
      emissive: '#e11d48',
      emissiveIntensity: 0.65,
      roughness: 0.2,
    });

    const triplePkGeo = new THREE.DodecahedronGeometry(0.34, 0);
    const triplePkMat = new THREE.MeshStandardMaterial({
      color: '#c084fc',
      emissive: '#9333ea',
      emissiveIntensity: 0.7,
      roughness: 0.18,
    });

    const medkitPkGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const medkitPkMat = new THREE.MeshStandardMaterial({
      color: '#34d399',
      emissive: '#059669',
      emissiveIntensity: 0.65,
      roughness: 0.2,
    });

    const crateBoxGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    const crateBandGeo = new THREE.BoxGeometry(1.08, 0.18, 1.08);
    const pillarCoreGeo = new THREE.CylinderGeometry(0.35, 0.54, 1.72, 6);
    const pillarCapGeo = new THREE.ConeGeometry(0.39, 0.54, 6);
    const pillarBaseGeo = new THREE.CylinderGeometry(0.62, 0.68, 0.2, 6);
    const barrelBodyGeo = new THREE.CylinderGeometry(0.45, 0.42, 1.08, 12);
    const barrelHoopGeo = new THREE.TorusGeometry(0.45, 0.055, 8, 18);
    barrelHoopGeo.rotateX(Math.PI / 2);
    const barrelCoreGeo = new THREE.CylinderGeometry(0.47, 0.47, 0.22, 12);

    const crateMat = new THREE.MeshPhysicalMaterial({
      color: '#bae6fd',
      emissive: '#0284c7',
      emissiveIntensity: 0.22,
      roughness: 0.2,
      clearcoat: 0.85,
    });
    const crateTrimMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      metalness: 0.55,
      roughness: 0.35,
    });
    const pillarMat = new THREE.MeshPhysicalMaterial({
      color: '#7dd3fc',
      emissive: '#0284c7',
      emissiveIntensity: 0.32,
      roughness: 0.1,
      metalness: 0.08,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.9,
    });
    const barrelMat = new THREE.MeshStandardMaterial({
      color: '#1e3a5f',
      emissive: '#0369a1',
      emissiveIntensity: 0.22,
      metalness: 0.45,
      roughness: 0.32,
    });
    const barrelGlowMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0ea5e9',
      emissiveIntensity: 0.72,
      roughness: 0.18,
    });

    const snowballGeo = new THREE.IcosahedronGeometry(0.26, 1);
    const snowballMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      emissive: '#38bdf8',
      emissiveIntensity: 0.28,
      roughness: 0.45,
    });
    const blasterBoltGeo = new THREE.SphereGeometry(0.22, 8, 8);
    const blasterBoltMat = new THREE.MeshBasicMaterial({ color: '#22d3ee' });
    const enemyOrbMat = new THREE.MeshBasicMaterial({ color: '#f43f5e' });

    const applyMapAssetPalette = (mId: MapId) => {
      const bRingMat = beaconRing.material as THREE.MeshBasicMaterial;
      const bBeamMat = beaconBeam.material as THREE.MeshBasicMaterial;
      if (mId === 'volcanic_springs') {
        crateMat.color.set('#44403c');
        crateMat.emissive.set('#ea580c');
        crateMat.emissiveIntensity = 0.28;
        crateTrimMat.color.set('#fb923c');
        pillarMat.color.set('#57534e');
        pillarMat.emissive.set('#ea580c');
        pillarMat.emissiveIntensity = 0.42;
        barrelMat.color.set('#292524');
        barrelMat.emissive.set('#9a3412');
        barrelGlowMat.color.set('#fb923c');
        barrelGlowMat.emissive.set('#f97316');
        snowballMat.color.set('#fff7ed');
        snowballMat.emissive.set('#fb923c');
        bRingMat.color.set('#fb923c');
        bBeamMat.color.set('#fdba74');
      } else if (mId === 'aurora_summit') {
        crateMat.color.set('#99f6e4');
        crateMat.emissive.set('#7c3aed');
        crateMat.emissiveIntensity = 0.3;
        crateTrimMat.color.set('#c084fc');
        pillarMat.color.set('#5eead4');
        pillarMat.emissive.set('#7c3aed');
        pillarMat.emissiveIntensity = 0.38;
        barrelMat.color.set('#312e81');
        barrelMat.emissive.set('#0d9488');
        barrelGlowMat.color.set('#c084fc');
        barrelGlowMat.emissive.set('#a855f7');
        snowballMat.color.set('#ecfeff');
        snowballMat.emissive.set('#2dd4bf');
        bRingMat.color.set('#2dd4bf');
        bBeamMat.color.set('#a855f7');
      } else {
        crateMat.color.set('#bae6fd');
        crateMat.emissive.set('#0284c7');
        crateMat.emissiveIntensity = 0.22;
        crateTrimMat.color.set('#f59e0b');
        pillarMat.color.set('#7dd3fc');
        pillarMat.emissive.set('#0284c7');
        pillarMat.emissiveIntensity = 0.32;
        barrelMat.color.set('#1e3a5f');
        barrelMat.emissive.set('#0369a1');
        barrelGlowMat.color.set('#38bdf8');
        barrelGlowMat.emissive.set('#0ea5e9');
        snowballMat.color.set('#f8fafc');
        snowballMat.emissive.set('#38bdf8');
        bRingMat.color.set('#fbbf24');
        bBeamMat.color.set('#fde047');
      }
    };
    applyMapAssetPalette(mapIdRef.current);

    const burstGeo = new THREE.SphereGeometry(0.11, 6, 6);
    const shockRingGeo = new THREE.RingGeometry(0.65, 0.88, 28);
    shockRingGeo.rotateX(-Math.PI / 2);
    const burstMatCache = new Map<string, THREE.MeshBasicMaterial>();
    let smoothLookX = 0;
    let smoothLookY = 0.9;
    let smoothLookZ = 0;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const updateAimFromPointer = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndc, camera);
      if (_raycaster.ray.intersectPlane(_groundPlane, _v3A)) {
        const aimLx = _v3A.x / WORLD_SCALE + ARENA_CENTER_X;
        const aimLy = _v3A.z / WORLD_SCALE + ARENA_CENTER_Y;
        aimLogicalRef.current.x = aimLx;
        aimLogicalRef.current.y = aimLy;
        return { aimLx, aimLy };
      }
      return null;
    };

    const onCanvasPointerMove = (e: PointerEvent) => {
      if (gameStateRef.current !== 'PLAYING') return;
      updateAimFromPointer(e.clientX, e.clientY);
    };

    const onCanvasPointerDown = (e: PointerEvent) => {
      if (gameStateRef.current !== 'PLAYING') return;
      pointerDownRef.current = true;
      const hit = updateAimFromPointer(e.clientX, e.clientY);
      if (hit) {
        triggerThrowOrFire(hit.aimLx, hit.aimLy);
      }
    };

    const onCanvasPointerUp = () => {
      pointerDownRef.current = false;
    };

    renderer.domElement.addEventListener('pointermove', onCanvasPointerMove);
    renderer.domElement.addEventListener('pointerdown', onCanvasPointerDown);
    window.addEventListener('pointerup', onCanvasPointerUp);

    const onResize = () => {
      if (!container) return;
      const cw = container.clientWidth || 960;
      const ch = container.clientHeight || 540;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    };
    window.addEventListener('resize', onResize);

    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();
    let hudSyncAccum = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(0.05, clock.getDelta());
      const elapsedTime = clock.elapsedTime;
      const now = Date.now();
      const s = simRef.current;
      const gm = gameModeRef.current;

      if (mapDirtyRef.current) {
        rebuildMapEnvironment(mapIdRef.current, gm);
        applyMapAssetPalette(mapIdRef.current);
        mapDirtyRef.current = false;
      }

      // ---- 1. Advance Solo Simulation by Selected Game Mode ----
      if (gameStateRef.current === 'PLAYING' && playModeRef.current === 'solo') {
        const mapSpec = getMapSpec(mapIdRef.current);
        s.meleeCd = Math.max(0, s.meleeCd - dt);
        s.shake = Math.max(0, s.shake - dt * 16);

        if (gm === 'car_racing') {
          // ===== BEACH BUGGY CIRCUIT RACING SIMULATION =====
          const wps = getRaceTrackWaypoints(mapIdRef.current);
          if (s.raceCountdown > 0) {
            s.raceCountdown = Math.max(0, s.raceCountdown - dt);
            if (s.raceCountdown === 0) {
              soundEngine.playLap(false);
              flashBanner('GO! Clear Checkpoints 1–4 & Hit Power-Up Orbs!');
            }
          } else {
            s.elapsed += dt;
            s.timeLeft = Math.max(0, s.timeLeft - dt);
          }

          const gripFactor =
            mapIdRef.current === 'volcanic_springs'
              ? 0.88
              : mapIdRef.current === 'aurora_summit'
              ? 0.92
              : 0.945;

          let playerOffRoad = false;

          for (const k of s.karts) {
            if (k.finished || s.raceCountdown > 0) continue;

            let throttle = 0;
            let steer = 0;

            if (!k.isBot) {
              const keys = keysRef.current;
              if (keys['w'] || keys['arrowup'] || touchDirRef.current.dy < -0.2) throttle += 1;
              if (keys['s'] || keys['arrowdown'] || touchDirRef.current.dy > 0.2) throttle -= 0.7;
              if (keys['a'] || keys['arrowleft'] || touchDirRef.current.dx < -0.2) steer -= 1;
              if (keys['d'] || keys['arrowright'] || touchDirRef.current.dx > 0.2) steer += 1;
              k.nitro = Math.min(100, k.nitro + dt * (Math.abs(steer) > 0.4 ? 15 : 8));
            } else {
              const wp = wps[k.nextWp];
              const targetX = wp.x + k.aiLaneOffset * Math.cos(k.nextWp);
              const targetY = wp.y + k.aiLaneOffset * Math.sin(k.nextWp);
              const desired = Math.atan2(targetY - k.y, targetX - k.x);
              let diff = desired - k.angle;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              steer = THREE.MathUtils.clamp(diff * 2.15, -1, 1);
              throttle = Math.abs(diff) > 0.9 ? 0.78 : 1.0;
              k.nitro = Math.min(100, k.nitro + dt * 6.5);
              if (k.nitro > 78 && Math.abs(diff) < 0.22 && now >= k.boostUntil) {
                k.nitro -= 38;
                k.boostUntil = now + 1200;
              }
            }

            k.steerInput = steer;
            const boosting = now < k.boostUntil;
            const distTrack = getDistanceToRaceTrack(k.x, k.y, mapIdRef.current);
            const offRoad = distTrack > 105;
            if (!k.isBot) playerOffRoad = offRoad;
            const offRoadMult = offRoad && !boosting ? 0.84 : 1.0;

            const maxSpd =
              (k.isBot ? 430 * k.aiSpeedBias : 455) *
              mapSpec.speedMult *
              (boosting ? 1.38 : 1.0) *
              offRoadMult;
            const accelRate = (boosting ? 840 : 540) * mapSpec.speedMult;

            if (throttle !== 0) {
              k.speed = THREE.MathUtils.clamp(k.speed + throttle * accelRate * dt, -150, maxSpd);
            } else {
              k.speed *= Math.exp(-1.85 * dt);
            }

            const turnAuthority = THREE.MathUtils.clamp(Math.abs(k.speed) / 95, 0.28, 1.0);
            const reverseSign = k.speed >= -5 ? 1 : -1;
            k.angle += steer * 2.6 * turnAuthority * reverseSign * dt;

            const hx = Math.cos(k.angle) * k.speed;
            const hy = Math.sin(k.angle) * k.speed;
            const gripRate = THREE.MathUtils.clamp((1 - gripFactor) * 84, 5, 22);
            const gripAlpha = 1 - Math.exp(-gripRate * dt);
            k.vx += (hx - k.vx) * gripAlpha;
            k.vy += (hy - k.vy) * gripAlpha;

            k.x = THREE.MathUtils.clamp(k.x + k.vx * dt, RACE_BOUNDS.minX, RACE_BOUNDS.maxX);
            k.y = THREE.MathUtils.clamp(k.y + k.vy * dt, RACE_BOUNDS.minY, RACE_BOUNDS.maxY);

            if (boosting && Math.random() < 0.65) {
              queueBurst(k.x, k.y, '#22d3ee', 1);
            }

            // Collect Beach-Buggy Track Power-Up Orbs (9s respawn)
            const orbRadius = now < k.magnetUntil ? 78 : 42;
            for (const pk of s.pickups) {
              if (pk.respawnAt && now < pk.respawnAt) continue;
              if (Math.hypot(pk.x - k.x, pk.y - k.y) < orbRadius) {
                pk.respawnAt = now + 9000;
                if (pk.kind === 'boost') {
                  k.nitro = Math.min(100, k.nitro + 30);
                  k.boostUntil = Math.max(k.boostUntil, now + 1350);
                  k.score += 55;
                } else if (pk.kind === 'triple') {
                  k.nitro = 100;
                  k.boostUntil = now + 2200;
                  k.tripleUntil = now + 7000;
                  k.score += 75;
                } else if (pk.kind === 'shield') {
                  k.shieldUntil = now + 9000;
                  k.score += 45;
                } else if (pk.kind === 'magnet') {
                  k.magnetUntil = now + 10000;
                  k.score += 45;
                } else if (pk.kind === 'gem') {
                  k.gemsCollected += 2;
                  k.score += 60;
                } else {
                  k.dropsCollected += 3;
                  k.score += 45;
                }
                if (!k.isBot) {
                  soundEngine.playPickup(pk.kind === 'gem' ? 'gem' : 'power');
                  queueBurst(pk.x, pk.y, '#22d3ee', 8);
                  queueRing(pk.x, pk.y, '#38bdf8', 2.2);
                }
              }
            }

            // Waypoint + Sequential Checkpoints 1..4
            const wp = wps[k.nextWp];
            const dWp = Math.hypot(k.x - wp.x, k.y - wp.y);
            if (dWp < 135) {
              if (wp.hasBoostPad && now >= k.boostUntil) {
                k.boostUntil = now + 1250;
                k.nitro = Math.min(100, k.nitro + 25);
                k.dropsCollected += 2;
                k.score += 50;
                if (!k.isBot) {
                  s.racePadsHit += 1;
                  soundEngine.playBoost();
                  queueBurst(k.x, k.y, '#22d3ee', 10);
                  queueRing(k.x, k.y, '#22d3ee', 2.6);
                  updateTaskProgress('race_pads', s.racePadsHit, s.entities[0]);
                }
              }

              if (wp.isCheckpoint && wp.checkpointNum && wp.checkpointNum === k.nextCheckpoint) {
                k.checkpointsCleared += 1;
                k.nextCheckpoint = wp.checkpointNum + 1;
                k.score += 90;
                k.dropsCollected += 2;
                if (!k.isBot) {
                  soundEngine.playPickup('gem');
                  queueBurst(k.x, k.y, '#fbbf24', 10);
                  queueRing(k.x, k.y, '#fbbf24', 3.0);
                  flashBanner(`Checkpoint ${wp.checkpointNum}/4 Cleared! +90 pts`);
                }
              }

              k.nextWp = (k.nextWp + 1) % wps.length;
              k.score += 35;
              k.dropsCollected += 1;

              if (k.nextWp === 1 && k.checkpointsCleared >= 4) {
                k.checkpointsCleared = 0;
                k.nextCheckpoint = 1;
                k.lap += 1;
                if (!k.isBot) {
                  updateTaskProgress('race_laps', k.lap - 1, s.entities[0]);
                  if (s.entities[0]) s.entities[0].hp = s.entities[0].maxHp;
                }
                if (k.lap > 3) {
                  k.finished = true;
                  k.finishTime = s.elapsed;
                  k.gemsCollected += 8;
                  if (!k.isBot) {
                    soundEngine.playLap(true);
                  }
                } else if (!k.isBot) {
                  soundEngine.playLap(k.lap === 3);
                  flashBanner(
                    k.lap === 3
                      ? 'FINAL LAP (3/3) · FULL HP RESTORED!'
                      : `Lap ${k.lap}/3 · Full HP Restored!`
                  );
                }
              }
            }

            const nextWpPos = wps[k.nextWp];
            const distNext = Math.hypot(k.x - nextWpPos.x, k.y - nextWpPos.y);
            const wpIdxAdjusted = k.nextWp === 0 ? wps.length : k.nextWp;
            k.totalProgress = (k.lap - 1) * 3000 + wpIdxAdjusted * 180 - distNext * 0.12;
          }

          const playerKart = s.karts.find((k) => k.id === 'player');
          if (playerKart) {
            const sortedKarts = [...s.karts].sort((a, b) => b.totalProgress - a.totalProgress);
            const posRank = sortedKarts.findIndex((k) => k.id === 'player') + 1;
            hudSyncAccum += dt;
            if (hudSyncAccum > 0.08) {
              hudSyncAccum = 0;
              setHud((prev) => ({
                ...prev,
                score: playerKart.score,
                wellDrops: playerKart.dropsCollected,
                frostGems: playerKart.gemsCollected,
                hp: 100,
                maxHp: 100,
                timeLeft: Math.ceil(s.timeLeft),
                lap: Math.min(3, playerKart.lap),
                totalLaps: 3,
                checkpoint: playerKart.checkpointsCleared,
                totalCheckpoints: 4,
                racePos: posRank,
                speedKmh: Math.round(Math.abs(playerKart.speed) * 0.36),
                nitroPct: Math.round(playerKart.nitro),
                shieldSec: playerKart.shieldUntil > now ? Math.ceil((playerKart.shieldUntil - now) / 1000) : 0,
                boostSec: playerKart.boostUntil > now ? Math.ceil((playerKart.boostUntil - now) / 1000) : 0,
                magnetSec: playerKart.magnetUntil > now ? Math.ceil((playerKart.magnetUntil - now) / 1000) : 0,
                tripleSec: playerKart.tripleUntil > now ? Math.ceil((playerKart.tripleUntil - now) / 1000) : 0,
                shieldActive: now < playerKart.shieldUntil,
                boostActive: now < playerKart.boostUntil,
                countdown: Math.ceil(s.raceCountdown),
                offRoad: playerOffRoad,
              }));
              setMinimapData({
                dots: [
                  ...s.pickups
                    .filter((pk) => !pk.respawnAt || now >= pk.respawnAt)
                    .map((pk) => ({
                      x: pk.x,
                      y: pk.y,
                      kind: 'powerup' as const,
                      color: getPowerUpRadarColor(pk.kind),
                    })),
                  ...s.karts.map((k) => ({
                    x: k.x,
                    y: k.y,
                    kind: (k.isBot ? 'bot' : 'player') as MiniMapDot['kind'],
                    color: getYetiColorway(k.colorway).accentHex,
                  })),
                ],
                ringRadius: s.ringRadius,
                playerAngle: playerKart.angle,
                nextCheckpoint: playerKart.nextCheckpoint,
                checkpointsCleared: playerKart.checkpointsCleared,
              });
            }
            if (playerKart.finished || s.timeLeft <= 0) {
              if (posRank <= 2) {
                updateTaskProgress('race_podium', 1, s.entities[0]);
              }
              finishSoloMatch(s.entities[0]);
            }
          }
        } else if (gm === 'shooting') {
          // ===== FROST BLASTER SHOOTER SIMULATION =====
          s.elapsed += dt;
          s.timeLeft = Math.max(0, s.timeLeft - dt);
          s.shooterNovaCd = Math.max(0, s.shooterNovaCd - dt);
          if (s.shooterComboTimer > 0) {
            s.shooterComboTimer -= dt;
            if (s.shooterComboTimer <= 0) {
              s.shooterCombo = 1;
            }
          }
          if (s.pickups.length < 16 && Math.random() < dt * 0.7) {
            s.pickups.push(spawnPickup(Math.floor(s.elapsed * 10), mapIdRef.current));
          }

          const player = s.entities[0];
          if (player && !player.eliminated) {
            player.throwCd = Math.max(0, player.throwCd - dt);
            player.throwPulse = Math.max(0, player.throwPulse - dt);

            if (pointerDownRef.current && player.throwCd <= 0) {
              triggerThrowOrFire(aimLogicalRef.current.x, aimLogicalRef.current.y);
            }

            const k = keysRef.current;
            let ix = touchDirRef.current.dx;
            let iy = touchDirRef.current.dy;
            if (k['w'] || k['arrowup']) iy -= 1;
            if (k['s'] || k['arrowdown']) iy += 1;
            if (k['a'] || k['arrowleft']) ix -= 1;
            if (k['d'] || k['arrowright']) ix += 1;
            const mag = Math.hypot(ix, iy);
            const moveSpd = 265 * mapSpec.speedMult * (now < player.boostUntil ? 1.32 : 1);
            if (mag > 0.05) {
              const accelAlpha = 1 - Math.exp(-19.5 * dt);
              player.vx += ((ix / mag) * moveSpd - player.vx) * accelAlpha;
              player.vy += ((iy / mag) * moveSpd - player.vy) * accelAlpha;
            } else {
              const decel = Math.exp(-13.4 * dt);
              player.vx *= decel;
              player.vy *= decel;
            }

            if (gameModeRef.current === 'shooting' || pointerDownRef.current) {
              const adx = aimLogicalRef.current.x - player.x;
              const ady = aimLogicalRef.current.y - player.y;
              const amag = Math.hypot(adx, ady);
              if (amag > 5) {
                player.facingX = adx / amag;
                player.facingY = ady / amag;
              }
            } else if (mag > 0.05) {
              const directionMag = Math.hypot(ix, iy);
              player.facingX = ix / directionMag;
              player.facingY = iy / directionMag;
            }

            player.x = Math.max(65, Math.min(W - 65, player.x + player.vx * dt));
            player.y = Math.max(65, Math.min(H - 65, player.y + player.vy * dt));
            const res = resolveArenaObstacleCollision(
              player.x,
              player.y,
              player.vx,
              player.vy,
              17,
              mapIdRef.current
            );
            player.x = res.x;
            player.y = res.y;
            player.vx = res.vx;
            player.vy = res.vy;

            for (const cr of s.crates) {
              const dxCr = player.x - cr.x;
              const dyCr = player.y - cr.y;
              const dCr = Math.hypot(dxCr, dyCr) || 0.001;
              const minD = (cr.radius || 21) + 16;
              if (dCr < minD) {
                player.x = cr.x + (dxCr / dCr) * minD;
                player.y = cr.y + (dyCr / dCr) * minD;
              }
            }

            // Collect & Magnet-pull Power-Ups + Drops
            const magnetActive = now < player.magnetUntil;
            for (let i = s.pickups.length - 1; i >= 0; i--) {
              const pk = s.pickups[i];
              const dPk = Math.hypot(pk.x - player.x, pk.y - player.y);
              if (magnetActive && (pk.kind === 'drop' || pk.kind === 'gem') && dPk > 16 && dPk < 240) {
                pk.x += ((player.x - pk.x) / dPk) * 420 * dt;
                pk.y += ((player.y - pk.y) / dPk) * 420 * dt;
              }
              if (Math.hypot(pk.x - player.x, pk.y - player.y) < 34) {
                if (pk.kind === 'drop') {
                  player.wellDrops += 1;
                  player.score += 20;
                  soundEngine.playPickup('drop');
                } else if (pk.kind === 'gem') {
                  player.frostGems += 1;
                  player.score += 35;
                  soundEngine.playPickup('gem');
                } else if (pk.kind === 'shield') {
                  player.shieldUntil = now + 9000;
                  soundEngine.playPickup('power');
                  flashBanner('Cryo Shield Active (9s)!');
                } else if (pk.kind === 'boost') {
                  player.boostUntil = now + 7000;
                  soundEngine.playPickup('power');
                  flashBanner('Turbo Surge Active (7s)!');
                } else if (pk.kind === 'magnet') {
                  player.magnetUntil = now + 10000;
                  soundEngine.playPickup('power');
                  flashBanner('Drop Magnet Active (10s)!');
                } else if (pk.kind === 'triple') {
                  player.tripleUntil = now + 10000;
                  soundEngine.playPickup('power');
                  flashBanner('Tri-Shot Blaster Active (10s)!');
                } else {
                  player.hp = Math.min(player.maxHp, player.hp + 30);
                  soundEngine.playPickup('gem');
                  flashBanner('+30 HP Restored!');
                }
                queueBurst(pk.x, pk.y, '#22d3ee', 7);
                s.pickups.splice(i, 1);
              }
            }

            // Update Shooter Enemies
            for (const en of s.shooterEnemies) {
              if (en.kind === 'bullseye') {
                en.orbitAngle += dt * 0.95;
                en.x += Math.cos(en.orbitAngle) * 42 * dt;
                en.y += Math.sin(en.orbitAngle) * 42 * dt;
              } else {
                const dxP = player.x - en.x;
                const dyP = player.y - en.y;
                const distP = Math.hypot(dxP, dyP) || 1;
                const desiredDist =
                  en.kind === 'boss_yeti' ? 310 : en.kind === 'yeti_rival' ? 240 : 185;
                const radialPush = distP > desiredDist ? 1 : distP < desiredDist - 55 ? -0.7 : 0;
                const strafe = en.kind === 'boss_yeti' ? 0.3 : en.kind === 'yeti_rival' ? 0.65 : 0.45;
                const spd =
                  (en.kind === 'boss_yeti' ? 92 : en.kind === 'yeti_rival' ? 148 : 118) *
                  mapSpec.speedMult;
                const tx = (dxP / distP) * radialPush - (dyP / distP) * strafe;
                const ty = (dyP / distP) * radialPush + (dxP / distP) * strafe;
                en.vx = en.vx * 0.85 + tx * spd * 0.15;
                en.vy = en.vy * 0.85 + ty * spd * 0.15;
                en.x = Math.max(70, Math.min(W - 70, en.x + en.vx * dt));
                en.y = Math.max(70, Math.min(H - 70, en.y + en.vy * dt));
                const er = resolveArenaObstacleCollision(en.x, en.y, en.vx, en.vy, 17, mapIdRef.current);
                en.x = er.x;
                en.y = er.y;
                for (const cr of s.crates) {
                  const dxCr = en.x - cr.x;
                  const dyCr = en.y - cr.y;
                  const dCr = Math.hypot(dxCr, dyCr) || 0.001;
                  const minD = (cr.radius || 21) + 17;
                  if (dCr < minD) {
                    en.x = cr.x + (dxCr / dCr) * minD;
                    en.y = cr.y + (dyCr / dCr) * minD;
                  }
                }

                en.fireCd -= dt;
                if (en.fireCd <= 0 && distP < 560) {
                  en.fireCd =
                    (en.kind === 'boss_yeti' ? 1.05 : en.kind === 'yeti_rival' ? 1.85 : 2.5) +
                    Math.random() * 0.8;
                  s.snowballs.push({
                    id: `eb_${now}_${en.id}`,
                    ownerId: en.id,
                    x: en.x + (dxP / distP) * 20,
                    y: en.y + (dyP / distP) * 20,
                    vx: (dxP / distP) * 290,
                    vy: (dyP / distP) * 290,
                    ttl: 2.1,
                    isEnemyOrb: true,
                  });
                }
              }
            }

            // Update Projectiles
            for (let i = s.snowballs.length - 1; i >= 0; i--) {
              const sb = s.snowballs[i];
              sb.x += sb.vx * dt;
              sb.y += sb.vy * dt;
              sb.ttl -= dt;
              let hit = false;

              if (sb.ownerId === 'player') {
                for (let eIdx = s.shooterEnemies.length - 1; eIdx >= 0; eIdx--) {
                  const en = s.shooterEnemies[eIdx];
                  if (Math.hypot(en.x - sb.x, en.y - sb.y) < 28) {
                    hit = true;
                    en.hp -= 1;
                    s.hitsLanded += 1;
                    queueBurst(sb.x, sb.y, '#22d3ee', 8);
                    queueRing(sb.x, sb.y, '#22d3ee', 1.6);
                    if (en.hp <= 0) {
                      s.shooterElims += 1;
                      if (en.kind === 'bullseye') s.shooterBullseyes += 1;
                      s.shooterCombo = Math.min(5, s.shooterCombo + 1);
                      s.shooterMaxCombo = Math.max(s.shooterMaxCombo, s.shooterCombo);
                      s.shooterComboTimer = 3.6;

                      const basePts =
                        en.kind === 'boss_yeti'
                          ? 650
                          : en.kind === 'bullseye'
                          ? 110
                          : en.kind === 'yeti_rival'
                          ? 95
                          : 75;
                      player.score += basePts * s.shooterCombo;
                      player.wellDrops += en.kind === 'boss_yeti' ? 8 : en.kind === 'yeti_rival' ? 2 : 1;
                      if (en.kind === 'bullseye') player.frostGems += 1;

                      soundEngine.playPickup(
                        en.kind === 'bullseye' || en.kind === 'boss_yeti' ? 'gem' : 'drop'
                      );
                      queueBurst(en.x, en.y, '#fbbf24', 12);
                      queueRing(en.x, en.y, '#fbbf24', 2.4);

                      if (Math.random() < 0.52) {
                        const pool: Pickup['kind'][] = ['drop', 'gem', 'shield', 'boost', 'magnet', 'triple', 'medkit'];
                        s.pickups.push({
                          id: `drop_${now}_${eIdx}`,
                          kind: pool[Math.floor(Math.random() * pool.length)],
                          x: en.x,
                          y: en.y,
                          bobOffset: 0,
                        });
                      }
                      s.shooterEnemies.splice(eIdx, 1);

                      updateTaskProgress('shoot_elims', s.shooterElims, player);
                      updateTaskProgress('shoot_combo', s.shooterCombo, player);
                      updateTaskProgress('shoot_bull', s.shooterBullseyes, player);
                    }
                    break;
                  }
                }
              } else if (Math.hypot(player.x - sb.x, player.y - sb.y) < 22) {
                hit = true;
                if (now >= player.shieldUntil && now >= player.hurtUntil) {
                  player.hp = Math.max(0, player.hp - 20);
                  player.hurtUntil = now + 850;
                  s.shooterCombo = 1;
                  s.shake = 0.45;
                  soundEngine.playHit();
                  queueBurst(player.x, player.y, '#f43f5e', 10);
                  if (player.hp === 0) player.eliminated = true;
                }
              }

              if (!hit) {
                for (let c = s.crates.length - 1; c >= 0; c--) {
                  const cr = s.crates[c];
                  const propRadius = cr.radius || 21;
                  if (Math.hypot(cr.x - sb.x, cr.y - sb.y) < propRadius + 6) {
                    hit = true;
                    const attacker = sb.ownerId === 'player' ? player : null;
                    damageDestructibleProp(c, 1, attacker);
                    break;
                  }
                }
              }

              if (!hit) {
                for (const obs of getMapObstacles(mapIdRef.current)) {
                  if (Math.hypot(obs.x - sb.x, obs.y - sb.y) < obs.radius + 5) {
                    hit = true;
                    queueBurst(sb.x, sb.y, '#94a3b8', 5);
                    break;
                  }
                }
              }

              if (hit || sb.ttl <= 0 || sb.x < 20 || sb.x > W - 20 || sb.y < 20 || sb.y > H - 20) {
                s.snowballs.splice(i, 1);
              }
            }

            if (s.crates.length < 7 && Math.random() < dt * 0.45) {
              s.crates.push(spawnCrate(Math.floor(s.elapsed * 10), mapIdRef.current));
            }

            if (s.shooterEnemies.length === 0) {
              s.shooterWave += 1;
              player.score += 120;
              player.hp = player.maxHp;
              while (s.crates.length < 8) {
                s.crates.push(spawnCrate(s.crates.length, mapIdRef.current));
              }
              spawnShooterWave(s.shooterWave, mapIdRef.current);
              soundEngine.playLap(false);
              flashBanner(`Wave ${s.shooterWave} · Full HP Restored!`);
            }

            hudSyncAccum += dt;
            if (hudSyncAccum > 0.08) {
              hudSyncAccum = 0;
              setHud((prev) => ({
                ...prev,
                score: player.score,
                wellDrops: player.wellDrops,
                frostGems: player.frostGems,
                hp: player.hp,
                maxHp: player.maxHp,
                timeLeft: Math.ceil(s.timeLeft),
                wave: s.shooterWave,
                shieldSec: player.shieldUntil > now ? Math.ceil((player.shieldUntil - now) / 1000) : 0,
                boostSec: player.boostUntil > now ? Math.ceil((player.boostUntil - now) / 1000) : 0,
                magnetSec: player.magnetUntil > now ? Math.ceil((player.magnetUntil - now) / 1000) : 0,
                tripleSec: player.tripleUntil > now ? Math.ceil((player.tripleUntil - now) / 1000) : 0,
                shieldActive: now < player.shieldUntil,
                boostActive: now < player.boostUntil,
                elims: s.shooterElims,
                combo: s.shooterCombo,
                novaReady: s.shooterNovaCd <= 0,
              }));
              setMinimapData({
                dots: [
                  { x: ARENA_CENTER_X, y: ARENA_CENTER_Y, kind: 'well' },
                  ...s.crates.map((cr) => ({ x: cr.x, y: cr.y, kind: 'crate' as const })),
                  ...s.pickups
                    .filter((pk) => pk.kind !== 'drop' && pk.kind !== 'gem')
                    .map((pk) => ({
                      x: pk.x,
                      y: pk.y,
                      kind: 'powerup' as const,
                      color: getPowerUpRadarColor(pk.kind),
                    })),
                  ...s.shooterEnemies.map((en) => ({
                    x: en.x,
                    y: en.y,
                    kind: (en.kind === 'bullseye' ? 'bullseye' : 'enemy') as MiniMapDot['kind'],
                  })),
                  { x: player.x, y: player.y, kind: 'player' },
                ],
                ringRadius: s.ringRadius,
                playerAngle: Math.atan2(player.facingY, player.facingX),
                nextCheckpoint: 1,
                checkpointsCleared: 0,
              });
            }

            if (player.eliminated || s.timeLeft <= 0) {
              finishSoloMatch(player);
            }
          }
        } else {
          // ===== SURVIVAL FLURRY SIMULATION (EXPANDED 2400x1600 MAP · 150s) =====
          s.elapsed += dt;
          s.timeLeft = Math.max(0, s.timeLeft - dt);
          s.ringRadius = Math.max(210, ARENA_INITIAL_RING_RADIUS - s.elapsed * 3.2);

          while (s.pickups.length < 28) {
            s.pickups.push(spawnPickup(Math.floor(s.elapsed * 10), mapIdRef.current));
          }
          while (s.crates.length < 10) {
            s.crates.push(spawnCrate(Math.floor(s.elapsed * 10)));
          }

          if (s.beacon.active) {
            s.beacon.timeLeft = Math.max(0, s.beacon.timeLeft - dt);
            if (s.beacon.timeLeft <= 0) {
              s.beacon.active = false;
              s.beacon.nextIn = 11.0;
            }
          } else {
            s.beacon.nextIn -= dt;
            if (s.beacon.nextIn <= 0) {
              const a = Math.random() * Math.PI * 2;
              const d = 150 + Math.random() * Math.max(90, s.ringRadius - 210);
              const bPos = nudgeOutsideObstacles(
                ARENA_CENTER_X + Math.cos(a) * d,
                ARENA_CENTER_Y + Math.sin(a) * d,
                32,
                mapIdRef.current
              );
              s.beacon = {
                active: true,
                x: bPos.x,
                y: bPos.y,
                radius: 78,
                timeLeft: 12.0,
                nextIn: 11.0,
                tickAccum: 0,
              };
              flashBanner('Shrine Beacon Activated! Stand inside for Drops');
            }
          }

          s.nextHazardIn -= dt;
          if (s.nextHazardIn <= 0) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 95 + Math.random() * Math.max(100, s.ringRadius - 95);
            const hPos = nudgeOutsideObstacles(
              ARENA_CENTER_X + Math.cos(angle) * dist,
              ARENA_CENTER_Y + Math.sin(angle) * dist,
              20,
              mapIdRef.current
            );
            s.hazards.push({
              id: `hz_${now}_${Math.random()}`,
              x: hPos.x,
              y: hPos.y,
              radius: 44,
              timer: 1.45,
              maxTimer: 1.45,
            });
            s.nextHazardIn = Math.max(1.5, 3.6 - s.elapsed * 0.018);
          }

          const hazardBurstCol =
            mapIdRef.current === 'volcanic_springs'
              ? '#fb923c'
              : mapIdRef.current === 'aurora_summit'
              ? '#2dd4bf'
              : '#7dd3fc';

          for (let i = s.hazards.length - 1; i >= 0; i--) {
            const hz = s.hazards[i];
            hz.timer -= dt;
            if (hz.timer <= 0) {
              queueBurst(hz.x, hz.y, hazardBurstCol, 14);
              queueRing(hz.x, hz.y, hazardBurstCol, 2.7);
              for (const ent of s.entities) {
                if (ent.eliminated) continue;
                if (Math.hypot(ent.x - hz.x, ent.y - hz.y) < hz.radius + 10) {
                  if (now >= ent.shieldUntil && now >= ent.hurtUntil) {
                    ent.hp = Math.max(0, ent.hp - 20);
                    ent.hurtUntil = now + 900;
                    if (!ent.isBot) {
                      s.shake = 0.45;
                      soundEngine.playHit();
                    }
                    if (ent.hp === 0) ent.eliminated = true;
                  }
                }
              }
              s.hazards.splice(i, 1);
            }
          }

          for (const ent of s.entities) {
            if (ent.eliminated) continue;
            ent.dashCd = Math.max(0, ent.dashCd - dt);
            ent.dashTime = Math.max(0, ent.dashTime - dt);
            ent.throwCd = Math.max(0, ent.throwCd - dt);
            ent.throwPulse = Math.max(0, ent.throwPulse - dt);
            if (ent.emote !== 'none' && now >= ent.emoteUntil) {
              ent.emote = 'none';
            }

            let ix = 0;
            let iy = 0;

            if (!ent.isBot) {
              const k = keysRef.current;
              ix += touchDirRef.current.dx;
              iy += touchDirRef.current.dy;
              if (k['w'] || k['arrowup']) iy -= 1;
              if (k['s'] || k['arrowdown']) iy += 1;
              if (k['a'] || k['arrowleft']) ix -= 1;
              if (k['d'] || k['arrowright']) ix += 1;
            } else {
              const dxC = ARENA_CENTER_X - ent.x;
              const dyC = ARENA_CENTER_Y - ent.y;
              const dC = Math.hypot(dxC, dyC);
              if (ent.gatherAtWellUntil && now < ent.gatherAtWellUntil && dC > 68) {
                ix = dxC / (dC || 1);
                iy = dyC / (dC || 1);
              } else if (ent.gatherAtWellUntil && now < ent.gatherAtWellUntil) {
                ix = 0;
                iy = 0;
              } else if (dC > s.ringRadius - 55 || ent.carriedDrops >= 3) {
                ix = dxC / (dC || 1);
                iy = dyC / (dC || 1);
              } else {
                let bestPk = s.pickups[0];
                let bestDist = Infinity;
                for (const pk of s.pickups) {
                  const d = Math.hypot(pk.x - ent.x, pk.y - ent.y);
                  if (d < bestDist) {
                    bestDist = d;
                    bestPk = pk;
                  }
                }
                if (bestPk) {
                  const d = Math.hypot(bestPk.x - ent.x, bestPk.y - ent.y) || 1;
                  ix = (bestPk.x - ent.x) / d;
                  iy = (bestPk.y - ent.y) / d;
                }
              }

              if (ent.throwCd <= 0) {
                const target = s.entities.find(
                  (o) => o.id !== ent.id && !o.eliminated && Math.hypot(o.x - ent.x, o.y - ent.y) < 340
                );
                if (target) {
                  const d = Math.hypot(target.x - ent.x, target.y - ent.y) || 1;
                  ent.throwPulse = 0.24;
                  s.snowballs.push({
                    id: `sb_${now}_${ent.id}`,
                    ownerId: ent.id,
                    x: ent.x + ((target.x - ent.x) / d) * 20,
                    y: ent.y + ((target.y - ent.y) / d) * 20,
                    vx: ((target.x - ent.x) / d) * 370,
                    vy: ((target.y - ent.y) / d) * 370,
                    ttl: 1.4,
                  });
                  ent.throwCd = 2.2 + Math.random() * 1.4;
                }
              }
            }

            const boostFactor = now < ent.boostUntil ? 1.38 : 1;
            const baseSpeed = (ent.isBot ? 205 : 245) * boostFactor * mapSpec.speedMult;
            const mag = Math.hypot(ix, iy);
            const dampRate = Math.max(
              2.5,
              -Math.log(Math.max(0.5, Math.min(0.98, mapSpec.friction))) * 60
            );
            if (mag > 0.05 && ent.dashTime <= 0) {
              const nx = ix / mag;
              const ny = iy / mag;
              ent.facingX = nx;
              ent.facingY = ny;
              const accelAlpha = 1 - Math.exp(-dampRate * dt);
              ent.vx += (nx * baseSpeed - ent.vx) * accelAlpha;
              ent.vy += (ny * baseSpeed - ent.vy) * accelAlpha;
            } else if (ent.dashTime <= 0) {
              const frictionDecay = Math.exp(-dampRate * dt);
              ent.vx *= frictionDecay;
              ent.vy *= frictionDecay;
            }

            const moveSpeed = Math.hypot(ent.vx, ent.vy);
            if ((ent.dashTime > 0 || moveSpeed > 135) && Math.random() < (ent.dashTime > 0 ? 0.65 : 0.22)) {
              const trailCol = getCosmeticColor(ent.trail, getYetiColorway(ent.colorway).accentHex);
              queueBurst(ent.x, ent.y, trailCol, ent.dashTime > 0 ? 2 : 1);
            }

            ent.x = Math.max(55, Math.min(W - 55, ent.x + ent.vx * dt));
            ent.y = Math.max(55, Math.min(H - 55, ent.y + ent.vy * dt));

            const resolved = resolveArenaObstacleCollision(
              ent.x,
              ent.y,
              ent.vx,
              ent.vy,
              16,
              mapIdRef.current
            );
            ent.x = resolved.x;
            ent.y = resolved.y;
            ent.vx = resolved.vx;
            ent.vy = resolved.vy;

            if (ent.dashTime > 0) {
              for (let c = s.crates.length - 1; c >= 0; c--) {
                const cr = s.crates[c];
                if (Math.hypot(cr.x - ent.x, cr.y - ent.y) < (cr.radius || 21) + 20) {
                  damageDestructibleProp(c, cr.maxHp || 3, ent, 'Frost Dash');
                }
              }
            } else {
              for (const cr of s.crates) {
                const dxCr = ent.x - cr.x;
                const dyCr = ent.y - cr.y;
                const dCr = Math.hypot(dxCr, dyCr) || 0.001;
                const minD = (cr.radius || 21) + 15;
                if (dCr < minD) {
                  ent.x = cr.x + (dxCr / dCr) * minD;
                  ent.y = cr.y + (dyCr / dCr) * minD;
                }
              }
            }

            const distCenter = Math.hypot(ent.x - ARENA_CENTER_X, ent.y - ARENA_CENTER_Y);
            if (distCenter < 75 && ent.carriedDrops >= 2) {
              const bonus = ent.carriedDrops * 28;
              ent.score += bonus;
              ent.wellDrops += ent.carriedDrops;
              ent.carriedDrops = 0;
              ent.hp = Math.min(ent.maxHp, ent.hp + 25);
              queueBurst(ARENA_CENTER_X, ARENA_CENTER_Y, '#34d399', 14);
              queueRing(ARENA_CENTER_X, ARENA_CENTER_Y, '#34d399', 3.4);
              if (!ent.isBot) {
                s.wellBanks += 1;
                soundEngine.playPickup('power');
                flashBanner(`Well Deposit! +${bonus} pts & +25 HP`);
                updateTaskProgress('task_bank', s.wellBanks, ent);
              }
            }

            if (!ent.isBot && s.beacon.active) {
              if (Math.hypot(ent.x - s.beacon.x, ent.y - s.beacon.y) < s.beacon.radius) {
                s.beacon.tickAccum += dt;
                if (s.beacon.tickAccum >= 0.75) {
                  s.beacon.tickAccum = 0;
                  s.beaconTicks += 1;
                  ent.score += 25;
                  ent.wellDrops += 1;
                  queueBurst(ent.x, ent.y, '#fde047', 6);
                  soundEngine.playPickup('drop');
                  updateTaskProgress('task_crates', s.cratesSmashed + s.beaconTicks, ent);
                }
              }
            }

            if (distCenter > s.ringRadius && now >= ent.hurtUntil && now >= ent.shieldUntil) {
              ent.hp = Math.max(0, ent.hp - 15);
              ent.hurtUntil = now + 1100;
              if (!ent.isBot) {
                s.shake = 0.4;
                soundEngine.playHit();
              }
              if (ent.hp === 0) ent.eliminated = true;
            }

            const dropMult = now < s.blessingUntil ? 2 : 1;
            const magnetActive = now < ent.magnetUntil;
            for (let i = s.pickups.length - 1; i >= 0; i--) {
              const pk = s.pickups[i];
              const dPk = Math.hypot(pk.x - ent.x, pk.y - ent.y);
              if (magnetActive && (pk.kind === 'drop' || pk.kind === 'gem') && dPk > 16 && dPk < 240) {
                pk.x += ((ent.x - pk.x) / dPk) * 420 * dt;
                pk.y += ((ent.y - pk.y) / dPk) * 420 * dt;
              }
              if (Math.hypot(pk.x - ent.x, pk.y - ent.y) < 34) {
                if (pk.kind === 'drop') {
                  ent.score += 15 * dropMult;
                  ent.wellDrops += dropMult;
                  ent.carriedDrops += dropMult;
                  if (!ent.isBot) soundEngine.playPickup('drop');
                } else if (pk.kind === 'gem') {
                  ent.score += 30;
                  ent.frostGems += 1;
                  if (!ent.isBot) soundEngine.playPickup('gem');
                } else if (pk.kind === 'shield') {
                  ent.shieldUntil = now + 9000;
                  ent.score += 25;
                  if (!ent.isBot) {
                    soundEngine.playPickup('power');
                    flashBanner('Cryo Shield Active (9s)!');
                  }
                } else if (pk.kind === 'boost') {
                  ent.boostUntil = now + 7000;
                  ent.score += 25;
                  if (!ent.isBot) {
                    soundEngine.playPickup('power');
                    flashBanner('Turbo Surge Active (7s)!');
                  }
                } else if (pk.kind === 'magnet') {
                  ent.magnetUntil = now + 10000;
                  ent.score += 30;
                  if (!ent.isBot) {
                    soundEngine.playPickup('power');
                    flashBanner('Drop Magnet Active (10s)!');
                  }
                } else if (pk.kind === 'triple') {
                  ent.tripleUntil = now + 10000;
                  ent.score += 30;
                  if (!ent.isBot) {
                    soundEngine.playPickup('power');
                    flashBanner('Tri-Shot Flurry Active (10s)!');
                  }
                } else {
                  ent.hp = Math.min(ent.maxHp, ent.hp + 30);
                  ent.score += 20;
                  if (!ent.isBot) {
                    soundEngine.playPickup('gem');
                    flashBanner('+30 HP Restored!');
                  }
                }
                queueBurst(pk.x, pk.y, '#bae6fd', 7);
                s.pickups.splice(i, 1);
              }
            }
          }

          if (now >= s.ritualCooldownUntil) {
            const waveYetis: LocalYeti[] = [];
            const danceYetis: LocalYeti[] = [];
            for (const ent of s.entities) {
              if (ent.eliminated) continue;
              if (
                Math.hypot(ent.x - ARENA_CENTER_X, ent.y - ARENA_CENTER_Y) <= WELL_RITUAL_RADIUS &&
                now < ent.emoteUntil
              ) {
                if (ent.emote === 'wave') waveYetis.push(ent);
                else if (ent.emote === 'dance') danceYetis.push(ent);
              }
            }
            if (danceYetis.length >= 2) {
              triggerWellRitualBlessing('dance', danceYetis);
            } else if (waveYetis.length >= 2) {
              triggerWellRitualBlessing('wave', waveYetis);
            }
          }

          for (let i = s.snowballs.length - 1; i >= 0; i--) {
            const sb = s.snowballs[i];
            sb.x += sb.vx * dt;
            sb.y += sb.vy * dt;
            sb.ttl -= dt;
            let hit = false;

            for (const ent of s.entities) {
              if (ent.id === sb.ownerId || ent.eliminated) continue;
              if (Math.hypot(ent.x - sb.x, ent.y - sb.y) < 23) {
                hit = true;
                queueBurst(sb.x, sb.y, '#f8fafc', 9);
                queueRing(sb.x, sb.y, '#7dd3fc', 1.8);
                if (now >= ent.shieldUntil) {
                  ent.vx += sb.vx * 0.65;
                  ent.vy += sb.vy * 0.65;
                  const shooter = s.entities.find((e) => e.id === sb.ownerId);
                  if (now >= ent.hurtUntil) {
                    ent.hp = Math.max(0, ent.hp - 20);
                    ent.hurtUntil = now + 750;
                    if (shooter) {
                      shooter.score += 45;
                      if (ent.hp === 0) shooter.knockouts += 1;
                      if (!shooter.isBot) {
                        s.hitsLanded += 1;
                        updateTaskProgress('task_hits', s.hitsLanded, shooter);
                      }
                    }
                    if (!ent.isBot) {
                      s.shake = 0.45;
                      soundEngine.playHit();
                    }
                    if (ent.hp === 0) ent.eliminated = true;
                  }
                }
                break;
              }
            }

            if (!hit) {
              for (const obs of getMapObstacles(mapIdRef.current)) {
                if (Math.hypot(obs.x - sb.x, obs.y - sb.y) < obs.radius + 5) {
                  hit = true;
                  queueBurst(sb.x, sb.y, hazardBurstCol, 8);
                  queueRing(sb.x, sb.y, hazardBurstCol, 1.5);
                  break;
                }
              }
            }

            if (!hit) {
              for (let c = s.crates.length - 1; c >= 0; c--) {
                const cr = s.crates[c];
                if (Math.hypot(cr.x - sb.x, cr.y - sb.y) < (cr.radius || 21) + 6) {
                  hit = true;
                  const shooter = s.entities.find((e) => e.id === sb.ownerId) || null;
                  damageDestructibleProp(c, 1, shooter);
                  break;
                }
              }
            }

            if (hit || sb.ttl <= 0 || sb.x < 0 || sb.x > W || sb.y < 0 || sb.y > H) {
              s.snowballs.splice(i, 1);
            }
          }

          const player = s.entities.find((e) => e.id === 'player');
          if (player) {
            hudSyncAccum += dt;
            if (hudSyncAccum > 0.08) {
              hudSyncAccum = 0;
              const distWell = Math.hypot(player.x - ARENA_CENTER_X, player.y - ARENA_CENTER_Y);
              const blessingLeft =
                s.blessingUntil > now ? Math.ceil((s.blessingUntil - now) / 1000) : 0;
              setHud((prev) => ({
                ...prev,
                score: player.score,
                wellDrops: player.wellDrops,
                carriedDrops: player.carriedDrops,
                frostGems: player.frostGems,
                hp: player.hp,
                maxHp: player.maxHp,
                timeLeft: Math.ceil(s.timeLeft),
                wave: Math.max(1, Math.ceil(s.elapsed / 25)),
                shieldSec: player.shieldUntil > now ? Math.ceil((player.shieldUntil - now) / 1000) : 0,
                boostSec: player.boostUntil > now ? Math.ceil((player.boostUntil - now) / 1000) : 0,
                magnetSec: player.magnetUntil > now ? Math.ceil((player.magnetUntil - now) / 1000) : 0,
                tripleSec: player.tripleUntil > now ? Math.ceil((player.tripleUntil - now) / 1000) : 0,
                shieldActive: now < player.shieldUntil,
                boostActive: now < player.boostUntil,
                dashReady: player.dashCd <= 0,
                beaconActive: s.beacon.active,
                nearWell: distWell <= WELL_RITUAL_RADIUS,
                blessingLeft,
                ritualReady: now >= s.ritualCooldownUntil,
              }));
              setMinimapData({
                dots: [
                  { x: ARENA_CENTER_X, y: ARENA_CENTER_Y, kind: 'well' },
                  ...(s.beacon.active ? [{ x: s.beacon.x, y: s.beacon.y, kind: 'beacon' as const }] : []),
                  ...s.crates.map((cr) => ({ x: cr.x, y: cr.y, kind: 'crate' as const })),
                  ...s.pickups
                    .filter((pk) => pk.kind !== 'drop' && pk.kind !== 'gem')
                    .map((pk) => ({
                      x: pk.x,
                      y: pk.y,
                      kind: 'powerup' as const,
                      color: getPowerUpRadarColor(pk.kind),
                    })),
                  ...s.entities
                    .filter((e) => !e.eliminated)
                    .map((e) => ({
                      x: e.x,
                      y: e.y,
                      kind: (e.isBot ? 'bot' : 'player') as MiniMapDot['kind'],
                      color: getYetiColorway(e.colorway).accentHex,
                    })),
                ],
                ringRadius: s.ringRadius,
                playerAngle: Math.atan2(player.facingY, player.facingX),
                nextCheckpoint: 1,
                checkpointsCleared: 0,
              });
            }

            const botsAlive = s.entities.filter((e) => e.isBot && !e.eliminated).length;
            if (player.eliminated || s.timeLeft <= 0 || botsAlive === 0) {
              if (botsAlive === 0 && !player.eliminated) player.score += 150;
              finishSoloMatch(player);
            }
          }
        }
      }

      // ---- 2. Sync 3D Scene Objects with Current State ----
      const tunnelSnap =
        (gm === 'survival' || gm === 'car_racing') && playModeRef.current === 'tunnel'
          ? tunnelSnapshotRef.current
          : null;
      const ringRadiusWorld = (tunnelSnap ? tunnelSnap.ringRadius : s.ringRadius) * WORLD_SCALE;
      const myPlayerActor = tunnelSnap
        ? tunnelSnap.players.find((p) => p.id === tunnelPlayerIdRef.current)
        : s.entities.find((e) => e.id === 'player');
      const bankReady = gm === 'survival' && (myPlayerActor?.carriedDrops || 0) >= 2;
      const blessingActive =
        gm === 'survival' &&
        (tunnelSnap ? now < (tunnelSnap.blessingUntil || 0) : now < s.blessingUntil);

      envHandles?.update(elapsedTime, dt, ringRadiusWorld, bankReady, blessingActive);

      // Toggle group visibility cleanly per GameMode
      const showYetis = gm !== 'car_racing';
      const showKarts = gm === 'car_racing';
      const showShooterTargets = gm === 'shooting';

      actorsGroup.visible = showYetis;
      kartsGroup.visible = showKarts;
      shooterGroup.visible = showShooterTargets;
      cratesGroup.visible = gm === 'survival' || gm === 'shooting';
      hazardsGroup.visible = gm === 'survival';
      aimReticle.visible = gm === 'shooting' && gameStateRef.current === 'PLAYING';
      if (aimReticle.visible) {
        aimReticle.position.set(toWorldX(aimLogicalRef.current.x), 0, toWorldZ(aimLogicalRef.current.y));
        aimReticle.rotation.y += dt * 2.8;
      }

      const activeBeacon = tunnelSnap ? tunnelSnap.beacon : s.beacon;
      beaconGroup.visible = gm === 'survival' && activeBeacon.active;
      if (beaconGroup.visible) {
        beaconGroup.position.set(toWorldX(activeBeacon.x), 0, toWorldZ(activeBeacon.y));
        beaconRing.scale.setScalar(1 + Math.sin(elapsedTime * 5) * 0.08);
        beaconBeam.rotation.y += dt * 1.4;
      }

      if (rigVersionDirtyRef.current) {
        for (const rig of yetiRigs.values()) actorsGroup.remove(rig.root);
        yetiRigs.clear();
        for (const kr of kartRigs.values()) kartsGroup.remove(kr.root);
        kartRigs.clear();
        for (const sm of shooterMeshes.values()) {
          shooterGroup.remove('group' in sm ? sm.group : sm.root);
        }
        shooterMeshes.clear();
        rigVersionDirtyRef.current = false;
      }

      let focusX = 0;
      let focusZ = 2;
      let playerBoosted = false;
      let chaseYaw: number | null = null;

      if (showYetis) {
        const activeActors = tunnelSnap
          ? tunnelSnap.players.map((p) => ({
              id: p.id,
              x: p.x,
              y: p.y,
              vx: p.vx,
              vy: p.vy,
              hp: p.hp,
              maxHp: p.maxHp || 100,
              facingX: p.facingX || 0,
              facingY: p.facingY || 1,
              hat:
                p.id === tunnelPlayerIdRef.current && yetiPropRef.current
                  ? yetiPropRef.current.equipped.hat
                  : p.hat,
              scarf:
                p.id === tunnelPlayerIdRef.current && yetiPropRef.current
                  ? yetiPropRef.current.equipped.scarf
                  : p.scarf,
              colorway:
                p.id === tunnelPlayerIdRef.current ? colorwayRef.current : p.colorway || 'glacier_mint',
              shieldUntil: p.shieldUntil,
              boostUntil: p.boostUntil,
              dashing: p.dashing,
              throwPulse: 0,
              eliminated: p.eliminated,
              isMe: p.id === tunnelPlayerIdRef.current,
              emote: (p.emote || 'none') as YetiEmoteKind,
              emoteUntil: p.emoteUntil || 0,
            }))
          : s.entities.map((e) => ({
              id: e.id,
              x: e.x,
              y: e.y,
              vx: e.vx,
              vy: e.vy,
              hp: e.hp,
              maxHp: e.maxHp || 100,
              facingX: e.facingX,
              facingY: e.facingY,
              hat:
                e.id === 'player' && yetiPropRef.current ? yetiPropRef.current.equipped.hat : e.hat,
              scarf:
                e.id === 'player' && yetiPropRef.current
                  ? yetiPropRef.current.equipped.scarf
                  : e.scarf,
              colorway: e.id === 'player' ? colorwayRef.current : e.colorway,
              shieldUntil: e.shieldUntil,
              boostUntil: e.boostUntil,
              dashing: e.dashTime > 0,
              throwPulse: e.throwPulse,
              eliminated: e.eliminated,
              isMe: e.id === 'player',
              emote: e.emote,
              emoteUntil: e.emoteUntil,
            }));

        const seenActorIds = new Set<string>();
        for (const act of activeActors) {
          seenActorIds.add(act.id);
          const rigKey = `${act.colorway}|${act.hat}|${act.scarf}|${act.isMe}|${gm}`;
          let rig = yetiRigs.get(act.id);
          if (!rig || rig.root.userData.rigKey !== rigKey) {
            if (rig) actorsGroup.remove(rig.root);
            rig = buildYetiRig({
              colorwayId: act.colorway,
              hatId: act.hat,
              scarfId: act.scarf,
              isPlayer: act.isMe,
              weapon: gm === 'shooting' ? 'blaster' : 'sword',
            });
            rig.root.userData.rigKey = rigKey;
            if (!act.isMe) {
              const hpBar = buildHealthBar3D(1.15, 2.35);
              rig.root.add(hpBar.group);
              rig.root.userData.hpBar = hpBar;
            }
            yetiRigs.set(act.id, rig);
            actorsGroup.add(rig.root);
          }

          rig.root.visible = !act.eliminated;
          if (act.eliminated) continue;

          const wx = toWorldX(act.x);
          const wz = toWorldZ(act.y);
          rig.root.position.set(wx, 0, wz);

          if (rig.root.userData.hpBar) {
            updateHealthBar3D(rig.root.userData.hpBar as HealthBar3D, act.hp, act.maxHp, camera);
          }

          if (act.isMe) {
            focusX = wx;
            focusZ = wz;
            playerBoosted = now < act.boostUntil || act.dashing;
          }

          const speed = Math.hypot(act.vx, act.vy);
          const targetYaw = Math.atan2(act.facingX, act.facingY);
          let diff = targetYaw - rig.root.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          rig.root.rotation.y += diff * Math.min(1, dt * 15);

          rig.bodyPivot.scale.setScalar(act.dashing ? 1.04 : 1);
          animateYetiWalk(rig, {
            speed,
            dt,
            elapsedTime,
            dashing: act.dashing,
            throwPulse: act.throwPulse,
            lateralTurn: THREE.MathUtils.clamp(-act.vx * 0.00035, -0.09, 0.09),
            emote: now < act.emoteUntil ? act.emote : 'none',
          });

          rig.shieldMesh.visible = now < act.shieldUntil;
          if (rig.shieldMesh.visible) rig.shieldMesh.rotation.y += dt * 1.8;
          rig.boostRing.visible = now < act.boostUntil || act.dashing;
        }
        for (const [id, rig] of yetiRigs.entries()) {
          if (!seenActorIds.has(id)) {
            actorsGroup.remove(rig.root);
            yetiRigs.delete(id);
          }
        }
      }

      if (showKarts) {
        const seenKartIds = new Set<string>();
        for (const k of s.karts) {
          seenKartIds.add(k.id);
          const kKey = `${k.colorway}|${k.hat}|${k.scarf}|${!k.isBot}`;
          let krig = kartRigs.get(k.id);
          if (!krig || krig.root.userData.kKey !== kKey) {
            if (krig) kartsGroup.remove(krig.root);
            krig = buildYetiKartRig({
              colorwayId: k.colorway,
              hatId: k.hat,
              scarfId: k.scarf,
              isPlayer: !k.isBot,
            });
            krig.root.userData.kKey = kKey;
            kartRigs.set(k.id, krig);
            kartsGroup.add(krig.root);
          }

          const wx = toWorldX(k.x);
          const wz = toWorldZ(k.y);
          krig.root.position.set(wx, 0, wz);
          const yaw = Math.atan2(Math.cos(k.angle), Math.sin(k.angle));
          krig.root.rotation.y = yaw;

          const boosting = now < k.boostUntil;
          animateYetiKart(krig, {
            speed: k.speed,
            steer: k.steerInput,
            boosting,
            dt,
            elapsedTime,
          });

          if (!k.isBot) {
            focusX = wx;
            focusZ = wz;
            chaseYaw = yaw;
            playerBoosted = boosting;
          }
        }
        for (const [id, krig] of kartRigs.entries()) {
          if (!seenKartIds.has(id)) {
            kartsGroup.remove(krig.root);
            kartRigs.delete(id);
          }
        }
      }

      if (showShooterTargets) {
        const seenEnemyIds = new Set<string>();
        const accentHex = getMapSpec(mapIdRef.current).accentHex;
        for (const en of s.shooterEnemies) {
          seenEnemyIds.add(en.id);
          let sm = shooterMeshes.get(en.id);
          if (!sm) {
            if (en.kind === 'yeti_rival' || en.kind === 'boss_yeti') {
              sm = buildYetiRig({
                colorwayId: en.colorway,
                hatId: 'hat_goggles',
                scarfId: 'scarf_crimson',
                isPlayer: false,
                scale: en.kind === 'boss_yeti' ? 1.45 : 1,
                weapon: en.kind === 'boss_yeti' ? 'sword' : 'blaster',
              });
              const hpBar = buildHealthBar3D(1.2, 2.35);
              sm.root.add(hpBar.group);
              sm.root.userData.hpBar = hpBar;
              shooterGroup.add(sm.root);
            } else {
              sm = buildShooterTargetMesh(en.kind, accentHex);
              if (en.kind === 'drone') {
                const hpBar = buildHealthBar3D(1.0, 1.9);
                sm.group.add(hpBar.group);
                sm.group.userData.hpBar = hpBar;
              }
              shooterGroup.add(sm.group);
            }
            shooterMeshes.set(en.id, sm);
          }

          const wx = toWorldX(en.x);
          const wz = toWorldZ(en.y);
          if ('root' in sm) {
            sm.root.position.set(wx, 0, wz);
            const spd = Math.hypot(en.vx, en.vy);
            if (spd > 5) sm.root.rotation.y = Math.atan2(en.vx, en.vy);
            animateYetiWalk(sm, { speed: spd, dt, elapsedTime });
            if (sm.root.userData.hpBar) {
              updateHealthBar3D(sm.root.userData.hpBar as HealthBar3D, en.hp, en.maxHp, camera);
            }
          } else {
            sm.group.position.set(wx, 0, wz);
            if (en.kind === 'drone') {
              sm.coreMesh.rotation.y += dt * 2.5;
              sm.ringMesh.rotation.z += dt * 4.2;
              sm.group.position.y = Math.sin(elapsedTime * 4 + en.orbitAngle) * 0.16;
              if (sm.group.userData.hpBar) {
                updateHealthBar3D(sm.group.userData.hpBar as HealthBar3D, en.hp, en.maxHp, camera);
              }
            } else {
              sm.group.rotation.y += dt * 1.8;
            }
          }
        }
        for (const [id, sm] of shooterMeshes.entries()) {
          if (!seenEnemyIds.has(id)) {
            shooterGroup.remove('group' in sm ? sm.group : sm.root);
            shooterMeshes.delete(id);
          }
        }
      }

      // Sync Pickups (including Beach-Buggy respawning orbs & new power-ups)
      const activePickups = tunnelSnap ? tunnelSnap.pickups : s.pickups;
      const seenPickupIds = new Set<string>();
      for (const pk of activePickups) {
        const respawnAt = (pk as Pickup).respawnAt;
        if (respawnAt && now < respawnAt) continue;
        seenPickupIds.add(pk.id);
        let mesh = pickupMeshes.get(pk.id);
        if (!mesh) {
          if (pk.kind === 'drop') mesh = new THREE.Mesh(dropGeo, dropMat);
          else if (pk.kind === 'gem') mesh = new THREE.Mesh(gemGeo, gemMat);
          else if (pk.kind === 'shield') mesh = new THREE.Mesh(shieldPkGeo, shieldPkMat);
          else if (pk.kind === 'magnet') mesh = new THREE.Mesh(magnetPkGeo, magnetPkMat);
          else if (pk.kind === 'triple') mesh = new THREE.Mesh(triplePkGeo, triplePkMat);
          else if (pk.kind === 'medkit') mesh = new THREE.Mesh(medkitPkGeo, medkitPkMat);
          else mesh = new THREE.Mesh(boostPkGeo, boostPkMat);
          mesh.castShadow = !isSoftwareGl;
          pickupMeshes.set(pk.id, mesh);
          pickupsGroup.add(mesh);
        }
        mesh.position.set(
          toWorldX(pk.x),
          0.56 + Math.sin(elapsedTime * 4 + ((pk as Pickup).bobOffset || 0)) * 0.14,
          toWorldZ(pk.y)
        );
        mesh.rotation.y += dt * 2.4;
        if (pk.kind === 'magnet') mesh.rotation.x = Math.sin(elapsedTime * 2) * 0.25;
      }
      for (const [id, mesh] of pickupMeshes.entries()) {
        if (!seenPickupIds.has(id)) {
          pickupsGroup.remove(mesh);
          pickupMeshes.delete(id);
        }
      }

      // Sync Interactive Destructible Props (Ice Pillars, Frozen Barrels, Supply Crates)
      const activeCrates = tunnelSnap ? tunnelSnap.crates : s.crates;
      const seenCrateIds = new Set<string>();
      for (const cr of activeCrates) {
        const crTyped = cr as CrateProp;
        const kind: DestructiblePropKind = crTyped.kind || 'ice_crate';
        const maxHp = crTyped.maxHp || 2;
        seenCrateIds.add(cr.id);
        let cGroup = crateMeshes.get(cr.id);
        if (cGroup && cGroup.userData.kind !== kind) {
          cratesGroup.remove(cGroup);
          crateMeshes.delete(cr.id);
          cGroup = undefined;
        }
        if (!cGroup) {
          cGroup = new THREE.Group();
          cGroup.userData = { kind };
          if (kind === 'ice_pillar') {
            const base = new THREE.Mesh(pillarBaseGeo, crateTrimMat);
            base.position.y = 0.1;
            base.receiveShadow = true;
            const col = new THREE.Mesh(pillarCoreGeo, pillarMat);
            col.position.y = 0.96;
            col.castShadow = !isSoftwareGl;
            col.receiveShadow = true;
            const cap = new THREE.Mesh(pillarCapGeo, pillarMat);
            cap.position.y = 2.08;
            cap.castShadow = !isSoftwareGl;
            cGroup.add(base, col, cap);
          } else if (kind === 'frozen_barrel') {
            const body = new THREE.Mesh(barrelBodyGeo, barrelMat);
            body.position.y = 0.54;
            body.castShadow = !isSoftwareGl;
            body.receiveShadow = true;
            const coreBand = new THREE.Mesh(barrelCoreGeo, barrelGlowMat);
            coreBand.position.y = 0.54;
            const hoopLow = new THREE.Mesh(barrelHoopGeo, crateTrimMat);
            hoopLow.position.y = 0.22;
            const hoopHigh = new THREE.Mesh(barrelHoopGeo, crateTrimMat);
            hoopHigh.position.y = 0.86;
            cGroup.add(body, coreBand, hoopLow, hoopHigh);
          } else {
            const box = new THREE.Mesh(crateBoxGeo, crateMat);
            box.position.y = 0.5;
            box.castShadow = !isSoftwareGl;
            box.receiveShadow = true;
            const band = new THREE.Mesh(crateBandGeo, crateTrimMat);
            band.position.y = 0.5;
            cGroup.add(box, band);
          }
          cratesGroup.add(cGroup);
          crateMeshes.set(cr.id, cGroup);
        }
        cGroup.position.set(toWorldX(cr.x), 0, toWorldZ(cr.y));
        const isHitFlashing = now < (crTyped.hitFlashUntil || 0);
        const dmgRatio = Math.max(0, Math.min(1, cr.hp / maxHp));
        if (kind === 'ice_crate') {
          cGroup.rotation.y += dt * 0.45;
        }
        if (isHitFlashing) {
          cGroup.rotation.z = Math.sin(elapsedTime * 55) * 0.16;
          cGroup.rotation.x = Math.cos(elapsedTime * 48) * 0.12;
          cGroup.scale.set(1.09, 0.88, 1.09);
        } else {
          const lean = cr.hp < maxHp ? 0.065 : 0;
          cGroup.rotation.z = THREE.MathUtils.damp(cGroup.rotation.z, lean, 10, dt);
          cGroup.rotation.x = THREE.MathUtils.damp(cGroup.rotation.x, 0, 10, dt);
          const targetYScale = cr.hp < maxHp ? 0.86 + dmgRatio * 0.12 : 1;
          cGroup.scale.set(
            THREE.MathUtils.damp(cGroup.scale.x, 1, 10, dt),
            THREE.MathUtils.damp(cGroup.scale.y, targetYScale, 10, dt),
            THREE.MathUtils.damp(cGroup.scale.z, 1, 10, dt)
          );
        }
      }
      for (const [id, cg] of crateMeshes.entries()) {
        if (!seenCrateIds.has(id)) {
          cratesGroup.remove(cg);
          crateMeshes.delete(id);
        }
      }

      // Sync Snowballs / Blaster Bolts
      const activeSnowballs = tunnelSnap ? tunnelSnap.snowballs : s.snowballs;
      const seenBallIds = new Set<string>();
      for (const sb of activeSnowballs) {
        seenBallIds.add(sb.id);
        let mesh = snowballMeshes.get(sb.id);
        if (!mesh) {
          const sbTyped = sb as Snowball;
          if (sbTyped.isEnemyOrb) mesh = new THREE.Mesh(blasterBoltGeo, enemyOrbMat);
          else if (sbTyped.isBlaster) mesh = new THREE.Mesh(blasterBoltGeo, blasterBoltMat);
          else mesh = new THREE.Mesh(snowballGeo, snowballMat);
          mesh.castShadow = !isSoftwareGl;
          snowballMeshes.set(sb.id, mesh);
          snowballsGroup.add(mesh);
        }
        mesh.position.set(toWorldX(sb.x), 0.78, toWorldZ(sb.y));
        mesh.rotation.x += dt * 8;
        mesh.rotation.y += dt * 6;
      }
      for (const [id, mesh] of snowballMeshes.entries()) {
        if (!seenBallIds.has(id)) {
          snowballsGroup.remove(mesh);
          snowballMeshes.delete(id);
        }
      }

      // Sync Hazards (Survival)
      const seenHazardIds = new Set<string>();
      if (!tunnelSnap && gm === 'survival') {
        for (const hz of s.hazards) {
          seenHazardIds.add(hz.id);
          let hObj = hazardMeshes.get(hz.id);
          if (!hObj) {
            const group = new THREE.Group();
            const rWorld = hz.radius * WORLD_SCALE;
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(rWorld * 0.84, rWorld, 24),
              new THREE.MeshBasicMaterial({ color: '#f87171', side: THREE.DoubleSide })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.04;
            group.add(ring);

            const spike = new THREE.Mesh(
              new THREE.ConeGeometry(0.42, 2.2, 6),
              new THREE.MeshPhysicalMaterial({
                color: mapIdRef.current === 'volcanic_springs' ? '#fb923c' : '#7dd3fc',
                emissive: '#ef4444',
                emissiveIntensity: 0.45,
                roughness: 0.14,
                transparent: true,
                opacity: 0.88,
              })
            );
            spike.rotation.x = mapIdRef.current === 'volcanic_springs' ? 0 : Math.PI;
            group.add(spike);
            group.position.set(toWorldX(hz.x), 0, toWorldZ(hz.y));
            hazardsGroup.add(group);
            hObj = { group, spike, ring };
            hazardMeshes.set(hz.id, hObj);
          }
          const pct = Math.max(0, hz.timer / hz.maxTimer);
          hObj.spike.position.y =
            mapIdRef.current === 'volcanic_springs' ? 0.5 - pct * 1.4 : 1.1 + pct * 7.5;
          hObj.ring.scale.setScalar(0.5 + (1 - pct) * 0.5);
        }
      }
      for (const [id, hObj] of hazardMeshes.entries()) {
        if (!seenHazardIds.has(id)) {
          hazardsGroup.remove(hObj.group);
          hazardMeshes.delete(id);
        }
      }

      // Spawn & Step Burst Particles + Shockwave Rings
      while (s.pendingBursts.length > 0) {
        const b = s.pendingBursts.pop()!;
        let mat = burstMatCache.get(b.color);
        if (!mat) {
          mat = new THREE.MeshBasicMaterial({ color: b.color });
          burstMatCache.set(b.color, mat);
        }
        for (let i = 0; i < b.count; i++) {
          const m = new THREE.Mesh(burstGeo, mat);
          m.position.set(b.x, 0.6, b.z);
          const a = Math.random() * Math.PI * 2;
          const sp = 2.0 + Math.random() * 4.6;
          burstsGroup.add(m);
          activeBursts.push({
            mesh: m,
            vx: Math.cos(a) * sp,
            vy: 2.5 + Math.random() * 3.5,
            vz: Math.sin(a) * sp,
            life: 0.45,
            maxLife: 0.45,
          });
        }
      }
      for (let i = activeBursts.length - 1; i >= 0; i--) {
        const bp = activeBursts[i];
        bp.life -= dt;
        bp.vy -= 11 * dt;
        bp.mesh.position.x += bp.vx * dt;
        bp.mesh.position.y = Math.max(0.05, bp.mesh.position.y + bp.vy * dt);
        bp.mesh.position.z += bp.vz * dt;
        bp.mesh.scale.setScalar(Math.max(0.01, bp.life / bp.maxLife));
        if (bp.life <= 0) {
          burstsGroup.remove(bp.mesh);
          activeBursts.splice(i, 1);
        }
      }

      while (s.pendingRings.length > 0) {
        const rg = s.pendingRings.pop()!;
        const rMat = new THREE.MeshBasicMaterial({
          color: rg.color,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const rm = new THREE.Mesh(shockRingGeo, rMat);
        rm.position.set(rg.x, 0.05, rg.z);
        rm.scale.setScalar(0.35);
        ringsGroup.add(rm);
        activeRings.push({ mesh: rm, life: 0.42, maxLife: 0.42, maxScale: rg.maxScale });
      }
      for (let i = activeRings.length - 1; i >= 0; i--) {
        const sr = activeRings[i];
        sr.life -= dt;
        const progress = 1 - Math.max(0, sr.life / sr.maxLife);
        sr.mesh.scale.setScalar(0.35 + progress * sr.maxScale);
        (sr.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - progress);
        if (sr.life <= 0) {
          ringsGroup.remove(sr.mesh);
          (sr.mesh.material as THREE.MeshBasicMaterial).dispose();
          activeRings.splice(i, 1);
        }
      }

      // ---- 3. Dynamic Mode-Aware 3D Chase Camera + FOV Speed Cue ----
      let targetCamX = focusX * 0.72;
      let targetCamY = gameStateRef.current === 'TITLE_MENU' ? 16.5 : 15.2;
      let targetCamZ = focusZ * 0.72 + (gameStateRef.current === 'TITLE_MENU' ? 21.0 : 15.8);
      let lookX = focusX * 0.8;
      let lookY = 0.9;
      let lookZ = focusZ * 0.8;

      if (gm === 'car_racing' && chaseYaw !== null && gameStateRef.current !== 'TITLE_MENU') {
        const fwdX = Math.sin(chaseYaw);
        const fwdZ = Math.cos(chaseYaw);
        targetCamX = focusX - fwdX * 8.2;
        targetCamY = 3.85;
        targetCamZ = focusZ - fwdZ * 8.2;
        lookX = focusX + fwdX * 4.6;
        lookY = 1.0;
        lookZ = focusZ + fwdZ * 4.6;
      }

      const camLambda = gm === 'car_racing' ? 10.5 : 8.5;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, camLambda, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, camLambda, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, camLambda, dt);

      if (s.shake > 0.02) {
        camera.position.x += (Math.random() - 0.5) * s.shake;
        camera.position.y += (Math.random() - 0.5) * s.shake;
      }

      const targetFov =
        gm === 'car_racing' ? (playerBoosted ? 58 : 50) : playerBoosted ? 53 : 48;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 7, dt);
        camera.updateProjectionMatrix();
      }

      smoothLookX = THREE.MathUtils.damp(smoothLookX, lookX, 12, dt);
      smoothLookY = THREE.MathUtils.damp(smoothLookY, lookY, 12, dt);
      smoothLookZ = THREE.MathUtils.damp(smoothLookZ, lookZ, 12, dt);
      _v3B.set(smoothLookX, smoothLookY, smoothLookZ);
      camera.lookAt(_v3B);

      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    if (isSoftwareGl) afterDraw(tick);
    else frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onCanvasPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onCanvasPointerDown);
      window.removeEventListener('pointerup', onCanvasPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      crateBoxGeo.dispose();
      crateBandGeo.dispose();
      pillarCoreGeo.dispose();
      pillarCapGeo.dispose();
      pillarBaseGeo.dispose();
      barrelBodyGeo.dispose();
      barrelHoopGeo.dispose();
      barrelCoreGeo.dispose();
      crateMat.dispose();
      crateTrimMat.dispose();
      pillarMat.dispose();
      barrelMat.dispose();
      barrelGlowMat.dispose();
      burstGeo.dispose();
      shockRingGeo.dispose();
      burstMatCache.forEach((mat) => mat.dispose());
      burstMatCache.clear();
      envTex.dispose();
      renderer.dispose();
    };
  }, [
    damageDestructibleProp,
    finishSoloMatch,
    flashBanner,
    queueBurst,
    queueRing,
    spawnCrate,
    spawnPickup,
    spawnShooterWave,
    triggerThrowOrFire,
    triggerWellRitualBlessing,
    updateTaskProgress,
  ]);

  const toggleMute = () => {
    soundEngine.muted = !muted;
    setMuted(!muted);
  };

  const handleClaimSummary = async () => {
    if (!summary || claimStatus !== 'idle') return;
    setClaimStatus('claiming');
    await onRecordRun(summary);
    setClaimStatus('claimed');
  };

  const handleExitToLanding = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
    onReturnHome();
  }, [onReturnHome]);

  useEffect(() => {
    if (autoLaunchMode === 'tunnel') {
      onChangeGameMode('survival');
      startGame('tunnel', 'survival');
      onAutoLaunchHandled?.();
    } else if (autoLaunchMode === 'choose_map') {
      openGameMapLauncher('choose_map');
      onAutoLaunchHandled?.();
    } else if (autoLaunchMode === 'launcher') {
      openGameMapLauncher('choose_game');
      onAutoLaunchHandled?.();
    }
  }, [autoLaunchMode, onAutoLaunchHandled, onChangeGameMode, openGameMapLauncher, startGame]);

  const activeMap = getMapSpec(selectedMapId);
  const activeGame = getGameModeSpec(selectedGameMode);

  return (
    <div className="space-y-3">
      {/* Main 3D WebGL Game Viewport */}
      <div
        ref={viewportRef}
        className="relative overflow-hidden rounded-2xl border-2 border-sky-400/30 bg-[#050E1C] shadow-[0_24px_60px_rgba(2,8,20,0.75)] aspect-[16/9]"
      >
        <div ref={mountRef} className="w-full h-full cursor-crosshair select-none touch-none" />

        {/* IN-VIEWPORT ARCADE MINI-HUD & LIFE BARS */}
        {gameState === 'PLAYING' && (
          <>
            {/* Top-Left: Life Bar + Nitro/Ability + Power-Ups + Mission Pips */}
            <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-1.5 arcade-hud px-3 py-2.5 min-w-[218px]">
              <div className="flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-wider text-slate-100">
                <span className="inline-flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-rose-400 fill-rose-400" />
                  {selectedGameMode === 'car_racing' ? 'Hull' : 'Life'}
                </span>
                <span className="font-mono text-xs text-white tabular-nums">
                  {hud.hp}/{hud.maxHp}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-white/15">
                <div
                  className={`h-full transition-all duration-150 ${
                    hud.hp > 55
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                      : hud.hp > 28
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                      : 'bg-gradient-to-r from-rose-600 to-orange-500'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100))}%` }}
                />
              </div>

              {selectedGameMode === 'car_racing' ? (
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                    <span className="inline-flex items-center gap-1">
                      <Zap className="h-3 w-3 text-cyan-400" /> Nitro
                    </span>
                    <span className="font-mono tabular-nums">{hud.nitroPct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-950">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-cyan-300 transition-all duration-100"
                      style={{ width: `${hud.nitroPct}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider pt-0.5">
                  <span className={hud.novaReady || hud.dashReady ? 'text-cyan-300' : 'text-slate-400'}>
                    {selectedGameMode === 'shooting'
                      ? hud.novaReady
                        ? 'Nova Ready'
                        : 'Nova Charging'
                      : hud.dashReady
                      ? 'Dash Ready'
                      : 'Dash Charging'}
                  </span>
                  <span className="arcade-kbd">SPACE</span>
                </div>
              )}

              {(hud.shieldSec > 0 || hud.boostSec > 0 || hud.magnetSec > 0 || hud.tripleSec > 0) && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {hud.shieldSec > 0 && (
                    <span className="inline-flex items-center gap-1 rounded bg-cyan-500/20 border border-cyan-400/50 px-1.5 py-0.5 text-[10px] font-bold text-cyan-200 tabular-nums">
                      <Shield className="h-2.5 w-2.5" /> {hud.shieldSec}s
                    </span>
                  )}
                  {hud.boostSec > 0 && (
                    <span className="inline-flex items-center gap-1 rounded bg-teal-500/20 border border-teal-400/50 px-1.5 py-0.5 text-[10px] font-bold text-teal-200 tabular-nums">
                      <Flame className="h-2.5 w-2.5" /> {hud.boostSec}s
                    </span>
                  )}
                  {hud.magnetSec > 0 && (
                    <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 border border-rose-400/50 px-1.5 py-0.5 text-[10px] font-bold text-rose-200 tabular-nums">
                      <Magnet className="h-2.5 w-2.5" /> {hud.magnetSec}s
                    </span>
                  )}
                  {hud.tripleSec > 0 && (
                    <span className="inline-flex items-center gap-1 rounded bg-purple-500/20 border border-purple-400/50 px-1.5 py-0.5 text-[10px] font-bold text-purple-200 tabular-nums">
                      <Sparkles className="h-2.5 w-2.5" /> 3× {hud.tripleSec}s
                    </span>
                  )}
                </div>
              )}

              {/* Compact Mission Pips */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-white/10 text-[10px] font-mono tabular-nums">
                {tasks.map((t, idx) => (
                  <span
                    key={t.id}
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 border ${
                      t.completed
                        ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                        : 'border-slate-700 bg-slate-900/90 text-slate-300'
                    }`}
                  >
                    {t.completed ? (
                      <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                    ) : (
                      <Target className="h-2.5 w-2.5 text-sky-400" />
                    )}
                    M{idx + 1} {t.progress}/{t.target}
                  </span>
                ))}
              </div>
            </div>

            {/* Top-Center: Crisp Arcade Scoreboard Strip */}
            <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-20 hidden sm:flex items-center gap-3.5 arcade-hud px-4 py-2 text-xs tabular-nums whitespace-nowrap">
              <span className="font-mono font-bold text-sm text-white">{formatClock(hud.timeLeft)}</span>
              <span className="text-slate-600">·</span>
              <span className="font-mono font-bold text-sky-300">{hud.score} PTS</span>
              <span className="text-slate-600">·</span>
              {selectedGameMode === 'car_racing' ? (
                <>
                  <span className="font-bold text-cyan-200">
                    LAP {hud.lap}/{hud.totalLaps}
                  </span>
                  <span className="font-bold text-amber-300">
                    CP {hud.checkpoint}/{hud.totalCheckpoints}
                  </span>
                  <span className="font-mono font-bold text-white">#{hud.racePos}/4</span>
                  <span className="font-mono text-slate-300">{hud.speedKmh} km/h</span>
                  {hud.offRoad && (
                    <span className="rounded bg-amber-500/25 border border-amber-400/50 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                      OFF-ROAD
                    </span>
                  )}
                </>
              ) : selectedGameMode === 'shooting' ? (
                <>
                  <span className="font-bold text-cyan-200">W{hud.wave}</span>
                  <span className="font-bold text-white">{hud.elims} KO</span>
                  <span className="font-bold text-amber-300">{hud.combo}×</span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 font-bold text-cyan-200">
                    <Droplets className="h-3.5 w-3.5" /> {hud.wellDrops}
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-sky-200">
                    <Gem className="h-3.5 w-3.5" /> {hud.frostGems}
                  </span>
                  <span className="font-bold text-slate-300">W{hud.wave}</span>
                </>
              )}
            </div>

            {/* Top-Right: Arcade Quick Controls */}
            <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
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
                  if (playMode === 'solo') setGameState('PAUSED');
                  else openGameMapLauncher('choose_game');
                }}
                className="arcade-hud inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-sky-200 hover:border-sky-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Menu className="h-3.5 w-3.5 text-sky-400" />
                Menu
              </button>

              {playMode === 'solo' && (
                <button
                  type="button"
                  onClick={() => setGameState('PAUSED')}
                  aria-label="Pause game"
                  className="arcade-hud inline-flex items-center justify-center p-1.5 text-slate-100 hover:border-sky-400 cursor-pointer"
                >
                  <Pause className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                className="arcade-hud inline-flex items-center justify-center p-1.5 text-slate-100 hover:border-sky-400 cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                className="arcade-hud inline-flex items-center justify-center p-1.5 text-slate-100 hover:border-sky-400 cursor-pointer"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>

            {/* Bottom-Left: Real-Time Mini-Map Overlay Component */}
            <ArenaMiniMap
              gameMode={selectedGameMode}
              mapId={selectedMapId}
              dots={minimapData.dots}
              ringRadius={minimapData.ringRadius}
              playerAngle={minimapData.playerAngle}
              nextCheckpoint={minimapData.nextCheckpoint}
              checkpointsCleared={minimapData.checkpointsCleared}
              totalCheckpoints={hud.totalCheckpoints}
            />
          </>
        )}

        {bannerMsg && gameState === 'PLAYING' && (
          <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-20 arcade-hud border-sky-400/60 px-4 py-1.5 text-xs font-bold text-sky-200">
            {bannerMsg}
          </div>
        )}

        {gameState === 'PLAYING' &&
          selectedGameMode === 'car_racing' &&
          hud.countdown > 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
              <div className="title-3d-game text-6xl sm:text-7xl">{hud.countdown}</div>
            </div>
          )}

        {gameState === 'PLAYING' &&
          selectedGameMode === 'survival' &&
          (hud.blessingLeft > 0 || (hud.nearWell && hud.ritualReady)) && (
            <div
              className={`pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-10 arcade-hud px-3.5 py-1.5 text-xs font-bold ${
                hud.blessingLeft > 0
                  ? 'border-amber-400/60 text-amber-200'
                  : 'border-cyan-400/55 text-cyan-200'
              }`}
            >
              {hud.blessingLeft > 0
                ? `2× Blessing (${hud.blessingLeft}s)`
                : 'Near Well: [1] Wave · [2] Dance'}
            </div>
          )}

        {webglFallback && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#081322] p-6 text-center space-y-3">
            <p className="title-3d-game-sm text-2xl">Lofi Yeti Arcade</p>
            <p className="text-xs text-slate-400 max-w-md">
              Enable hardware WebGL or refresh to launch the 3D arena.
            </p>
          </div>
        )}

        {/* GAMISH TWO-STEP LAUNCHER OVERLAY (ZERO TEXT WALLS, ZERO BACKDROP-BLUR) */}
        {gameState === 'TITLE_MENU' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#040B16]/80 p-3 sm:p-5 overflow-y-auto">
            <div className="w-full max-w-4xl arcade-panel p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-400/15 pb-3.5">
                <div className="flex items-center gap-3">
                  <h2 className="title-3d-game text-2xl sm:text-4xl leading-none">
                    Lofi Arena
                  </h2>
                  <span className="rounded bg-sky-500/15 border border-sky-400/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                    {launcherStep === 'choose_game' ? '1 · Game' : `2 · ${activeGame.shortLabel}`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExitToLanding}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-sky-400 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Home className="h-3.5 w-3.5 text-sky-400" />
                    Home
                  </button>
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-200 hover:border-sky-400 cursor-pointer"
                  >
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </button>
                  {launcherStep === 'choose_map' && (
                    <button
                      type="button"
                      onClick={() => setLauncherStep('choose_game')}
                      className="inline-flex items-center gap-1 rounded-lg border border-sky-400/40 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-200 hover:bg-sky-500/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      All Games
                    </button>
                  )}
                </div>
              </div>

              {launcherStep === 'choose_game' ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    {GAME_MODES.filter((g) => g.dimension === '3D').map((gm) => {
                      const Icon =
                        gm.id === 'car_racing' ? Car : gm.id === 'shooting' ? Crosshair : Snowflake;
                      const isSel = selectedGameMode === gm.id;
                      const grad =
                        gm.id === 'car_racing'
                          ? 'from-cyan-500/25 via-sky-500/10 to-slate-900'
                          : gm.id === 'shooting'
                          ? 'from-indigo-500/25 via-sky-500/10 to-slate-900'
                          : 'from-sky-400/25 via-cyan-500/10 to-slate-900';
                      const quickTag =
                        gm.id === 'car_racing'
                          ? '3 Laps · 4 Checkpoints'
                          : gm.id === 'shooting'
                          ? 'Frost Blaster · Waves'
                          : 'Snowballs · Well Shrine';
                      return (
                        <button
                          key={gm.id}
                          type="button"
                          onClick={() => {
                            onChangeGameMode(gm.id);
                            setLauncherStep('choose_map');
                          }}
                          className={`group flex flex-col justify-between rounded-xl border-2 overflow-hidden text-left transition-all cursor-pointer ${
                            isSel
                              ? 'border-sky-400 bg-sky-500/15 shadow-[0_0_24px_rgba(56,189,248,0.22)]'
                              : 'border-slate-700/80 bg-slate-900/90 hover:border-sky-400/60'
                          }`}
                        >
                          <div className={`w-full bg-gradient-to-br ${grad} px-4 py-3.5 border-b border-white/10 flex items-center justify-between`}>
                            <Icon className="h-7 w-7 text-sky-300" />
                            <span className="rounded bg-slate-950/70 border border-sky-400/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-200">
                              3D
                            </span>
                          </div>
                          <div className="p-3.5 space-y-2">
                            <h3 className="font-display text-xl text-white leading-tight">{gm.name}</h3>
                            <div className="flex items-center justify-between text-[11px] font-semibold text-sky-300">
                              <span>{quickTag}</span>
                              <span>Pick Map →</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick 2D Stickman Games Switcher */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3.5 py-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      2D Stickman Games
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {GAME_MODES.filter((g) => g.dimension === '2D').map((gm) => (
                        <button
                          key={gm.id}
                          type="button"
                          onClick={() => onChangeGameMode(gm.id)}
                          className="rounded-lg border border-amber-400/45 bg-[#081322] px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-400 hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {gm.shortLabel}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Colorway Swatches + Mint Link */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Yeti: {getYetiColorway(selectedColorway).name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {YETI_COLORWAYS.map((cw) => (
                          <button
                            key={cw.id}
                            type="button"
                            onClick={() => onChangeColorway(cw.id)}
                            title={cw.name}
                            className={`h-6 w-6 rounded-md border-2 transition-transform cursor-pointer ${
                              selectedColorway === cw.id
                                ? 'border-white scale-110'
                                : 'border-slate-700 opacity-75 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: cw.skinHex }}
                          />
                        ))}
                      </div>
                    </div>

                    {!yeti && (
                      <button
                        type="button"
                        onClick={onMintPrompt}
                        className="text-xs font-bold text-sky-400 hover:text-sky-300 underline underline-offset-4 cursor-pointer"
                      >
                        Mint Starter Yeti
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Quick 3D Mode Tabs */}
                  <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/80 p-1.5">
                    {GAME_MODES.filter((g) => g.dimension === '3D').map((gm) => {
                      const Icon =
                        gm.id === 'car_racing' ? Car : gm.id === 'shooting' ? Crosshair : Snowflake;
                      return (
                        <button
                          key={gm.id}
                          type="button"
                          onClick={() => onChangeGameMode(gm.id)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            selectedGameMode === gm.id
                              ? 'bg-sky-400 text-slate-950'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {gm.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* Visual Biome Map Selector Cards */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    {ARENA_MAPS.map((m) => {
                      const modeInfo = getMapModeDetails(m.id, selectedGameMode);
                      const biomeGrad =
                        m.id === 'volcanic_springs'
                          ? 'from-orange-500/45 via-amber-500/20 to-slate-900'
                          : m.id === 'aurora_summit'
                          ? 'from-violet-500/45 via-fuchsia-500/20 to-slate-900'
                          : 'from-cyan-500/45 via-sky-500/20 to-slate-900';
                      const isMapSel = selectedMapId === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onChangeMapId(m.id)}
                          className={`overflow-hidden rounded-xl border-2 text-left transition-all cursor-pointer ${
                            isMapSel
                              ? 'border-sky-400 bg-sky-500/15 shadow-[0_0_20px_rgba(56,189,248,0.2)]'
                              : 'border-slate-700/80 bg-slate-900/90 hover:border-slate-500'
                          }`}
                        >
                          <div className={`h-11 w-full bg-gradient-to-r ${biomeGrad} px-3 flex items-center justify-between border-b border-white/10`}>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-950/75" style={{ color: m.accentHex }}>
                              {modeInfo.tag}
                            </span>
                            {isMapSel && (
                              <span className="text-[10px] font-bold uppercase text-sky-300">Selected</span>
                            )}
                          </div>
                          <div className="p-3 space-y-1">
                            <span className="font-display text-lg text-white block leading-tight">{m.name}</span>
                            <span className="text-[11px] font-medium text-slate-400 block truncate">
                              {m.subtitle}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Action Bar + Visual Keycap Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-sky-400/15">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <span className="arcade-kbd">WASD</span> Move
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="arcade-kbd">SPACE</span>{' '}
                        {selectedGameMode === 'car_racing'
                          ? 'Nitro'
                          : selectedGameMode === 'shooting'
                          ? 'Nova'
                          : 'Dash'}
                      </span>
                      {selectedGameMode !== 'car_racing' && (
                        <span className="inline-flex items-center gap-1">
                          <span className="arcade-kbd">CLICK</span>{' '}
                          {selectedGameMode === 'shooting' ? 'Fire' : 'Throw'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {activeGame.supportsTunnel && (
                        <button
                          type="button"
                          onClick={() => startGame('tunnel', selectedGameMode)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/45 bg-sky-500/15 px-3.5 py-2.5 text-xs font-bold text-sky-200 hover:bg-sky-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Users className="h-4 w-4" />
                          Live Tunnel
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startGame('solo', selectedGameMode)}
                        className="arcade-btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Play className="h-4 w-4 fill-current" />
                        Play Now
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PAUSED / IN-FULLSCREEN GAME MENU OVERLAY */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#040B16]/82 p-6">
            <div className="w-full max-w-sm arcade-panel p-6 text-center space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                  Paused
                </p>
                <h3 className="title-3d-game-sm text-3xl mt-1">Lofi Arena</h3>
              </div>
              <p className="text-xs font-semibold text-slate-300">
                {activeGame.shortLabel} · {activeMap.name}
              </p>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setGameState('PLAYING')}
                  className="arcade-btn-primary inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Resume
                </button>
                <button
                  type="button"
                  onClick={() => startGame(playMode, selectedGameMode)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restart
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  {isFullscreen ? 'Window' : 'Fullscreen'}
                </button>
                <button
                  type="button"
                  onClick={() => openGameMapLauncher('choose_game')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-4 py-2.5 text-xs font-bold text-sky-200 hover:bg-sky-500/25 transition-colors cursor-pointer"
                >
                  <Menu className="h-3.5 w-3.5" />
                  Switch Game
                </button>
                <button
                  type="button"
                  onClick={handleExitToLanding}
                  className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-200 hover:border-sky-400 hover:text-white transition-colors cursor-pointer"
                >
                  <Home className="h-3.5 w-3.5 text-sky-400" />
                  Return Home
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GAME OVER / RUN SUMMARY OVERLAY */}
        {gameState === 'GAME_OVER' && summary && (
          <ArenaGameOverOverlay
            summary={summary}
            lifeDepleted={lifeDepleted}
            claimStatus={claimStatus}
            onClaimSummary={handleClaimSummary}
            onRestart={() => startGame(playMode, summary.gameMode)}
            onReturnToMenu={() => openGameMapLauncher('choose_game')}
            onReturnHome={handleExitToLanding}
            onShare={() => onShareRun(summary)}
          />
        )}
      </div>

      {/* Compact Single-Row Arcade Console Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 arcade-hud px-3.5 py-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Move Left"
              onPointerDown={() => (touchDirRef.current.dx = -1)}
              onPointerUp={() => (touchDirRef.current.dx = 0)}
              onPointerLeave={() => (touchDirRef.current.dx = 0)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200 active:bg-sky-500 active:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Move Up"
              onPointerDown={() => (touchDirRef.current.dy = -1)}
              onPointerUp={() => (touchDirRef.current.dy = 0)}
              onPointerLeave={() => (touchDirRef.current.dy = 0)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200 active:bg-sky-500 active:text-slate-950"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Move Down"
              onPointerDown={() => (touchDirRef.current.dy = 1)}
              onPointerUp={() => (touchDirRef.current.dy = 0)}
              onPointerLeave={() => (touchDirRef.current.dy = 0)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200 active:bg-sky-500 active:text-slate-950"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Move Right"
              onPointerDown={() => (touchDirRef.current.dx = 1)}
              onPointerUp={() => (touchDirRef.current.dx = 0)}
              onPointerLeave={() => (touchDirRef.current.dx = 0)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200 active:bg-sky-500 active:text-slate-950"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/90 px-2 py-1">
            {YETI_COLORWAYS.map((cw) => (
              <button
                key={cw.id}
                type="button"
                title={cw.name}
                onClick={() => onChangeColorway(cw.id)}
                className={`h-5 w-5 rounded border transition-transform cursor-pointer ${
                  selectedColorway === cw.id
                    ? 'border-white scale-110'
                    : 'border-slate-700 opacity-75 hover:opacity-100'
                }`}
                style={{ backgroundColor: cw.skinHex }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedGameMode === 'survival' && (
            <>
              <button
                type="button"
                onClick={() => triggerEmote('wave')}
                disabled={gameState !== 'PLAYING'}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs font-bold text-slate-200 hover:border-sky-400 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Hand className="h-3.5 w-3.5 text-amber-300" />
                Wave <span className="arcade-kbd">E</span>
              </button>
              <button
                type="button"
                onClick={() => triggerEmote('dance')}
                disabled={gameState !== 'PLAYING'}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs font-bold text-slate-200 hover:border-sky-400 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Music className="h-3.5 w-3.5 text-cyan-300" />
                Dance <span className="arcade-kbd">F</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={triggerDashOrSpecial}
            disabled={
              gameState !== 'PLAYING' ||
              (selectedGameMode === 'survival'
                ? !hud.dashReady
                : selectedGameMode === 'shooting'
                ? !hud.novaReady
                : hud.nitroPct < 22)
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sky-500/45 bg-sky-500/15 px-3 text-xs font-bold text-sky-200 hover:bg-sky-500/25 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Wind className="h-3.5 w-3.5" />
            {selectedGameMode === 'car_racing'
              ? 'Nitro'
              : selectedGameMode === 'shooting'
              ? 'Nova'
              : 'Dash'}
            <span className="arcade-kbd">SPACE</span>
          </button>

          {selectedGameMode !== 'car_racing' && (
            <button
              type="button"
              onClick={() => triggerThrowOrFire()}
              disabled={gameState !== 'PLAYING'}
              className="arcade-btn-primary inline-flex h-9 items-center gap-1.5 px-3.5 text-xs disabled:opacity-45 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {selectedGameMode === 'shooting' ? (
                <>
                  <Crosshair className="h-3.5 w-3.5" />
                  Blast
                </>
              ) : (
                <>
                  <Snowflake className="h-3.5 w-3.5" />
                  Throw
                </>
              )}
              <span className="arcade-kbd bg-slate-950/80 text-sky-200 border-slate-800">J</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
