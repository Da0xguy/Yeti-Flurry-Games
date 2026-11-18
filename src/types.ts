export type NavTab = 'home' | 'arena' | 'yeti' | 'leaderboard' | 'docs';

export type YetiStage = 'Frost Cub' | 'Glacier Runner' | 'Blizzard Guardian' | 'Apex Lofi';

export type CosmeticSlot = 'hat' | 'scarf' | 'trail';

export type MapId = 'glacier_well' | 'volcanic_springs' | 'aurora_summit';

export type GameModeId = 'survival' | 'car_racing' | 'shooting';

export interface GameModeSpec {
  id: GameModeId;
  name: string;
  shortLabel: string;
  subtitle: string;
  description: string;
  controlsSummary: string;
  supportsTunnel: boolean;
}

export type YetiColorId =
  | 'classic_lofi'
  | 'glacier_mint'
  | 'aurora_violet'
  | 'sunset_ember'
  | 'midnight_cyan'
  | 'golden_frost';

export interface YetiColorway {
  id: YetiColorId;
  name: string;
  furHex: string;
  skinHex: string;
  chinHex: string;
  accentHex: string;
}

export interface ArenaObstacle {
  id: string;
  x: number;
  y: number;
  radius: number;
  kind: 'iceberg' | 'basalt_pillar' | 'aurora_obelisk';
  height: number;
}

export interface ArenaMapSpec {
  id: MapId;
  name: string;
  subtitle: string;
  description: string;
  friction: number;
  speedMult: number;
  accentHex: string;
  hazardName: string;
  obstacleLabel: string;
  landmarkName: string;
}

export interface CosmeticItem {
  id: string;
  name: string;
  slot: CosmeticSlot;
  costGems: number;
  description: string;
  colorHex: string;
  walrusBlobId: string;
}

export interface PtbReceipt {
  digest: string;
  action: string;
  gasSponsored: boolean;
  gasMist: number;
  timestamp: string;
  objectId: string;
}

export interface CareerQuest {
  id: string;
  title: string;
  description: string;
  metric: 'wellDrops' | 'hitsLanded' | 'tasksCompleted' | 'mapsVisited' | 'cratesSmashed';
  target: number;
  rewardGems: number;
  rewardXp: number;
}

export interface ArenaTaskProgress {
  id: string;
  title: string;
  progress: number;
  target: number;
  rewardGems: number;
  completed: boolean;
}

export interface YetiObject {
  objectId: string;
  ownerAddress: string;
  authMethod: 'zkLogin (Google)' | 'Sui Wallet' | 'Sponsored Guest';
  name: string;
  stage: YetiStage;
  level: number;
  xp: number;
  frostGems: number;
  wellDropsContributed: number;
  highScore: number;
  runsCompleted: number;
  version: number;
  colorway: YetiColorId;
  mapsPlayed: MapId[];
  totalHits: number;
  cratesSmashed: number;
  tasksCompleted: number;
  claimedQuests: string[];
  equipped: {
    hat: string;
    scarf: string;
    trail: string;
  };
  unlockedCosmetics: string[];
  recentPtbs: PtbReceipt[];
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  yetiName: string;
  yetiStage: YetiStage;
  score: number;
  wellDrops: number;
  frostGems: number;
  survivalSeconds: number;
  mode: 'solo' | 'tunnel';
  gameMode?: GameModeId;
  mapId?: MapId;
  txDigest: string;
  timestamp: string;
}

export interface WellImpactState {
  totalDropsCollected: number;
  dropsPerWellMilestone: number;
  wellsFunded: number;
  activeContributors: number;
  activeBonusDrops?: number;
  blessingUntil?: number;
}

export interface RunSummary {
  score: number;
  wellDrops: number;
  frostGems: number;
  knockouts: number;
  survivalSeconds: number;
  mode: 'solo' | 'tunnel';
  gameMode?: GameModeId;
  mapId: MapId;
  hitsLanded: number;
  cratesSmashed: number;
  wellBanks: number;
  tasksDone: number;
  rank: number;
  totalContenders: number;
  xpEarned: number;
  extraStatLabel?: string;
  extraStatValue?: string;
}

export type YetiEmoteKind = 'none' | 'wave' | 'dance';

export interface TunnelPlayerSnapshot {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp?: number;
  score: number;
  wellDrops: number;
  carriedDrops: number;
  isBot: boolean;
  hat: string;
  scarf: string;
  colorway: YetiColorId;
  shieldUntil: number;
  boostUntil: number;
  magnetUntil?: number;
  tripleUntil?: number;
  dashing: boolean;
  eliminated: boolean;
  emote?: YetiEmoteKind;
  emoteUntil?: number;
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
}

export interface TunnelPickupSnapshot {
  id: string;
  kind: 'drop' | 'gem' | 'shield' | 'boost' | 'magnet' | 'triple' | 'medkit';
  x: number;
  y: number;
}

export interface TunnelCrateSnapshot {
  id: string;
  x: number;
  y: number;
  hp: number;
}

export interface TunnelSnowballSnapshot {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface TunnelBeaconSnapshot {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  timeLeft: number;
}

export interface TunnelRoomSnapshot {
  roomId: string;
  mapId: MapId;
  mode?: GameModeId;
  tick: number;
  ringRadius: number;
  timeLeft: number;
  players: TunnelPlayerSnapshot[];
  pickups: TunnelPickupSnapshot[];
  crates: TunnelCrateSnapshot[];
  snowballs: TunnelSnowballSnapshot[];
  beacon: TunnelBeaconSnapshot;
  blessingUntil?: number;
  blessingKind?: YetiEmoteKind;
  globalWellDrops?: number;
  globalBonusDrops?: number;
}
