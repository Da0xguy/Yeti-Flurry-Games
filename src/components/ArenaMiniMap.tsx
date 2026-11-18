import React, { useMemo } from 'react';
import type { GameModeId, MapId } from '../types';
import {
  ARENA_CENTER_X,
  ARENA_CENTER_Y,
  ARENA_H,
  ARENA_W,
  getMapObstacles,
  getMapSpec,
  getRaceTrackWaypoints,
} from '../data/gameCatalog';

export type MiniMapDotKind =
  | 'player'
  | 'bot'
  | 'enemy'
  | 'bullseye'
  | 'powerup'
  | 'crate'
  | 'beacon'
  | 'well';

export interface MiniMapDot {
  x: number;
  y: number;
  kind: MiniMapDotKind;
  color?: string;
  label?: string;
}

interface ArenaMiniMapProps {
  gameMode: GameModeId;
  mapId: MapId;
  dots: MiniMapDot[];
  ringRadius: number;
  playerAngle: number;
  nextCheckpoint?: number;
  checkpointsCleared?: number;
  totalCheckpoints?: number;
  compassMode?: boolean;
}

const SVG_W = 184;
const SVG_H = 124;

export const ArenaMiniMap: React.FC<ArenaMiniMapProps> = ({
  gameMode,
  mapId,
  dots,
  ringRadius,
  playerAngle,
  nextCheckpoint = 1,
  checkpointsCleared = 0,
  totalCheckpoints = 4,
}) => {
  const mapSpec = getMapSpec(mapId);
  const obstacles = useMemo(() => getMapObstacles(mapId), [mapId]);
  const waypoints = useMemo(() => getRaceTrackWaypoints(mapId), [mapId]);

  const raceBounds = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const wp of waypoints) {
      if (wp.x < minX) minX = wp.x;
      if (wp.x > maxX) maxX = wp.x;
      if (wp.y < minY) minY = wp.y;
      if (wp.y > maxY) maxY = wp.y;
    }
    const padX = Math.max(180, (maxX - minX) * 0.14);
    const padY = Math.max(150, (maxY - minY) * 0.16);
    return {
      minX: minX - padX,
      maxX: maxX + padX,
      minY: minY - padY,
      maxY: maxY + padY,
    };
  }, [waypoints]);

  const mapPoint = (x: number, y: number): { cx: number; cy: number } => {
    if (gameMode === 'car_racing') {
      const spanX = Math.max(1, raceBounds.maxX - raceBounds.minX);
      const spanY = Math.max(1, raceBounds.maxY - raceBounds.minY);
      return {
        cx: 10 + ((x - raceBounds.minX) / spanX) * (SVG_W - 20),
        cy: 10 + ((y - raceBounds.minY) / spanY) * (SVG_H - 20),
      };
    }
    return {
      cx: 6 + (x / ARENA_W) * (SVG_W - 12),
      cy: 6 + (y / ARENA_H) * (SVG_H - 12),
    };
  };

  const playerDot = dots.find((d) => d.kind === 'player');
  const deg = (playerAngle * 180) / Math.PI;
  const finishReady = gameMode === 'car_racing' && checkpointsCleared >= totalCheckpoints;

  return (
    <div
      className="pointer-events-none absolute left-3 bottom-3 z-20 rounded-xl border border-white/15 bg-[#061120]/82 p-2.5 backdrop-blur-md shadow-xl select-none"
      aria-label="Live arena mini-map"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5 px-0.5">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {gameMode === 'car_racing' ? 'Circuit Radar' : 'Tactical Radar'}
        </span>
        <span className="font-mono text-sky-300 truncate max-w-[92px]">{mapSpec.name}</span>
      </div>

      {/* SVG Map Surface */}
      {gameMode === 'car_racing' ? (
        (() => {
          const pts = waypoints
            .map((w) => {
              const p = mapPoint(w.x, w.y);
              return `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`;
            })
            .join(' ');

          return (
            <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="block rounded-lg bg-[#08162a]/90 border border-slate-800/80">
              {/* Road Corridor & Track Centerline */}
              <polygon
                points={pts}
                fill="none"
                stroke="#1e3a5f"
                strokeWidth={9}
                strokeLinejoin="round"
              />
              <polygon
                points={pts}
                fill="none"
                stroke={mapSpec.accentHex}
                strokeOpacity={0.62}
                strokeWidth={2.2}
                strokeLinejoin="round"
              />

              {/* Boost Pads */}
              {waypoints.map((w, idx) => {
                if (!w.hasBoostPad) return null;
                const p = mapPoint(w.x, w.y);
                return (
                  <rect
                    key={`pad_${idx}`}
                    x={p.cx - 2.3}
                    y={p.cy - 2.3}
                    width={4.6}
                    height={4.6}
                    transform={`rotate(45 ${p.cx} ${p.cy})`}
                    fill="#22d3ee"
                    fillOpacity={0.85}
                  />
                );
              })}

              {/* Power-Up Orbs on Track */}
              {dots
                .filter((d) => d.kind === 'powerup')
                .map((d, i) => {
                  const p = mapPoint(d.x, d.y);
                  return (
                    <circle
                      key={`orb_${i}`}
                      cx={p.cx}
                      cy={p.cy}
                      r={2.3}
                      fill={d.color || '#c084fc'}
                      stroke="#ffffff"
                      strokeOpacity={0.55}
                      strokeWidth={0.6}
                    />
                  );
                })}

              {/* Sequential Checkpoints 1..4 & Start/Finish Gate */}
              {waypoints.map((w, idx) => {
                const p = mapPoint(w.x, w.y);
                if (idx === 0) {
                  return (
                    <g key="start_sf">
                      {finishReady && (
                        <circle
                          cx={p.cx}
                          cy={p.cy}
                          r={8}
                          fill="none"
                          stroke="#34d399"
                          strokeWidth={1.4}
                          strokeOpacity={0.85}
                        />
                      )}
                      <rect
                        x={p.cx - 4.2}
                        y={p.cy - 4.2}
                        width={8.4}
                        height={8.4}
                        rx={1.5}
                        fill="#f8fafc"
                        stroke={finishReady ? '#34d399' : '#0284c7'}
                        strokeWidth={1.5}
                      />
                    </g>
                  );
                }

                if (!w.isCheckpoint || !w.checkpointNum) return null;
                const isCleared = w.checkpointNum < nextCheckpoint;
                const isNext = w.checkpointNum === nextCheckpoint;
                return (
                  <g key={`cp_${w.checkpointNum}`}>
                    {isNext && (
                      <circle
                        cx={p.cx}
                        cy={p.cy}
                        r={8}
                        fill="#fbbf24"
                        fillOpacity={0.18}
                        stroke="#fbbf24"
                        strokeWidth={1.4}
                      />
                    )}
                    <circle
                      cx={p.cx}
                      cy={p.cy}
                      r={isNext ? 5.2 : 4}
                      fill={isCleared ? '#10b981' : isNext ? '#fbbf24' : '#475569'}
                      stroke="#061120"
                      strokeWidth={1}
                    />
                    <text
                      x={p.cx}
                      y={p.cy + 2.4}
                      textAnchor="middle"
                      fontSize="6.5"
                      fontWeight="700"
                      fill="#061120"
                    >
                      {w.checkpointNum}
                    </text>
                  </g>
                );
              })}

              {/* AI / Tunnel Rival Karts */}
              {dots
                .filter((d) => d.kind === 'bot')
                .map((d, i) => {
                  const p = mapPoint(d.x, d.y);
                  return (
                    <circle
                      key={`bot_${i}`}
                      cx={p.cx}
                      cy={p.cy}
                      r={3.2}
                      fill={d.color || '#fb923c'}
                      stroke="#061120"
                      strokeWidth={0.9}
                    />
                  );
                })}

              {/* Directional Player Marker */}
              {playerDot && (() => {
                const p = mapPoint(playerDot.x, playerDot.y);
                return (
                  <g transform={`translate(${p.cx.toFixed(1)}, ${p.cy.toFixed(1)}) rotate(${deg.toFixed(1)})`}>
                    <circle r={7.2} fill="#38bdf8" fillOpacity={0.22} />
                    <polygon
                      points="6.5,0 -4.5,-4.2 -2.2,0 -4.5,4.2"
                      fill="#38bdf8"
                      stroke="#ffffff"
                      strokeWidth={1.2}
                      strokeLinejoin="round"
                    />
                  </g>
                );
              })()}
            </svg>
          );
        })()
      ) : (
        <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="block rounded-lg bg-[#08162a]/90 border border-slate-800/80">
          {/* Subtle Tactical Grid Crosshairs */}
          <line x1={SVG_W / 2} y1={6} x2={SVG_W / 2} y2={SVG_H - 6} stroke="#1e3a5f" strokeWidth={0.6} strokeOpacity={0.5} />
          <line x1={6} y1={SVG_H / 2} x2={SVG_W - 6} y2={SVG_H / 2} stroke="#1e3a5f" strokeWidth={0.6} strokeOpacity={0.5} />

          {/* Arena Obstacles */}
          {obstacles.map((obs) => {
            const p = mapPoint(obs.x, obs.y);
            const rPx = Math.max(2.6, (obs.radius / ARENA_W) * (SVG_W - 12));
            return (
              <circle
                key={obs.id}
                cx={p.cx}
                cy={p.cy}
                r={rPx}
                fill="#1e293b"
                stroke="#475569"
                strokeWidth={0.8}
              />
            );
          })}

          {/* Shrinking Blizzard Storm Ring (Survival) */}
          {gameMode === 'survival' && (() => {
            const center = mapPoint(ARENA_CENTER_X, ARENA_CENTER_Y);
            const rRing = Math.max(10, (ringRadius / ARENA_W) * (SVG_W - 12));
            return (
              <circle
                cx={center.cx}
                cy={center.cy}
                r={rRing}
                fill="none"
                stroke="#38bdf8"
                strokeOpacity={0.58}
                strokeDasharray="3.5 2.5"
                strokeWidth={1.3}
              />
            );
          })()}

          {/* Objectives: Central Well, Active Beacon, Crates & Power-Ups */}
          {dots.map((d, i) => {
            if (d.kind === 'player' || d.kind === 'bot' || d.kind === 'enemy' || d.kind === 'bullseye') {
              return null;
            }
            const p = mapPoint(d.x, d.y);
            if (d.kind === 'well') {
              return (
                <g key={`obj_${i}`}>
                  <circle cx={p.cx} cy={p.cy} r={6.2} fill="#22d3ee" fillOpacity={0.22} stroke="#67e8f9" strokeWidth={1.1} />
                  <circle cx={p.cx} cy={p.cy} r={2.3} fill="#67e8f9" />
                </g>
              );
            }
            if (d.kind === 'beacon') {
              return (
                <g key={`obj_${i}`}>
                  <circle cx={p.cx} cy={p.cy} r={7.5} fill="#fde047" fillOpacity={0.16} stroke="#fde047" strokeWidth={1.5} />
                  <circle cx={p.cx} cy={p.cy} r={2.4} fill="#fef08a" />
                </g>
              );
            }
            if (d.kind === 'crate') {
              return (
                <rect
                  key={`obj_${i}`}
                  x={p.cx - 1.9}
                  y={p.cy - 1.9}
                  width={3.8}
                  height={3.8}
                  fill="#fbbf24"
                  fillOpacity={0.78}
                />
              );
            }
            if (d.kind === 'powerup') {
              return (
                <rect
                  key={`obj_${i}`}
                  x={p.cx - 2}
                  y={p.cy - 2}
                  width={4}
                  height={4}
                  transform={`rotate(45 ${p.cx} ${p.cy})`}
                  fill={d.color || '#c084fc'}
                />
              );
            }
            return null;
          })}

          {/* Rival Yetis, Shooter Drones & Bullseyes */}
          {dots.map((d, i) => {
            if (d.kind !== 'bot' && d.kind !== 'enemy' && d.kind !== 'bullseye') return null;
            const p = mapPoint(d.x, d.y);
            if (d.kind === 'bullseye') {
              return (
                <g key={`en_${i}`}>
                  <circle cx={p.cx} cy={p.cy} r={3.4} fill="none" stroke="#fbbf24" strokeWidth={1.2} />
                  <circle cx={p.cx} cy={p.cy} r={1.3} fill="#fbbf24" />
                </g>
              );
            }
            if (d.kind === 'enemy') {
              return (
                <circle
                  key={`en_${i}`}
                  cx={p.cx}
                  cy={p.cy}
                  r={2.9}
                  fill="#f43f5e"
                  stroke="#061120"
                  strokeWidth={0.8}
                />
              );
            }
            return (
              <circle
                key={`en_${i}`}
                cx={p.cx}
                cy={p.cy}
                r={3.1}
                fill={d.color || '#fb923c'}
                stroke="#061120"
                strokeWidth={0.9}
              />
            );
          })}

          {/* Directional Player Marker */}
          {playerDot && (() => {
            const p = mapPoint(playerDot.x, playerDot.y);
            return (
              <g transform={`translate(${p.cx.toFixed(1)}, ${p.cy.toFixed(1)}) rotate(${deg.toFixed(1)})`}>
                <circle r={7} fill="#38bdf8" fillOpacity={0.22} />
                <polygon
                  points="6.2,0 -4.2,-4 -2,0 -4.2,4"
                  fill="#38bdf8"
                  stroke="#ffffff"
                  strokeWidth={1.2}
                  strokeLinejoin="round"
                />
              </g>
            );
          })()}
        </svg>
      )}

      {/* Compact Objective Legend */}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[9px] text-slate-300 px-0.5 tabular-nums">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-400 border border-white/80" />
          You
        </span>
        {gameMode === 'car_racing' ? (
          <>
            <span className="inline-flex items-center gap-1 text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {finishReady ? 'Finish' : `CP ${nextCheckpoint}/${totalCheckpoints}`}
            </span>
            <span className="inline-flex items-center gap-1 text-purple-300">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              Orbs
            </span>
          </>
        ) : gameMode === 'shooting' ? (
          <>
            <span className="inline-flex items-center gap-1 text-rose-300">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Drones
            </span>
            <span className="inline-flex items-center gap-1 text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Targets
            </span>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1 text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              Well
            </span>
            <span className="inline-flex items-center gap-1 text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Beacon/Crate
            </span>
          </>
        )}
      </div>
    </div>
  );
};
