import { useDAppKit, useWalletConnection } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { Transaction } from '@mysten/sui/transactions';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Home } from 'lucide-react';
import type {
  CharacterId,
  CosmeticSlot,
  CustomCharacterColors,
  GameModeId,
  LeaderboardEntry,
  MapId,
  NavTab,
  RunSummary,
  WellImpactState,
  YetiColorId,
  YetiObject,
} from './types';
import { LandingHero3D } from './components/LandingHero3D';
import { YetiArenaCanvas } from './components/YetiArenaCanvas';
import { StickmanArcadeCanvas } from './components/StickmanArcadeCanvas';
import { MyYetiView } from './components/MyYetiView';
import { LeaderboardWellView } from './components/LeaderboardWellView';
import { DocsAndMoveView } from './components/DocsAndMoveView';
import { GAME_MODES, getGameModeSpec } from './data/gameCatalog';
import {
  anchorGameDataOnChain,
  fetchSuiTestnetWalletInfo,
  PLAYER_PROFILE_PACKAGE_ID,
  type SuiTestnetWalletInfo,
} from './lib/blockchain';

const STORAGE_ADDR_KEY = 'yeti_flurry_owner_address';
const STORAGE_COLOR_KEY = 'yeti_flurry_colorway';
const STORAGE_CHAR_KEY = 'yeti_flurry_character';
const STORAGE_CUSTOM_COLORS_KEY = 'yeti_flurry_custom_colors';

