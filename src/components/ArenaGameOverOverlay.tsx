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
      className="absolute inset-0 z-30 flex items-center justify-center bg-[#061120]/88 p-4 sm:p-6 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arena-gameover-title"
    >
      <div
        className={`w-full max-w-lg rounded-2xl border bg-[#0D1C30]/96 p-5 sm:p-6 space-y-5 shadow-2xl ${
          lifeDepleted ? 'border-rose-500/45' : 'border-slate-700'
        }`}
      >
        {/* Header & Final Score Hero */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {lifeDepleted ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-rose-300">
                  <HeartCrack className="h-3.5 w-3.5" />
                  Life Depleted (0 HP)
                </span>
              ) : isWinner ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-amber-200">
                  <Trophy className="h-3.5 w-3.5" />
                  Rank #1 Victory
                </span>
              ) : null}
              <span className="text-sky-400">
                {gameSpec.name} · {mapSpec.name} · Rank #{summary.rank}
              </span>
            </div>

            <h3
              id="arena-gameover-title"
              className="title-3d-game-sm text-3xl sm:text-4xl leading-none pt-1"
            >
              {lifeDepleted ? 'Game Over' : isWinner ? 'Arctic Champion!' : 'Run Complete'}
            </h3>
          </div>

          <div className="text-right tabular-nums">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
              Final Score
            </span>
            <span className="font-mono text-2xl sm:text-3xl font-bold text-sky-300 inline-flex items-center gap-1.5">
              <Sparkles className="h-5 w-5 text-sky-400" />
              {summary.score.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Highlighted Final Score & Well Drops Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
          <div className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 p-3">
            <span className="text-xs text-cyan-200/80 inline-flex items-center gap-1">
              <Droplets className="h-3.5 w-3.5 text-cyan-400" />
              Well Drops
            </span>
            <span className="font-mono text-xl font-bold text-cyan-300 block mt-0.5">
              +{summary.wellDrops}
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-3">
            <span className="text-xs text-slate-400 inline-flex items-center gap-1">
              <Gem className="h-3.5 w-3.5 text-sky-400" />
              Frost Gems
            </span>
            <span className="font-mono text-xl font-semibold text-sky-300 block mt-0.5">
              +{summary.frostGems}
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-3">
            <span className="text-xs text-slate-400 block">Tasks Done</span>
            <span className="font-mono text-xl font-semibold text-emerald-300 block mt-0.5">
              {summary.tasksDone}/3
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-3">
            <span className="text-xs text-slate-400 block">
              {summary.extraStatLabel || 'Time Survived'}
            </span>
            <span className="font-mono text-lg font-semibold text-white block mt-0.5">
              {summary.extraStatValue || `${summary.survivalSeconds}s`}
            </span>
          </div>
        </div>

        {/* Primary Action Buttons: Restart, Return to Menu, Settle & Share */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            Restart
          </button>

          <button
            type="button"
            onClick={onReturnToMenu}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            Game Menu
          </button>

          {onReturnHome && (
            <button
              type="button"
              onClick={onReturnHome}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm font-semibold text-slate-200 hover:border-sky-400 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Home className="h-4 w-4 text-sky-400" />
              Landing Page
            </button>
          )}

          <button
            type="button"
            onClick={onClaimSummary}
            disabled={claimStatus !== 'idle'}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3.5 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            <Zap className="h-4 w-4" />
            {claimStatus === 'idle'
              ? 'Settle Run on Sui'
              : claimStatus === 'claiming'
              ? 'Settling PTB...'
              : 'Settled On-Chain'}
          </button>

          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-transparent px-3.5 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:border-slate-500 transition-colors whitespace-nowrap shrink-0"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
};
