import type {
  CharacterId,
  CosmeticSlot,
  CustomCharacterColors,
  OnChainRunRecord,
  YetiColorId,
  YetiObject,
  YetiStage,
} from '../types';

const WALRUS_PUBLISHER =
  'https://publisher.walrus-testnet.walrus.space/v1/blobs';
const WALRUS_AGGREGATOR =
  'https://aggregator.walrus-testnet.walrus.space/v1/blobs';

export interface PlayerProfileBlob {
  walletAddress: string;
  displayName: string;
  yetiName: string;
  characterId?: CharacterId;
  colorway: string;
  customColors?: CustomCharacterColors;
  createdAt: string;
  schemaVersion: 1;
}

export interface PlayerGameStateBlob {
  schemaVersion: 2;
  ownerAddress: string;
  displayName: string;
  characterId: CharacterId;
  colorway: YetiColorId;
  customColors?: CustomCharacterColors;
  equipped: Record<CosmeticSlot, string>;
  unlockedCosmetics: string[];
  stage: YetiStage;
  level: number;
  xp: number;
  frostGems: number;
  wellDropsContributed: number;
  highScore: number;
  runsCompleted: number;
  mapsPlayed: string[];
  claimedQuests: string[];
  recentRuns: OnChainRunRecord[];
  stateRootHash?: string;
  syncedAt: string;
}

export interface WalrusBlobReceipt {
  blobId: string;
  aggregatorUrl: string;
  liveTestnet: boolean;
}

async function putBlobToWalrus(
  bodyPayload: unknown,
  timeoutMs = 6500
): Promise<WalrusBlobReceipt> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${WALRUS_PUBLISHER}?epochs=5`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Walrus publisher responded ${response.status}`);
    }

    const payload = (await response.json()) as {
      newlyCreated?: { blobObject?: { blobId?: string } };
      alreadyCertified?: { blobId?: string };
    };
    const blobId =
      payload.newlyCreated?.blobObject?.blobId || payload.alreadyCertified?.blobId;

    if (!blobId) {
      throw new Error('Walrus returned no blob ID');
    }

    return {
      blobId,
      aggregatorUrl: `${WALRUS_AGGREGATOR}/${encodeURIComponent(blobId)}`,
      liveTestnet: true,
    };
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function uploadPlayerProfile(
  profile: PlayerProfileBlob
): Promise<WalrusBlobReceipt> {
  return putBlobToWalrus(profile, 7000);
}

export async function uploadPlayerGameState(
  stateBlob: PlayerGameStateBlob
): Promise<WalrusBlobReceipt> {
  return putBlobToWalrus(stateBlob, 6500);
}

export function buildWalrusGameStateBlob(
  yeti: YetiObject,
  stateRootHash?: string
): PlayerGameStateBlob {
  return {
    schemaVersion: 2,
    ownerAddress: yeti.ownerAddress,
    displayName: yeti.name,
    characterId: yeti.characterId || 'lofi_yeti',
    colorway: yeti.colorway,
    customColors: yeti.customColors,
    equipped: {
      hat: yeti.equipped.hat || 'hat_goggles',
      scarf: yeti.equipped.scarf || 'scarf_lofi',
      outfit: yeti.equipped.outfit || 'outfit_hoodie',
      trail: yeti.equipped.trail || 'trail_powder',
    },
    unlockedCosmetics: [...yeti.unlockedCosmetics],
    stage: yeti.stage,
    level: yeti.level,
    xp: yeti.xp,
    frostGems: yeti.frostGems,
    wellDropsContributed: yeti.wellDropsContributed,
    highScore: yeti.highScore,
    runsCompleted: yeti.runsCompleted,
    mapsPlayed: [...yeti.mapsPlayed],
    claimedQuests: [...yeti.claimedQuests],
    recentRuns: (yeti.recentRuns || []).slice(0, 15),
    stateRootHash,
    syncedAt: new Date().toISOString(),
  };
}
