import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  Lock,
  Zap,
  ArrowUpRight,
  Droplets,
  Gem,
  Award,
  Palette,
  RotateCcw,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  Shirt,
  Users,
} from 'lucide-react';
import type {
  CharacterId,
  CosmeticSlot,
  CustomCharacterColors,
  YetiColorId,
  YetiObject,
  YetiStage,
} from '../types';
import { COSMETICS_CATALOG } from '../data/moveContracts';
import {
  CAREER_QUESTS,
  PLAYABLE_CHARACTERS,
  YETI_COLORWAYS,
  getCharacterSpec,
  resolveCharacterPalette,
} from '../data/gameCatalog';
import type { SuiTestnetWalletInfo } from '../lib/blockchain';
import { MyYetiPreview3D } from './MyYetiPreview3D';

interface MyYetiViewProps {
  yeti: YetiObject | null;
  selectedCharacterId: CharacterId;
  onChangeCharacter: (characterId: CharacterId) => Promise<void>;
  selectedColorway: YetiColorId;
  onChangeColorway: (colorway: YetiColorId) => Promise<void>;
  customColors?: CustomCharacterColors;
  onChangeCustomColors: (colors?: CustomCharacterColors) => Promise<void>;
  walletAddress?: string;
  walletInfo?: SuiTestnetWalletInfo | null;
  onMintYeti: (
    yetiName: string,
    authMethod: YetiObject['authMethod'],
    colorway: YetiColorId,
    characterId: CharacterId,
    outfitId: string,
    customColors?: CustomCharacterColors
  ) => Promise<void>;
  onEvolve: () => Promise<void>;
  onCosmeticAction: (
    action: 'unlock_cosmetic' | 'equip_cosmetic',
    cosmeticId: string,
    slot: CosmeticSlot,
    gemCost: number
  ) => Promise<void>;
  onClaimQuest: (questId: string) => Promise<void>;
  onSyncBlockchain: () => Promise<void>;
  onGoToArena: () => void;
}

const STAGES: YetiStage[] = ['Frost Cub', 'Glacier Runner', 'Blizzard Guardian', 'Apex Lofi'];

const SLOT_LABELS: Record<CosmeticSlot, string> = {
  outfit: 'Clothes',
  hat: 'Hats',
  scarf: 'Scarves',
  trail: 'Trails',
};

