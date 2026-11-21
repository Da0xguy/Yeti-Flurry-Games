import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import type {
  BlockchainSyncState,
  CharacterId,
  CosmeticSlot,
  CustomCharacterColors,
  GameModeId,
  LeaderboardEntry,
  MapId,
  OnChainRunRecord,
  PtbReceipt,
  TunnelBeaconSnapshot,
  TunnelCrateSnapshot,
  TunnelPickupSnapshot,
  TunnelPlayerSnapshot,
  TunnelRoomSnapshot,
  TunnelSnowballSnapshot,
  WellImpactState,
  YetiColorId,
  YetiEmoteKind,
  YetiObject,
  YetiStage,
} from './src/types';
import {
  ARENA_CENTER_X,
  ARENA_CENTER_Y,
  ARENA_H,
  ARENA_INITIAL_RING_RADIUS,
  ARENA_W,
  CAREER_QUESTS,
  RACE_BOUNDS,
  WELL_RITUAL_RADIUS,
  getDistanceToRaceTrack,
  getMapObstacles,
  getRaceTrackWaypoints,
  getMapSpec,
  resolveArenaObstacleCollision,
} from './src/data/gameCatalog';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'game-state.json');

interface PersistedState {
  yetis: Record<string, YetiObject>;
  leaderboard: LeaderboardEntry[];
  wellImpact: WellImpactState;
}

function randomHex(bytes: number): string {
  return '0x' + crypto.randomBytes(bytes).toString('hex');
}

function defaultState(): PersistedState {
  const sampleDigest1 = randomHex(32);
  const sampleDigest2 = randomHex(32);
  const sampleDigest3 = randomHex(32);

  return {
    yetis: {},
    leaderboard: [
      {
        id: 'run_seed_1',
        playerName: 'MysticetiKai',
        yetiName: 'Snowdrift #042',
        yetiStage: 'Apex Lofi',
        score: 1620,
        wellDrops: 42,
        frostGems: 48,
        survivalSeconds: 75,
        mode: 'tunnel',
        mapId: 'aurora_summit',
        txDigest: sampleDigest1,
        timestamp: '2026-11-16T14:15:00Z',
      },
      {
        id: 'run_seed_2',
        playerName: 'WalrusNora',
        yetiName: 'Frostbite',
        yetiStage: 'Blizzard Guardian',
        score: 1310,
        wellDrops: 33,
        frostGems: 38,
        survivalSeconds: 72,
        mode: 'solo',
        mapId: 'volcanic_springs',
        txDigest: sampleDigest2,
        timestamp: '2026-11-16T13:40:00Z',
      },
      {
        id: 'run_seed_3',
        playerName: 'SuiGlacier',
        yetiName: 'Pebble',
        yetiStage: 'Glacier Runner',
        score: 980,
        wellDrops: 26,
        frostGems: 29,
        survivalSeconds: 67,
        mode: 'tunnel',
        mapId: 'glacier_well',
        txDigest: sampleDigest3,
        timestamp: '2026-11-16T12:10:00Z',
      },
    ],
    wellImpact: {
      totalDropsCollected: 2740,
      dropsPerWellMilestone: 1000,
      wellsFunded: 2,
      activeContributors: 148,
    },
  };
}

function computeServerStateRoot(y: YetiObject): string {
  const canonical = JSON.stringify({
    objectId: y.objectId,
    ownerAddress: y.ownerAddress,
    characterId: y.characterId || 'lofi_yeti',
    colorway: y.colorway,
    customColors: y.customColors || null,
    equipped: y.equipped,
    unlockedCosmetics: y.unlockedCosmetics,
    stage: y.stage,
    level: y.level,
    xp: y.xp,
    frostGems: y.frostGems,
    wellDropsContributed: y.wellDropsContributed,
    highScore: y.highScore,
    runsCompleted: y.runsCompleted,
    mapsPlayed: y.mapsPlayed,
    claimedQuests: y.claimedQuests,
    recentRuns: (y.recentRuns || []).slice(0, 15),
  });
  return '0x' + crypto.createHash('sha256').update(canonical).digest('hex');
}

function normalizeYeti(y: YetiObject): YetiObject {
  const unlocked = Array.isArray(y.unlockedCosmetics) ? [...y.unlockedCosmetics] : [];
  if (!unlocked.includes('outfit_none')) unlocked.push('outfit_none');
  if (!unlocked.includes('outfit_hoodie')) unlocked.push('outfit_hoodie');

  const normalized: YetiObject = {
    ...y,
    characterId: y.characterId || 'lofi_yeti',
    colorway: y.colorway || 'classic_lofi',
    equipped: {
      hat: y.equipped?.hat || 'hat_goggles',
      scarf: y.equipped?.scarf || 'scarf_lofi',
      outfit: y.equipped?.outfit || 'outfit_hoodie',
      trail: y.equipped?.trail || 'trail_powder',
    },
    unlockedCosmetics: unlocked,
    mapsPlayed: Array.isArray(y.mapsPlayed) ? y.mapsPlayed : [],
    totalHits: Number(y.totalHits) || 0,
    cratesSmashed: Number(y.cratesSmashed) || 0,
    tasksCompleted: Number(y.tasksCompleted) || 0,
    claimedQuests: Array.isArray(y.claimedQuests) ? y.claimedQuests : [],
    recentRuns: Array.isArray(y.recentRuns) ? y.recentRuns : [],
  };
  const rootHash = computeServerStateRoot(normalized);
  normalized.blockchain = {
    network: 'sui:testnet',
    stateRootHash: normalized.blockchain?.stateRootHash || rootHash,
    walrusBlobId: normalized.blockchain?.walrusBlobId,
    walrusUrl: normalized.blockchain?.walrusUrl,
    lastTxDigest: normalized.blockchain?.lastTxDigest,
    profileObjectId: normalized.blockchain?.profileObjectId,
    walletSignature: normalized.blockchain?.walletSignature,
    lastSyncedAt: normalized.blockchain?.lastSyncedAt,
    onChainVerified: Boolean(normalized.blockchain?.onChainVerified),
  };
  return normalized;
}

function loadState(): PersistedState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as PersistedState;
      for (const k of Object.keys(parsed.yetis || {})) {
        parsed.yetis[k] = normalizeYeti(parsed.yetis[k]);
      }
      return parsed;
    }
  } catch (err) {
    console.error('Failed to load game state, using defaults:', err);
  }
  const initial = defaultState();
  saveState(initial);
  return initial;
}

function saveState(state: PersistedState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save game state:', err);
  }
}

const state = loadState();
let globalBlessingUntil = 0;
let globalBonusDrops = 0;

function getPublicWellImpact(): WellImpactState {
  const now = Date.now();
  const bonus = now < globalBlessingUntil ? globalBonusDrops : 0;
  const effectiveTotal = state.wellImpact.totalDropsCollected + bonus;
  return {
    totalDropsCollected: effectiveTotal,
    dropsPerWellMilestone: state.wellImpact.dropsPerWellMilestone,
    wellsFunded: Math.floor(effectiveTotal / state.wellImpact.dropsPerWellMilestone),
    activeContributors: state.wellImpact.activeContributors,
    activeBonusDrops: bonus,
    blessingUntil: now < globalBlessingUntil ? globalBlessingUntil : 0,
  };
}

