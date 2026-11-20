import React from 'react';
import {
  Droplets,
  Gem,
  HeartCrack,
  Home,
  RotateCcw,
  Share2,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import type { RunSummary } from '../types';
import { getGameModeSpec, getMapSpec } from '../data/gameCatalog';

interface ArenaGameOverOverlayProps {
  summary: RunSummary;
  lifeDepleted: boolean;
  claimStatus: 'idle' | 'claiming' | 'claimed';
  onClaimSummary: () => void;
  onRestart: () => void;
  onReturnToMenu: () => void;
  onReturnHome?: () => void;
  onShare: () => void;
}

export const ArenaGameOverOverlay: React.FC<ArenaGameOverOverlayProps> = ({
  summary,
  lifeDepleted,
  claimStatus,
  onClaimSummary,
  onRestart,
  onReturnToMenu,
  onReturnHome,
  onShare,
}) => {
  const gameSpec = getGameModeSpec(summary.gameMode);
  const mapSpec = getMapSpec(summary.mapId);
  const isWinner = !lifeDepleted && summary.rank === 1;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[#040c1a]/88 p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arena-gameover-title"
    >
      <div
        className={`w-full max-w-md rounded-2xl arcade-panel p-5 sm:p-6 space-y-4 ${
          lifeDepleted ? '!border-rose-500/60' : ''
        }`}
      >
        {/* Header & Final Score Hero */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-sky-500/20 pb-3.5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              {lifeDepleted ? (
                <span className="inline-flex items-center gap-1 text-rose-300">
                  <HeartCrack className="h-3.5 w-3.5" />
                  KO · 0 HP
                </span>
              ) : isWinner ? (
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <Trophy className="h-3.5 w-3.5" />
                  {summary.gameMode === 'survival' ? 'Escaped Alive' : '#1 Victory'}
                </span>
              ) : null}
              <span className="text-sky-300">
                {gameSpec.shortLabel} · {mapSpec.name} · #{summary.rank}
              </span>
            </div>

            <h3
              id="arena-gameover-title"
              className="title-3d-game-sm text-3xl sm:text-4xl leading-none pt-0.5"
            >
              {lifeDepleted
                ? summary.gameMode === 'survival'
                  ? 'Quest Failed'
                  : 'Game Over'
                : isWinner
                ? summary.gameMode === 'survival'
                  ? 'Quest Escaped!'
                  : 'Victory!'
                : 'Run Complete'}
            </h3>
          </div>

          <div className="text-right tabular-nums">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Score
            </span>
            <span className="font-mono text-2xl sm:text-3xl font-bold text-sky-300 inline-flex items-center gap-1.5">
              <Sparkles className="h-5 w-5 text-amber-300" />
              {summary.score.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Highlighted Final Score & Well Drops Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 tabular-nums">
          <div className="rounded-xl border border-cyan-400/35 bg-cyan-500/10 p-2.5">
            <span className="text-[11px] font-semibold text-cyan-200 inline-flex items-center gap-1">
              <Droplets className="h-3.5 w-3.5 text-cyan-400" />
              Drops
            </span>
            <span className="font-mono text-xl font-bold text-cyan-300 block">
              +{summary.wellDrops}
            </span>
          </div>

          <div className="rounded-xl border border-slate-700/80 bg-[#081529] p-2.5">
            <span className="text-[11px] font-semibold text-slate-400 inline-flex items-center gap-1">
              <Gem className="h-3.5 w-3.5 text-sky-400" />
              Gems
            </span>
            <span className="font-mono text-xl font-bold text-sky-300 block">
              +{summary.frostGems}
            </span>
          </div>

          <div className="rounded-xl border border-slate-700/80 bg-[#081529] p-2.5">
            <span className="text-[11px] font-semibold text-slate-400 block">Missions</span>
            <span className="font-mono text-xl font-bold text-emerald-300 block">
              {summary.tasksDone}/3
            </span>
          </div>

          <div className="rounded-xl border border-slate-700/80 bg-[#081529] p-2.5">
            <span className="text-[11px] font-semibold text-slate-400 block">
              {summary.extraStatLabel || 'Time'}
            </span>
            <span className="font-mono text-lg font-bold text-white block">
              {summary.extraStatValue || `${summary.survivalSeconds}s`}
            </span>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onRestart}
            className="arcade-btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            Play Again
          </button>

          <button
            type="button"
            onClick={onReturnToMenu}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/90 px-4 py-2 text-sm font-semibold text-white hover:border-sky-400 transition-colors whitespace-nowrap shrink-0"
          >
            Modes
          </button>

          {onReturnHome && (
            <button
              type="button"
              onClick={onReturnHome}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-sky-400 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Home className="h-4 w-4 text-sky-400" />
              Home
            </button>
          )}

          <button
            type="button"
            onClick={onClaimSummary}
            disabled={claimStatus !== 'idle'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/45 bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            <Zap className="h-3.5 w-3.5" />
            {claimStatus === 'idle'
              ? 'Save Run'
              : claimStatus === 'claiming'
              ? 'Saving...'
              : 'Saved'}
          </button>

          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-500 transition-colors whitespace-nowrap shrink-0"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
};
