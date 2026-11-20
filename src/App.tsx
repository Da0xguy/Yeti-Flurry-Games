import { useDAppKit, useWalletConnection } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { Transaction } from '@mysten/sui/transactions';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Home } from 'lucide-react';
import type {
  CosmeticSlot,
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
import { uploadPlayerProfile } from './lib/walrus';

const STORAGE_ADDR_KEY = 'yeti_flurry_owner_address';
const STORAGE_COLOR_KEY = 'yeti_flurry_colorway';
const PLAYER_PROFILE_PACKAGE_ID = import.meta.env.VITE_PLAYER_PROFILE_PACKAGE_ID as
  | string
  | undefined;

export default function App() {
  const dAppKit = useDAppKit();
  const walletConnection = useWalletConnection();
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [autoLaunchMode, setAutoLaunchMode] = useState<'launcher' | 'choose_map' | 'tunnel' | null>(null);
  const [selectedGameMode, setSelectedGameMode] = useState<GameModeId>('survival');
  const [selectedMapId, setSelectedMapId] = useState<MapId>('glacier_well');
  const [selectedColorway, setSelectedColorway] = useState<YetiColorId>(() => {
    const saved = localStorage.getItem(STORAGE_COLOR_KEY) as YetiColorId | null;
    return saved || 'classic_lofi';
  });
  const [yeti, setYeti] = useState<YetiObject | null>(null);
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
    if (!walletAddress || bootstrappedWalletRef.current === walletAddress) return;
    bootstrappedWalletRef.current = walletAddress;

    if (!PLAYER_PROFILE_PACKAGE_ID) {
      showToast('Wallet connected. Set VITE_PLAYER_PROFILE_PACKAGE_ID to create your profile.');
      return;
    }

    const createPlayerProfile = async () => {
      try {
        const walrus = await uploadPlayerProfile({
          walletAddress,
          displayName: `Yeti Player ${walletAddress.slice(0, 6)}`,
          yetiName: yeti?.name || 'Lofi Frosty',
          colorway: selectedColorway,
          createdAt: new Date().toISOString(),
          schemaVersion: 1,
        });
        const transaction = new Transaction();
        transaction.moveCall({
          target: `${PLAYER_PROFILE_PACKAGE_ID}::player_profile::create_profile`,
          arguments: [
            transaction.pure.string(`Yeti Player ${walletAddress.slice(0, 6)}`),
            transaction.pure.string(yeti?.name || 'Lofi Frosty'),
            transaction.pure.string(selectedColorway),
            transaction.pure.string(walrus.blobId),
            transaction.pure.string(walrus.aggregatorUrl),
            transaction.object('0x6'),
          ],
        });
        const result = await dAppKit.signAndExecuteTransaction({ transaction });
        if ('FailedTransaction' in result && result.FailedTransaction) {
          throw new Error(
            result.FailedTransaction.status.error?.message || 'Profile transaction failed'
          );
        }
        showToast('Player profile created on Sui and stored on Walrus');
      } catch (error) {
        bootstrappedWalletRef.current = null;
        showToast(error instanceof Error ? error.message : 'Could not create player profile');
      }
    };

    void createPlayerProfile();
  }, [
    dAppKit,
    selectedColorway,
    showToast,
    walletConnection.account?.address,
    yeti?.name,
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

  const handleMintYeti = async (
    yetiName: string,
    authMethod: YetiObject['authMethod'],
    colorway: YetiColorId
  ) => {
    const res = await fetch('/api/yeti/mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yetiName, authMethod, colorway }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Mint failed');
    }
    localStorage.setItem(STORAGE_ADDR_KEY, data.yeti.ownerAddress);
    setYeti(data.yeti);
    setSelectedColorway(data.yeti.colorway);
    showToast(`Minted ${data.yeti.name} on Sui (0 Gas Sponsored)`);
    loadGlobalState();
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
    showToast(`Updated ${slot} cosmetic via PTB`);
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

  const handleRecordRun = async (summary: RunSummary) => {
    const res = await fetch('/api/runs/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerAddress: yeti?.ownerAddress,
        playerName: yeti ? yeti.name : 'Arctic Guest',
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
      if (data.yeti) setYeti(data.yeti);
      if (data.wellImpact) setWellImpact(data.wellImpact);
      if (data.leaderboard) setLeaderboard(data.leaderboard);
      showToast(`Settled +${summary.wellDrops} Well Drops & +${summary.xpEarned} XP`);
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
                { key: 'yeti', label: 'My Yeti' },
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
                : 'Mint Starter Yeti'}
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
                  selectedColorway={selectedColorway}
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
                  selectedColorway={selectedColorway}
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
              selectedColorway={selectedColorway}
              onChangeColorway={handleChangeColorway}
              onMintYeti={handleMintYeti}
              onEvolve={handleEvolve}
              onCosmeticAction={handleCosmeticAction}
              onClaimQuest={handleClaimQuest}
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
