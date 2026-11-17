import React, { useState } from 'react';
import { Sparkles, Check, Lock, Zap, ArrowUpRight, Droplets, Gem, Award } from 'lucide-react';
import type { CosmeticSlot, YetiColorId, YetiObject, YetiStage } from '../types';
import { COSMETICS_CATALOG } from '../data/moveContracts';
import { CAREER_QUESTS, YETI_COLORWAYS } from '../data/gameCatalog';
import { MyYetiPreview3D } from './MyYetiPreview3D';

interface MyYetiViewProps {
  yeti: YetiObject | null;
  selectedColorway: YetiColorId;
  onChangeColorway: (colorway: YetiColorId) => void;
  onMintYeti: (
    yetiName: string,
    authMethod: YetiObject['authMethod'],
    colorway: YetiColorId
  ) => Promise<void>;
  onEvolve: () => Promise<void>;
  onCosmeticAction: (
    action: 'unlock_cosmetic' | 'equip_cosmetic',
    cosmeticId: string,
    slot: CosmeticSlot,
    gemCost: number
  ) => Promise<void>;
  onClaimQuest: (questId: string) => Promise<void>;
  onGoToArena: () => void;
}

const STAGES: YetiStage[] = ['Frost Cub', 'Glacier Runner', 'Blizzard Guardian', 'Apex Lofi'];

export const MyYetiView: React.FC<MyYetiViewProps> = ({
  yeti,
  selectedColorway,
  onChangeColorway,
  onMintYeti,
  onEvolve,
  onCosmeticAction,
  onClaimQuest,
  onGoToArena,
}) => {
  const [nameInput, setNameInput] = useState('Lofi Frosty');
  const [authMethod, setAuthMethod] = useState<YetiObject['authMethod']>('zkLogin (Google)');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<CosmeticSlot>('hat');

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      await onMintYeti(nameInput, authMethod, selectedColorway);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to mint Yeti');
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

  if (!yeti) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr] items-stretch rounded-2xl border border-slate-800 bg-[#0D1C30] p-6 md:p-8">
        <div className="space-y-5 flex flex-col justify-center">
          <p className="text-xs font-medium text-sky-400">
            Sponsored Onboarding · Owned Sui Object
          </p>
          <h2 className="title-3d-game-sm text-3xl text-balance">
            Mint Your 3D Lofi Yeti
          </h2>
          <p className="text-sm leading-relaxed text-slate-300">
            Pick your Yeti's fur & skin colorway, mint your owned <code className="font-mono text-sky-300">LofiYeti</code> Sui Move object with zero gas, and carry your XP, Gems, and Quest rewards across all 3 arenas.
          </p>

          <form onSubmit={handleMint} className="space-y-4 pt-1">
            <div>
              <label htmlFor="yeti-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                Yeti Name
              </label>
              <input
                id="yeti-name"
                type="text"
                maxLength={24}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                placeholder="Enter your Yeti's name"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-300 mb-1.5">
                Choose Yeti Colorway
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {YETI_COLORWAYS.map((cw) => (
                  <button
                    key={cw.id}
                    type="button"
                    onClick={() => onChangeColorway(cw.id)}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
                      selectedColorway === cw.id
                        ? 'border-sky-400 bg-sky-500/15 text-white'
                        : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-sm border border-white/30 shrink-0"
                      style={{ backgroundColor: cw.skinHex }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{cw.name}</span>
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
              {busy ? 'Minting LofiYeti Object...' : 'Mint Starter Yeti (Free · 0 Gas)'}
            </button>
          </form>
        </div>

        <div className="flex flex-col justify-center space-y-3">
          <MyYetiPreview3D
            colorwayId={selectedColorway}
            hatId="hat_goggles"
            scarfId="scarf_lofi"
          />
          <p className="text-center text-xs text-slate-400">
            Interactive 3D Preview · Fur & Skin Colorway updates live
          </p>
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
      {/* Owned Sui Object Profile + 3D Turntable + Evolution Forge */}
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] items-stretch rounded-2xl border border-slate-800 bg-[#0D1C30] p-6">
        <div className="flex flex-col justify-between gap-4">
          <MyYetiPreview3D
            colorwayId={selectedColorway}
            hatId={yeti.equipped.hat}
            scarfId={yeti.equipped.scarf}
          />

          <div className="space-y-2 font-mono text-xs text-slate-400">
            <div className="flex items-center justify-between gap-2">
              <span>Object ID</span>
              <span className="text-sky-300 truncate max-w-[210px]">{yeti.objectId}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Owner ({yeti.authMethod})</span>
              <span className="text-slate-200 truncate max-w-[210px]">{yeti.ownerAddress}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Object Version</span>
              <span className="text-slate-200 tabular-nums">v{yeti.version} · Fast Path</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-sky-400">
                  {yeti.stage} · Level {yeti.level}
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
                <span className="text-xs text-slate-400 block">Tasks Done</span>
                <span className="font-mono text-lg font-semibold text-emerald-300">
                  {yeti.tasksCompleted}
                </span>
              </div>
            </div>
          </div>

          {/* Colorway Switcher */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 block">
              Yeti Fur & Skin Colorway
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {YETI_COLORWAYS.map((cw) => (
                <button
                  key={cw.id}
                  type="button"
                  onClick={() => onChangeColorway(cw.id)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors ${
                    selectedColorway === cw.id
                      ? 'border-sky-400 bg-sky-500/15 text-white'
                      : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded-sm border border-white/30"
                    style={{ backgroundColor: cw.skinHex }}
                    aria-hidden="true"
                  />
                  <span className="truncate w-full text-center">{cw.name.split(' ')[0]}</span>
                </button>
              ))}
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
                  Evolve Yeti
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

      {/* Career Quests & Tasks */}
      <div className="space-y-4">
        <div>
          <h3 className="font-display text-2xl text-white">Yeti Career Quests</h3>
          <p className="text-xs text-slate-400">
            Complete multi-run milestones across all 3 maps to earn bonus Frost Gems and XP.
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

      {/* Cosmetic Wardrobe */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-2xl text-white">Cosmetic Wardrobe</h3>
            <p className="text-xs text-slate-400">
              Purely visual 3D traits stored via Sui Dynamic Fields. Zero pay-to-win stats.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1 border border-slate-800">
            {(['hat', 'scarf', 'trail'] as const).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setActiveSlot(slot)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                  activeSlot === slot
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {slot}s
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {COSMETICS_CATALOG.filter((c) => c.slot === activeSlot).map((item) => {
            const unlocked = yeti.unlockedCosmetics.includes(item.id);
            const equipped = yeti.equipped[item.slot] === item.id;

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
                    'Equip Cosmetic'
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
                <tr key={ptb.digest} className="text-slate-300">
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
