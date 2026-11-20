import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Droplets,
  Flame,
  Gem,
  Heart,
  Home,
  Maximize2,
  Menu,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Trophy,
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
  drawPowerUpIcon,
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
const RING_LEFT = 175;
const RING_RIGHT = 1025;
const RING_FLOOR = 535;
const BRAWL_FLOOR = 565;

const BRAWL_PLATFORMS = [
  { x: 170, y: 425, w: 230 },
  { x: 485, y: 335, w: 230 },
  { x: 800, y: 425, w: 230 },
];

const WRESTLE_CHALLENGERS = [
  { name: 'Baron Basalt', stroke: '#fb923c', accent: '#facc15', maxHp: 115, speed: 235, aggro: 0.7 },
  { name: 'Kodiak Frost', stroke: '#38bdf8', accent: '#c084fc', maxHp: 135, speed: 265, aggro: 0.84 },
  { name: 'Mask of Aurora', stroke: '#f43f5e', accent: '#fde047', maxHp: 165, speed: 290, aggro: 0.96 },
];

interface FighterEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
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
  kind: 'spike' | 'icicle' | 'crate';
  hp: number;
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
    timeLeft: 160,
    shieldLeft: 0,
    rageLeft: 0,
    magnetLeft: 0,
    pinCount: 0,
    pinPossible: false,
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
    ropeLeftBend: number;
    ropeRightBend: number;
    pinActive: boolean;
    pinTimer: number;
    pinCount: number;
    pickupSpawnTimer: number;
    waveSpawnTimer: number;
    runnerSpeed: number;
    runnerScroll: number;
    player: FighterEntity;
    enemies: FighterEntity[];
    pickups: Pickup2D[];
    projectiles: Projectile2D[];
    particles: Particle2D[];
    runnerPlatforms: RunnerPlatform[];
    runnerHazards: RunnerHazard[];
    banner: FloatingBanner | null;
    ambientFlakes: { x: number; y: number; s: number; spd: number }[];
  } | null>(null);

  const makeInitialFighter = (isPlayer: boolean, floorY: number): FighterEntity => ({
    x: isPlayer ? 360 : 840,
    y: floorY,
    vx: 0,
    vy: 0,
    facing: isPlayer ? 1 : -1,
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
    finisher: isPlayer ? 25 : 0,
    shieldUntil: 0,
    rageUntil: 0,
    magnetUntil: 0,
    dropThroughUntil: 0,
    stunnedUntil: 0,
    ropeBoostUntil: 0,
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
        vy: Math.sin(a) * spd - 60,
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

  const spawnWrestlingChallenger = (boutIndex: number): FighterEntity => {
    const spec = WRESTLE_CHALLENGERS[Math.min(WRESTLE_CHALLENGERS.length - 1, boutIndex - 1)];
    const f = makeInitialFighter(false, RING_FLOOR);
    f.x = 840;
    f.hp = spec.maxHp;
    f.maxHp = spec.maxHp;
    f.name = spec.name;
    f.stroke = spec.stroke;
    f.accent = spec.accent;
    f.colorway = YETI_COLORWAYS[(boutIndex - 1) % YETI_COLORWAYS.length].id;
    f.speed = spec.speed;
    f.aggro = spec.aggro;
    f.isBoss = true;
    f.aiCooldown = 0.6;
    return f;
  };

  const spawnBrawlWave = (wave: number): FighterEntity[] => {
    const list: FighterEntity[] = [];
    const count = Math.min(4, 1 + Math.ceil(wave * 0.75));
    const isBossWave = wave % 3 === 0;
    for (let i = 0; i < count; i++) {
      const fromRight = i % 2 === 0;
      const f = makeInitialFighter(false, BRAWL_FLOOR);
      f.x = fromRight ? 1090 - i * 45 : 110 + i * 45;
      f.facing = fromRight ? -1 : 1;
      const boss = isBossWave && i === 0;
      f.isBoss = boss;
      f.maxHp = boss ? 130 + wave * 12 : 42 + wave * 6;
      f.hp = f.maxHp;
      f.name = boss ? `Glacier Brute Lv.${wave}` : i % 2 === 0 ? 'Frost Ninja' : 'Ember Stick';
      f.stroke = boss ? '#a855f7' : i % 2 === 0 ? '#fb7185' : '#fb923c';
      f.accent = boss ? '#fde047' : '#38bdf8';
      f.colorway = boss ? 'golden_frost' : i % 2 === 0 ? 'aurora_violet' : 'sunset_ember';
      f.speed = boss ? 165 : 210 + Math.min(70, wave * 8);
      f.aggro = 0.6 + Math.min(0.35, wave * 0.04);
      f.aiCooldown = 0.45 + i * 0.25;
      list.push(f);
    }
    return list;
  };

  const initMatchState = useCallback((mode: GameModeId, mapId: MapId) => {
    const floor = mode === 'stickman_wrestling' ? RING_FLOOR : BRAWL_FLOOR;
    const player = makeInitialFighter(true, floor);
    if (mode === 'stickman_run') {
      player.x = 240;
      player.y = 470;
    }

    const ambientFlakes = Array.from({ length: 42 }, () => ({
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H,
      s: 1.5 + Math.random() * 2.5,
      spd: 35 + Math.random() * 65,
    }));

    const enemies =
      mode === 'stickman_wrestling'
        ? [spawnWrestlingChallenger(1)]
        : mode === 'stickman_brawl'
        ? spawnBrawlWave(1)
        : [];

    const runnerPlatforms: RunnerPlatform[] =
      mode === 'stickman_run'
        ? [
            { x: 0, y: 470, w: 680 },
            { x: 760, y: 440, w: 460 },
            { x: 1300, y: 390, w: 360 },
            { x: 1740, y: 470, w: 540 },
          ]
        : [];

    const totalTime = mode === 'stickman_wrestling' ? 180 : 150;

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
      ropeLeftBend: 0,
      ropeRightBend: 0,
      pinActive: false,
      pinTimer: 0,
      pinCount: 0,
      pickupSpawnTimer: 3.5,
      waveSpawnTimer: 0,
      runnerSpeed: 370,
      runnerScroll: 0,
      player,
      enemies,
      pickups: [],
      projectiles: [],
      particles: [],
      runnerPlatforms,
      runnerHazards: [],
      banner: null,
      ambientFlakes,
    };

    if (mode === 'stickman_wrestling') {
      soundEngine.playBell(2);
      showBanner('BOUT 1: BARON BASALT', 'Ding! Ding! Strike (J), Suplex (K), Pin (E)', '#fbbf24', 2200);
    } else if (mode === 'stickman_brawl') {
      soundEngine.playBell(1);
      showBanner('LEVEL 1: FROST BRAWL', 'Chain combos & collect Drops + Power-Ups!', '#38bdf8', 2000);
    } else {
      soundEngine.playBoost();
      showBanner('LEVEL 1: GLACIER RUN!', 'Double-Jump (W/Space), Slide (S), Blast Crates (J)', '#2dd4bf', 2000);
    }

    setSummary(null);
    setClaimStatus('idle');
    setPhase('PLAYING');
  }, []);

  const finishMatch = useCallback((victory: boolean) => {
    const st = stateRef.current;
    if (!st || st.phase === 'GAME_OVER') return;
    st.phase = 'GAME_OVER';
    setPhase('GAME_OVER');

    soundEngine.playRoundEnd(victory);
    if (st.mode === 'stickman_wrestling') soundEngine.playBell(victory ? 3 : 1);

    const cleanDrops = Math.max(1, st.drops + (victory ? 8 : 2));
    const cleanGems = Math.max(1, st.gems + (victory ? 5 : 1));
    const cleanScore = Math.max(50, Math.round(st.score + (victory ? 350 : 0)));
    const tasksDone = Math.min(
      3,
      (st.hitsLanded >= 8 ? 1 : 0) +
        (cleanDrops >= 6 ? 1 : 0) +
        (st.knockouts >= 2 || st.cratesSmashed >= 4 ? 1 : 0)
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
      totalContenders: st.mode === 'stickman_wrestling' ? 4 : 6,
      xpEarned: Math.round(cleanScore / 5) + 25 + tasksDone * 20,
      extraStatLabel:
        st.mode === 'stickman_wrestling'
          ? 'Bouts Cleared'
          : st.mode === 'stickman_brawl'
          ? 'Level Reached'
          : 'Distance (m)',
      extraStatValue:
        st.mode === 'stickman_run'
          ? `${Math.round(st.runnerScroll / 16)}m`
          : `${st.waveOrBout}`,
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

  // Smooth Responsive Action Triggers with Jump Buffering & Coyote Time
  const triggerAction = useCallback((action: 'jump' | 'jab' | 'heavy' | 'special' | 'dash' | 'pin' | 'wave') => {
    const st = stateRef.current;
    if (!st || st.phase !== 'PLAYING') return;
    const p = st.player;
    const now = performance.now();

    if (action === 'jump') {
      if (st.mode === 'stickman_run') {
        if (p.grounded || p.coyoteTimer > 0 || p.jumpsLeft > 0) {
          const isFirstJump = p.grounded || p.coyoteTimer > 0;
          p.vy = isFirstJump ? -645 : -565;
          p.grounded = false;
          p.coyoteTimer = 0;
          p.jumpsLeft = isFirstJump ? 1 : 0;
          p.pose = 'jump';
          soundEngine.playDash();
          spawnParticles(p.x, p.y, '#bae6fd', 6, 120);
        } else {
          p.jumpBufferTimer = 0.14;
        }
        return;
      }

      if (p.grounded || p.coyoteTimer > 0 || p.jumpsLeft > 0) {
        const isFirstJump = p.grounded || p.coyoteTimer > 0;
        const nearTurnbuckle =
          st.mode === 'stickman_wrestling' &&
          (p.x < RING_LEFT + 65 || p.x > RING_RIGHT - 65);
        p.vy = nearTurnbuckle ? -780 : isFirstJump ? -630 : -555;
        p.grounded = false;
        p.coyoteTimer = 0;
        p.jumpsLeft = isFirstJump ? 1 : 0;
        p.dashTimer = 0;
        p.pose = nearTurnbuckle ? 'finisher' : 'jump';
        if (nearTurnbuckle) {
          p.actionTimer = 0.52;
          p.actionDuration = 0.52;
          p.hasHitCurrentSwing = false;
          showBanner('TURNBUCKLE FROG SPLASH!', undefined, '#38bdf8', 900);
        }
        soundEngine.playDash();
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
      if (p.stamina < 18 || p.dashCooldown > 0) return;
      p.stamina = Math.max(0, p.stamina - 20);
      p.dashTimer = 0.18;
      p.dashCooldown = 0.36;
      p.actionTimer = 0;
      p.vx = p.facing * 680;
      p.invulnTimer = Math.max(p.invulnTimer, 0.22);
      p.ropeBoostUntil = now + 900;
      soundEngine.playDash();
      spawnParticles(p.x, p.y - 30, '#38bdf8', 8, 160);
      return;
    }

    if (st.mode === 'stickman_run') {
      if (action === 'jab' || action === 'heavy' || action === 'special') {
        if (p.hitCooldown > 0) return;
        p.hitCooldown = 0.22;
        p.pose = 'jab';
        p.actionTimer = 0.18;
        p.actionDuration = 0.18;
        st.projectiles.push({
          x: p.x + 28,
          y: p.y - 48,
          vx: 820,
          vy: 0,
          owner: 'player',
          color: '#67e8f9',
          radius: 10,
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

    // Allow snappy chaining once past active strike swing (> 0.05s remaining cancels cleanly!)
    if (p.actionTimer > 0.09) return;

    if (action === 'jab') {
      p.pose = 'jab';
      p.actionTimer = 0.18;
      p.actionDuration = 0.18;
      p.hasHitCurrentSwing = false;
      p.vx += p.facing * 110; // responsive forward step-in
      soundEngine.playPunch(false);
    } else if (action === 'heavy') {
      if (st.mode === 'stickman_wrestling') {
        const target = st.enemies[0];
        if (target && Math.abs(target.x - p.x) < 108 && Math.abs(target.y - p.y) < 82) {
          if (target.hp <= 38 && target.stunnedUntil > now) {
            st.pinActive = true;
            st.pinTimer = 0;
            st.pinCount = 0;
            p.pose = 'pin';
            p.x = target.x - p.facing * 24;
            soundEngine.playPinTick(1);
            return;
          }
          p.pose = 'suplex';
          p.actionTimer = 0.46;
          p.actionDuration = 0.46;
          p.invulnTimer = 0.48;
          target.pose = 'hurt';
          target.actionTimer = 0.5;
          target.actionDuration = 0.5;
          target.x = Math.max(RING_LEFT + 35, Math.min(RING_RIGHT - 35, p.x - p.facing * 75));
          target.vy = -420;
          target.grounded = false;
          const dmg = now < p.rageUntil ? 34 : 24;
          target.hp = Math.max(0, target.hp - dmg);
          target.flashTimer = 0.2;
          target.stunnedUntil = now + 2600;
          st.hitsLanded += 1;
          st.combo += 1;
          st.comboTimer = 2.6;
          st.score += 65 + st.combo * 10;
          p.finisher = Math.min(100, p.finisher + 22);
          st.shake = 12;
          soundEngine.playSlam();
          spawnParticles(target.x, RING_FLOOR - 12, '#fbbf24', 16, 260);
          showBanner('OVERHEAD YETI SUPLEX!', `-${dmg} HP · STUNNED`, '#fbbf24', 1100);
          return;
        }
      }
      p.pose = 'heavy';
      p.actionTimer = 0.28;
      p.actionDuration = 0.28;
      p.hasHitCurrentSwing = false;
      p.vx += p.facing * 150;
      p.vy = Math.min(p.vy, -170);
      soundEngine.playPunch(true);
    } else if (action === 'special') {
      if (st.mode === 'stickman_wrestling') {
        if (p.finisher < 100) {
          showBanner('NEED 100% FINISHER METER!', 'Land strikes & blocks to charge', '#94a3b8', 900);
          return;
        }
        p.finisher = 0;
        p.pose = 'finisher';
        p.actionTimer = 0.58;
        p.actionDuration = 0.58;
        p.vy = -520;
        p.vx = p.facing * 430;
        p.grounded = false;
        p.hasHitCurrentSwing = false;
        p.invulnTimer = 0.7;
        soundEngine.playBell(1);
        showBanner('AVALANCHE YETI SLAM!!', 'SIGNATURE FINISHER', '#38bdf8', 1400);
      } else {
        if (p.hitCooldown > 0) return;
        p.hitCooldown = 0.26;
        p.pose = 'jab';
        p.actionTimer = 0.18;
        p.actionDuration = 0.18;
        st.projectiles.push({
          x: p.x + p.facing * 26,
          y: p.y - 56,
          vx: p.facing * 720,
          vy: -25,
          owner: 'player',
          color: '#67e8f9',
          radius: 10,
        });
        soundEngine.playThrow();
      }
    } else if (action === 'pin' && st.mode === 'stickman_wrestling') {
      const target = st.enemies[0];
      if (!target) return;
      if (Math.abs(target.x - p.x) < 115 && (target.hp <= 45 || target.stunnedUntil > now)) {
        st.pinActive = true;
        st.pinTimer = 0;
        st.pinCount = 0;
        p.pose = 'pin';
        p.x = target.x - p.facing * 22;
        target.pose = 'down';
        soundEngine.playPinTick(1);
      } else {
        showBanner('WEAKEN OR STUN RIVAL FIRST!', 'Drop rival below 45 HP or stun with Suplex (K)', '#fb7185', 1100);
      }
    }
  }, []);

  // Keyboard Listeners (with variable jump height release!)
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

      if (k === 'w' || k === 'arrowup') triggerAction('jump');
      else if (k === 'j') triggerAction('jab');
      else if (k === 'k') triggerAction('heavy');
      else if (k === 'l') triggerAction('special');
      else if (k === ' ') triggerAction('dash');
      else if (k === 'e') triggerAction('pin');
      else if (k === '1') triggerAction('wave');
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current[k] = false;
      // Variable jump height cut when releasing jump early
      if (k === 'w' || k === 'arrowup') {
        const p = stateRef.current?.player;
        if (p && p.vy < -220) {
          p.vy *= 0.64;
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

    const handlePlayerDamage = (dmg: number, knockX: number) => {
      const st = stateRef.current;
      if (!st) return;
      const p = st.player;
      const now = performance.now();
      if (p.invulnTimer > 0) return;

      const guarding = p.pose === 'guard';
      if (now < p.shieldUntil) {
        spawnParticles(p.x, p.y - 45, '#38bdf8', 10, 180);
        soundEngine.playDash();
        return;
      }
      const finalDmg = guarding ? Math.max(2, Math.round(dmg * 0.25)) : dmg;
      p.hp = Math.max(0, p.hp - finalDmg);
      p.flashTimer = 0.18;
      p.invulnTimer = guarding ? 0.25 : 0.55;
      p.vx = knockX * (guarding ? 0.35 : 1);
      if (guarding) {
        p.finisher = Math.min(100, p.finisher + 14);
        soundEngine.playDash();
      } else {
        p.pose = 'hurt';
        p.actionTimer = 0.22;
        p.actionDuration = 0.22;
        st.combo = 0;
        st.shake = 8;
        soundEngine.playHit();
        spawnParticles(p.x, p.y - 45, '#ef4444', 10, 180);
      }

      if (p.hp <= 0) {
        finishMatch(false);
      }
    };

    const damageEnemy = (e: FighterEntity, dmg: number, knockX: number, knockY = -180) => {
      const st = stateRef.current;
      if (!st) return;
      const now = performance.now();
      const mult = now < st.player.rageUntil ? 1.6 : 1;
      const dealt = Math.round(dmg * mult);
      e.hp = Math.max(0, e.hp - dealt);
      e.flashTimer = 0.16;
      e.vx = knockX;
      e.vy = knockY;
      if (knockY < -50) e.grounded = false;
      e.pose = e.hp <= 0 ? 'down' : 'hurt';
      e.actionTimer = 0.26;
      e.actionDuration = 0.26;

      st.hitsLanded += 1;
      st.combo += 1;
      st.comboTimer = 2.6;
      st.score += 25 + st.combo * 5;
      st.player.finisher = Math.min(100, st.player.finisher + 14);
      st.shake = Math.max(st.shake, 6);
      spawnParticles(e.x, e.y - 48, '#7dd3fc', 10, 210);
    };

    const spawnDropBurst = (x: number, y: number, count: number, includePowerUp = false) => {
      const st = stateRef.current;
      if (!st) return;
      for (let i = 0; i < count; i++) {
        st.pickups.push({
          id: `pk_${Math.random().toString(36).slice(2, 8)}`,
          x: x + (Math.random() - 0.5) * 60,
          y: y - 40,
          vy: -160 - Math.random() * 140,
          kind: i === 0 && Math.random() < 0.45 ? 'gem' : 'drop',
        });
      }
      if (includePowerUp) {
        const kinds: Pickup2D['kind'][] = ['medkit', 'shield', 'rage', 'magnet'];
        st.pickups.push({
          id: `pu_${Math.random().toString(36).slice(2, 8)}`,
          x,
          y: y - 70,
          vy: -220,
          kind: kinds[Math.floor(Math.random() * kinds.length)],
        });
      }
    };

    const refillPlayerFullLife = (label: string, sublabel?: string) => {
      const st = stateRef.current;
      if (!st) return;
      st.player.hp = st.player.maxHp;
      spawnParticles(st.player.x, st.player.y - 50, '#4ade80', 18, 220);
      showBanner(label, sublabel || 'FULL HP RESTORED!', '#4ade80', 2100);
    };

    const stepPhysics = (dt: number) => {
      const st = stateRef.current;
      if (!st || st.phase !== 'PLAYING') return;
      const now = performance.now();
      const p = st.player;
      const keys = keysRef.current;

      st.elapsed += dt;
      st.timeLeft = Math.max(0, st.timeLeft - dt);
      if (st.timeLeft <= 0) {
        finishMatch(st.mode !== 'stickman_wrestling');
        return;
      }

      if (st.comboTimer > 0) {
        st.comboTimer -= dt;
        if (st.comboTimer <= 0) st.combo = 0;
      }
      st.shake = Math.max(0, st.shake - dt * 32);
      st.ropeLeftBend = Math.max(0, st.ropeLeftBend - dt * 65);
      st.ropeRightBend = Math.max(0, st.ropeRightBend - dt * 65);

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

      // Pinfall Sequence in Wrestling
      if (st.mode === 'stickman_wrestling' && st.pinActive) {
        const target = st.enemies[0];
        if (!target) {
          st.pinActive = false;
        } else {
          st.pinTimer += dt;
          const nextCount = Math.floor(st.pinTimer / 0.85) + 1;
          if (nextCount > st.pinCount && nextCount <= 3) {
            st.pinCount = nextCount;
            soundEngine.playPinTick(nextCount);
            showBanner(`REFEREE COUNT: ${nextCount}!`, undefined, '#fbbf24', 800);
          }
          if (st.pinTimer >= 2.55) {
            const kickoutChance = target.hp > 32 ? 0.85 : target.hp > 18 ? 0.35 : 0;
            if (Math.random() < kickoutChance) {
              st.pinActive = false;
              st.pinCount = 0;
              p.vy = -260;
              p.vx = -p.facing * 240;
              target.pose = 'idle';
              target.hp = Math.min(target.maxHp, target.hp + 12);
              showBanner('KICKOUT AT 2!!', 'Keep attacking to secure the pin!', '#fb7185', 1300);
              soundEngine.playDash();
            } else {
              st.pinActive = false;
              st.pinCount = 3;
              target.hp = 0;
              st.knockouts += 1;
              st.drops += 6;
              st.gems += 3;
              st.score += 320;
              p.pose = 'victory';
              p.actionTimer = 0.8;
              p.actionDuration = 0.8;
              soundEngine.playBell(3);
              if (st.waveOrBout >= WRESTLE_CHALLENGERS.length) {
                finishMatch(true);
                return;
              } else {
                st.waveOrBout += 1;
                st.enemies = [spawnWrestlingChallenger(st.waveOrBout)];
                refillPlayerFullLife(
                  `BOUT ${st.waveOrBout}: ${st.enemies[0].name?.toUpperCase()}!`,
                  'LEVEL COMPLETE · FULL HP RESTORED!'
                );
              }
            }
          }
          return;
        }
      }

      // === MODE 3: STICKMAN GLACIER RUN ===
      if (st.mode === 'stickman_run') {
        const turbo = now < p.rageUntil ? 1.35 : 1;
        st.runnerSpeed = Math.min(640, (370 + st.elapsed * 2.1) * turbo);
        st.runnerScroll += st.runnerSpeed * dt;
        st.score += st.runnerSpeed * dt * 0.04;

        // Check Glacier Run Level Milestones (every 750m -> automatic full HP refill!)
        const distMeters = Math.floor(st.runnerScroll / 16);
        const targetLevel = 1 + Math.floor(distMeters / 750);
        if (targetLevel > st.waveOrBout) {
          st.waveOrBout = targetLevel;
          st.score += 150;
          soundEngine.playLap(false);
          refillPlayerFullLife(`LEVEL ${st.waveOrBout} REACHED!`, '750m Cleared · Full HP Restored!');
        }

        const sliding = Boolean(keys['s'] || keys['arrowdown']);
        if (sliding && !p.grounded) {
          p.vy += 1100 * dt; // fast-fall responsiveness
        }
        p.pose = !p.grounded ? (p.vy < 0 ? 'jump' : 'fall') : sliding ? 'slide' : 'run';

        p.vy += 1580 * dt;
        p.y += p.vy * dt;

        for (const plat of st.runnerPlatforms) plat.x -= st.runnerSpeed * dt;
        for (const hz of st.runnerHazards) hz.x -= st.runnerSpeed * dt;
        for (const pk of st.pickups) pk.x -= st.runnerSpeed * dt;

        st.runnerPlatforms = st.runnerPlatforms.filter((pl) => pl.x + pl.w > -120);
        const lastPlat = st.runnerPlatforms[st.runnerPlatforms.length - 1];
        if (lastPlat && lastPlat.x + lastPlat.w < CANVAS_W + 450) {
          const gap = 90 + Math.random() * 125;
          const nx = lastPlat.x + lastPlat.w + gap;
          const ny = Math.max(310, Math.min(520, lastPlat.y + (Math.random() - 0.5) * 140));
          const nw = 280 + Math.random() * 340;
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
          if (Math.random() < 0.28) {
            const kinds: Pickup2D['kind'][] = ['medkit', 'shield', 'rage', 'magnet'];
            st.pickups.push({
              id: `rpu_${Math.random()}`,
              x: nx + nw * 0.5,
              y: ny - 95,
              vy: 0,
              kind: kinds[Math.floor(Math.random() * kinds.length)],
            });
          }
          if (nw > 260 && Math.random() < 0.85) {
            const roll = Math.random();
            if (roll < 0.36) {
              st.runnerHazards.push({
                id: `hz_${Math.random()}`,
                x: nx + nw * 0.55,
                y: ny,
                w: 38,
                h: 36,
                kind: 'spike',
                hp: 99,
              });
            } else if (roll < 0.68) {
              st.runnerHazards.push({
                id: `hz_${Math.random()}`,
                x: nx + nw * 0.52,
                y: ny - 54,
                w: 58,
                h: 48,
                kind: 'icicle',
                hp: 99,
              });
            } else {
              st.runnerHazards.push({
                id: `hz_${Math.random()}`,
                x: nx + nw * 0.62,
                y: ny,
                w: 44,
                h: 48,
                kind: 'crate',
                hp: 1,
              });
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
                p.vy = -645;
                p.grounded = false;
                p.jumpsLeft = 1;
                soundEngine.playDash();
              }
            }
          }
        }
        if (wasGrounded && !p.grounded && p.vy >= 0) {
          p.coyoteTimer = 0.12;
        }

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
          const overlapY = p.y > hzTop + 6 && playerTop < hz.y - 6;
          if (overlapX && overlapY) {
            if (hz.kind === 'crate' && now < p.rageUntil) {
              st.cratesSmashed += 1;
              st.score += 45;
              soundEngine.playPunch(true);
              spawnParticles(hz.x, hz.y - 24, '#7dd3fc', 12, 220);
              return false;
            }
            handlePlayerDamage(18, -140);
            spawnParticles(hz.x, hz.y - 20, '#ef4444', 8, 160);
            return false;
          }
          return true;
        });
      } else {
        // === BUTTER-SMOOTH WRESTLING & BRAWL MOVEMENT ===
        const moveLeft = Boolean(keys['a'] || keys['arrowleft']);
        const moveRight = Boolean(keys['d'] || keys['arrowright']);
        const guarding = Boolean(keys['s'] || keys['arrowdown']);
        const moveDir = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);

        if (guarding && st.mode === 'stickman_brawl' && p.grounded) {
          p.dropThroughUntil = now + 180;
        }

        const maxSpeed =
          (now < p.ropeBoostUntil ? 500 : 355) * (now < p.rageUntil ? 1.2 : 1);

        if (p.dashTimer > 0) {
          // Smooth dash momentum glide
          p.vx *= Math.pow(0.18, dt);
          p.pose = 'run';
          if (Math.random() < 0.6) {
            spawnParticles(p.x, p.y - 42, '#38bdf8', 1, 55);
          }
        } else {
          const isAttacking = p.actionTimer > 0;
          if (isAttacking) {
            p.actionTimer = Math.max(0, p.actionTimer - dt);
          }

          const targetVx =
            guarding && p.grounded && !isAttacking
              ? 0
              : moveDir * maxSpeed * (isAttacking ? 0.65 : 1);

          const rate = moveDir !== 0 ? (p.grounded ? 20 : 12) : 16;
          p.vx += (targetVx - p.vx) * Math.min(1, dt * rate);

          if (!isAttacking) {
            if (guarding && p.grounded) {
              p.pose = 'guard';
            } else if (moveDir !== 0) {
              p.facing = moveDir > 0 ? 1 : -1;
              p.pose = p.grounded ? 'run' : p.vy < 0 ? 'jump' : 'fall';
            } else {
              p.pose = p.grounded
                ? Math.abs(p.vx) > 45
                  ? 'run'
                  : 'idle'
                : p.vy < 0
                ? 'jump'
                : 'fall';
            }
          }
        }

        // Fast-fall in midair when holding S/Down
        if (guarding && !p.grounded) {
          p.vy += 850 * dt;
        }

        p.vy += 1560 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const floorY = st.mode === 'stickman_wrestling' ? RING_FLOOR : BRAWL_FLOOR;
        const wasGrounded = p.grounded;
        p.grounded = false;

        if (st.mode === 'stickman_brawl' && p.vy >= 0 && now > p.dropThroughUntil) {
          for (const pl of BRAWL_PLATFORMS) {
            if (p.x >= pl.x && p.x <= pl.x + pl.w && p.y >= pl.y && p.y - p.vy * dt <= pl.y + 20) {
              p.y = pl.y;
              p.vy = 0;
              p.grounded = true;
              p.jumpsLeft = 2;
              p.coyoteTimer = 0.12;
            }
          }
        }
        if (p.y >= floorY) {
          p.y = floorY;
          if (p.pose === 'finisher' && !p.hasHitCurrentSwing) {
            p.hasHitCurrentSwing = true;
            st.shake = 16;
            soundEngine.playSlam();
            spawnParticles(p.x, floorY - 8, '#38bdf8', 22, 320);
            for (const e of st.enemies) {
              if (Math.abs(e.x - p.x) < 220) {
                damageEnemy(e, 46, (e.x >= p.x ? 1 : -1) * 420, -340);
                e.stunnedUntil = now + 3200;
              }
            }
          }
          p.vy = 0;
          p.grounded = true;
          p.jumpsLeft = 2;
          p.coyoteTimer = 0.12;
        }

        if (wasGrounded && !p.grounded && p.vy >= 0) {
          p.coyoteTimer = 0.12;
        }

        // Consume Jump Buffer right upon landing!
        if (p.grounded && p.jumpBufferTimer > 0) {
          p.jumpBufferTimer = 0;
          p.vy = -630;
          p.grounded = false;
          p.jumpsLeft = 1;
          soundEngine.playDash();
        }

        // Ring Rope Bounce (Wrestling) vs Canyon Walls (Brawl)
        if (st.mode === 'stickman_wrestling') {
          if (p.x < RING_LEFT + 18) {
            p.x = RING_LEFT + 18;
            if (p.vx < -250) {
              p.vx = 530;
              p.facing = 1;
              p.ropeBoostUntil = now + 1100;
              st.ropeLeftBend = 28;
              soundEngine.playDash();
              showBanner('ROPE REBOUND!', 'Turbo Lariat Ready!', '#38bdf8', 850);
            } else {
              p.vx = 0;
            }
          } else if (p.x > RING_RIGHT - 18) {
            p.x = RING_RIGHT - 18;
            if (p.vx > 250) {
              p.vx = -530;
              p.facing = -1;
              p.ropeBoostUntil = now + 1100;
              st.ropeRightBend = 28;
              soundEngine.playDash();
              showBanner('ROPE REBOUND!', 'Turbo Lariat Ready!', '#38bdf8', 850);
            } else {
              p.vx = 0;
            }
          }
        } else {
          p.x = Math.max(45, Math.min(CANVAS_W - 45, p.x));
        }

        // Player Melee Hitbox Check
        if (
          (p.pose === 'jab' || p.pose === 'heavy' || p.pose === 'finisher') &&
          !p.hasHitCurrentSwing &&
          p.actionTimer < p.actionDuration * 0.78
        ) {
          const reach = p.pose === 'heavy' ? 110 : 94;
          const dmg = p.pose === 'finisher' ? 38 : p.pose === 'heavy' ? 22 : 14;
          let landed = false;
          for (const e of st.enemies) {
            if (e.hp <= 0) continue;
            const dx = e.x - p.x;
            const dy = Math.abs(e.y - p.y);
            if (dx * p.facing > -24 && Math.abs(dx) <= reach && dy < 92) {
              damageEnemy(
                e,
                dmg,
                p.facing * (p.pose === 'heavy' ? 380 : 210),
                p.pose === 'heavy' ? -260 : -110
              );
              landed = true;
            }
          }
          if (landed) {
            p.hasHitCurrentSwing = true;
            soundEngine.playPunch(p.pose !== 'jab');
          }
        }

        // Update Enemies & AI
        for (let i = st.enemies.length - 1; i >= 0; i--) {
          const e = st.enemies[i];
          e.flashTimer = Math.max(0, e.flashTimer - dt);
          if (e.actionTimer > 0) e.actionTimer = Math.max(0, e.actionTimer - dt);
          e.aiCooldown = Math.max(0, (e.aiCooldown || 0) - dt);

          const dx = p.x - e.x;
          const dist = Math.abs(dx);
          const stunned = now < e.stunnedUntil;

          if (e.hp <= 0) {
            e.pose = 'down';
            if (st.mode === 'stickman_brawl') {
              st.knockouts += 1;
              st.drops += e.isBoss ? 5 : 2;
              st.gems += e.isBoss ? 3 : 1;
              st.score += e.isBoss ? 220 : 85;
              spawnDropBurst(e.x, e.y, e.isBoss ? 4 : 2, e.isBoss || Math.random() < 0.28);
              spawnParticles(e.x, e.y - 40, e.stroke || '#fb923c', 18, 250);
              st.enemies.splice(i, 1);
              continue;
            } else if (st.mode === 'stickman_wrestling') {
              st.knockouts += 1;
              st.drops += 6;
              st.gems += 3;
              st.score += 300;
              soundEngine.playBell(3);
              if (st.waveOrBout >= WRESTLE_CHALLENGERS.length) {
                finishMatch(true);
                return;
              } else {
                st.waveOrBout += 1;
                st.enemies = [spawnWrestlingChallenger(st.waveOrBout)];
                refillPlayerFullLife(
                  `KO! BOUT ${st.waveOrBout}: ${st.enemies[0].name?.toUpperCase()}!`,
                  'LEVEL COMPLETE · FULL HP RESTORED!'
                );
                break;
              }
            }
          }

          if (e.actionTimer <= 0) {
            if (stunned) {
              e.pose = 'down';
              e.vx *= Math.pow(0.05, dt);
            } else {
              e.facing = dx >= 0 ? 1 : -1;
              const desiredGap = 58;
              if (dist > desiredGap) {
                const targetEvx = e.facing * (e.speed || 220);
                e.vx += (targetEvx - e.vx) * Math.min(1, dt * 10);
                e.pose = e.grounded ? 'run' : 'jump';
                if (st.mode === 'stickman_brawl' && p.y < e.y - 80 && e.grounded && Math.random() < 0.03) {
                  e.vy = -610;
                  e.grounded = false;
                }
              } else {
                e.vx *= Math.pow(0.05, dt);
                e.pose = 'idle';
                if ((e.aiCooldown || 0) <= 0) {
                  const heavy = Math.random() < (st.mode === 'stickman_wrestling' ? 0.36 : 0.24);
                  e.pose = heavy ? 'heavy' : 'jab';
                  e.actionTimer = heavy ? 0.44 : 0.3;
                  e.actionDuration = e.actionTimer;
                  e.hasHitCurrentSwing = false;
                  e.aiCooldown = 0.78 + (1 - (e.aggro || 0.7)) * 0.6;
                }
              }
            }
          }

          if (
            (e.pose === 'jab' || e.pose === 'heavy') &&
            !e.hasHitCurrentSwing &&
            e.actionTimer < e.actionDuration * 0.52
          ) {
            if (Math.abs(p.x - e.x) < 86 && Math.abs(p.y - e.y) < 82) {
              e.hasHitCurrentSwing = true;
              handlePlayerDamage(e.pose === 'heavy' ? 14 : 9, e.facing * 240);
            }
          }

          e.vy += 1560 * dt;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.grounded = false;

          if (st.mode === 'stickman_brawl' && e.vy >= 0) {
            for (const pl of BRAWL_PLATFORMS) {
              if (e.x >= pl.x && e.x <= pl.x + pl.w && e.y >= pl.y && e.y - e.vy * dt <= pl.y + 18) {
                e.y = pl.y;
                e.vy = 0;
                e.grounded = true;
              }
            }
          }
          if (e.y >= floorY) {
            e.y = floorY;
            e.vy = 0;
            e.grounded = true;
          }
          if (st.mode === 'stickman_wrestling') {
            if (e.x < RING_LEFT + 18) {
              e.x = RING_LEFT + 18;
              e.vx = Math.abs(e.vx) * 0.5;
              st.ropeLeftBend = 18;
            } else if (e.x > RING_RIGHT - 18) {
              e.x = RING_RIGHT - 18;
              e.vx = -Math.abs(e.vx) * 0.5;
              st.ropeRightBend = 18;
            }
          } else {
            e.x = Math.max(40, Math.min(CANVAS_W - 40, e.x));
          }
        }

        // Respawn Brawl Waves when cleared -> AUTOMATIC FULL HP REFILL!
        if (st.mode === 'stickman_brawl' && st.enemies.length === 0) {
          st.waveSpawnTimer += dt;
          if (st.waveSpawnTimer > 0.95) {
            st.waveSpawnTimer = 0;
            if (st.waveOrBout >= 6) {
              showBanner('FROST CITADEL CLEARED!', 'The final boss is defeated!', '#facc15', 2200);
              finishMatch(true);
              return;
            }
            st.waveOrBout += 1;
            st.enemies = spawnBrawlWave(st.waveOrBout);
            soundEngine.playBell(1);
            refillPlayerFullLife(
              `LEVEL ${st.waveOrBout}`,
              st.waveOrBout % 3 === 0 ? 'BOSS LEVEL · Full HP Restored!' : 'Wave Cleared · Full HP Restored!'
            );
          }
        }

        st.pickupSpawnTimer -= dt;
        if (st.pickupSpawnTimer <= 0) {
          st.pickupSpawnTimer = 7.0;
          const kinds: Pickup2D['kind'][] = ['drop', 'gem', 'medkit', 'shield', 'rage', 'magnet'];
          const minX = st.mode === 'stickman_wrestling' ? RING_LEFT + 90 : 160;
          const maxX = st.mode === 'stickman_wrestling' ? RING_RIGHT - 90 : CANVAS_W - 160;
          st.pickups.push({
            id: `ap_${Math.random()}`,
            x: minX + Math.random() * (maxX - minX),
            y: 120,
            vy: 60,
            kind: kinds[Math.floor(Math.random() * kinds.length)],
          });
        }
      }

      // === PROJECTILES ===
      for (let i = st.projectiles.length - 1; i >= 0; i--) {
        const pr = st.projectiles[i];
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        if (pr.x < -40 || pr.x > CANVAS_W + 40) {
          st.projectiles.splice(i, 1);
          continue;
        }
        let hit = false;
        if (st.mode === 'stickman_run') {
          for (let j = st.runnerHazards.length - 1; j >= 0; j--) {
            const hz = st.runnerHazards[j];
            if (
              hz.kind === 'crate' &&
              Math.abs(pr.x - (hz.x + hz.w / 2)) < hz.w / 2 + 12 &&
              Math.abs(pr.y - (hz.y - hz.h / 2)) < hz.h / 2 + 16
            ) {
              st.runnerHazards.splice(j, 1);
              st.cratesSmashed += 1;
              st.drops += 2;
              st.score += 60;
              soundEngine.playPunch(true);
              spawnParticles(hz.x, hz.y - 24, '#67e8f9', 14, 240);
              hit = true;
              break;
            }
          }
        } else {
          for (const e of st.enemies) {
            if (Math.abs(pr.x - e.x) < 36 && Math.abs(pr.y - (e.y - 48)) < 56) {
              damageEnemy(e, 16, Math.sign(pr.vx) * 200, -100);
              soundEngine.playPunch(false);
              hit = true;
              break;
            }
          }
        }
        if (hit) st.projectiles.splice(i, 1);
      }

      // === PICKUPS ===
      const floorPkY = st.mode === 'stickman_wrestling' ? RING_FLOOR : BRAWL_FLOOR;
      for (let i = st.pickups.length - 1; i >= 0; i--) {
        const pk = st.pickups[i];
        if (st.mode !== 'stickman_run') {
          pk.vy += 680 * dt;
          pk.y += pk.vy * dt;
          if (pk.y >= floorPkY - 16) {
            pk.y = floorPkY - 16;
            pk.vy = 0;
          }
        }
        if (now < p.magnetUntil) {
          const dx = p.x - pk.x;
          const dy = p.y - 45 - pk.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < 360) {
            pk.x += (dx / d) * 480 * dt;
            pk.y += (dy / d) * 480 * dt;
          }
        }

        if (Math.hypot(pk.x - p.x, pk.y - (p.y - 42)) < 50) {
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
            p.shieldUntil = now + 7000;
            soundEngine.playPickup('power');
            showBanner('CRYO SHIELD (7s)', undefined, '#38bdf8', 900);
          } else if (pk.kind === 'rage') {
            p.rageUntil = now + 7000;
            soundEngine.playPickup('power');
            showBanner('YETI RAGE 1.6x DMG (7s)', undefined, '#fb923c', 900);
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
        pt.vy += 450 * dt;
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

      const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      sky.addColorStop(0, pal.skyTop);
      sky.addColorStop(1, pal.skyBot);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.save();
      ctx.strokeStyle = pal.accent;
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = 34;
      ctx.beginPath();
      const scrollOff = st ? st.runnerScroll * 0.12 : nowMs * 0.02;
      ctx.moveTo(0, 120);
      for (let x = 0; x <= CANVAS_W; x += 80) {
        ctx.lineTo(x, 115 + Math.sin((x + scrollOff) * 0.008) * 38);
      }
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = pal.ridgeFar;
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_H);
      for (let x = 0; x <= CANVAS_W + 120; x += 140) {
        const h = 230 + Math.sin(x * 0.011 + 1.4) * 60;
        ctx.lineTo(x, h);
      }
      ctx.lineTo(CANVAS_W, CANVAS_H);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.ridgeNear;
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_H);
      for (let x = 0; x <= CANVAS_W + 100; x += 110) {
        const h = 320 + Math.cos(x * 0.014) * 52;
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
        ctx.save();
        ctx.fillStyle = 'rgba(186, 230, 253, 0.07)';
        ctx.beginPath();
        ctx.moveTo(260, 0);
        ctx.lineTo(440, RING_FLOOR);
        ctx.lineTo(760, RING_FLOOR);
        ctx.lineTo(540, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(940, 0);
        ctx.lineTo(440, RING_FLOOR);
        ctx.lineTo(760, RING_FLOOR);
        ctx.lineTo(660, 0);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#050c18';
        for (let cx = 30; cx < CANVAS_W; cx += 52) {
          const bounce = st ? Math.abs(Math.sin(nowMs * 0.005 + cx)) * 5 : 0;
          ctx.beginPath();
          ctx.arc(cx, 548 - bounce, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(cx - 16, 560 - bounce, 32, 115);
        }

        ctx.fillStyle = '#0284c7';
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 3;
        ctx.fillRect(RING_LEFT - 14, 330, 22, 210);
        ctx.strokeRect(RING_LEFT - 14, 330, 22, 210);
        ctx.fillStyle = '#e11d48';
        ctx.fillRect(RING_RIGHT - 8, 330, 22, 210);
        ctx.strokeRect(RING_RIGHT - 8, 330, 22, 210);

        [355, 405, 455].forEach((ry) => {
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(RING_LEFT - 2, ry - 9, 18, 18);
          ctx.fillStyle = '#f43f5e';
          ctx.fillRect(RING_RIGHT - 16, ry - 9, 18, 18);
        });

        const bendL = st ? st.ropeLeftBend : 0;
        const bendR = st ? st.ropeRightBend : 0;
        const ropeColors = ['#38bdf8', '#e2e8f0', '#f43f5e'];
        [355, 405, 455].forEach((ry, idx) => {
          ctx.strokeStyle = ropeColors[idx];
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(RING_LEFT + 8, ry);
          ctx.quadraticCurveTo(
            RING_LEFT - bendL * 1.2 + (RING_RIGHT - RING_LEFT) * 0.25,
            ry,
            (RING_LEFT + RING_RIGHT) / 2,
            ry
          );
          ctx.quadraticCurveTo(
            RING_RIGHT + bendR * 1.2 - (RING_RIGHT - RING_LEFT) * 0.25,
            ry,
            RING_RIGHT - 8,
            ry
          );
          ctx.stroke();
        });

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(RING_LEFT - 28, RING_FLOOR, RING_RIGHT - RING_LEFT + 56, 22);
        ctx.fillStyle = pal.floorFill;
        ctx.fillRect(RING_LEFT - 28, RING_FLOOR + 22, RING_RIGHT - RING_LEFT + 56, 75);
        ctx.strokeStyle = pal.floorTrim;
        ctx.lineWidth = 4;
        ctx.strokeRect(RING_LEFT - 28, RING_FLOOR, RING_RIGHT - RING_LEFT + 56, 22);

        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.font = '700 18px Oxanium, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('LOFI SLAM · SUI WRESTLING', CANVAS_W / 2, RING_FLOOR + 62);
      } else if (mode === 'stickman_brawl') {
        ctx.fillStyle = pal.floorFill;
        ctx.fillRect(0, BRAWL_FLOOR, CANVAS_W, CANVAS_H - BRAWL_FLOOR);
        ctx.fillStyle = pal.floorTrim;
        ctx.fillRect(0, BRAWL_FLOOR, CANVAS_W, 6);

        for (const pl of BRAWL_PLATFORMS) {
          ctx.fillStyle = '#16385d';
          ctx.strokeStyle = pal.floorTrim;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(pl.x, pl.y, pl.w, 16, 8);
          ctx.fill();
          ctx.stroke();
        }
      } else if (mode === 'stickman_run' && st) {
        for (const pl of st.runnerPlatforms) {
          ctx.fillStyle = pal.floorFill;
          ctx.fillRect(pl.x, pl.y, pl.w, CANVAS_H - pl.y);
          ctx.fillStyle = pal.floorTrim;
          ctx.fillRect(pl.x, pl.y, pl.w, 7);
        }
        for (const hz of st.runnerHazards) {
          if (hz.kind === 'spike') {
            ctx.fillStyle = '#38bdf8';
            ctx.strokeStyle = '#e0f2fe';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(hz.x, hz.y);
            ctx.lineTo(hz.x + hz.w * 0.5, hz.y - hz.h);
            ctx.lineTo(hz.x + hz.w, hz.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else if (hz.kind === 'icicle') {
            ctx.fillStyle = '#fb7185';
            ctx.strokeStyle = '#ffe4e6';
            ctx.lineWidth = 2;
            ctx.fillRect(hz.x, hz.y - hz.h, hz.w, hz.h * 0.72);
            ctx.strokeRect(hz.x, hz.y - hz.h, hz.w, hz.h * 0.72);
            ctx.font = '700 10px Oxanium, sans-serif';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText('SLIDE!', hz.x + hz.w / 2, hz.y - hz.h - 6);
          } else {
            ctx.fillStyle = '#0284c7';
            ctx.strokeStyle = '#bae6fd';
            ctx.lineWidth = 3;
            ctx.fillRect(hz.x, hz.y - hz.h, hz.w, hz.h);
            ctx.strokeRect(hz.x, hz.y - hz.h, hz.w, hz.h);
            ctx.beginPath();
            ctx.moveTo(hz.x, hz.y - hz.h);
            ctx.lineTo(hz.x + hz.w, hz.y);
            ctx.moveTo(hz.x + hz.w, hz.y - hz.h);
            ctx.lineTo(hz.x, hz.y);
            ctx.stroke();
          }
        }
      }

      if (!st) {
        const t = nowMs * 0.001;
        drawStickmanCharacter(ctx, {
          x: 430,
          y: mode === 'stickman_wrestling' ? RING_FLOOR : BRAWL_FLOOR,
          facing: 1,
          pose: mode === 'stickman_wrestling' ? 'victory' : 'run',
          animTime: t,
          isLofiYeti: true,
          colorwayId: selectedColorway,
          hatId: yeti?.equipped.hat || 'hat_goggles',
          scarfId: yeti?.equipped.scarf || 'scarf_lofi',
          hasBelt: mode === 'stickman_wrestling',
          hp: 100,
          maxHp: 100,
          label: playerName,
          scale: 1.25,
          weapon: 'sword',
        });
        if (mode !== 'stickman_run') {
          drawStickmanCharacter(ctx, {
            x: 770,
            y: mode === 'stickman_wrestling' ? RING_FLOOR : BRAWL_FLOOR,
            facing: -1,
            pose: 'guard',
            animTime: t + 1,
            isLofiYeti: true,
            colorwayId: 'sunset_ember',
            hp: 100,
            maxHp: 100,
            label: mode === 'stickman_wrestling' ? 'Baron Basalt' : 'Frost Ninja',
            scale: 1.2,
            weapon: 'sword',
          });
        }
        ctx.restore();
        return;
      }

      // Draw Graphic Power-Ups & Pickups (NO letter glyphs!)
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
          scale: e.isBoss ? 1.24 : 1.08,
          isLofiYeti: true,
          colorwayId: e.colorway || 'classic_lofi',
          hp: e.hp,
          maxHp: e.maxHp,
          label: e.name,
          flashHit: e.flashTimer > 0,
          weapon: st.mode === 'stickman_run' ? 'blaster' : 'sword',
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
        hasBelt: st.mode === 'stickman_wrestling',
        shielded: nowMs < p.shieldUntil,
        raged: nowMs < p.rageUntil,
        finisherReady: st.mode === 'stickman_wrestling' && p.finisher >= 100,
        hp: p.hp,
        maxHp: p.maxHp,
        label: playerName,
        flashHit: p.flashTimer > 0,
        weapon: st.mode === 'stickman_run' ? 'blaster' : 'sword',
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

      if (st.banner && nowMs < st.banner.until) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '700 28px "Pixel Forge", Oxanium, sans-serif';
        ctx.fillStyle = '#040c18';
        ctx.fillText(st.banner.text, CANVAS_W / 2 + 2, 166);
        ctx.fillStyle = st.banner.color;
        ctx.fillText(st.banner.text, CANVAS_W / 2, 164);
        if (st.banner.subtext) {
          ctx.font = '600 14px Oxanium, sans-serif';
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(st.banner.subtext, CANVAS_W / 2, 192);
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
        const boss = st.enemies[0];
        const now = performance.now();
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
          pinCount: st.pinCount,
          pinPossible:
            st.mode === 'stickman_wrestling' &&
            Boolean(boss && (boss.hp <= 45 || boss.stunnedUntil > now)),
        });
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [finishMatch, playerName, selectedColorway, selectedGameMode, selectedMapId, yeti?.equipped.hat, yeti?.equipped.scarf]);

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
            {/* Left: Lofi Yeti Life Bar & Finisher/Level */}
            <div className="pointer-events-auto min-w-[215px] arcade-hud px-3 py-2 space-y-1.5">
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
                  <div className="flex items-center justify-between text-[10px] font-bold text-cyan-300 tabular-nums">
                    <span>FINISHER (L) · BOUT {hud.waveOrBout}/3</span>
                    <span>{hud.finisher}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-950">
                    <div
                      className={`h-full transition-all duration-150 ${
                        hud.finisher >= 100 ? 'bg-amber-400' : 'bg-cyan-400'
                      }`}
                      style={{ width: `${hud.finisher}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-300 tabular-nums">
                  <span>LVL {hud.waveOrBout}</span>
                  {hud.combo > 1 && <span className="text-amber-300">{hud.combo}× COMBO</span>}
                </div>
              )}

              {(hud.shieldLeft > 0 || hud.rageLeft > 0 || hud.magnetLeft > 0) && (
                <div className="flex flex-wrap gap-2 pt-0.5 text-[10px] font-bold">
                  {hud.shieldLeft > 0 && (
                    <span className="inline-flex items-center gap-1 text-sky-300">
                      <Shield className="h-3 w-3" /> {hud.shieldLeft}s
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

            {/* Right: Opponent HP Bar + Home / Menu / Pause / Fullscreen */}
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

              {hud.enemyName && selectedGameMode !== 'stickman_run' && (
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
                  {hud.pinPossible && (
                    <span className="block text-[10px] font-bold text-amber-300">
                      PRESS [E] TO PIN!
                    </span>
                  )}
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
                <span className="arcade-kbd">S</span> {selectedGameMode === 'stickman_run' ? 'Slide' : 'Guard'}
              </button>
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
                <span className="arcade-kbd">J</span> {selectedGameMode === 'stickman_run' ? 'Blast' : 'Strike'}
              </button>
              {selectedGameMode !== 'stickman_run' && (
                <>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      triggerAction('heavy');
                    }}
                    className="rounded-lg border border-amber-400/50 bg-amber-500/20 px-2.5 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-500/35 whitespace-nowrap shrink-0 touch-none cursor-pointer inline-flex items-center gap-1"
                  >
                    <span className="arcade-kbd">K</span> {selectedGameMode === 'stickman_wrestling' ? 'Suplex' : 'Upper'}
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      triggerAction('dash');
                    }}
                    className="rounded-lg border border-cyan-400/50 bg-cyan-500/20 px-2.5 py-1.5 text-xs font-bold text-cyan-100 hover:bg-cyan-500/35 whitespace-nowrap shrink-0 touch-none cursor-pointer inline-flex items-center gap-1"
                  >
                    <span className="arcade-kbd">SPC</span> Dash
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      triggerAction('special');
                    }}
                    className="rounded-lg border border-purple-400/50 bg-purple-500/20 px-2.5 py-1.5 text-xs font-bold text-purple-100 hover:bg-purple-500/35 whitespace-nowrap shrink-0 touch-none cursor-pointer inline-flex items-center gap-1"
                  >
                    <span className="arcade-kbd">L</span> {selectedGameMode === 'stickman_wrestling' ? `${hud.finisher}%` : 'Ice'}
                  </button>
                  {selectedGameMode === 'stickman_wrestling' && (
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        triggerAction('pin');
                      }}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap shrink-0 touch-none cursor-pointer inline-flex items-center gap-1 ${
                        hud.pinPossible
                          ? 'bg-amber-400 text-slate-950'
                          : 'border border-rose-500/45 bg-rose-500/20 text-rose-100'
                      }`}
                    >
                      <span className="arcade-kbd">E</span> Pin
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* === GAMISH 2D LAUNCHER OVERLAY (ZERO TEXT WALLS, ZERO BACKDROP-BLUR) === */}
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
                          ? Trophy
                          : gm.id === 'stickman_brawl'
                          ? Swords
                          : Flame;
                      const grad =
                        gm.id === 'stickman_wrestling'
                          ? 'from-amber-500/25 via-rose-500/10 to-slate-900'
                          : gm.id === 'stickman_brawl'
                          ? 'from-sky-500/25 via-cyan-500/10 to-slate-900'
                          : 'from-emerald-500/25 via-sky-500/10 to-slate-900';
                      const quickTag =
                        gm.id === 'stickman_wrestling'
                          ? 'Pro Ring · 1-2-3 Pin'
                          : gm.id === 'stickman_brawl'
                          ? 'Ledge Brawl · Combos'
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
                  ) : (
                    <>
                      <span><span className="arcade-kbd">A/D</span> Move</span>
                      <span><span className="arcade-kbd">W</span> Jump</span>
                      <span><span className="arcade-kbd">J</span> Hit</span>
                      <span><span className="arcade-kbd">K</span> Heavy</span>
                      <span><span className="arcade-kbd">L</span> Special</span>
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
            </>
          ) : (
            <>
              <span><span className="arcade-kbd">A/D</span> Move</span>
              <span><span className="arcade-kbd">W</span> Jump</span>
              <span><span className="arcade-kbd">S</span> Guard</span>
              <span><span className="arcade-kbd">J</span> Strike</span>
              <span><span className="arcade-kbd">K</span> Heavy</span>
              <span><span className="arcade-kbd">L</span> {selectedGameMode === 'stickman_wrestling' ? 'Finisher' : 'Throw'}</span>
              {selectedGameMode === 'stickman_wrestling' && (
                <span><span className="arcade-kbd">E</span> Pin</span>
              )}
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
