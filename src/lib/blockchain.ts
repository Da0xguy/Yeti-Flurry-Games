import { Transaction } from '@mysten/sui/transactions';
import type { YetiObject } from '../types';
import { buildWalrusGameStateBlob, uploadPlayerGameState } from './walrus';

const SUI_TESTNET_RPC = 'https://fullnode.testnet.sui.io:443';
export const PLAYER_PROFILE_PACKAGE_ID = import.meta.env
  .VITE_PLAYER_PROFILE_PACKAGE_ID as string | undefined;

export interface SuiTestnetWalletInfo {
  address: string;
  suiBalanceMist: string;
  suiBalanceFormatted: string;
  profileObjects: { objectId: string; version?: string; digest?: string }[];
  rpcOnline: boolean;
}

export interface BlockchainAnchorResult {
  walrusBlobId: string;
  walrusUrl: string;
  walrusLive: boolean;
  stateRootHash: string;
  txDigest?: string;
  profileObjectId?: string;
  walletSignature?: string;
  onChainVerified: boolean;
  network: 'sui:testnet';
  syncedAt: string;
}

export async function computeStateRootHash(payload: unknown): Promise<string> {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const arr = Array.from(new Uint8Array(digest));
  return '0x' + arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function suiRpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Sui RPC HTTP ${res.status}`);
    }
    const json = (await res.json()) as { result?: T; error?: { message?: string } };
    if (json.error) {
      throw new Error(json.error.message || 'Sui RPC error');
    }
    return json.result as T;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function fetchSuiTestnetWalletInfo(
  address: string
): Promise<SuiTestnetWalletInfo> {
  try {
    const balanceRes = await suiRpcCall<{ totalBalance?: string }>('suix_getBalance', [
      address,
      '0x2::sui::SUI',
    ]);
    const mist = BigInt(balanceRes?.totalBalance || '0');
    const whole = mist / 1_000_000_000n;
    const frac = ((mist % 1_000_000_000n) / 1_000_000n)
      .toString()
      .padStart(3, '0');

    let profileObjects: { objectId: string; version?: string; digest?: string }[] = [];
    if (PLAYER_PROFILE_PACKAGE_ID) {
      const owned = await suiRpcCall<{
        data?: { data?: { objectId: string; version?: string; digest?: string } }[];
      }>('suix_getOwnedObjects', [
        address,
        {
          filter: {
            StructType: `${PLAYER_PROFILE_PACKAGE_ID}::player_profile::PlayerProfile`,
          },
          options: { showType: true },
        },
      ]);
      profileObjects = (owned?.data || [])
        .map((entry) => entry.data)
        .filter((d): d is { objectId: string; version?: string; digest?: string } => Boolean(d?.objectId));
    }

    return {
      address,
      suiBalanceMist: mist.toString(),
      suiBalanceFormatted: `${whole}.${frac} SUI`,
      profileObjects,
      rpcOnline: true,
    };
  } catch {
    return {
      address,
      suiBalanceMist: '0',
      suiBalanceFormatted: '0.000 SUI',
      profileObjects: [],
      rpcOnline: false,
    };
  }
}

interface DAppKitLike {
  signAndExecuteTransaction: (args: {
    transaction: Transaction;
  }) => Promise<Record<string, unknown>>;
  signPersonalMessage?: (args: {
    message: Uint8Array;
  }) => Promise<{ signature?: string; bytes?: string }>;
}

export async function anchorGameDataOnChain(params: {
  yeti: YetiObject;
  walletAddress?: string;
  dAppKit?: DAppKitLike;
  existingProfileObjectId?: string;
  interactiveWalletSign?: boolean;
}): Promise<BlockchainAnchorResult> {
  const {
    yeti,
    walletAddress,
    dAppKit,
    existingProfileObjectId,
    interactiveWalletSign = false,
  } = params;

  const baseBlob = buildWalrusGameStateBlob(yeti);
  const stateRootHash = await computeStateRootHash({
    ownerAddress: baseBlob.ownerAddress,
    characterId: baseBlob.characterId,
    colorway: baseBlob.colorway,
    customColors: baseBlob.customColors,
    equipped: baseBlob.equipped,
    unlockedCosmetics: baseBlob.unlockedCosmetics,
    stage: baseBlob.stage,
    level: baseBlob.level,
    xp: baseBlob.xp,
    frostGems: baseBlob.frostGems,
    wellDropsContributed: baseBlob.wellDropsContributed,
    highScore: baseBlob.highScore,
    runsCompleted: baseBlob.runsCompleted,
    mapsPlayed: baseBlob.mapsPlayed,
    claimedQuests: baseBlob.claimedQuests,
    recentRuns: baseBlob.recentRuns,
  });

  const fullBlob = { ...baseBlob, stateRootHash };
  let walrusBlobId = `walrus_hash_${stateRootHash.slice(2, 18)}`;
  let walrusUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${walrusBlobId}`;
  let walrusLive = false;

  try {
    const receipt = await uploadPlayerGameState(fullBlob);
    walrusBlobId = receipt.blobId;
    walrusUrl = receipt.aggregatorUrl;
    walrusLive = receipt.liveTestnet;
  } catch {
    // Graceful fallback when Walrus testnet publisher is throttled or offline
  }

  let txDigest: string | undefined;
  let profileObjectId = existingProfileObjectId;
  let walletSignature: string | undefined;
  let onChainVerified = walrusLive;

  if (walletAddress && dAppKit && interactiveWalletSign) {
    if (PLAYER_PROFILE_PACKAGE_ID) {
      const tx = new Transaction();
      const customColorsJson = JSON.stringify(yeti.customColors || {});
      if (profileObjectId) {
        tx.moveCall({
          target: `${PLAYER_PROFILE_PACKAGE_ID}::player_profile::sync_game_data`,
          arguments: [
            tx.object(profileObjectId),
            tx.pure.string(yeti.characterId || 'lofi_yeti'),
            tx.pure.string(yeti.colorway),
            tx.pure.string(customColorsJson),
            tx.pure.string(yeti.equipped.hat || 'hat_goggles'),
            tx.pure.string(yeti.equipped.scarf || 'scarf_lofi'),
            tx.pure.string(yeti.equipped.outfit || 'outfit_hoodie'),
            tx.pure.string(yeti.equipped.trail || 'trail_powder'),
            tx.pure.u64(yeti.level),
            tx.pure.u64(yeti.xp),
            tx.pure.u64(yeti.frostGems),
            tx.pure.u64(yeti.wellDropsContributed),
            tx.pure.u64(yeti.highScore),
            tx.pure.u64(yeti.runsCompleted),
            tx.pure.string(walrusBlobId),
            tx.pure.string(walrusUrl),
            tx.object('0x6'),
          ],
        });
      } else {
        tx.moveCall({
          target: `${PLAYER_PROFILE_PACKAGE_ID}::player_profile::create_profile`,
          arguments: [
            tx.pure.string(yeti.name),
            tx.pure.string(yeti.characterId || 'lofi_yeti'),
            tx.pure.string(yeti.colorway),
            tx.pure.string(customColorsJson),
            tx.pure.string(yeti.equipped.hat || 'hat_goggles'),
            tx.pure.string(yeti.equipped.scarf || 'scarf_lofi'),
            tx.pure.string(yeti.equipped.outfit || 'outfit_hoodie'),
            tx.pure.string(yeti.equipped.trail || 'trail_powder'),
            tx.pure.string(walrusBlobId),
            tx.pure.string(walrusUrl),
            tx.object('0x6'),
          ],
        });
      }
      const res = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if ('FailedTransaction' in res && res.FailedTransaction) {
        const failed = res.FailedTransaction as { status?: { error?: { message?: string } } };
        throw new Error(failed.status?.error?.message || 'On-chain profile sync failed');
      }
      const exec = res.Transaction as { digest?: string } | undefined;
      if (exec?.digest) {
        txDigest = exec.digest;
      }
      onChainVerified = true;
    } else if (dAppKit.signPersonalMessage) {
      const commitment = [
        'Yeti Flurry Rush — Sui State Anchor',
        `Player: ${yeti.name}`,
        `Character: ${yeti.characterId || 'lofi_yeti'} (${yeti.colorway})`,
        `Outfit: ${yeti.equipped.outfit || 'outfit_hoodie'} | Hat: ${yeti.equipped.hat}`,
        `Progress: Lv ${yeti.level} · ${yeti.xp} XP · ${yeti.highScore} High Score`,
        `Walrus Blob: ${walrusBlobId}`,
        `SHA-256 State Root: ${stateRootHash}`,
      ].join('\n');
      const signed = await dAppKit.signPersonalMessage({
        message: new TextEncoder().encode(commitment),
      });
      walletSignature = signed.signature;
      onChainVerified = true;
    }
  }

  return {
    walrusBlobId,
    walrusUrl,
    walrusLive,
    stateRootHash,
    txDigest,
    profileObjectId,
    walletSignature,
    onChainVerified,
    network: 'sui:testnet',
    syncedAt: new Date().toISOString(),
  };
}