export const MyYetiView: React.FC<MyYetiViewProps> = ({
  yeti,
  selectedCharacterId,
  onChangeCharacter,
  selectedColorway,
  onChangeColorway,
  customColors,
  onChangeCustomColors,
  walletAddress,
  walletInfo,
  onMintYeti,
  onEvolve,
  onCosmeticAction,
  onClaimQuest,
  onSyncBlockchain,
  onGoToArena,
}) => {
  const [nameInput, setNameInput] = useState('Lofi Frosty');
  const [starterOutfit, setStarterOutfit] = useState('outfit_hoodie');
  const [authMethod, setAuthMethod] = useState<YetiObject['authMethod']>(
    walletAddress ? 'Sui Wallet' : 'zkLogin (Google)'
  );
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<CosmeticSlot>('outfit');

  const activeCharacterId: CharacterId = yeti?.characterId || selectedCharacterId || 'lofi_yeti';
  const activeCharacter = getCharacterSpec(activeCharacterId);
  const activeCustomColors = yeti?.customColors || customColors;
  const resolvedPalette = resolveCharacterPalette(selectedColorway, activeCustomColors);
  const activeOutfit = yeti?.equipped.outfit || starterOutfit;

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      await onMintYeti(
        nameInput,
        authMethod,
        selectedColorway,
        activeCharacterId,
        starterOutfit,
        activeCustomColors
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to mint hero profile');
    } finally {
      setBusy(false);
    }
  };

  const handleEvolveClick = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await onEvolve();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Evolution failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCosmetic = async (
    item: (typeof COSMETICS_CATALOG)[number],
    unlocked: boolean
  ) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await onCosmeticAction(
        unlocked ? 'equip_cosmetic' : 'unlock_cosmetic',
        item.id,
        item.slot,
        item.costGems
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setBusy(false);
    }
  };

  const handleQuestClaim = async (questId: string) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await onClaimQuest(questId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not claim reward');
    } finally {
      setBusy(false);
    }
  };

  const handleBlockchainSyncClick = async () => {
    setSyncBusy(true);
    setErrorMsg(null);
    try {
      await onSyncBlockchain();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Blockchain sync failed');
    } finally {
      setSyncBusy(false);
    }
  };

  const updateCustomColorField = (
    field: keyof CustomCharacterColors,
    hex: string
  ) => {
    void onChangeCustomColors({
      ...activeCustomColors,
      [field]: hex,
    });
  };

  if (!yeti) {
    return (
      <div className="space-y-6">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] items-stretch rounded-2xl border border-slate-800 bg-[#0D1C30] p-6 md:p-8">
          <div className="space-y-5 flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">
              Multi-Hero Roster · On-Chain Sui &amp; Walrus Storage
            </p>
            <h2 className="title-3d-game-sm text-3xl text-balance">
              Create Your Playable Hero
            </h2>
            <p className="text-sm leading-relaxed text-slate-300">
              Choose your fighter from 5 playable heroes (Lofi Yeti is one of 5!), dress them in wearable clothes and custom colors, and mint your owned <code className="font-mono text-sky-300">PlayerProfile</code> on Sui + Walrus.
            </p>

            <form onSubmit={handleMint} className="space-y-4 pt-1">
              {/* Playable Character Picker */}
              <div>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
                  <Users className="h-3.5 w-3.5 text-sky-400" />
                  1. Pick Playable Character (5 Heroes)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PLAYABLE_CHARACTERS.map((ch) => {
                    const selected = activeCharacterId === ch.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => void onChangeCharacter(ch.id)}
                        className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                          selected
                            ? 'border-sky-400 bg-sky-500/15 text-white'
                            : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold">{ch.name}</span>
                          <span className="text-[10px] font-semibold text-sky-300">{ch.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{ch.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="yeti-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Hero Callsign
                  </label>
                  <input
                    id="yeti-name"
                    type="text"
                    maxLength={24}
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                    placeholder="Enter hero name"
                  />
                </div>

                <div>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                    <Shirt className="h-3.5 w-3.5 text-sky-400" />
                    Starter Clothes
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['outfit_hoodie', 'outfit_none'] as const).map((oid) => (
                      <button
                        key={oid}
                        type="button"
                        onClick={() => setStarterOutfit(oid)}
                        className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors truncate ${
                          starterOutfit === oid
                            ? 'border-sky-400 bg-sky-500/15 text-white'
                            : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:text-white'
                        }`}
                      >
                        {oid === 'outfit_hoodie' ? 'Winter Hoodie' : 'Bare Fur'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-300 mb-1.5">
                  Preset Colorway + Custom Colors
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {YETI_COLORWAYS.map((cw) => (
                    <button
                      key={cw.id}
                      type="button"
                      onClick={() => void onChangeColorway(cw.id)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                        selectedColorway === cw.id
                          ? 'border-sky-400 bg-sky-500/15 text-white'
                          : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span
                        className="h-3 w-3 rounded-sm border border-white/30 shrink-0"
                        style={{ backgroundColor: cw.furHex }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{cw.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-300 mb-1.5">
                  Sign-In Method (0 Gas Sponsored)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['zkLogin (Google)', 'Sui Wallet', 'Sponsored Guest'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setAuthMethod(method)}
                      className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors whitespace-nowrap truncate ${
                        authMethod === method
                          ? 'border-sky-400 bg-sky-500/15 text-sky-200'
                          : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-400" role="alert">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-60 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                {busy ? 'Anchoring Hero on Sui & Walrus...' : `Mint ${activeCharacter.name} (Free · On-Chain)`}
              </button>
            </form>
          </div>

          <div className="flex flex-col justify-center space-y-4">
            <MyYetiPreview3D
              characterId={activeCharacterId}
              colorwayId={selectedColorway}
              customColors={activeCustomColors}
              hatId="hat_goggles"
              scarfId="scarf_lofi"
              outfitId={starterOutfit}
            />

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                  <Palette className="h-3.5 w-3.5 text-sky-400" />
                  Custom Color Studio
                </span>
                {activeCustomColors && (
                  <button
                    type="button"
                    onClick={() => void onChangeCustomColors(undefined)}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 text-[11px] text-slate-300">
                <label className="flex flex-col items-center gap-1 cursor-pointer">
                  <input
                    type="color"
                    value={activeCustomColors?.furHex || resolvedPalette.furHex}
                    onChange={(e) => updateCustomColorField('furHex', e.target.value)}
                    className="h-7 w-full rounded border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <span>Coat/Fur</span>
                </label>
                <label className="flex flex-col items-center gap-1 cursor-pointer">
                  <input
                    type="color"
                    value={activeCustomColors?.skinHex || resolvedPalette.skinHex}
                    onChange={(e) => updateCustomColorField('skinHex', e.target.value)}
                    className="h-7 w-full rounded border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <span>Face/Skin</span>
                </label>
                <label className="flex flex-col items-center gap-1 cursor-pointer">
                  <input
                    type="color"
                    value={activeCustomColors?.outfitHex || '#38bdf8'}
                    onChange={(e) => updateCustomColorField('outfitHex', e.target.value)}
                    className="h-7 w-full rounded border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <span>Clothes</span>
                </label>
                <label className="flex flex-col items-center gap-1 cursor-pointer">
                  <input
                    type="color"
                    value={activeCustomColors?.accentHex || resolvedPalette.accentHex}
                    onChange={(e) => updateCustomColorField('accentHex', e.target.value)}
                    className="h-7 w-full rounded border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <span>Accent</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stageIdx = STAGES.indexOf(yeti.stage);
  const nextStage = stageIdx < STAGES.length - 1 ? STAGES[stageIdx + 1] : null;
  const requiredXp = (stageIdx + 1) * 300;
  const xpProgress = nextStage ? Math.min(100, Math.round((yeti.xp / requiredXp) * 100)) : 100;

  return (
    <div className="space-y-8">
      {/* Owned Sui Object Profile + 3D Turntable + Multi-Character & Color Customizer */}
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] items-stretch rounded-2xl border border-slate-800 bg-[#0D1C30] p-6">
        <div className="flex flex-col justify-between gap-4">
          <MyYetiPreview3D
            characterId={activeCharacterId}
            colorwayId={selectedColorway}
            customColors={activeCustomColors}
            hatId={yeti.equipped.hat}
            scarfId={yeti.equipped.scarf}
            outfitId={activeOutfit}
          />

          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 font-mono text-xs text-slate-400">
            <div className="flex items-center justify-between gap-2">
              <span>Active Hero</span>
              <span className="text-sky-300 font-semibold">{activeCharacter.name} ({activeCharacter.species})</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Object ID</span>
              <span className="text-sky-300 truncate max-w-[205px]">{yeti.objectId}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Owner ({yeti.authMethod})</span>
              <span className="text-slate-200 truncate max-w-[205px]">{yeti.ownerAddress}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>State Version</span>
              <span className="text-slate-200 tabular-nums">v{yeti.version} · Sui Testnet</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-sky-400">
                  {activeCharacter.name} · {yeti.stage} · Level {yeti.level}
                </p>
                <h2 className="title-3d-game-sm text-3xl">{yeti.name}</h2>
              </div>
              <button
                type="button"
                onClick={onGoToArena}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
              >
                Enter Arena
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 tabular-nums">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <span className="text-xs text-slate-400 block">Frost Gems</span>
                <span className="font-mono text-lg font-semibold text-sky-300 flex items-center gap-1.5">
                  <Gem className="h-4 w-4" aria-hidden="true" />
                  {yeti.frostGems}
                </span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <span className="text-xs text-slate-400 block">Well Drops</span>
                <span className="font-mono text-lg font-semibold text-cyan-300 flex items-center gap-1.5">
                  <Droplets className="h-4 w-4" aria-hidden="true" />
                  {yeti.wellDropsContributed}
                </span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <span className="text-xs text-slate-400 block">High Score</span>
                <span className="font-mono text-lg font-semibold text-white">{yeti.highScore}</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <span className="text-xs text-slate-400 block">Runs Stored</span>
                <span className="font-mono text-lg font-semibold text-emerald-300">
                  {yeti.runsCompleted}
                </span>
              </div>
            </div>
          </div>

          {/* Playable Character Switcher (Yeti is one of 5 Heroes!) */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 block">
              Switch Playable Character (5 Heroes)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PLAYABLE_CHARACTERS.map((ch) => {
                const selected = activeCharacterId === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => void onChangeCharacter(ch.id)}
                    className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      selected
                        ? 'border-sky-400 bg-sky-500/15 text-white'
                        : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="block text-[11px] font-bold truncate">{ch.name}</span>
                    <span className="block text-[10px] text-sky-300/90 truncate">{ch.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Colorways + Custom Color Studio */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-300">
                Colorway Presets &amp; Custom Colors
              </span>
              {activeCustomColors && (
                <button
                  type="button"
                  onClick={() => void onChangeCustomColors(undefined)}
                  className="inline-flex items-center gap-1 text-[11px] text-sky-300 hover:text-sky-200"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset Custom Colors
                </button>
              )}
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {YETI_COLORWAYS.map((cw) => (
                <button
                  key={cw.id}
                  type="button"
                  onClick={() => void onChangeColorway(cw.id)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    selectedColorway === cw.id
                      ? 'border-sky-400 bg-sky-500/15 text-white'
                      : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-sm border border-white/30 shrink-0"
                    style={{ backgroundColor: cw.furHex }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{cw.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 text-[11px] text-slate-300">
              <label className="flex flex-col items-center gap-1 cursor-pointer">
                <input
                  type="color"
                  value={activeCustomColors?.furHex || resolvedPalette.furHex}
                  onChange={(e) => updateCustomColorField('furHex', e.target.value)}
                  className="h-6 w-full rounded border border-slate-700 bg-transparent cursor-pointer"
                />
                <span>Fur / Body</span>
              </label>
              <label className="flex flex-col items-center gap-1 cursor-pointer">
                <input
                  type="color"
                  value={activeCustomColors?.skinHex || resolvedPalette.skinHex}
                  onChange={(e) => updateCustomColorField('skinHex', e.target.value)}
                  className="h-6 w-full rounded border border-slate-700 bg-transparent cursor-pointer"
                />
                <span>Face / Skin</span>
              </label>
              <label className="flex flex-col items-center gap-1 cursor-pointer">
                <input
                  type="color"
                  value={activeCustomColors?.outfitHex || '#38bdf8'}
                  onChange={(e) => updateCustomColorField('outfitHex', e.target.value)}
                  className="h-6 w-full rounded border border-slate-700 bg-transparent cursor-pointer"
                />
                <span>Clothes Tint</span>
              </label>
              <label className="flex flex-col items-center gap-1 cursor-pointer">
                <input
                  type="color"
                  value={activeCustomColors?.accentHex || resolvedPalette.accentHex}
                  onChange={(e) => updateCustomColorField('accentHex', e.target.value)}
                  className="h-6 w-full rounded border border-slate-700 bg-transparent cursor-pointer"
                />
                <span>Neon Accent</span>
              </label>
            </div>
          </div>

          {/* Evolution Progress */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">On-Chain Evolution Forge</h3>
                <p className="text-xs text-slate-400">
                  {nextStage
                    ? `Next Stage: ${nextStage} (${yeti.xp} / ${requiredXp} XP)`
                    : 'Maximum Evolution Reached: Apex Lofi'}
                </p>
              </div>
              {nextStage && (
                <button
                  type="button"
                  onClick={handleEvolveClick}
                  disabled={busy || yeti.xp < requiredXp}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Evolve Hero
                </button>
              )}
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-sky-400 transition-all duration-300"
                style={{ width: `${xpProgress}%` }}
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-400" role="alert">
                {errorMsg}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* On-Chain Blockchain Storage & Walrus Archival Panel */}
      <div className="rounded-2xl border border-sky-500/30 bg-[#0B1A2E] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sky-300">
              <ShieldCheck className="h-5 w-5" />
              <h3 className="font-display text-2xl text-white">
                Blockchain Player Data Storage (Sui + Walrus)
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Your hero choice, wearable clothes, custom color palette, stats, and match records are hashed with SHA-256 and archived on Walrus Testnet + anchored to Sui.
            </p>
          </div>

          <button
            type="button"
            disabled={syncBusy}
            onClick={handleBlockchainSyncClick}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncBusy ? 'animate-spin' : ''}`} />
            {syncBusy
              ? 'Anchoring to Blockchain...'
              : walletAddress
              ? 'Anchor & Sign on Sui + Walrus'
              : 'Archive Game Data on Walrus'}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3 font-mono text-xs">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-1">
            <span className="text-slate-400 block">Sui Wallet &amp; Testnet Balance</span>
            <span className="text-white font-semibold block truncate">
              {walletAddress
                ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`
                : 'Sponsored Guest Vault'}
            </span>
            <span className="text-emerald-300 block">
              {walletInfo
                ? `${walletInfo.suiBalanceFormatted} · ${walletInfo.profileObjects.length} Move Obj`
                : 'Sui Testnet Anchor Active'}
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-1">
            <span className="text-slate-400 block">SHA-256 On-Chain State Root</span>
            <span className="text-sky-300 font-semibold block truncate">
              {yeti.blockchain?.stateRootHash || 'Pending snapshot'}
            </span>
            <span className="text-slate-400 block">
              {yeti.blockchain?.lastSyncedAt
                ? `Synced ${new Date(yeti.blockchain.lastSyncedAt).toLocaleTimeString()}`
                : 'Ready to anchor'}
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-1">
            <span className="text-slate-400 block">Walrus Decentralized Blob ID</span>
            <span className="text-cyan-300 font-semibold block truncate">
              {yeti.blockchain?.walrusBlobId || 'Click Archive to store on Walrus'}
            </span>
            {yeti.blockchain?.walrusUrl ? (
              <a
                href={yeti.blockchain.walrusUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 underline underline-offset-2"
              >
                Verify Blob on Walrus
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-slate-500 block">walrus-testnet.walrus.space</span>
            )}
          </div>
        </div>
      </div>

      {/* Clothes & Cosmetic Wardrobe */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-2xl text-white">Clothes &amp; Cosmetic Wardrobe</h3>
            <p className="text-xs text-slate-400">
              Equip clothes, hats, scarves, and trails across both 3D &amp; 2D game modes. Stored on-chain via Sui Dynamic Fields.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1 border border-slate-800">
            {(['outfit', 'hat', 'scarf', 'trail'] as const).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setActiveSlot(slot)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeSlot === slot
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {SLOT_LABELS[slot]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {COSMETICS_CATALOG.filter((c) => c.slot === activeSlot).map((item) => {
            const unlocked = yeti.unlockedCosmetics.includes(item.id);
            const equipped = (yeti.equipped[item.slot] || (item.slot === 'outfit' ? 'outfit_hoodie' : '')) === item.id;

            return (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0D1C30] p-4 space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white text-sm">{item.name}</span>
                    <span
                      className="h-4 w-4 rounded-sm border border-slate-700 shrink-0"
                      style={{ backgroundColor: item.colorHex }}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">{item.description}</p>
                  <p className="font-mono text-[11px] text-slate-500 truncate">
                    {item.walrusBlobId}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={busy || equipped || (!unlocked && yeti.frostGems < item.costGems)}
                  onClick={() => handleCosmetic(item, unlocked)}
                  className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    equipped
                      ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : unlocked
                      ? 'border border-slate-700 bg-slate-800 text-white hover:bg-slate-700'
                      : 'bg-sky-500 text-slate-950 hover:bg-sky-400 disabled:opacity-45'
                  }`}
                >
                  {equipped ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Equipped
                    </>
                  ) : unlocked ? (
                    item.slot === 'outfit' ? 'Wear Clothes' : 'Equip Cosmetic'
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      Unlock · {item.costGems} Gems
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Career Quests & Tasks */}
      <div className="space-y-4">
        <div>
          <h3 className="font-display text-2xl text-white">Hero Career Quests</h3>
          <p className="text-xs text-slate-400">
            Complete multi-run milestones across all maps to earn bonus Frost Gems and XP.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {CAREER_QUESTS.map((quest) => {
            const current =
              quest.metric === 'wellDrops'
                ? yeti.wellDropsContributed
                : quest.metric === 'hitsLanded'
                ? yeti.totalHits
                : quest.metric === 'cratesSmashed'
                ? yeti.cratesSmashed
                : quest.metric === 'tasksCompleted'
                ? yeti.tasksCompleted
                : yeti.mapsPlayed.length;
            const pct = Math.min(100, Math.round((current / quest.target) * 100));
            const claimed = yeti.claimedQuests.includes(quest.id);
            const ready = current >= quest.target && !claimed;

            return (
              <div
                key={quest.id}
                className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0D1C30] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-sky-400 shrink-0" aria-hidden="true" />
                      <h4 className="text-sm font-semibold text-white">{quest.title}</h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{quest.description}</p>
                  </div>
                  <span className="font-mono text-xs font-semibold text-sky-300 whitespace-nowrap">
                    +{quest.rewardGems}G · +{quest.rewardXp}XP
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span className="text-slate-400">Progress</span>
                    <span className="font-mono text-slate-200">
                      {Math.min(current, quest.target)} / {quest.target}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        claimed ? 'bg-emerald-400' : 'bg-sky-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!ready || busy}
                  onClick={() => handleQuestClaim(quest.id)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    claimed
                      ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : ready
                      ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                      : 'border border-slate-700 bg-slate-800/60 text-slate-500'
                  }`}
                >
                  {claimed ? 'Reward Claimed' : ready ? 'Claim Quest Reward (0 Gas)' : 'In Progress'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* On-Chain Match History */}
      {yeti.recentRuns && yeti.recentRuns.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display text-2xl text-white">
            On-Chain Match Records
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0D1C30]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Hero</th>
                  <th className="px-4 py-3 font-medium">Mode / Map</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Tx / Blob</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 tabular-nums">
                {yeti.recentRuns.map((run) => (
                  <tr key={run.id} className="text-slate-300">
                    <td className="px-4 py-3 font-medium text-white">
                      {getCharacterSpec(run.characterId).name}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {run.gameMode} · {run.mapId}
                    </td>
                    <td className="px-4 py-3 font-mono text-sky-300">
                      {run.score} pts ({run.xpEarned !== undefined ? `+${run.xpEarned} XP` : `+${run.wellDrops} Drops`})
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-300">
                      {run.txDigest.slice(0, 10)}...{run.txDigest.slice(-4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent PTB Receipts */}
      <div className="space-y-3">
        <h3 className="font-display text-2xl text-white">
          Recent Sponsored PTB Receipts
        </h3>
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0D1C30]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Move Action</th>
                <th className="px-4 py-3 font-medium">Tx Digest</th>
                <th className="px-4 py-3 font-medium">Gas Paid</th>
                <th className="px-4 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 tabular-nums">
              {yeti.recentPtbs.map((ptb) => (
                <tr key={ptb.digest + ptb.timestamp} className="text-slate-300">
                  <td className="px-4 py-3 font-medium text-white">{ptb.action}</td>
                  <td className="px-4 py-3 font-mono text-sky-300">
                    {ptb.digest.slice(0, 10)}...{ptb.digest.slice(-6)}
                  </td>
                  <td className="px-4 py-3 font-mono text-emerald-300">0 SUI (Sponsored)</td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(ptb.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