function triggerServerWellBlessing(durationMs = 15000, bonusDrops = 25, permDrops = 3): WellImpactState {
  const now = Date.now();
  globalBlessingUntil = Math.max(globalBlessingUntil, now + durationMs);
  globalBonusDrops = bonusDrops;
  state.wellImpact.totalDropsCollected += permDrops;
  state.wellImpact.wellsFunded = Math.floor(
    state.wellImpact.totalDropsCollected / state.wellImpact.dropsPerWellMilestone
  );
  saveState(state);
  return getPublicWellImpact();
}

// ============================================================================
// WebSocket Sui Tunnel Multiplayer Simulation (20Hz Authoritative Multi-Map Rooms)
// ============================================================================

interface TunnelRoom {
  roomId: string;
  mapId: MapId;
  mode: GameModeId;
  tick: number;
  ringRadius: number;
  timeLeft: number;
  players: Map<
    string,
    TunnelPlayerSnapshot & {
      inputX: number;
      inputY: number;
      dashCd: number;
      throwCd: number;
      meleeCd: number;
      facingX: number;
      facingY: number;
      gatherAtWellUntil?: number;
      angle?: number;
      speed?: number;
      lap?: number;
      nextWp?: number;
      nextCheckpoint?: number;
      checkpointsCleared?: number;
      totalProgress?: number;
      nitro?: number;
      finished?: boolean;
      finishTime?: number;
      dropsCollected?: number;
      gemsCollected?: number;
      aiSpeedBias?: number;
      aiLaneOffset?: number;
      boostUntilRace?: number;
      magnetUntil?: number;
      tripleUntil?: number;
    }
  >;
  pickups: TunnelPickupSnapshot[];
  crates: TunnelCrateSnapshot[];
  snowballs: (TunnelSnowballSnapshot & { ttl: number })[];
  beacon: TunnelBeaconSnapshot;
  nextBeaconIn: number;
  blessingUntil: number;
  blessingKind: YetiEmoteKind;
  ritualCooldownUntil: number;
  clients: Map<string, WebSocket>;
}

const BOT_CONFIGS: {
  name: string;
  characterId: CharacterId;
  colorway: YetiColorId;
  hat: string;
  scarf: string;
  outfit: string;
}[] = [
  { name: 'Kitsune Mira', characterId: 'frost_fox', colorway: 'glacier_mint', hat: 'hat_beanie', scarf: 'scarf_aurora', outfit: 'outfit_parka' },
  { name: 'Mech Taro', characterId: 'mecha_bot', colorway: 'sunset_ember', hat: 'hat_visor', scarf: 'scarf_crimson', outfit: 'outfit_cyber' },
  { name: 'Emperor Pip', characterId: 'cryo_penguin', colorway: 'aurora_violet', hat: 'hat_crown', scarf: 'scarf_lofi', outfit: 'outfit_jersey' },
];

function spawnPickup(idPrefix: string, mapId: MapId): TunnelPickupSnapshot {
  const angle = Math.random() * Math.PI * 2;
  const dist = 110 + Math.random() * 540;
  const roll = Math.random();
  const gemThreshold =
    mapId === 'orbital_rift' ? 0.74 : mapId === 'aurora_summit' ? 0.72 : 0.68;
  let kind: TunnelPickupSnapshot['kind'] = 'drop';
  if (roll < 0.42) kind = 'drop';
  else if (roll < gemThreshold) kind = 'gem';
  else if (roll < 0.78) kind = 'shield';
  else if (roll < 0.85) kind = 'boost';
  else if (roll < 0.91) kind = 'magnet';
  else if (roll < 0.96) kind = 'triple';
  else kind = 'medkit';

  return {
    id: `${idPrefix}_${crypto.randomBytes(3).toString('hex')}`,
    kind,
    x: ARENA_CENTER_X + Math.cos(angle) * dist,
    y: ARENA_CENTER_Y + Math.sin(angle) * dist,
  };
}

function spawnCrate(idPrefix: string): TunnelCrateSnapshot {
  const angle = Math.random() * Math.PI * 2;
  const dist = 150 + Math.random() * 460;
  return {
    id: `cr_${idPrefix}_${crypto.randomBytes(2).toString('hex')}`,
    x: ARENA_CENTER_X + Math.cos(angle) * dist,
    y: ARENA_CENTER_Y + Math.sin(angle) * dist,
    hp: 2,
  };
}

function createTunnelRoom(roomId: string, mapId: MapId, mode: GameModeId = 'survival'): TunnelRoom {
  const duration = mode === 'car_racing' ? 180 : 150;
  const room: TunnelRoom = {
    roomId,
    mapId,
    mode,
    tick: 0,
    ringRadius: ARENA_INITIAL_RING_RADIUS,
    timeLeft: duration,
    players: new Map(),
    pickups:
      mode === 'car_racing'
        ? []
        : Array.from({ length: 30 }, (_, i) => spawnPickup(`init_${i}`, mapId)),
    crates: mode === 'car_racing' ? [] : Array.from({ length: 10 }, (_, i) => spawnCrate(`init_${i}`)),
    snowballs: [],
    beacon: { active: false, x: ARENA_CENTER_X, y: ARENA_CENTER_Y, radius: 78, timeLeft: 0 },
    nextBeaconIn: 10,
    blessingUntil: 0,
    blessingKind: 'none',
    ritualCooldownUntil: 0,
    clients: new Map(),
  };

  BOT_CONFIGS.forEach((bot, idx) => {
    const angle = (idx / 3) * Math.PI * 2;
    const raceStart = mode === 'car_racing' ? getRaceTrackWaypoints(mapId)[0] : null;
    const raceNext = mode === 'car_racing' ? getRaceTrackWaypoints(mapId)[1] : null;
    const raceAngle = raceStart && raceNext
      ? Math.atan2(raceNext.y - raceStart.y, raceNext.x - raceStart.x)
      : 0;
    room.players.set(`bot_${idx}`, {
      id: `bot_${idx}`,
      name: bot.name,
      x: raceStart ? raceStart.x - Math.cos(raceAngle) * (24 + idx * 42) : ARENA_CENTER_X + Math.cos(angle) * 320,
      y: raceStart ? raceStart.y - Math.sin(raceAngle) * (24 + idx * 42) : ARENA_CENTER_Y + Math.sin(angle) * 240,
      vx: 0,
      vy: 0,
      hp: 100,
      maxHp: 100,
      score: 0,
      wellDrops: 0,
      carriedDrops: 0,
      isBot: true,
      characterId: bot.characterId,
      hat: bot.hat,
      scarf: bot.scarf,
      outfit: bot.outfit,
      colorway: bot.colorway,
      shieldUntil: 0,
      boostUntil: 0,
      magnetUntil: 0,
      tripleUntil: 0,
      dashing: false,
      eliminated: false,
      emote: 'none',
      emoteUntil: 0,
      inputX: 0,
      inputY: 0,
      dashCd: 0,
      throwCd: 1.5,
      meleeCd: 0,
      facingX: 1,
      facingY: 0,
      angle: raceAngle,
      speed: 0,
      lap: 1,
      nextWp: 1,
      nextCheckpoint: 1,
      checkpointsCleared: 0,
      totalProgress: 0,
      nitro: 100,
      finished: false,
      finishTime: 0,
      dropsCollected: 0,
      gemsCollected: 0,
      aiSpeedBias: 0.96 - idx * 0.05,
      aiLaneOffset: (idx % 2 ? -1 : 1) * (32 + idx * 8),
      boostUntilRace: 0,
    });
  });

  return room;
}