export default function App() {
  const dAppKit = useDAppKit();
  const walletConnection = useWalletConnection();
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [autoLaunchMode, setAutoLaunchMode] = useState<'launcher' | 'choose_map' | 'tunnel' | null>(null);
  const [selectedGameMode, setSelectedGameMode] = useState<GameModeId>('survival');
  const [selectedMapId, setSelectedMapId] = useState<MapId>('glacier_well');
  const [selectedCharacterId, setSelectedCharacterId] = useState<CharacterId>(() => {
    const saved = localStorage.getItem(STORAGE_CHAR_KEY) as CharacterId | null;
    return saved || 'lofi_yeti';
  });
  const [selectedColorway, setSelectedColorway] = useState<YetiColorId>(() => {
    const saved = localStorage.getItem(STORAGE_COLOR_KEY) as YetiColorId | null;
    return saved || 'classic_lofi';
  });
  const [customColors, setCustomColors] = useState<CustomCharacterColors | undefined>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CUSTOM_COLORS_KEY);
      return raw ? (JSON.parse(raw) as CustomCharacterColors) : undefined;
    } catch {
      return undefined;
    }
  });
  const [yeti, setYeti] = useState<YetiObject | null>(null);
  const [walletInfo, setWalletInfo] = useState<SuiTestnetWalletInfo | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [wellImpact, setWellImpact] = useState<WellImpactState>({
    totalDropsCollected: 2740,
    dropsPerWellMilestone: 1000,
    wellsFunded: 2,
    activeContributors: 148,
  });
  const [toast, setToast] = useState<string | null>(null);
  const bootstrappedWalletRef = useRef<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  useEffect(() => {
    const walletAddress = walletConnection.account?.address;
    if (!walletAddress) {
      setWalletInfo(null);
      return;
    }
    if (bootstrappedWalletRef.current === walletAddress) return;
    bootstrappedWalletRef.current = walletAddress;

    const bootstrapWallet = async () => {
      const info = await fetchSuiTestnetWalletInfo(walletAddress);
      setWalletInfo(info);

      if (!PLAYER_PROFILE_PACKAGE_ID || info.profileObjects.length > 0) {
        return;
      }

      try {
        const walrus = await anchorGameDataOnChain({
          yeti: yeti || {
            objectId: '0xpending',
            ownerAddress: walletAddress,
            name: `Hero ${walletAddress.slice(0, 6)}`,
            authMethod: 'Sui Wallet',
            characterId: selectedCharacterId,
            colorway: selectedColorway,
            customColors,
            stage: 'Frost Cub',
            level: 1,
            xp: 0,
            frostGems: 40,
            wellDropsContributed: 0,
            highScore: 0,
            runsCompleted: 0,
            version: 1,
            mapsPlayed: ['glacier_well'],
            totalHits: 0,
            cratesSmashed: 0,
            tasksCompleted: 0,
            unlockedCosmetics: ['hat_goggles', 'scarf_lofi', 'outfit_hoodie', 'trail_powder'],
            equipped: {
              hat: 'hat_goggles',
              scarf: 'scarf_lofi',
              outfit: 'outfit_hoodie',
              trail: 'trail_powder',
            },
            claimedQuests: [],
            recentPtbs: [],
          },
          interactiveWalletSign: false,
        });

        const transaction = new Transaction();
        transaction.moveCall({
          target: `${PLAYER_PROFILE_PACKAGE_ID}::player_profile::create_profile`,
          arguments: [
            transaction.pure.string(yeti?.name || `Hero ${walletAddress.slice(0, 6)}`),
            transaction.pure.string(selectedCharacterId),
            transaction.pure.string(selectedColorway),
            transaction.pure.string(JSON.stringify(customColors || {})),
            transaction.pure.string(yeti?.equipped.hat || 'hat_goggles'),
            transaction.pure.string(yeti?.equipped.scarf || 'scarf_lofi'),
            transaction.pure.string(yeti?.equipped.outfit || 'outfit_hoodie'),
            transaction.pure.string(yeti?.equipped.trail || 'trail_powder'),
            transaction.pure.string(walrus.walrusBlobId),
            transaction.pure.string(walrus.walrusUrl),
            transaction.object('0x6'),
          ],
        });
        const result = await dAppKit.signAndExecuteTransaction({ transaction });
        if ('FailedTransaction' in result && result.FailedTransaction) {
          throw new Error(
            result.FailedTransaction.status.error?.message || 'Profile transaction failed'
          );
        }
        const refreshed = await fetchSuiTestnetWalletInfo(walletAddress);
        setWalletInfo(refreshed);
        showToast('On-chain PlayerProfile created on Sui & Walrus');
      } catch (error) {
        bootstrappedWalletRef.current = null;
        showToast(error instanceof Error ? error.message : 'Could not initialize on-chain profile');
      }
    };

    void bootstrapWallet();
  }, [
    customColors,
    dAppKit,
    selectedCharacterId,
    selectedColorway,
    showToast,
    walletConnection.account?.address,
    yeti,
  ]);

  const loadGlobalState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
        if (data.wellImpact) setWellImpact(data.wellImpact);
      }
    } catch {
      // Keep optimistic fallback
    }
  }, []);

  useEffect(() => {
    loadGlobalState();
    const savedAddress = localStorage.getItem(STORAGE_ADDR_KEY);
    if (savedAddress) {
      fetch(`/api/yeti/${encodeURIComponent(savedAddress)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.yeti) {
            setYeti(data.yeti);
            if (data.yeti.colorway) setSelectedColorway(data.yeti.colorway);
            if (data.yeti.characterId) setSelectedCharacterId(data.yeti.characterId);
            if (data.yeti.customColors) setCustomColors(data.yeti.customColors);
          }
        })
        .catch(() => {});
    }
  }, [loadGlobalState]);

  useEffect(() => {
    if (!wellImpact.blessingUntil || wellImpact.blessingUntil <= Date.now()) return;
    const msLeft = Math.max(200, wellImpact.blessingUntil - Date.now() + 250);
    const id = window.setTimeout(() => {
      loadGlobalState();
    }, msLeft);
    return () => clearTimeout(id);
  }, [wellImpact.blessingUntil, loadGlobalState]);

  const launchArena = useCallback(
    (mode: 'launcher' | 'choose_map' | 'tunnel', mapId?: MapId, gameMode?: GameModeId) => {
      if (mapId) setSelectedMapId(mapId);
      if (gameMode) setSelectedGameMode(gameMode);
      setAutoLaunchMode(mode);
      setActiveTab('arena');
    },
    []
  );

  const persistBlockchainSnapshot = useCallback(
    async (targetYeti: YetiObject, interactiveWalletSign: boolean) => {
      const result = await anchorGameDataOnChain({
        yeti: targetYeti,
        walletAddress: walletConnection.account?.address,
        dAppKit: {
          signAndExecuteTransaction: (args) =>
            dAppKit.signAndExecuteTransaction(args) as Promise<Record<string, unknown>>,
          signPersonalMessage: (args) =>
            dAppKit.signPersonalMessage(args) as Promise<{ signature?: string; bytes?: string }>,
        },
        existingProfileObjectId:
          walletInfo?.profileObjects[0]?.objectId || targetYeti.blockchain?.profileObjectId,
        interactiveWalletSign,
      });

      const syncRes = await fetch('/api/yeti/evolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerAddress: targetYeti.ownerAddress,
          action: 'sync_blockchain',
          blockchain: result,
        }),
      });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        if (syncData.yeti) setYeti(syncData.yeti);
      }
      return result;
    },
    [dAppKit, walletConnection.account?.address, walletInfo?.profileObjects]
  );

  const handleChangeCharacter = useCallback(
    async (characterId: CharacterId) => {
      setSelectedCharacterId(characterId);
      localStorage.setItem(STORAGE_CHAR_KEY, characterId);
      if (yeti) {
        try {
          const res = await fetch('/api/yeti/evolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ownerAddress: yeti.ownerAddress,
              action: 'set_character',
              characterId,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.yeti) setYeti(data.yeti);
          }
        } catch {
          // Local preview remains responsive
        }
      }
    },
    [yeti]
  );

  const handleChangeColorway = useCallback(
    async (colorway: YetiColorId) => {
      setSelectedColorway(colorway);
      localStorage.setItem(STORAGE_COLOR_KEY, colorway);
      if (yeti) {
        try {
          const res = await fetch('/api/yeti/evolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ownerAddress: yeti.ownerAddress,
              action: 'set_colorway',
              colorway,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.yeti) setYeti(data.yeti);
          }
        } catch {
          // Local preview remains responsive
        }
      }
    },
    [yeti]
  );

  const handleChangeCustomColors = useCallback(
    async (colors?: CustomCharacterColors) => {
      setCustomColors(colors);
      if (colors) {
        localStorage.setItem(STORAGE_CUSTOM_COLORS_KEY, JSON.stringify(colors));
      } else {
        localStorage.removeItem(STORAGE_CUSTOM_COLORS_KEY);
      }
      if (yeti) {
        try {
          const res = await fetch('/api/yeti/evolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ownerAddress: yeti.ownerAddress,
              action: 'set_custom_colors',
              customColors: colors || {},
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.yeti) setYeti(data.yeti);
          }
        } catch {
          // Local preview remains responsive
        }
      }
    },
    [yeti]
  );

  const handleMintYeti = async (
    yetiName: string,
    authMethod: YetiObject['authMethod'],
    colorway: YetiColorId,
    characterId: CharacterId,
    outfitId: string,
    colors?: CustomCharacterColors
  ) => {
    const res = await fetch('/api/yeti/mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerAddress: walletConnection.account?.address,
        yetiName,
        authMethod,
        colorway,
        characterId,
        outfit: outfitId,
        customColors: colors,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Mint failed');
    }
    localStorage.setItem(STORAGE_ADDR_KEY, data.yeti.ownerAddress);
    localStorage.setItem(STORAGE_CHAR_KEY, data.yeti.characterId || characterId);
    localStorage.setItem(STORAGE_COLOR_KEY, data.yeti.colorway || colorway);
    if (data.yeti.customColors) {
      localStorage.setItem(STORAGE_CUSTOM_COLORS_KEY, JSON.stringify(data.yeti.customColors));
    }
    setYeti(data.yeti);
    setSelectedCharacterId(data.yeti.characterId || characterId);
    setSelectedColorway(data.yeti.colorway);
    setCustomColors(data.yeti.customColors);
    showToast(`Minted ${data.yeti.name} on Sui & archived to Walrus`);
    loadGlobalState();
    void persistBlockchainSnapshot(data.yeti, false).catch(() => {});
  };

  const handleEvolve = async () => {
    if (!yeti) return;
    const res = await fetch('/api/yeti/evolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerAddress: yeti.ownerAddress,
        action: 'evolve',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Evolution failed');
    }
    setYeti(data.yeti);
    showToast(`${data.yeti.name} evolved to ${data.yeti.stage}!`);
  };

  const handleCosmeticAction = async (
    action: 'unlock_cosmetic' | 'equip_cosmetic',
    cosmeticId: string,
    slot: CosmeticSlot,
    gemCost: number
  ) => {
    if (!yeti) return;
    const res = await fetch('/api/yeti/evolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerAddress: yeti.ownerAddress,
        action,
        cosmeticId,
        slot,
        gemCost,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Cosmetic transaction failed');
    }
    setYeti(data.yeti);
    showToast(`Equipped ${slot} item & updated state root`);
  };

  const handleClaimQuest = async (questId: string) => {
    if (!yeti) return;
    const res = await fetch('/api/yeti/evolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerAddress: yeti.ownerAddress,
        action: 'claim_quest',
        questId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Quest claim failed');
    }
    setYeti(data.yeti);
    showToast('Quest reward claimed on Sui!');
  };

  const handleSyncBlockchain = async () => {
    if (!yeti) return;
    try {
      const result = await persistBlockchainSnapshot(yeti, true);
      if (walletConnection.account?.address) {
        void fetchSuiTestnetWalletInfo(walletConnection.account.address).then(setWalletInfo);
      }
      showToast(
        result.txDigest
          ? 'Profile synced on Sui Testnet & Walrus!'
          : result.walletSignature
          ? 'Signed state root & archived to Walrus!'
          : 'Player snapshot anchored on Walrus!'
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Blockchain sync paused');
    }
  };

  const handleRecordRun = async (summary: RunSummary) => {
    const res = await fetch('/api/runs/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerAddress: yeti?.ownerAddress,
        playerName: yeti ? yeti.name : 'Arctic Guest',
        characterId: yeti?.characterId || selectedCharacterId,
        score: summary.score,
        wellDrops: summary.wellDrops,
        frostGems: summary.frostGems,
        survivalSeconds: summary.survivalSeconds,
        mode: summary.mode,
        gameMode: summary.gameMode || 'survival',
        mapId: summary.mapId,
        hitsLanded: summary.hitsLanded,
        cratesSmashed: summary.cratesSmashed,
        tasksDone: summary.tasksDone,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.yeti) {
        setYeti(data.yeti);
        void persistBlockchainSnapshot(data.yeti, false).catch(() => {});
      }
      if (data.wellImpact) setWellImpact(data.wellImpact);
      if (data.leaderboard) setLeaderboard(data.leaderboard);
      showToast(`Settled +${summary.wellDrops} Drops & anchored run hash`);
    }
  };

  const handleShareRun = async (summary: RunSummary) => {
    const name = yeti?.name || 'Lofi Cub';
    const modeLabel = getGameModeSpec(summary.gameMode).name;
    const text = `Scored ${summary.score} pts and gathered ${summary.wellDrops} Glacial Drops in ${modeLabel} on Yeti Flurry Rush! (${name})`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Share card text copied to clipboard');
    } catch {
      showToast('Score ready to share: ' + summary.score + ' pts');
    }
  };

  return (
    <div className="min-h-screen bg-[#081322] text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header
        className={`z-30 transition-colors duration-200 ${
          activeTab === 'home'
            ? 'fixed top-0 inset-x-0 bg-gradient-to-b from-[#061120]/75 via-[#061120]/30 to-transparent backdrop-blur-[3px] border-b border-white/10'
            : 'sticky top-0 border-b border-slate-800/90 bg-[#0A1728]/92 backdrop-blur-md'
        }`}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-4 sm:px-6 py-3.5">
          {/* Zone 1: Pixel Forge 3D Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="title-3d-game-sm text-xl sm:text-2xl hover:text-sky-200 transition-colors whitespace-nowrap shrink-0 text-left"
          >
            Yeti Flurry Rush
          </button>

          {/* Zone 2: Clean single-line Navigation Links */}
          <nav className="flex items-center gap-5 sm:gap-7 text-sm font-semibold tracking-wide overflow-x-auto">
            {(
              [
                { key: 'arena', label: 'Play Arena' },
                { key: 'yeti', label: 'Characters & Chain' },
                { key: 'leaderboard', label: 'Leaderboard' },
                { key: 'docs', label: 'Game & Move' },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                  activeTab === item.key
                    ? 'border-sky-400 text-white'
                    : activeTab === 'home'
                    ? 'border-transparent text-slate-200/90 hover:text-white hover:border-sky-400/60'
                    : 'border-transparent text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Primary Action + Wallet */}
          <div className="flex items-center gap-2.5 shrink-0">
            <ConnectButton />
            <button
              type="button"
              onClick={() =>
                activeTab === 'home' ? launchArena('launcher') : setActiveTab('yeti')
              }
              className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-bold tracking-wide text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.28)] hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
            >
              {activeTab === 'home'
                ? 'Launch Game'
                : yeti
                ? `${yeti.name} · Lv ${yeti.level}`
                : 'Create Hero'}
            </button>
          </div>
        </div>
      </header>

      {/* Full-Bleed 3D Landing Page OR Contained App Views */}
      {activeTab === 'home' ? (
        <main className="flex-1">
          <LandingHero3D
            yeti={yeti}
            onLaunchGame={() => launchArena('launcher')}
            onLaunchMode={(gm) => launchArena('choose_map', undefined, gm)}
            onLaunchTunnel={(mapId) => launchArena('tunnel', mapId, 'survival')}
            onOpenMyYeti={() => setActiveTab('yeti')}
          />
        </main>
      ) : (
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 sm:px-6 py-4 sm:py-5">
          {activeTab === 'arena' && (
            <div className="space-y-3">
              {/* Compact Arcade Game Switcher Ribbon */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl arcade-hud px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('home')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-sky-400 hover:text-white transition-colors whitespace-nowrap shrink-0 mr-1"
                  >
                    <Home className="h-3.5 w-3.5 text-sky-400" />
                    Home
                  </button>

                  {GAME_MODES.map((gm) => {
                    const isActive = selectedGameMode === gm.id;
                    const is2D = gm.dimension === '2D';
                    return (
                      <button
                        key={gm.id}
                        type="button"
                        onClick={() => {
                          setSelectedGameMode(gm.id);
                          setAutoLaunchMode('choose_map');
                        }}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold tracking-wide transition-all whitespace-nowrap shrink-0 ${
                          isActive
                            ? is2D
                              ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                              : 'bg-sky-400 text-slate-950 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                            : is2D
                            ? 'border border-amber-500/25 bg-[#081527] text-amber-200/85 hover:border-amber-400 hover:text-amber-100'
                            : 'border border-sky-500/25 bg-[#081527] text-sky-100/85 hover:border-sky-400 hover:text-white'
                        }`}
                      >
                        {gm.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {getGameModeSpec(selectedGameMode).dimension === '2D' ? (
                <StickmanArcadeCanvas
                  yeti={yeti}
                  playerName={yeti?.name || 'Lofi Cub'}
                  selectedGameMode={selectedGameMode}
                  onChangeGameMode={setSelectedGameMode}
                  selectedMapId={selectedMapId}
                  onChangeMapId={setSelectedMapId}
                  selectedCharacterId={yeti?.characterId || selectedCharacterId}
                  selectedColorway={selectedColorway}
                  customColors={yeti?.customColors || customColors}
                  onChangeColorway={handleChangeColorway}
                  autoLaunchMode={autoLaunchMode}
                  onAutoLaunchHandled={() => setAutoLaunchMode(null)}
                  onMintPrompt={() => setActiveTab('yeti')}
                  onRecordRun={handleRecordRun}
                  onShareRun={handleShareRun}
                  onReturnHome={() => setActiveTab('home')}
                />
              ) : (
                <YetiArenaCanvas
                  yeti={yeti}
                  playerName={yeti?.name || 'Lofi Cub'}
                  selectedGameMode={selectedGameMode}
                  onChangeGameMode={setSelectedGameMode}
                  selectedMapId={selectedMapId}
                  onChangeMapId={setSelectedMapId}
                  selectedCharacterId={yeti?.characterId || selectedCharacterId}
                  selectedColorway={selectedColorway}
                  customColors={yeti?.customColors || customColors}
                  onChangeColorway={handleChangeColorway}
                  wellImpact={wellImpact}
                  onWellImpactUpdate={setWellImpact}
                  autoLaunchMode={autoLaunchMode}
                  onAutoLaunchHandled={() => setAutoLaunchMode(null)}
                  onMintPrompt={() => setActiveTab('yeti')}
                  onRecordRun={handleRecordRun}
                  onShareRun={handleShareRun}
                  onReturnHome={() => setActiveTab('home')}
                />
              )}
            </div>
          )}

          {activeTab === 'yeti' && (
            <MyYetiView
              yeti={yeti}
              selectedCharacterId={yeti?.characterId || selectedCharacterId}
              onChangeCharacter={handleChangeCharacter}
              selectedColorway={selectedColorway}
              onChangeColorway={handleChangeColorway}
              customColors={yeti?.customColors || customColors}
              onChangeCustomColors={handleChangeCustomColors}
              walletAddress={walletConnection.account?.address}
              walletInfo={walletInfo}
              onMintYeti={handleMintYeti}
              onEvolve={handleEvolve}
              onCosmeticAction={handleCosmeticAction}
              onClaimQuest={handleClaimQuest}
              onSyncBlockchain={handleSyncBlockchain}
              onGoToArena={() => launchArena('launcher')}
            />
          )}

          {activeTab === 'leaderboard' && (
            <LeaderboardWellView
              leaderboard={leaderboard}
              wellImpact={wellImpact}
            />
          )}

          {activeTab === 'docs' && <DocsAndMoveView />}
        </main>
      )}

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 py-5 px-6 text-center text-xs text-slate-500">
        Yeti Flurry Rush · Lofi the Yeti on Sui Network
      </footer>

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 rounded-xl border border-sky-500/40 bg-[#0D1C30] px-4 py-2.5 text-xs font-medium text-sky-200 shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
