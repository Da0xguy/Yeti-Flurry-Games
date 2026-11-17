import React, { useState } from 'react';
import { Droplets, Trophy, Copy, Check } from 'lucide-react';
import type { LeaderboardEntry, WellImpactState } from '../types';
import { getGameModeSpec, getMapSpec } from '../data/gameCatalog';

interface LeaderboardWellViewProps {
  leaderboard: LeaderboardEntry[];
  wellImpact: WellImpactState;
}

export const LeaderboardWellView: React.FC<LeaderboardWellViewProps> = ({
  leaderboard,
  wellImpact,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'solo' | 'tunnel'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const dropsIntoCurrentWell =
    wellImpact.totalDropsCollected % wellImpact.dropsPerWellMilestone;
  const pctToNextWell = Math.min(
    100,
    Math.round((dropsIntoCurrentWell / wellImpact.dropsPerWellMilestone) * 100)
  );

  const filtered = leaderboard.filter((item) =>
    filterMode === 'all' ? true : item.mode === filterMode
  );

  const handleCopyShare = async (entry: LeaderboardEntry) => {
    const shareText = `I scored ${entry.score} pts and gathered ${entry.wellDrops} Glacial Drops for @lofitheyeti Clean Water Wells in Yeti Flurry Rush on Sui! (${entry.yetiName} · ${entry.yetiStage})`;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="space-y-8">
      {/* Lofi Clean Water Well Community Impact Section */}
      <section className="grid gap-6 md:grid-cols-[260px_1fr] items-stretch rounded-2xl border border-slate-800 bg-[#0D1C30] p-6">
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <img
            src="/src/assets/images/lofi_well_emblem_1794874871937.jpg"
            alt="Enchanted arctic water well overflowing with pure glacial drops"
            referrerPolicy="no-referrer"
            className="h-56 md:h-full w-full object-cover"
          />
        </div>

        <div className="flex flex-col justify-between space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-medium text-cyan-400">
              Lofi Well Impact Pool · Shared Sui Object
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white text-balance">
              Every Glacial Drop Collected Fuels Real-World Water Wells
            </h2>
            <p className="text-sm leading-relaxed text-slate-300">
              Every 1,000 Glacial Drops settled through <code className="font-mono text-sky-300">well_impact::contribute_drops</code> unlocks a community milestone grant toward Lofi the Yeti clean water well initiatives and mints an on-chain Well Guardian Badge.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 tabular-nums">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
              <span className="text-xs text-slate-400 block">Wells Funded</span>
              <span className="font-mono text-2xl font-bold text-cyan-300">
                {wellImpact.wellsFunded}
              </span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
              <span className="text-xs text-slate-400 block">Total Drops</span>
              <span className="font-mono text-2xl font-bold text-white">
                {wellImpact.totalDropsCollected.toLocaleString()}
              </span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
              <span className="text-xs text-slate-400 block">Contributors</span>
              <span className="font-mono text-2xl font-bold text-sky-300">
                {wellImpact.activeContributors}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs tabular-nums">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <Droplets className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                Progress to Well #{wellImpact.wellsFunded + 1}
              </span>
              <span className="font-mono text-cyan-300">
                {dropsIntoCurrentWell} / {wellImpact.dropsPerWellMilestone} drops ({pctToNextWell}%)
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-cyan-400 transition-all duration-300"
                style={{ width: `${pctToNextWell}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Global Leaderboard */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Trophy className="h-5 w-5 text-sky-400" aria-hidden="true" />
            <h3 className="font-display text-2xl font-bold text-white">
              Arena Leaderboard
            </h3>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
            {(
              [
                { key: 'all', label: 'All Runs' },
                { key: 'solo', label: 'Solo Arena' },
                { key: 'tunnel', label: 'Sui Tunnel' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterMode(tab.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  filterMode === tab.key
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0D1C30]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-xs text-slate-400">
              <tr>
                <th className="px-4 py-3.5 font-medium">Rank</th>
                <th className="px-4 py-3.5 font-medium">Player & Yeti</th>
                <th className="px-4 py-3.5 font-medium">Mode</th>
                <th className="px-4 py-3.5 font-medium text-right">Score</th>
                <th className="px-4 py-3.5 font-medium text-right">Well Drops</th>
                <th className="px-4 py-3.5 font-medium text-right">Time</th>
                <th className="px-4 py-3.5 font-medium">Settlement</th>
                <th className="px-4 py-3.5 font-medium text-right">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 tabular-nums">
              {filtered.map((entry, idx) => (
                <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3.5 font-mono font-semibold text-sky-300">
                    #{idx + 1}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-white">{entry.playerName}</div>
                    <div className="text-xs text-slate-400">
                      {entry.yetiName} · {entry.yetiStage}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-300">
                    {entry.mode === 'tunnel' ? 'Sui Tunnel' : getGameModeSpec(entry.gameMode).shortLabel} · {getMapSpec(entry.mapId).name}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono font-semibold text-white">
                    {entry.score}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-cyan-300">
                    +{entry.wellDrops}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-slate-300">
                    {entry.survivalSeconds}s
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-slate-400">
                    {entry.txDigest.slice(0, 8)}...{entry.txDigest.slice(-4)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleCopyShare(entry)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap"
                    >
                      {copiedId === entry.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Share
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