const tunnelRooms = new Map<string, TunnelRoom>();
(['glacier_well', 'volcanic_springs', 'aurora_summit', 'orbital_rift'] as MapId[]).forEach((mapId) => {
  const roomId = `tunnel-${mapId}`;
  tunnelRooms.set(roomId, createTunnelRoom(roomId, mapId));
  const raceRoomId = `tunnel-race-${mapId}`;
  tunnelRooms.set(raceRoomId, createTunnelRoom(raceRoomId, mapId, 'car_racing'));
});

function stepRaceRoom(room: TunnelRoom, dt: number): void {
  room.tick += 1;
  if (room.timeLeft > 0) room.timeLeft = Math.max(0, room.timeLeft - dt);
  const wps = getRaceTrackWaypoints(room.mapId);
  const mapSpec = getMapSpec(room.mapId);

  for (const p of room.players.values()) {
    if (p.finished) continue;
    let throttle = p.isBot ? 1 : p.inputY;
    let steer = p.isBot ? 0 : p.inputX;

    if (p.isBot) {
      const wp = wps[p.nextWp ?? 1];
      const laneOffset = p.aiLaneOffset || 0;
      const targetX = wp.x + laneOffset * Math.cos(p.nextWp ?? 1);
      const targetY = wp.y + laneOffset * Math.sin(p.nextWp ?? 1);
      const desired = Math.atan2(targetY - p.y, targetX - p.x);
      let diff = desired - (p.angle || 0);
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      steer = THREEClamp(diff * 2.1, -1, 1);
    }

    const boosting = (p.boostUntilRace || 0) > Date.now();
    const offRoad = getDistanceToRaceTrack(p.x, p.y, room.mapId) > 105;
    const offRoadMult = offRoad && !boosting ? 0.84 : 1.0;
    const maxSpeed = (p.isBot ? 415 * (p.aiSpeedBias || 0.92) : 450) * mapSpec.speedMult * (boosting ? 1.38 : 1) * offRoadMult;
    p.speed = THREEClamp((p.speed || 0) + throttle * (boosting ? 780 : 520) * mapSpec.speedMult * dt, -160, maxSpeed);
    p.speed = Math.abs(p.speed) < 2 ? 0 : p.speed;
    p.angle = (p.angle || 0) + steer * 2.55 * THREEClamp(Math.abs(p.speed) / 90, 0.25, 1) * dt;
    p.vx = Math.cos(p.angle) * p.speed;
    p.vy = Math.sin(p.angle) * p.speed;
    p.x = THREEClamp(p.x + p.vx * dt, RACE_BOUNDS.minX, RACE_BOUNDS.maxX);
    p.y = THREEClamp(p.y + p.vy * dt, RACE_BOUNDS.minY, RACE_BOUNDS.maxY);

    let nextWp = p.nextWp ?? 1;
    const wp = wps[nextWp];
    if (Math.hypot(p.x - wp.x, p.y - wp.y) < 135) {
      if (wp.hasBoostPad && (p.boostUntilRace || 0) <= Date.now()) {
        p.boostUntilRace = Date.now() + 1350;
        p.nitro = Math.min(100, (p.nitro || 0) + 25);
      }
      if (wp.isCheckpoint && wp.checkpointNum) {
        if (wp.checkpointNum >= (p.nextCheckpoint || 1)) {
          p.checkpointsCleared = Math.max(p.checkpointsCleared || 0, wp.checkpointNum);
          p.nextCheckpoint = wp.checkpointNum + 1;
          p.score += 75;
        }
      }
      p.nextWp = (nextWp + 1) % wps.length;
      p.score += 35;
      p.dropsCollected = (p.dropsCollected || 0) + 1;
      nextWp = p.nextWp;
      if (nextWp === 1 && (p.checkpointsCleared || 0) >= 4) {
        p.lap = (p.lap || 1) + 1;
        p.checkpointsCleared = 0;
        p.nextCheckpoint = 1;
        if (p.lap > 3) {
          p.finished = true;
          p.finishTime = 180 - room.timeLeft;
          p.gemsCollected = (p.gemsCollected || 0) + 6;
        }
      }
    }

    const target = wps[p.nextWp ?? 0];
    const distNext = Math.hypot(p.x - target.x, p.y - target.y);
    const wpIdxAdj = (p.nextWp ?? 0) === 0 ? wps.length : (p.nextWp ?? 0);
    p.totalProgress = ((p.lap || 1) - 1) * 3000 + wpIdxAdj * 180 - distNext * 0.12;
  }
}

function THREEClamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stepRoom(room: TunnelRoom, dt: number): void {
  const now = Date.now();
  const mapSpec = getMapSpec(room.mapId);
  room.tick += 1;
  room.timeLeft = Math.max(0, room.timeLeft - dt);
  room.ringRadius = Math.max(210, ARENA_INITIAL_RING_RADIUS - (150 - room.timeLeft) * 3.4);

  if (room.timeLeft <= 0) {
    room.timeLeft = 150;
    room.ringRadius = ARENA_INITIAL_RING_RADIUS;
    room.crates = Array.from({ length: 10 }, (_, i) => spawnCrate(`rst_${i}`));
    room.beacon.active = false;
    room.nextBeaconIn = 10;
    let idx = 0;
    for (const p of room.players.values()) {
      const angle = (idx / Math.max(1, room.players.size)) * Math.PI * 2;
      p.x = ARENA_CENTER_X + Math.cos(angle) * 320;
      p.y = ARENA_CENTER_Y + Math.sin(angle) * 240;
      p.vx = 0;
      p.vy = 0;
      p.hp = 100;
      p.maxHp = 100;
      p.score = 0;
      p.wellDrops = 0;
      p.carriedDrops = 0;
      p.eliminated = false;
      p.emote = 'none';
      p.emoteUntil = 0;
      idx += 1;
    }
  }

  while (room.pickups.length < 30) {
    room.pickups.push(spawnPickup(`p_${room.tick}`, room.mapId));
  }
  while (room.crates.length < 10) {
    room.crates.push(spawnCrate(`c_${room.tick}`));
  }

  // Beacon event cycle
  if (room.beacon.active) {
    room.beacon.timeLeft = Math.max(0, room.beacon.timeLeft - dt);
    if (room.beacon.timeLeft <= 0) {
      room.beacon.active = false;
      room.nextBeaconIn = 11;
    }
  } else {
    room.nextBeaconIn -= dt;
    if (room.nextBeaconIn <= 0) {
      const a = Math.random() * Math.PI * 2;
      const d = 120 + Math.random() * Math.max(60, room.ringRadius - 170);
      room.beacon = {
        active: true,
        x: ARENA_CENTER_X + Math.cos(a) * d,
        y: ARENA_CENTER_Y + Math.sin(a) * d,
        radius: 64,
        timeLeft: 10,
      };
    }
  }

  for (const p of room.players.values()) {
    if (p.eliminated) continue;
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.throwCd = Math.max(0, p.throwCd - dt);
    p.meleeCd = Math.max(0, p.meleeCd - dt);
    if (p.emote && p.emote !== 'none' && now >= (p.emoteUntil || 0)) {
      p.emote = 'none';
    }

    if (p.isBot) {
      const dxCenter = ARENA_W / 2 - p.x;
      const dyCenter = ARENA_H / 2 - p.y;
      const distCenter = Math.hypot(dxCenter, dyCenter);

      if (p.gatherAtWellUntil && now < p.gatherAtWellUntil && distCenter > 56) {
        p.inputX = dxCenter / (distCenter || 1);
        p.inputY = dyCenter / (distCenter || 1);
      } else if (p.gatherAtWellUntil && now < p.gatherAtWellUntil) {
        p.inputX = 0;
        p.inputY = 0;
      } else if (distCenter > room.ringRadius - 35) {
        p.inputX = dxCenter / (distCenter || 1);
        p.inputY = dyCenter / (distCenter || 1);
      } else if (p.carriedDrops >= 3) {
        p.inputX = dxCenter / (distCenter || 1);
        p.inputY = dyCenter / (distCenter || 1);
      } else {
        let best = room.pickups[0];
        let bestDist = Infinity;
        for (const pk of room.pickups) {
          const d = Math.hypot(pk.x - p.x, pk.y - p.y);
          if (d < bestDist) {
            bestDist = d;
            best = pk;
          }
        }
        if (best) {
          const d = Math.hypot(best.x - p.x, best.y - p.y) || 1;
          p.inputX = (best.x - p.x) / d;
          p.inputY = (best.y - p.y) / d;
        }
      }

      if (p.throwCd <= 0) {
        let target: TunnelPlayerSnapshot | null = null;
        let minD = 260;
        for (const other of room.players.values()) {
          if (other.id === p.id || other.eliminated) continue;
          const d = Math.hypot(other.x - p.x, other.y - p.y);
          if (d < minD) {
            minD = d;
            target = other;
          }
        }
        if (target) {
          const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
          room.snowballs.push({
            id: `sb_${room.tick}_${p.id}`,
            ownerId: p.id,
            x: p.x + ((target.x - p.x) / d) * 22,
            y: p.y + ((target.y - p.y) / d) * 22,
            vx: ((target.x - p.x) / d) * 345,
            vy: ((target.y - p.y) / d) * 345,
            ttl: 1.2,
          });
          p.throwCd = 2.4 + Math.random() * 1.4;
        }
      }
    }

    const speed = (now < p.boostUntil ? 255 : 200) * mapSpec.speedMult;
    const len = Math.hypot(p.inputX, p.inputY);
    if (len > 0.05) {
      const nx = p.inputX / len;
      const ny = p.inputY / len;
      p.facingX = nx;
      p.facingY = ny;
      p.vx = p.vx * mapSpec.friction + nx * speed * (1 - mapSpec.friction);
      p.vy = p.vy * mapSpec.friction + ny * speed * (1 - mapSpec.friction);
    } else {
      p.vx *= mapSpec.friction;
      p.vy *= mapSpec.friction;
    }

    p.x = Math.max(30, Math.min(ARENA_W - 30, p.x + p.vx * dt));
    p.y = Math.max(30, Math.min(ARENA_H - 30, p.y + p.vy * dt));
    const resolved = resolveArenaObstacleCollision(p.x, p.y, p.vx, p.vy, 16, room.mapId);
    p.x = resolved.x;
    p.y = resolved.y;
    p.vx = resolved.vx;
    p.vy = resolved.vy;
    p.dashing = Math.hypot(p.vx, p.vy) > 280;

    // Dash smash crate check
    if (p.dashing) {
      for (let i = room.crates.length - 1; i >= 0; i--) {
        const cr = room.crates[i];
        if (Math.hypot(cr.x - p.x, cr.y - p.y) < 34) {
          p.score += 55;
          room.pickups.push({
            id: `cr_pk_${room.tick}_${i}`,
            kind: Math.random() < 0.65 ? 'gem' : 'shield',
            x: cr.x,
            y: cr.y,
          });
          room.crates.splice(i, 1);
        }
      }
    }

    // Central Well Deposit (bank 2+ carried drops for bonus & heal)
    const distFromCenter = Math.hypot(p.x - ARENA_W / 2, p.y - ARENA_H / 2);
    if (distFromCenter < 75 && p.carriedDrops >= 2) {
      p.score += p.carriedDrops * 25;
      p.wellDrops += p.carriedDrops;
      p.carriedDrops = 0;
      p.hp = Math.min(100, p.hp + 25);
    }

    // Beacon capture tick
    if (room.beacon.active && room.tick % 10 === 0) {
      if (Math.hypot(p.x - room.beacon.x, p.y - room.beacon.y) < room.beacon.radius) {
        p.score += 18;
        p.wellDrops += 1;
      }
    }

    // Ring damage check
    if (distFromCenter > room.ringRadius && room.tick % 20 === 0) {
      if (now >= p.shieldUntil) {
        p.hp = Math.max(0, p.hp - 15);
        if (p.hp === 0) p.eliminated = true;
      }
    }

    // Collect pickups (with magnet pull if magnetUntil active)
    const dropMult = now < room.blessingUntil ? 2 : 1;
    const hasMagnet = now < (p.magnetUntil || 0);
    for (let i = room.pickups.length - 1; i >= 0; i--) {
      const pk = room.pickups[i];
      const distPk = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (hasMagnet && distPk < 240 && distPk > 24 && (pk.kind === 'drop' || pk.kind === 'gem')) {
        pk.x += ((p.x - pk.x) / distPk) * 320 * dt;
        pk.y += ((p.y - pk.y) / distPk) * 320 * dt;
      }
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
        if (pk.kind === 'drop') {
          p.score += 15 * dropMult;
          p.wellDrops += dropMult;
          p.carriedDrops += dropMult;
        } else if (pk.kind === 'gem') {
          p.score += 30;
        } else if (pk.kind === 'shield') {
          p.shieldUntil = now + 10000;
          p.score += 25;
        } else if (pk.kind === 'boost') {
          p.boostUntil = now + 7000;
          p.score += 20;
        } else if (pk.kind === 'magnet') {
          p.magnetUntil = now + 10000;
          p.score += 25;
        } else if (pk.kind === 'triple') {
          p.tripleUntil = now + 10000;
          p.score += 25;
        } else if (pk.kind === 'medkit') {
          p.hp = Math.min(100, p.hp + 30);
          p.score += 20;
        }
        room.pickups.splice(i, 1);
      }
    }
  }

  // Synchronized Well Ritual check (2+ Yetis around Central Well performing matching wave/dance)
  if (now >= room.ritualCooldownUntil) {
    const waveGroup: typeof room.players extends Map<string, infer V> ? V[] : never = [];
    const danceGroup: typeof room.players extends Map<string, infer V> ? V[] : never = [];
    for (const p of room.players.values()) {
      if (p.eliminated) continue;
      if (Math.hypot(p.x - ARENA_W / 2, p.y - ARENA_H / 2) <= WELL_RITUAL_RADIUS && now < (p.emoteUntil || 0)) {
        if (p.emote === 'wave') waveGroup.push(p);
        else if (p.emote === 'dance') danceGroup.push(p);
      }
    }
    const ritualGroup = danceGroup.length >= 2 ? danceGroup : waveGroup.length >= 2 ? waveGroup : null;
    if (ritualGroup) {
      const kind: YetiEmoteKind = danceGroup.length >= 2 ? 'dance' : 'wave';
      room.blessingKind = kind;
      room.blessingUntil = now + 15000;
      room.ritualCooldownUntil = now + 16000;
      for (const participant of ritualGroup) {
        participant.wellDrops += 2;
        participant.score += 65;
        participant.hp = Math.min(100, participant.hp + 25);
      }
      triggerServerWellBlessing(15000, 25, 3);
    }
  }
  if (room.blessingKind !== 'none' && now >= room.blessingUntil) {
    room.blessingKind = 'none';
  }

  // Update snowballs (hit players + crates)
  for (let i = room.snowballs.length - 1; i >= 0; i--) {
    const sb = room.snowballs[i];
    sb.x += sb.vx * dt;
    sb.y += sb.vy * dt;
    sb.ttl -= dt;

    let hit = false;
    for (const p of room.players.values()) {
      if (p.id === sb.ownerId || p.eliminated) continue;
      if (Math.hypot(p.x - sb.x, p.y - sb.y) < 22) {
        hit = true;
        if (now >= p.shieldUntil) {
          p.vx += sb.vx * 0.75;
          p.vy += sb.vy * 0.75;
          p.hp = Math.max(0, p.hp - 20);
          if (p.hp === 0) p.eliminated = true;
          const shooter = room.players.get(sb.ownerId);
          if (shooter) shooter.score += 45;
        }
        break;
      }
    }

    if (!hit) {
      for (const obs of getMapObstacles(room.mapId)) {
        if (Math.hypot(obs.x - sb.x, obs.y - sb.y) < obs.radius + 5) {
          hit = true;
          break;
        }
      }
    }

    if (!hit) {
      for (let c = room.crates.length - 1; c >= 0; c--) {
        const cr = room.crates[c];
        if (Math.hypot(cr.x - sb.x, cr.y - sb.y) < 24) {
          hit = true;
          cr.hp -= 1;
          if (cr.hp <= 0) {
            const shooter = room.players.get(sb.ownerId);
            if (shooter) shooter.score += 55;
            room.pickups.push({
              id: `cr_drop_${room.tick}_${c}`,
              kind: Math.random() < 0.6 ? 'gem' : 'drop',
              x: cr.x,
              y: cr.y,
            });
            room.crates.splice(c, 1);
          }
          break;
        }
      }
    }

    if (hit || sb.ttl <= 0 || sb.x < 0 || sb.x > ARENA_W || sb.y < 0 || sb.y > ARENA_H) {
      room.snowballs.splice(i, 1);
    }
  }
}

