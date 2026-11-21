import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { YetiColorId } from '../types';
import { drawPowerUpIcon, drawStickmanCharacter } from '../lib/stickmanRenderer';
import { animateYetiWalk, buildYetiRig } from '../three/yetiBuilder';
import {
  animateQuestMonster,
  buildQuestMonsterMesh,
  buildWeaponPodMesh,
  animateWeaponPod,
} from '../three/questEntities';

export type FeatureSpotlightId =
  | 'frost_shield'
  | 'loot_weapons'
  | 'squad_quest'
  | 'room_escape'
  | 'gun_fu';

interface FeatureShowcaseStageProps {
  featureId: FeatureSpotlightId;
  colorway?: YetiColorId;
  hatId?: string;
  scarfId?: string;
}

export const FeatureShowcaseStage: React.FC<FeatureShowcaseStageProps> = ({
  featureId,
  colorway = 'classic_lofi',
  hatId = 'hat_goggles',
  scarfId = 'scarf_lofi',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let rafId = 0;
    let disposed = false;
    const startMs = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(480, Math.round((rect.width || 680) * dpr));
      const h = Math.max(270, Math.round((rect.height || 380) * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const tick = (now: number) => {
      if (disposed) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const t = (now - startMs) / 1000;
        const W = 800;
        const H = 450;
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const s = Math.max(canvas.width / W, canvas.height / H);
        ctx.translate((canvas.width - W * s) * 0.5, (canvas.height - H * s) * 0.5);
        ctx.scale(s, s);

        // Backdrop grid & atmospheric sky
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#050e1c');
        bg.addColorStop(1, '#0c223c');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.lineWidth = 1;
        const gridShift = (t * 40) % 44;
        for (let gx = -gridShift; gx < W; gx += 44) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, H);
          ctx.stroke();
        }
        for (let gy = 0; gy < H; gy += 44) {
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(W, gy);
          ctx.stroke();
        }

        // Arena Floor
        const floorY = 358;
        ctx.fillStyle = '#09192e';
        ctx.fillRect(0, floorY, W, H - floorY);
        ctx.fillStyle = featureId === 'gun_fu' ? '#f59e0b' : featureId === 'room_escape' ? '#2dd4bf' : '#38bdf8';
        ctx.fillRect(0, floorY, W, 4);

        // Snowflakes
        ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
        for (let i = 0; i < 22; i++) {
          const fx = ((i * 97 + t * (28 + (i % 4) * 12)) % (W + 20)) - 10;
          const fy = ((i * 61 + t * (45 + (i % 3) * 16)) % (H + 20)) - 10;
          ctx.beginPath();
          ctx.arc(fx, fy, 1.6 + (i % 3) * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }

        if (featureId === 'frost_shield') {
          const cycle = t % 5.0;
          const shielded = cycle > 1.2;
          const timerPct = shielded ? Math.max(0, 1 - (cycle - 1.2) / 3.8) : 0;

          if (!shielded) {
            drawPowerUpIcon(ctx, 'shield', 390, floorY - 46, t);
          } else {
            // Deflection shockwave pulse
            const ringR = 52 + ((cycle - 1.2) % 1.0) * 88;
            ctx.strokeStyle = `rgba(56, 189, 248, ${Math.max(0, 1 - ((cycle - 1.2) % 1.0))})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(385, floorY - 58, ringR, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Charging Enemy Boss deflected off shield
          const enemyX = shielded ? 520 + Math.sin((cycle - 1.2) * 5) * 42 : 580 - cycle * 95;
          drawStickmanCharacter(ctx, {
            x: enemyX,
            y: floorY,
            facing: -1,
            pose: shielded ? 'hurt' : 'run',
            animTime: t + 0.4,
            scale: 1.22,
            isLofiYeti: false,
            bossAura: true,
            customStroke: '#fb7185',
            customAccent: '#fbbf24',
            hp: 100,
            maxHp: 100,
            label: shielded ? 'DEFLECTED!' : 'Boss Raider',
            weapon: 'sword',
          });

          drawStickmanCharacter(ctx, {
            x: 385,
            y: floorY,
            facing: 1,
            pose: shielded ? 'guard' : 'run',
            animTime: t,
            scale: 1.32,
            isLofiYeti: true,
            colorwayId: colorway,
            hatId,
            scarfId,
            shielded,
            hp: 100,
            maxHp: 100,
            label: shielded ? `FROST SHIELD ${(timerPct * 10).toFixed(1)}s` : 'Lofi Hero',
            weapon: 'sword',
          });
        } else if (featureId === 'loot_weapons') {
          // 3 Floating Loot Crates / Weapon Pods & Frost Spear Piercing Shots
          drawPowerUpIcon(ctx, 'rage', 180, floorY - 62, t);
          drawPowerUpIcon(ctx, 'magnet', 270, floorY - 92, t + 1);
          drawPowerUpIcon(ctx, 'gem', 350, floorY - 62, t + 2);

          // Piercing Frost-Spear Beam
          const beamCycle = t % 1.4;
          const spearX = 320 + beamCycle * 460;
          ctx.fillStyle = '#60a5fa';
          ctx.beginPath();
          ctx.moveTo(spearX + 26, floorY - 58);
          ctx.lineTo(spearX - 24, floorY - 65);
          ctx.lineTo(spearX - 24, floorY - 51);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#bae6fd';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Two armored enemies hit in a line
          drawStickmanCharacter(ctx, {
            x: 540,
            y: floorY,
            facing: -1,
            pose: Math.abs(spearX - 540) < 60 ? 'hurt' : 'guard',
            animTime: t + 0.3,
            scale: 1.16,
            isLofiYeti: false,
            customStroke: '#fb7185',
            customAccent: '#f43f5e',
            hp: 62,
            maxHp: 100,
            label: 'Frost Brute',
            weapon: 'sword',
          });

          drawStickmanCharacter(ctx, {
            x: 660,
            y: floorY,
            facing: -1,
            pose: Math.abs(spearX - 660) < 60 ? 'hurt' : 'jab',
            animTime: t + 0.9,
            scale: 1.24,
            isLofiYeti: false,
            bossAura: true,
            customStroke: '#c084fc',
            customAccent: '#fbbf24',
            hp: 45,
            maxHp: 100,
            label: 'Wraith Elite',
            weapon: 'blaster',
          });

          drawStickmanCharacter(ctx, {
            x: 240,
            y: floorY,
            facing: 1,
            pose: beamCycle < 0.35 ? 'heavy' : 'idle',
            actionProgress: beamCycle / 0.35,
            animTime: t,
            scale: 1.28,
            isLofiYeti: true,
            colorwayId: colorway,
            hatId,
            scarfId,
            raged: true,
            hp: 100,
            maxHp: 100,
            label: 'Frost-Spear Equipped',
            weapon: 'sword',
          });
        } else if (featureId === 'squad_quest') {
          // Waystone Relic + 3 Squad Yetis vs Monster Boss
          const pulse = 0.6 + Math.sin(t * 4) * 0.25;
          ctx.fillStyle = `rgba(56, 189, 248, ${pulse * 0.2})`;
          ctx.fillRect(390, 60, 52, floorY - 60);
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.fillRect(398, floorY - 68, 36, 68);
          ctx.strokeRect(398, floorY - 68, 36, 68);

          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(416, floorY - 122 + Math.sin(t * 3) * 6);
          ctx.lineTo(432, floorY - 96 + Math.sin(t * 3) * 6);
          ctx.lineTo(416, floorY - 70 + Math.sin(t * 3) * 6);
          ctx.lineTo(400, floorY - 96 + Math.sin(t * 3) * 6);
          ctx.closePath();
          ctx.fill();

          // Allies
          drawStickmanCharacter(ctx, {
            x: 165 + Math.sin(t * 2) * 18,
            y: floorY,
            facing: 1,
            pose: 'run',
            animTime: t + 0.5,
            scale: 1.05,
            isLofiYeti: true,
            colorwayId: 'glacier_mint',
            hatId: 'hat_beanie',
            hp: 95,
            maxHp: 100,
            label: 'Squad Ally',
            weapon: 'blaster',
          });
          drawStickmanCharacter(ctx, {
            x: 270 + Math.cos(t * 2.2) * 16,
            y: floorY,
            facing: 1,
            pose: 'jab',
            actionProgress: (t * 2) % 1,
            animTime: t,
            scale: 1.24,
            isLofiYeti: true,
            colorwayId: colorway,
            hatId,
            scarfId,
            hp: 100,
            maxHp: 100,
            label: 'Squad Leader',
            weapon: 'sword',
          });

          // Giant Dread Boss
          drawStickmanCharacter(ctx, {
            x: 615 + Math.sin(t * 1.4) * 24,
            y: floorY,
            facing: -1,
            pose: Math.sin(t * 3) > 0.2 ? 'heavy' : 'guard',
            actionProgress: (t * 1.4) % 1,
            animTime: t,
            scale: 1.48,
            isLofiYeti: false,
            bossAura: true,
            customStroke: '#f43f5e',
            customAccent: '#fbbf24',
            hp: 78,
            maxHp: 100,
            label: 'Dread Frost Titan',
            weapon: 'sword',
          });
        } else if (featureId === 'room_escape') {
          // 2-Deck Side-View Station Cutaway + Ladder + Blast Door + Escape Shuttle
          const upperDeckY = 204;
          const lowerCeilingY = 224;
          const cycle = t % 5.4;
          const doorOpen = cycle > 2.6;

          ctx.fillStyle = '#08182a';
          ctx.strokeStyle = '#2dd4bf';
          ctx.lineWidth = 3;
          ctx.fillRect(62, 62, 676, floorY - 62);
          ctx.strokeRect(62, 62, 676, floorY - 62);

          // Upper/Lower Room Labels
          ctx.fillStyle = 'rgba(226,232,240,0.22)';
          ctx.font = '700 12px Oxanium, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('MEDBAY · UPPER DECK', 80, 84);
          ctx.fillText('REACTOR CORRIDOR · LOWER DECK', 80, 244);
          ctx.fillText('AIRLOCK EXIT', 562, 244);

          // Inter-deck Floor Slab + Ladder Opening at x = 392
          ctx.fillStyle = '#050d18';
          ctx.fillRect(62, upperDeckY, 676, lowerCeilingY - upperDeckY);
          ctx.fillStyle = '#2dd4bf';
          ctx.fillRect(62, upperDeckY, 310, 3);
          ctx.fillRect(412, upperDeckY, 326, 3);

          // Vertical Ladder Shaft
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(380, upperDeckY - 6);
          ctx.lineTo(380, floorY);
          ctx.moveTo(404, upperDeckY - 6);
          ctx.lineTo(404, floorY);
          ctx.stroke();
          for (let ry = upperDeckY + 12; ry < floorY - 8; ry += 18) {
            ctx.beginPath();
            ctx.moveTo(380, ry);
            ctx.lineTo(404, ry);
            ctx.stroke();
          }

          // Medbay Cryo Tank + Clue Pad on Upper Deck
          ctx.fillStyle = 'rgba(45, 212, 191, 0.2)';
          ctx.strokeStyle = '#2dd4bf';
          ctx.lineWidth = 2;
          ctx.fillRect(130, upperDeckY - 78, 26, 78);
          ctx.strokeRect(130, upperDeckY - 78, 26, 78);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(268, upperDeckY - 34, 24, 34);
          ctx.fillStyle = doorOpen ? '#34d399' : '#fde047';
          ctx.fillRect(271, upperDeckY - 46, 18, 12);

          // Sliding Security Blast Door on Lower Deck
          const lift = doorOpen ? 68 : 0;
          ctx.fillStyle = doorOpen ? 'rgba(52, 211, 153, 0.22)' : 'rgba(244, 63, 94, 0.65)';
          ctx.strokeStyle = doorOpen ? '#34d399' : '#fb7185';
          ctx.lineWidth = 3;
          ctx.fillRect(528, floorY - 102 - lift, 14, 102);
          ctx.strokeRect(528, floorY - 102 - lift, 14, 102);

          // Side-view Escape Shuttle nose at right edge
          ctx.fillStyle = '#0f2744';
          ctx.strokeStyle = doorOpen ? '#34d399' : '#64748b';
          ctx.beginPath();
          ctx.moveTo(648, floorY - 18);
          ctx.lineTo(724, floorY - 18);
          ctx.lineTo(724, floorY - 66);
          ctx.lineTo(664, floorY - 66);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Player moves across upper deck -> climbs down ladder -> runs past opened door
          let pX = 210;
          let pY = upperDeckY;
          if (cycle < 1.8) {
            pX = 180 + (cycle / 1.8) * 125;
            pY = upperDeckY;
          } else if (cycle < 3.0) {
            const u = (cycle - 1.8) / 1.2;
            if (u < 0.45) {
              pX = 305 + (u / 0.45) * 87;
              pY = upperDeckY;
            } else {
              pX = 392;
              pY = upperDeckY + ((u - 0.45) / 0.55) * (floorY - upperDeckY);
            }
          } else {
            const u = (cycle - 3.0) / 2.4;
            pX = 392 + u * 215;
            pY = floorY;
          }

          drawStickmanCharacter(ctx, {
            x: pX,
            y: pY,
            facing: 1,
            pose: 'run',
            animTime: t,
            scale: 1.05,
            isLofiYeti: true,
            colorwayId: colorway,
            hatId,
            hp: 100,
            maxHp: 100,
            label: doorOpen ? 'AIRLOCK OPEN!' : 'Scanning Clue...',
            weapon: 'scanner',
          });

          drawStickmanCharacter(ctx, {
            x: 615 + Math.cos(t * 2.1) * 34,
            y: floorY,
            facing: -1,
            pose: 'jab',
            actionProgress: (t * 2) % 1,
            animTime: t + 0.6,
            scale: 1.15,
            isLofiYeti: false,
            imposterVisor: true,
            bossAura: true,
            customStroke: '#ef4444',
            customAccent: '#fbbf24',
            hp: 100,
            maxHp: 100,
            label: 'Airlock Warden',
            weapon: 'blaster',
          });
        } else {
          // Slow-Mo Gun-Fu Dive Raid
          const cycle = t % 3.6;
          const jumping = cycle > 0.8 && cycle < 2.3;
          const jumpY = jumping ? floorY - Math.sin(((cycle - 0.8) / 1.5) * Math.PI) * 115 : floorY;
          const pX = 160 + (cycle / 3.6) * 240;

          // Bullet tracer streaks
          ctx.fillStyle = '#fde047';
          const tx = pX + 52 + ((t * 640) % 280);
          ctx.fillRect(tx, jumpY - 56, 30, 4);
          ctx.fillRect(tx - 55, jumpY - 42, 24, 4);

          drawStickmanCharacter(ctx, {
            x: pX,
            y: jumpY,
            facing: 1,
            pose: jumping ? 'slide' : 'jab',
            actionProgress: (t * 4) % 1,
            animTime: t,
            scale: 1.25,
            isLofiYeti: true,
            colorwayId: colorway,
            hatId,
            raged: jumping,
            hp: 100,
            maxHp: 100,
            label: jumping ? 'SLOW-MO DIVE!' : 'Lofi Bean',
            weapon: 'pistols',
          });

          drawStickmanCharacter(ctx, {
            x: 565,
            y: floorY,
            facing: -1,
            pose: jumping ? 'hurt' : 'jab',
            animTime: t + 0.5,
            scale: 1.22,
            isLofiYeti: false,
            customStroke: '#fb7185',
            customAccent: '#fbbf24',
            hp: 75,
            maxHp: 100,
            label: 'Syndicate Guard',
            weapon: 'pistols',
          });

          drawStickmanCharacter(ctx, {
            x: 685,
            y: floorY,
            facing: -1,
            pose: 'guard',
            animTime: t + 1.1,
            scale: 1.32,
            isLofiYeti: false,
            bossAura: true,
            customStroke: '#f97316',
            customAccent: '#fbbf24',
            hp: 100,
            maxHp: 100,
            label: 'Vault Gate Boss',
            weapon: 'pistols',
          });
        }

        ctx.restore();
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [featureId, colorway, hatId, scarfId]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full block"
      aria-label={`Animated feature showcase for ${featureId}`}
    />
  );
};

export type NpcRosterId =
  | 'dread_boss'
  | 'cryo_brute'
  | 'abyssal_wraith'
  | 'frost_stalker'
  | 'lofi_hero'
  | 'syndicate_2d'
  | 'warden_2d';

interface NpcShowcaseStageProps {
  npcId: NpcRosterId;
  colorway?: YetiColorId;
  hatId?: string;
  scarfId?: string;
}

export const NpcShowcaseStage: React.FC<NpcShowcaseStageProps> = ({
  npcId,
  colorway = 'classic_lofi',
  hatId = 'hat_goggles',
  scarfId = 'scarf_lofi',
}) => {
  const mount3DRef = useRef<HTMLDivElement | null>(null);
  const canvas2DRef = useRef<HTMLCanvasElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const is2D = npcId === 'syndicate_2d' || npcId === 'warden_2d';

  useEffect(() => {
    if (!is2D) return;
    const canvas = canvas2DRef.current;
    if (!canvas) return;
    let rafId = 0;
    let disposed = false;
    const startMs = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(420, Math.round((rect.width || 620) * dpr));
      const h = Math.max(280, Math.round((rect.height || 400) * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const tick = (now: number) => {
      if (disposed) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const t = (now - startMs) / 1000;
        const W = 720;
        const H = 440;
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const s = Math.max(canvas.width / W, canvas.height / H);
        ctx.translate((canvas.width - W * s) * 0.5, (canvas.height - H * s) * 0.5);
        ctx.scale(s, s);

        const bg = ctx.createRadialGradient(W * 0.5, H * 0.48, 30, W * 0.5, H * 0.48, 420);
        bg.addColorStop(0, npcId === 'warden_2d' ? '#102e3a' : '#1f162b');
        bg.addColorStop(1, '#06101f');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Floor Deck
        ctx.fillStyle = '#09192e';
        ctx.fillRect(0, 355, W, 90);
        ctx.fillStyle = npcId === 'warden_2d' ? '#2dd4bf' : '#f59e0b';
        ctx.fillRect(0, 355, W, 3);

        if (npcId === 'warden_2d') {
          // Station Imposter Scout (Left)
          drawStickmanCharacter(ctx, {
            x: 190,
            y: 355,
            facing: 1,
            pose: Math.sin(t * 2.4) > 0.2 ? 'run' : 'jab',
            actionProgress: (t * 2.4) % 1,
            animTime: t,
            scale: 1.56,
            isLofiYeti: false,
            imposterVisor: true,
            customStroke: '#2dd4bf',
            customAccent: '#f43f5e',
            hp: 100,
            maxHp: 100,
            label: 'Station Imposter',
            weapon: 'blaster',
          });

          // Airlock Warden Final Boss (Right)
          drawStickmanCharacter(ctx, {
            x: 495,
            y: 355,
            facing: -1,
            pose: Math.cos(t * 2.1) > 0.2 ? 'heavy' : 'guard',
            actionProgress: (t * 2.1) % 1,
            animTime: t + 0.5,
            scale: 1.84,
            isLofiYeti: false,
            imposterVisor: true,
            bossAura: true,
            customStroke: '#ef4444',
            customAccent: '#fbbf24',
            hp: 100,
            maxHp: 100,
            label: 'Airlock Warden Boss',
            weapon: 'blaster',
          });
        } else {
          // Syndicate Enforcer (Left)
          drawStickmanCharacter(ctx, {
            x: 195,
            y: 355,
            facing: 1,
            pose: Math.sin(t * 2.5) > 0.35 ? 'jab' : 'guard',
            actionProgress: (t * 2.5) % 1,
            animTime: t,
            scale: 1.62,
            isLofiYeti: false,
            customStroke: '#fb7185',
            customAccent: '#f43f5e',
            hp: 100,
            maxHp: 100,
            label: 'Syndicate Enforcer',
            weapon: 'pistols',
          });

          // Vault Gate Boss (Right)
          drawStickmanCharacter(ctx, {
            x: 495,
            y: 355,
            facing: -1,
            pose: Math.cos(t * 2.1) > 0.3 ? 'heavy' : 'idle',
            actionProgress: (t * 2.1) % 1,
            animTime: t + 0.4,
            scale: 1.82,
            isLofiYeti: false,
            bossAura: true,
            customStroke: '#f97316',
            customAccent: '#fbbf24',
            hp: 100,
            maxHp: 100,
            label: 'Vault Gate Boss',
            weapon: 'pistols',
          });
        }

        ctx.restore();
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [is2D, npcId]);

  useEffect(() => {
    if (is2D) return;
    const container = mount3DRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || 600, container.clientHeight || 400);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071324');
    scene.fog = new THREE.FogExp2('#071324', 0.042);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const cw = container.clientWidth || 600;
    const ch = container.clientHeight || 400;
    const camera = new THREE.PerspectiveCamera(40, cw / ch, 0.2, 80);

    // 3-Point Studio Lighting Rig
    scene.add(new THREE.HemisphereLight('#bae6fd', '#0b1c34', 0.85));
    const key = new THREE.DirectionalLight('#fff7ed', 1.75);
    key.position.set(6, 10, 7);
    key.castShadow = !isSoftwareGl;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    scene.add(key);

    const accentHex =
      npcId === 'dread_boss'
        ? '#f59e0b'
        : npcId === 'abyssal_wraith'
        ? '#e879f9'
        : npcId === 'cryo_brute'
        ? '#fb7185'
        : '#38bdf8';

    const rim = new THREE.DirectionalLight(accentHex, 1.35);
    rim.position.set(-7, 5, -6);
    scene.add(rim);

    // Turntable Pedestal Plinth
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(2.35, 2.65, 0.34, 36),
      new THREE.MeshStandardMaterial({
        color: '#0f213a',
        roughness: 0.45,
        metalness: 0.55,
      })
    );
    plinth.position.y = -0.17;
    plinth.receiveShadow = true;
    scene.add(plinth);

    const plinthRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.38, 0.055, 8, 48),
      new THREE.MeshBasicMaterial({ color: accentHex })
    );
    plinthRing.rotation.x = Math.PI / 2;
    plinthRing.position.y = 0.01;
    scene.add(plinthRing);

    const heroStage = new THREE.Group();
    scene.add(heroStage);

    let monsterRig: ReturnType<typeof buildQuestMonsterMesh> | null = null;
    let yetiRig: ReturnType<typeof buildYetiRig> | null = null;
    let podRig: ReturnType<typeof buildWeaponPodMesh> | null = null;

    if (npcId === 'lofi_hero') {
      yetiRig = buildYetiRig({
        colorwayId: colorway,
        hatId,
        scarfId,
        isPlayer: true,
        scale: 1.28,
        weapon: 'sword',
      });
      yetiRig.shieldMesh.visible = true;
      heroStage.add(yetiRig.root);

      podRig = buildWeaponPodMesh('ice_axe');
      podRig.root.position.set(-1.55, 0, 0.3);
      podRig.root.scale.setScalar(0.85);
      heroStage.add(podRig.root);

      camera.position.set(0, 2.35, 6.2);
      camera.lookAt(0, 1.45, 0);
    } else {
      const mKind =
        npcId === 'dread_boss'
          ? 'boss'
          : npcId === 'cryo_brute'
          ? 'brute'
          : npcId === 'abyssal_wraith'
          ? 'wraith'
          : 'stalker';
      monsterRig = buildQuestMonsterMesh(mKind, accentHex);
      monsterRig.hpBar.group.visible = false;
      heroStage.add(monsterRig.root);

      const distZ = mKind === 'boss' ? 8.6 : mKind === 'brute' ? 7.2 : 6.2;
      const lookY = mKind === 'boss' ? 2.4 : mKind === 'brute' ? 1.85 : 1.55;
      camera.position.set(0, lookY + 0.8, distZ);
      camera.lookAt(0, lookY, 0);
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 400;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (st === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(0.05, clock.getDelta());
      const t = clock.elapsedTime;

      heroStage.rotation.y = Math.sin(t * 0.52) * 0.55 + t * 0.32;

      if (monsterRig) {
        animateQuestMonster(monsterRig, {
          speed: 35,
          dt,
          elapsedTime: t,
          attacking: Math.sin(t * 1.4) > 0.65,
        });
      }
      if (yetiRig) {
        yetiRig.shieldMesh.rotation.y += dt * 1.2;
        animateYetiWalk(yetiRig, {
          speed: 72,
          dt,
          elapsedTime: t,
          emote: Math.sin(t * 0.8) > 0.6 ? 'wave' : 'none',
        });
      }
      if (podRig) {
        animateWeaponPod(podRig, dt, t);
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    if (isSoftwareGl) afterDraw(tick);
    else frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      envTex.dispose();
      renderer.dispose();
    };
  }, [is2D, npcId, colorway, hatId, scarfId]);

  if (is2D) {
    return (
      <canvas
        ref={canvas2DRef}
        className="h-full w-full block"
        aria-label="2D Syndicate and Imposter NPC roster showcase"
      />
    );
  }

  if (webglUnavailable) {
    return (
      <img
        src="/src/assets/images/frost_arena_banner_1794874871724.jpg"
        alt="Lofi Frost Arena character preview"
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
      />
    );
  }

  return <div ref={mount3DRef} className="h-full w-full" />;
};

interface Hero2DActionStageProps {
  shotId: 'squad' | 'boss' | 'buggy';
  colorway?: YetiColorId;
  hatId?: string;
  scarfId?: string;
}

export const Hero2DActionStage: React.FC<Hero2DActionStageProps> = ({
  shotId,
  colorway = 'classic_lofi',
  hatId = 'hat_goggles',
  scarfId = 'scarf_lofi',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let rafId = 0;
    let disposed = false;
    const startMs = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(640, Math.round((rect.width || 1280) * dpr));
      const h = Math.max(360, Math.round((rect.height || 720) * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const tick = (now: number) => {
      if (disposed) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const t = (now - startMs) / 1000;
        const W = 1280;
        const H = 720;
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const s = Math.max(canvas.width / W, canvas.height / H);
        ctx.translate((canvas.width - W * s) * 0.5, (canvas.height - H * s) * 0.5);
        ctx.scale(s, s);

        // Transparent sky: only draw a feathered translucent icy catwalk rail on the right-side horizon
        // so the 2D fighters blend seamlessly into the 3D background across shots 01 -> 02 -> 03.
        const floorY = 582;
        const railStart = 590;
        const railEnd = 1248;

        const accentColor =
          shotId === 'boss' ? '#2dd4bf' : shotId === 'buggy' ? '#38bdf8' : '#f59e0b';

        const floorFade = ctx.createLinearGradient(railStart, 0, railEnd, 0);
        floorFade.addColorStop(0, 'rgba(8, 21, 39, 0)');
        floorFade.addColorStop(0.18, 'rgba(8, 21, 39, 0.52)');
        floorFade.addColorStop(0.85, 'rgba(8, 21, 39, 0.58)');
        floorFade.addColorStop(1, 'rgba(8, 21, 39, 0)');
        ctx.fillStyle = floorFade;
        ctx.fillRect(railStart, floorY, railEnd - railStart, 42);

        const railGrad = ctx.createLinearGradient(railStart, 0, railEnd, 0);
        railGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
        railGrad.addColorStop(0.16, accentColor);
        railGrad.addColorStop(0.88, accentColor);
        railGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.globalAlpha = 0.72;
        ctx.fillStyle = railGrad;
        ctx.fillRect(railStart, floorY, railEnd - railStart, 3);
        ctx.globalAlpha = 1;

        if (shotId === 'squad') {
          // 01: 2D Shadow Bean Gun-Fu Raid along lower-right horizon
          const c = t % 3.2;
          const jump = c > 0.65 && c < 2.15;
          const jy = jump ? floorY - Math.sin(((c - 0.65) / 1.5) * Math.PI) * 92 : floorY;
          const hx = 745 + Math.sin(t * 1.45) * 42;

          ctx.fillStyle = '#fde047';
          const bx = hx + 52 + ((t * 580) % 270);
          ctx.fillRect(bx, jy - 48, 26, 3.5);
          ctx.fillRect(bx - 56, jy - 34, 20, 3.5);

          drawStickmanCharacter(ctx, {
            x: hx,
            y: jy,
            facing: 1,
            pose: jump ? 'slide' : 'jab',
            actionProgress: (t * 4) % 1,
            animTime: t,
            scale: 1.12,
            isLofiYeti: true,
            colorwayId: colorway,
            hatId,
            scarfId,
            raged: jump,
            hp: 100,
            maxHp: 100,
            label: jump ? 'SLOW-MO RAID' : 'Lofi Bean',
            weapon: 'pistols',
          });

          drawStickmanCharacter(ctx, {
            x: 1010,
            y: floorY,
            facing: -1,
            pose: jump ? 'hurt' : 'jab',
            animTime: t + 0.5,
            scale: 1.08,
            isLofiYeti: false,
            customStroke: '#fb7185',
            customAccent: '#fbbf24',
            hp: 70,
            maxHp: 100,
            label: 'Syndicate',
            weapon: 'pistols',
          });

          drawStickmanCharacter(ctx, {
            x: 1138,
            y: floorY,
            facing: -1,
            pose: 'guard',
            animTime: t + 1.0,
            scale: 1.2,
            isLofiYeti: false,
            bossAura: true,
            customStroke: '#f97316',
            customAccent: '#fbbf24',
            hp: 100,
            maxHp: 100,
            label: 'Gate Boss',
            weapon: 'pistols',
          });
        } else if (shotId === 'boss') {
          // 02: 2D Side-View Station Cutaway Escape + Airlock Warden Boss
          const open = t % 4.0 > 2.2;
          ctx.fillStyle = 'rgba(13, 34, 56, 0.36)';
          ctx.strokeStyle = 'rgba(45, 212, 191, 0.52)';
          ctx.lineWidth = 2;
          ctx.strokeRect(675, floorY - 220, 520, 220);

          // Ladder shaft connecting upper deck to lower deck
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(735, floorY - 220);
          ctx.lineTo(735, floorY);
          ctx.moveTo(761, floorY - 220);
          ctx.lineTo(761, floorY);
          for (let ry = floorY - 205; ry < floorY; ry += 22) {
            ctx.moveTo(735, ry);
            ctx.lineTo(761, ry);
          }
          ctx.stroke();

          // Blast Door
          ctx.fillStyle = open ? 'rgba(52,211,153,0.18)' : 'rgba(244,63,94,0.48)';
          ctx.strokeStyle = open ? '#34d399' : '#fb7185';
          ctx.fillRect(975, floorY - 148, 16, 148);
          ctx.strokeRect(975, floorY - 148, 16, 148);

          drawStickmanCharacter(ctx, {
            x: open ? 1045 : 830 + Math.sin(t * 2.2) * 38,
            y: floorY,
            facing: 1,
            pose: 'run',
            animTime: t,
            scale: 1.08,
            isLofiYeti: true,
            colorwayId: colorway,
            hatId,
            scarfId,
            hp: 100,
            maxHp: 100,
            label: open ? 'AIRLOCK OPEN!' : 'Scanning Clue',
            weapon: 'scanner',
          });

          drawStickmanCharacter(ctx, {
            x: 1135 + Math.cos(t * 2.1) * 20,
            y: floorY,
            facing: -1,
            pose: 'heavy',
            actionProgress: (t * 2.1) % 1,
            animTime: t + 0.6,
            scale: 1.18,
            isLofiYeti: false,
            imposterVisor: true,
            bossAura: true,
            customStroke: '#ef4444',
            customAccent: '#fbbf24',
            hp: 100,
            maxHp: 100,
            label: 'Airlock Warden',
            weapon: 'blaster',
          });
        } else {
          // 03: 2D Stickman Frost Run leaping over ice spikes with Frost Shield
          const spikeX = 1230 - ((t * 280) % 620);
          if (spikeX > railStart + 30) {
            ctx.fillStyle = '#f43f5e';
            ctx.strokeStyle = '#fecdd3';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(spikeX, floorY);
            ctx.lineTo(spikeX + 16, floorY - 36);
            ctx.lineTo(spikeX + 32, floorY);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }

          const nearSpike = Math.abs(spikeX - 860) < 68;
          const runnerY = nearSpike ? floorY - Math.cos(((spikeX - 860) / 68) * 1.4) * 78 : floorY;
          drawPowerUpIcon(ctx, 'shield', 1085, floorY - 66, t);

          drawStickmanCharacter(ctx, {
            x: 860,
            y: runnerY,
            facing: 1,
            pose: nearSpike ? 'jump' : 'run',
            animTime: t * 1.5,
            scale: 1.14,
            isLofiYeti: true,
            colorwayId: colorway,
            hatId,
            scarfId,
            shielded: true,
            hp: 100,
            maxHp: 100,
            label: 'FROST RUN 2D',
          });
        }

        ctx.restore();
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [shotId, colorway, hatId, scarfId]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full block pointer-events-none"
      aria-hidden="true"
    />
  );
};