function broadcastRoom(room: TunnelRoom): void {
  if (room.clients.size === 0) return;

  const snapshot: TunnelRoomSnapshot = {
    roomId: room.roomId,
    mapId: room.mapId,
    mode: room.mode,
    tick: room.tick,
    ringRadius: Math.round(room.ringRadius),
    timeLeft: Math.ceil(room.timeLeft),
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      vx: Math.round(p.vx),
      vy: Math.round(p.vy),
      facingX: Math.round(p.facingX * 100) / 100,
      facingY: Math.round(p.facingY * 100) / 100,
      hp: p.hp,
      maxHp: p.maxHp || 100,
      score: p.score,
      wellDrops: p.wellDrops,
      carriedDrops: p.carriedDrops,
      isBot: p.isBot,
      characterId: p.characterId || 'lofi_yeti',
      hat: p.hat,
      scarf: p.scarf,
      outfit: p.outfit || 'outfit_hoodie',
      colorway: p.colorway,
      shieldUntil: p.shieldUntil,
      boostUntil: p.boostUntil,
      magnetUntil: p.magnetUntil || 0,
      tripleUntil: p.tripleUntil || 0,
      dashing: p.dashing,
      eliminated: p.eliminated,
      emote: p.emote || 'none',
      emoteUntil: p.emoteUntil || 0,
      angle: p.angle,
      speed: p.speed,
      lap: p.lap,
      nextWp: p.nextWp,
      nextCheckpoint: p.nextCheckpoint,
      checkpointsCleared: p.checkpointsCleared,
      totalProgress: p.totalProgress,
      nitro: p.nitro,
      finished: p.finished,
      finishTime: p.finishTime,
      dropsCollected: p.dropsCollected,
      gemsCollected: p.gemsCollected,
    })),
    pickups: room.pickups,
    crates: room.crates,
    snowballs: room.snowballs.map(({ id, ownerId, x, y, vx, vy }) => ({
      id,
      ownerId,
      x: Math.round(x),
      y: Math.round(y),
      vx: Math.round(vx),
      vy: Math.round(vy),
    })),
    beacon: {
      ...room.beacon,
      timeLeft: Math.ceil(room.beacon.timeLeft),
    },
    blessingUntil: room.blessingUntil,
    blessingKind: room.blessingKind,
    globalWellDrops: getPublicWellImpact().totalDropsCollected,
    globalBonusDrops: getPublicWellImpact().activeBonusDrops,
  };

  const payload = JSON.stringify({ type: 'tunnel:state', snapshot });
  for (const ws of room.clients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

setInterval(() => {
  for (const room of tunnelRooms.values()) {
    if (room.clients.size > 0) {
      if (room.mode === 'car_racing') stepRaceRoom(room, 0.05);
      else stepRoom(room, 0.05);
      broadcastRoom(room);
    }
  }
}, 50);

// ============================================================================
// Express + Vite Middleware + WebSocket Server
// ============================================================================
async function startServer() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/tunnel' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/ws/tunnel', `http://localhost:${PORT}`);
    const mapParam = (url.searchParams.get('map') || 'glacier_well') as MapId;
    const mapId: MapId = ['glacier_well', 'volcanic_springs', 'aurora_summit', 'orbital_rift'].includes(mapParam)
      ? mapParam
      : 'glacier_well';
    const requestedMode = url.searchParams.get('mode') === 'car_racing' ? 'car_racing' : 'survival';
    const roomId = url.searchParams.get('room') || `${requestedMode === 'car_racing' ? 'tunnel-race' : 'tunnel'}-${mapId}`;
    const playerId = url.searchParams.get('playerId') || `p_${crypto.randomBytes(4).toString('hex')}`;
    const playerName = (url.searchParams.get('name') || 'Lofi Explorer').slice(0, 20);
    const hat = url.searchParams.get('hat') || 'hat_goggles';
    const scarf = url.searchParams.get('scarf') || 'scarf_lofi';
    const outfit = url.searchParams.get('outfit') || 'outfit_hoodie';
    const characterId = (url.searchParams.get('characterId') || 'lofi_yeti') as CharacterId;
    const colorway = (url.searchParams.get('colorway') || 'classic_lofi') as YetiColorId;

    let room = tunnelRooms.get(roomId);
    if (!room) {
      room = createTunnelRoom(roomId, mapId, requestedMode);
      tunnelRooms.set(roomId, room);
    }

    room.clients.set(playerId, ws);
    if (!room.players.has(playerId)) {
      const raceWaypoints = requestedMode === 'car_racing' ? getRaceTrackWaypoints(mapId) : null;
      const raceAngle = raceWaypoints
        ? Math.atan2(raceWaypoints[1].y - raceWaypoints[0].y, raceWaypoints[1].x - raceWaypoints[0].x)
        : 0;
      room.players.set(playerId, {
        id: playerId,
        name: playerName,
        x: raceWaypoints ? raceWaypoints[0].x - Math.cos(raceAngle) * 55 : ARENA_W / 2,
        y: raceWaypoints ? raceWaypoints[0].y - Math.sin(raceAngle) * 55 : ARENA_H / 2 + 85,
        vx: 0,
        vy: 0,
        hp: 100,
        maxHp: 100,
        score: 0,
        wellDrops: 0,
        carriedDrops: 0,
        isBot: false,
        characterId,
        hat,
        scarf,
        outfit,
        colorway,
        shieldUntil: 0,
        boostUntil: 0,
        magnetUntil: 0,
        tripleUntil: 0,
        dashing: false,
        eliminated: false,
        emote: 'none',
        emoteUntil: 0,
        inputX: 0,
        inputY: 0,
        dashCd: 0,
        throwCd: 0,
        meleeCd: 0,
        facingX: 0,
        facingY: -1,
        angle: raceAngle,
        speed: 0,
        lap: 1,
        nextWp: 1,
        nextCheckpoint: 1,
        checkpointsCleared: 0,
        totalProgress: 0,
        nitro: 100,
        finished: false,
        finishTime: 0,
        dropsCollected: 0,
        gemsCollected: 0,
        aiSpeedBias: 1,
        aiLaneOffset: -22,
        boostUntilRace: 0,
      });
    }

    ws.send(JSON.stringify({ type: 'tunnel:joined', playerId, roomId, mapId: room.mapId }));
    broadcastRoom(room);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const p = room?.players.get(playerId);
        if (!p || !room) return;

        if (msg.type === 'input') {
          p.inputX = Math.max(-1, Math.min(1, Number(msg.dx) || 0));
          p.inputY = Math.max(-1, Math.min(1, Number(msg.dy) || 0));
          if (room.mode === 'car_racing') {
            p.inputX = Math.max(-1, Math.min(1, Number(msg.steer ?? msg.dx) || 0));
            p.inputY = Math.max(-1, Math.min(1, Number(msg.throttle ?? -msg.dy) || 0));
          }
        } else if (msg.type === 'melee' && room.mode === 'survival' && p.meleeCd <= 0 && !p.eliminated) {
          p.meleeCd = 0.55;
          const hitX = p.x + p.facingX * 78;
          const hitY = p.y + p.facingY * 78;
          for (const other of room.players.values()) {
            if (other.id === p.id || other.eliminated) continue;
            if (Math.hypot(other.x - hitX, other.y - hitY) < 52) {
              other.hp = Math.max(0, other.hp - 1);
              if (other.hp === 0) other.eliminated = true;
              p.score += other.hp === 0 ? 90 : 25;
            }
          }
        } else if (msg.type === 'dash' && p.dashCd <= 0 && !p.eliminated) {
          if (room.mode === 'car_racing') {
            if ((p.nitro || 0) >= 25) {
              p.nitro = (p.nitro || 0) - 25;
              p.boostUntilRace = Date.now() + 1150;
            }
            return;
          }
          const dirX = Math.abs(p.inputX) > 0.1 || Math.abs(p.inputY) > 0.1 ? p.inputX : p.facingX;
          const dirY = Math.abs(p.inputX) > 0.1 || Math.abs(p.inputY) > 0.1 ? p.inputY : p.facingY;
          const mag = Math.hypot(dirX, dirY) || 1;
          p.vx = (dirX / mag) * 480;
          p.vy = (dirY / mag) * 480;
          p.dashCd = 1.4;
        } else if (msg.type === 'throw' && p.throwCd <= 0 && !p.eliminated) {
          const tx = Number(msg.aimX) || p.facingX;
          const ty = Number(msg.aimY) || p.facingY;
          const baseAngle = Math.atan2(ty, tx);
          const offsets = Date.now() < (p.tripleUntil || 0) ? [-0.2, 0, 0.2] : [0];
          offsets.forEach((off, idx) => {
            const ang = baseAngle + off;
            room!.snowballs.push({
              id: `sb_${room!.tick}_${playerId}_${idx}`,
              ownerId: playerId,
              x: p.x + Math.cos(ang) * 22,
              y: p.y + Math.sin(ang) * 22,
              vx: Math.cos(ang) * 410,
              vy: Math.sin(ang) * 410,
              ttl: 1.35,
            });
          });
          p.emote = 'none';
          p.emoteUntil = 0;
          p.throwCd = 0.45;
        } else if (msg.type === 'emote' && !p.eliminated) {
          const kind: YetiEmoteKind =
            msg.emote === 'dance' ? 'dance' : msg.emote === 'wave' ? 'wave' : 'none';
          if (kind !== 'none') {
            const nowMs = Date.now();
            p.emote = kind;
            p.emoteUntil = nowMs + (kind === 'dance' ? 3200 : 2400);
            for (const other of room.players.values()) {
              if (other.isBot && !other.eliminated) {
                const nearPlayer = Math.hypot(other.x - p.x, other.y - p.y) < 220;
                const playerAtWell =
                  Math.hypot(p.x - ARENA_W / 2, p.y - ARENA_H / 2) <= WELL_RITUAL_RADIUS;
                if (nearPlayer || (playerAtWell && Math.hypot(other.x - ARENA_W / 2, other.y - ARENA_H / 2) < 230)) {
                  other.emote = kind;
                  other.emoteUntil = nowMs + 2800;
                  if (playerAtWell) {
                    other.gatherAtWellUntil = nowMs + 2200;
                  }
                }
              }
            }
          }
        }
      } catch {
        // Ignore malformed packets
      }
    });

    ws.on('close', () => {
      room?.clients.delete(playerId);
      room?.players.delete(playerId);
    });
  });

  // REST API endpoints
  app.get('/api/state', (_req, res) => {
    const rooms = Array.from(tunnelRooms.values()).map((r) => ({
      roomId: r.roomId,
      mapId: r.mapId,
      humanPlayers: r.clients.size,
      totalContenders: r.players.size,
      timeLeft: Math.ceil(r.timeLeft),
    }));
    res.json({
      leaderboard: state.leaderboard,
      wellImpact: getPublicWellImpact(),
      rooms,
    });
  });

  app.post('/api/well/ritual', (req, res) => {
    const { kind } = req.body as { kind?: 'wave' | 'dance' };
    const bonusDrops = kind === 'dance' ? 30 : 25;
    const permDrops = kind === 'dance' ? 4 : 3;
    const wellImpact = triggerServerWellBlessing(15000, bonusDrops, permDrops);
    res.json({ wellImpact });
  });

  app.get('/api/yeti/:address', (req, res) => {
    const yeti = state.yetis[req.params.address];
    if (!yeti) {
      return res.status(404).json({ error: 'No Yeti minted for this address yet' });
    }
    res.json({ yeti: normalizeYeti(yeti) });
  });

  app.post('/api/yeti/mint', (req, res) => {
    const { ownerAddress, yetiName, authMethod, colorway, characterId, customColors, outfit } =
      req.body as {
        ownerAddress?: string;
        yetiName?: string;
        authMethod?: YetiObject['authMethod'];
        colorway?: YetiColorId;
        characterId?: CharacterId;
        customColors?: CustomCharacterColors;
        outfit?: string;
      };

    const address = (ownerAddress || randomHex(32)).trim();
    const cleanName = (yetiName || 'Lofi Cub').trim().slice(0, 24) || 'Lofi Cub';
    const digest = randomHex(32);
    const objectId = randomHex(32);
    const chosenChar: CharacterId = characterId || 'lofi_yeti';
    const chosenOutfit = outfit || 'outfit_hoodie';

    const receipt: PtbReceipt = {
      digest,
      action: `player_profile::mint_and_keep (${chosenChar})`,
      gasSponsored: true,
      gasMist: 0,
      timestamp: new Date().toISOString(),
      objectId,
    };

    const yetiBase: YetiObject = {
      objectId,
      ownerAddress: address,
      authMethod: authMethod || 'zkLogin (Google)',
      name: cleanName,
      characterId: chosenChar,
      stage: 'Frost Cub',
      level: 1,
      xp: 0,
      frostGems: 75,
      wellDropsContributed: 0,
      highScore: 0,
      runsCompleted: 0,
      version: 1,
      colorway: colorway || 'classic_lofi',
      customColors: customColors || undefined,
      mapsPlayed: [],
      totalHits: 0,
      cratesSmashed: 0,
      tasksCompleted: 0,
      claimedQuests: [],
      equipped: {
        hat: 'hat_goggles',
        scarf: 'scarf_lofi',
        outfit: chosenOutfit,
        trail: 'trail_powder',
      },
      unlockedCosmetics: ['hat_goggles', 'scarf_lofi', 'outfit_none', 'outfit_hoodie', 'trail_powder'],
      recentPtbs: [receipt],
      recentRuns: [],
    };

    const yeti = normalizeYeti(yetiBase);
    yeti.blockchain = {
      network: 'sui:testnet',
      stateRootHash: computeServerStateRoot(yeti),
      lastTxDigest: digest,
      profileObjectId: objectId,
      lastSyncedAt: new Date().toISOString(),
      onChainVerified: true,
    };

    state.yetis[address] = yeti;
    state.wellImpact.activeContributors += 1;
    saveState(state);

    res.json({ yeti, receipt });
  });

  app.post('/api/yeti/evolve', (req, res) => {
    const {
      ownerAddress,
      action,
      cosmeticId,
      slot,
      gemCost,
      colorway,
      characterId,
      customColors,
      blockchain,
      questId,
    } = req.body as {
      ownerAddress: string;
      action:
        | 'evolve'
        | 'unlock_cosmetic'
        | 'equip_cosmetic'
        | 'set_colorway'
        | 'set_character'
        | 'set_custom_colors'
        | 'sync_blockchain'
        | 'claim_quest';
      cosmeticId?: string;
      slot?: CosmeticSlot;
      gemCost?: number;
      colorway?: YetiColorId;
      characterId?: CharacterId;
      customColors?: CustomCharacterColors | null;
      blockchain?: Partial<BlockchainSyncState>;
      questId?: string;
    };

    const rawYeti = state.yetis[ownerAddress];
    if (!rawYeti) {
      return res.status(404).json({ error: 'Character profile not found' });
    }
    const yeti = normalizeYeti(rawYeti);
    state.yetis[ownerAddress] = yeti;

    const stages: YetiStage[] = ['Frost Cub', 'Glacier Runner', 'Blizzard Guardian', 'Apex Lofi'];
    let ptbAction = '';

    if (action === 'evolve') {
      const idx = stages.indexOf(yeti.stage);
      if (idx >= stages.length - 1) {
        return res.status(400).json({ error: 'Hero has already reached Apex Lofi stage' });
      }
      const reqXp = (idx + 1) * 300;
      if (yeti.xp < reqXp) {
        return res.status(400).json({ error: `Requires ${reqXp} XP to evolve (currently ${yeti.xp} XP)` });
      }
      yeti.stage = stages[idx + 1];
      yeti.version += 1;
      ptbAction = `player_profile::evolve -> ${yeti.stage}`;
    } else if (action === 'unlock_cosmetic' && cosmeticId && slot) {
      const cost = Math.max(0, Number(gemCost) || 0);
      if (!yeti.unlockedCosmetics.includes(cosmeticId)) {
        if (yeti.frostGems < cost) {
          return res.status(400).json({ error: 'Not enough Frost Gems yet' });
        }
        yeti.frostGems -= cost;
        yeti.unlockedCosmetics.push(cosmeticId);
      }
      yeti.equipped[slot] = cosmeticId;
      yeti.version += 1;
      ptbAction = `cosmetics::unlock_and_equip (${slot}: ${cosmeticId})`;
    } else if (action === 'equip_cosmetic' && cosmeticId && slot) {
      if (!yeti.unlockedCosmetics.includes(cosmeticId)) {
        return res.status(400).json({ error: 'Cosmetic not unlocked yet' });
      }
      yeti.equipped[slot] = cosmeticId;
      yeti.version += 1;
      ptbAction = `player_profile::equip_${slot} (${cosmeticId})`;
    } else if (action === 'set_colorway' && colorway) {
      yeti.colorway = colorway;
      yeti.version += 1;
      ptbAction = `player_profile::set_colorway (${colorway})`;
    } else if (action === 'set_character' && characterId) {
      yeti.characterId = characterId;
      yeti.version += 1;
      ptbAction = `player_profile::select_character (${characterId})`;
    } else if (action === 'set_custom_colors') {
      yeti.customColors = customColors ? { ...customColors } : undefined;
      yeti.version += 1;
      ptbAction = customColors
        ? `player_profile::set_custom_palette (${customColors.furHex || 'preset'})`
        : 'player_profile::reset_custom_palette';
    } else if (action === 'sync_blockchain' && blockchain) {
      const rootHash = blockchain.stateRootHash || computeServerStateRoot(yeti);
      yeti.blockchain = {
        network: 'sui:testnet',
        walrusBlobId: blockchain.walrusBlobId || yeti.blockchain?.walrusBlobId,
        walrusUrl: blockchain.walrusUrl || yeti.blockchain?.walrusUrl,
        lastTxDigest: blockchain.lastTxDigest || yeti.blockchain?.lastTxDigest,
        profileObjectId: blockchain.profileObjectId || yeti.blockchain?.profileObjectId || yeti.objectId,
        walletSignature: blockchain.walletSignature || yeti.blockchain?.walletSignature,
        stateRootHash: rootHash,
        lastSyncedAt: blockchain.lastSyncedAt || new Date().toISOString(),
        onChainVerified: Boolean(blockchain.onChainVerified ?? true),
      };
      yeti.version += 1;
      ptbAction = blockchain.walrusBlobId
        ? `walrus_sui::anchor_state (${blockchain.walrusBlobId.slice(0, 12)}...)`
        : 'sui::anchor_state_root';
    } else if (action === 'claim_quest' && questId) {
      const quest = CAREER_QUESTS.find((q) => q.id === questId);
      if (!quest) {
        return res.status(404).json({ error: 'Quest not found' });
      }
      if (yeti.claimedQuests.includes(questId)) {
        return res.status(400).json({ error: 'Quest reward already claimed' });
      }
      const progress =
        quest.metric === 'wellDrops'
          ? yeti.wellDropsContributed
          : quest.metric === 'hitsLanded'
          ? yeti.totalHits
          : quest.metric === 'cratesSmashed'
          ? yeti.cratesSmashed
          : quest.metric === 'tasksCompleted'
          ? yeti.tasksCompleted
          : yeti.mapsPlayed.length;

      if (progress < quest.target) {
        return res.status(400).json({ error: `Quest progress ${progress}/${quest.target}` });
      }
      yeti.claimedQuests.push(questId);
      yeti.frostGems += quest.rewardGems;
      yeti.xp += quest.rewardXp;
      yeti.level = 1 + Math.floor(yeti.xp / 250);
      yeti.version += 1;
      ptbAction = `quests::claim_reward (+${quest.rewardGems} Gems, +${quest.rewardXp} XP)`;
    } else {
      return res.status(400).json({ error: 'Invalid evolution action' });
    }

    const receiptDigest = blockchain?.lastTxDigest || randomHex(32);
    const receipt: PtbReceipt = {
      digest: receiptDigest,
      action: ptbAction,
      gasSponsored: true,
      gasMist: 0,
      timestamp: new Date().toISOString(),
      objectId: yeti.objectId,
    };
    yeti.recentPtbs = [receipt, ...yeti.recentPtbs].slice(0, 12);
    if (yeti.blockchain && action !== 'sync_blockchain') {
      yeti.blockchain.stateRootHash = computeServerStateRoot(yeti);
    }
    saveState(state);

    res.json({ yeti, receipt });
  });

  app.post('/api/runs/record', (req, res) => {
    const {
      ownerAddress,
      playerName,
      score,
      wellDrops,
      frostGems,
      survivalSeconds,
      mode,
      gameMode,
      mapId,
      hitsLanded,
      cratesSmashed,
      tasksDone,
      characterId,
      walrusBlobId,
      txDigest,
    } = req.body as {
      ownerAddress?: string;
      playerName?: string;
      score: number;
      wellDrops: number;
      frostGems: number;
      survivalSeconds: number;
      mode: 'solo' | 'tunnel';
      gameMode?: GameModeId;
      mapId?: MapId;
      hitsLanded?: number;
      cratesSmashed?: number;
      tasksDone?: number;
      characterId?: CharacterId;
      walrusBlobId?: string;
      txDigest?: string;
    };

    const cleanScore = Math.max(0, Math.round(Number(score) || 0));
    const cleanDrops = Math.max(0, Math.round(Number(wellDrops) || 0));
    const cleanGems = Math.max(0, Math.round(Number(frostGems) || 0));
    const cleanTime = Math.max(1, Math.round(Number(survivalSeconds) || 1));
    const cleanHits = Math.max(0, Math.round(Number(hitsLanded) || 0));
    const cleanCrates = Math.max(0, Math.round(Number(cratesSmashed) || 0));
    const cleanTasks = Math.max(0, Math.round(Number(tasksDone) || 0));
    const validMapId: MapId =
      mapId && ['glacier_well', 'volcanic_springs', 'aurora_summit', 'orbital_rift'].includes(mapId)
        ? mapId
        : 'glacier_well';
    const validGameMode: GameModeId =
      gameMode &&
      [
        'survival',
        'car_racing',
        'shooting',
        'stickman_brawl',
        'stickman_wrestling',
        'stickman_run',
      ].includes(gameMode)
        ? gameMode
        : 'survival';

    const xpEarned = Math.round(cleanScore / 5) + 25 + cleanTasks * 20;
    const digest = txDigest || randomHex(32);
    const nowIso = new Date().toISOString();

    let updatedYeti: YetiObject | null = null;
    if (ownerAddress && state.yetis[ownerAddress]) {
      const y = normalizeYeti(state.yetis[ownerAddress]);
      y.xp += xpEarned;
      y.level = 1 + Math.floor(y.xp / 250);
      y.frostGems += cleanGems;
      y.wellDropsContributed += cleanDrops;
      y.totalHits += cleanHits;
      y.cratesSmashed += cleanCrates;
      y.tasksCompleted += cleanTasks;
      if (!y.mapsPlayed.includes(validMapId)) {
        y.mapsPlayed.push(validMapId);
      }
      y.runsCompleted += 1;
      y.version += 1;
      if (cleanScore > y.highScore) y.highScore = cleanScore;

      const runRecord: OnChainRunRecord = {
        id: `run_${crypto.randomBytes(4).toString('hex')}`,
        characterId: characterId || y.characterId || 'lofi_yeti',
        gameMode: validGameMode,
        mapId: validMapId,
        score: cleanScore,
        xpEarned,
        wellDrops: cleanDrops,
        frostGems: cleanGems,
        survivalSeconds: cleanTime,
        walrusBlobId,
        txDigest: digest,
        timestamp: nowIso,
      };
      y.recentRuns = [runRecord, ...(y.recentRuns || [])].slice(0, 15);

      const receipt: PtbReceipt = {
        digest,
        action: `arena_session::settle_match (${validGameMode}/${validMapId} · +${xpEarned} XP, +${cleanDrops} Drops)`,
        gasSponsored: true,
        gasMist: 0,
        timestamp: nowIso,
        objectId: y.objectId,
      };
      y.recentPtbs = [receipt, ...y.recentPtbs].slice(0, 12);
      if (y.blockchain) {
        y.blockchain.stateRootHash = computeServerStateRoot(y);
        y.blockchain.lastTxDigest = digest;
        if (walrusBlobId) y.blockchain.walrusBlobId = walrusBlobId;
        y.blockchain.lastSyncedAt = nowIso;
      }

      state.yetis[ownerAddress] = y;
      updatedYeti = y;
    }

    state.wellImpact.totalDropsCollected += cleanDrops;
    state.wellImpact.wellsFunded = Math.floor(
      state.wellImpact.totalDropsCollected / state.wellImpact.dropsPerWellMilestone
    );

    const entry: LeaderboardEntry = {
      id: `run_${crypto.randomBytes(4).toString('hex')}`,
      playerName: (playerName || 'Arctic Player').slice(0, 20),
      yetiName: updatedYeti ? updatedYeti.name : 'Guest Hero',
      yetiStage: updatedYeti ? updatedYeti.stage : 'Frost Cub',
      score: cleanScore,
      wellDrops: cleanDrops,
      frostGems: cleanGems,
      survivalSeconds: cleanTime,
      mode: mode === 'tunnel' ? 'tunnel' : 'solo',
      gameMode: validGameMode,
      mapId: validMapId,
      txDigest: digest,
      timestamp: nowIso,
    };

    state.leaderboard = [entry, ...state.leaderboard]
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);

    saveState(state);

    res.json({
      entry,
      yeti: updatedYeti,
      wellImpact: getPublicWellImpact(),
      leaderboard: state.leaderboard,
      xpEarned,
    });
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Yeti Flurry Rush running on http://localhost:${PORT}`);
  });
}

startServer();
