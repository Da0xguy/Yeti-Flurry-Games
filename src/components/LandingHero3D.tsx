import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useScroll, useSpring, useTransform } from 'motion/react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ArrowRight,
  Car,
  ChevronLeft,
  ChevronRight,
  Compass,
  Crosshair,
  Flame,
  KeyRound,
  Play,
  Shield,
  Snowflake,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react';
import type { GameModeId, MapId, YetiObject } from '../types';
import { ARENA_MAPS, GAME_MODES } from '../data/gameCatalog';
import { buildArcticEnvironment } from '../three/arenaEnvironment';
import { animateYetiWalk, buildYetiRig } from '../three/yetiBuilder';
import { animateYetiKart, buildYetiKartRig } from '../three/kartAndShooter';
import {
  animateQuestMonster,
  animateWaystoneRelic,
  animateWeaponPod,
  buildQuestMonsterMesh,
  buildWaystoneRelicMesh,
  buildWeaponPodMesh,
} from '../three/questEntities';
import { GameVideoPreview } from './GameVideoPreview';
import {
  FeatureShowcaseStage,
  Hero2DActionStage,
  NpcShowcaseStage,
  type FeatureSpotlightId,
  type NpcRosterId,
} from './ShowcaseStages';

interface LandingHero3DProps {
  yeti: YetiObject | null;
  onLaunchGame: () => void;
  onLaunchMode: (gameMode: GameModeId) => void;
  onLaunchTunnel: (mapId?: MapId) => void;
  onOpenMyYeti: () => void;
}

type HeroShotId = 'squad' | 'boss' | 'buggy';

const FEATURE_SPOTLIGHTS: {
  id: FeatureSpotlightId;
  title: string;
  tag: string;
  summary: string;
  highlights: string[];
  modeToLaunch: GameModeId;
  actionLabel: string;
  accent: string;
}[] = [
  {
    id: 'frost_shield',
    title: '10s Frost Shield Power-Up',
    tag: 'Loot Drop & Contact Deflection',
    summary:
      'Smash glacial barrels or defeat elites to drop the 10-second Frost Shield. Grants full invulnerability to enemy contact, triggers knockback shockwaves, and lets you barrel through traps unscathed.',
    highlights: ['10.0s enemy contact invulnerability', 'Active deflection knockback burst', 'Drops in both 3D & 2D arenas'],
    modeToLaunch: 'survival',
    actionLabel: 'Test in Survival 3D',
    accent: '#38bdf8',
  },
  {
    id: 'loot_weapons',
    title: 'Random Weapon Loot Pods',
    tag: 'Temporary Heavy Arsenal',
    summary:
      'Weapon pods drop dynamically across waves so your squad can swap mid-fight between Glacial Ice-Axes, piercing Frost-Spears, Cryo Cannons, Plasma Glaives, and Tri-Rail Scatterguns.',
    highlights: ['5 distinct temporary weapon tiers', 'Piercing lances & AoE frost blasts', 'Spawned by crates & monster waves'],
    modeToLaunch: 'survival',
    actionLabel: 'Hunt Weapon Drops',
    accent: '#60a5fa',
  },
  {
    id: 'squad_quest',
    title: '5-Yeti Squad Escape Quest',
    tag: 'Waystones & Dread Bosses',
    summary:
      'Start every survival quest alongside 4 Yeti allies. Hold ground to awaken 3 Waystone Relics while fending off Stalkers, Brutes, Wraiths, and the Dread Frost Boss to unlock the Escape Portal.',
    highlights: ['5-Yeti cooperative formation', '3 Waystone Relic defense zones', 'Towering multi-phase Boss encounter'],
    modeToLaunch: 'survival',
    actionLabel: 'Start Escape Quest',
    accent: '#fbbf24',
  },
  {
    id: 'room_escape',
    title: '12-Room Frost Station Escape',
    tag: 'Smart BFS Imposters & Blast Doors',
    summary:
      'Navigate 12 interconnected ship rooms from Cryo Bay to the Airlock Exit. Scan hidden clues to unlock East Wing & Airlock blast doors while outsmarting vent Imposters and the Airlock Warden.',
    highlights: ['12 detailed rooms & live mini-map', 'Two-stage blast door decryption', 'Pathfinding Imposters & floor traps'],
    modeToLaunch: 'stickman_brawl',
    actionLabel: 'Enter Station Escape',
    accent: '#2dd4bf',
  },
  {
    id: 'gun_fu',
    title: 'Shadow Bean: Slow-Mo Raid',
    tag: 'Bullet-Time Gun-Fu Action',
    summary:
      'Leap into slow-motion aerial dives over enemy tracers with twin frost pistols, detonate volatile fuel barrels, and duel the Vault Gate Boss at the end of each fortified compound stage.',
    highlights: ['Bullet-time slow-motion diving', '3 escalating compound stages', 'Destructible barrels & Gate Bosses'],
    modeToLaunch: 'stickman_wrestling',
    actionLabel: 'Play Bean Raid 2D',
    accent: '#fb923c',
  },
];

const NPC_ROSTER: {
  id: NpcRosterId;
  faction: string;
  name: string;
  threat: string;
  arena: string;
  bio: string;
  abilities: string[];
  accent: string;
}[] = [
  {
    id: 'dread_boss',
    faction: 'Quest Apex Boss',
    name: 'Dread Frost Warden',
    threat: 'Extreme · Final Wave Titan',
    arena: '3D Survival Quest',
    bio: 'Towering obsidian-armored warlord crowned with ember frost horns and winged crystal pinions. Wields a rune-forged Dread Greataxe and guards the final Waystone.',
    abilities: ['Cleave Shockwave', 'Chest Furnace Surge', 'High-HP Armor Plating'],
    accent: '#f59e0b',
  },
  {
    id: 'cryo_brute',
    faction: 'Heavy Siege Unit',
    name: 'Glacial Brute Juggernaut',
    threat: 'High · Frontline Bruiser',
    arena: '3D Survival Quest',
    bio: 'Bulky siege golem encased in layered steel pauldrons and horned helm armor. Advances relentlessly with a cryo-infused War-Maul to scatter squad formations.',
    abilities: ['War-Maul Overhead Smash', 'Heavy Knockback Resistance', 'Drops Rare Weapon Pods'],
    accent: '#fb7185',
  },
  {
    id: 'abyssal_wraith',
    faction: 'Ranged Rift Caster',
    name: 'Abyssal Frost Wraith',
    threat: 'High · Floating Assassin',
    arena: '3D Survival & Shooter',
    bio: 'Spectral shroud phantom crowned with an orbiting halo of cryo runes and dual scythe-claws. Hovers above terrain obstacles to ambush flanks.',
    abilities: ['Orbiting Rune Volley', 'Hovering Flank Maneuver', 'Bone Mask Gaze'],
    accent: '#e879f9',
  },
  {
    id: 'frost_stalker',
    faction: 'Pack Predator',
    name: 'Horned Frost Stalker',
    threat: 'Medium · Fast Swarmer',
    arena: '3D Survival Quest',
    bio: 'Agile horned hunter built for speed. Charges in coordinated packs with razor wrist blades to overwhelm isolated Yetis during Waystone charges.',
    abilities: ['High-Speed Sprint Lunge', 'Pack Flanking AI', 'Dorsal Ice Spine Dash'],
    accent: '#38bdf8',
  },
  {
    id: 'lofi_hero',
    faction: 'Playable Hero · Character 01',
    name: 'Lofi the Yeti',
    threat: 'Hero · Chill Guardian',
    arena: 'All 6 2D & 3D Modes',
    bio: 'Chill yet unstoppable frost guardian equipped with custom Sui colorways, wearable hoodies/parkas, hats, and a 10-second Frost Shield.',
    abilities: ['10s Frost Shield Deflect', 'Wearable Outfits & Colors', 'Slow-Mo Gun-Fu & Dash'],
    accent: '#22d3ee',
  },
  {
    id: 'frost_fox_hero',
    faction: 'Playable Hero · Character 02',
    name: 'Kitsune Frost',
    threat: 'Hero · Agile Scout',
    arena: 'All 6 2D & 3D Modes',
    bio: 'Swift Arctic fox fighter with pointed ears, fluffy wagging tail, and winter explorer parka. Built for high-speed evasion and drifts.',
    abilities: ['Custom Coat & Outfit Slots', 'High-Agility Drifting & Jumps', 'On-Chain Sui Profile'],
    accent: '#fb923c',
  },
  {
    id: 'cryo_penguin_hero',
    faction: 'Playable Hero · Character 03',
    name: 'Emperor Pip',
    threat: 'Hero · Tanky Brawler',
    arena: 'All 6 2D & 3D Modes',
    bio: 'Regal crested penguin clad in a pro racing jersey and crown. Excels at snowball suppression, kart bumps, and Waystone defense.',
    abilities: ['Emperor Crest & Tuxedo', 'Full Colorway Customization', 'Walrus Match Replay Archive'],
    accent: '#60a5fa',
  },
  {
    id: 'mecha_bot_hero',
    faction: 'Playable Hero · Character 04',
    name: 'Cryo-Mech BMO',
    threat: 'Hero · Tech Specialist',
    arena: 'All 6 2D & 3D Modes',
    bio: 'Modular Cryo-Mech unit with glowing LED visor and neon cyber-jacket armor. Syncs telemetry and combat logs straight to Walrus.',
    abilities: ['Glowing LED Visor Array', 'Cyber-Jacket & Suit Upgrades', 'Verifiable Sui State Anchor'],
    accent: '#34d399',
  },
  {
    id: 'glacier_ronin_hero',
    faction: 'Playable Hero · Character 05',
    name: 'Shadow Ronin',
    threat: 'Hero · Blade Striker',
    arena: 'All 6 2D & 3D Modes',
    bio: 'Hooded frost swordsman with trailing headband ribbons and orbital astronaut gear. Strikes relentlessly with frost-steel blades.',
    abilities: ['Flowing Headband Ribbons', 'Orbital Suit & Katana Style', 'Zero-Gas Sponsored Progression'],
    accent: '#f43f5e',
  },
  {
    id: 'syndicate_2d',
    faction: '2D Raid Faction',
    name: 'Syndicate & Vault Gate Boss',
    threat: 'High · Gun-Fu Raid',
    arena: '2D Bean Slow-Mo Raid',
    bio: 'Tactical operatives in armored jackets and wrap-around shades, led by the caped Vault Gate Boss dual-wielding burst pistols at every compound exit.',
    abilities: ['Twin Pistol Crossfire', 'Caped Gate Boss Showdown', 'Explosive Fuel Trap Cover'],
    accent: '#fb923c',
  },
  {
    id: 'warden_2d',
    faction: '2D Station Threat',
    name: 'Airlock Warden & Imposters',
    threat: 'Extreme · 12-Room Pursuit',
    arena: '2D Frost Station Escape',
    bio: 'Pressurized cryo-suit Imposters with glowing scanner visors and BFS doorway routing, commanded by the horned Airlock Warden blocking final extraction.',
    abilities: ['Smart BFS Doorway Routing', 'Horned Airlock Ambush', 'Enraged Minion Drops'],
    accent: '#2dd4bf',
  },
];

export const LandingHero3D: React.FC<LandingHero3DProps> = ({
  yeti,
  onLaunchGame,
  onLaunchMode,
  onLaunchTunnel,
  onOpenMyYeti,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const activeShotRef = useRef<HeroShotId>('squad');
  const pointerRef = useRef({ x: 0, y: 0 });

  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [heroShot, setHeroShot] = useState<HeroShotId>('squad');
  const [activeWorldId, setActiveWorldId] = useState<MapId>('glacier_well');
  const [activeFeatureId, setActiveFeatureId] = useState<FeatureSpotlightId>('frost_shield');
  const [activeNpcId, setActiveNpcId] = useState<NpcRosterId>('dread_boss');
  const [activeModeIndex, setActiveModeIndex] = useState<number>(0);
  const [carouselPaused, setCarouselPaused] = useState(false);

  const { scrollYProgress } = useScroll({ target: pageRef, offset: ['start start', 'end end'] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 24 });
  const heroY = useTransform(smoothProgress, [0, 0.35], [0, -110]);
  const heroScale = useTransform(smoothProgress, [0, 0.35], [1, 1.08]);
  const heroContentY = useTransform(smoothProgress, [0, 0.25], [0, -48]);
  const heroOpacity = useTransform(smoothProgress, [0, 0.28], [1, 0.2]);

  useEffect(() => {
    activeShotRef.current = heroShot;
  }, [heroShot]);

  // Automatic GTA V-style Hero Camera Director cycling 01 -> 02 -> 03 -> 01
  useEffect(() => {
    const order: HeroShotId[] = ['squad', 'boss', 'buggy'];
    const timer = window.setInterval(() => {
      setHeroShot((prev) => {
        const nextIdx = (order.indexOf(prev) + 1) % order.length;
        return order[nextIdx];
      });
    }, 4800);
    return () => window.clearInterval(timer);
  }, []);

  // Continuous auto-switching game mode orbital carousel (no countdown/timer indicators)
  useEffect(() => {
    if (carouselPaused) return;
    const total = GAME_MODES.length;
    const timer = window.setInterval(() => {
      setActiveModeIndex((prev) => (prev + 1) % total);
    }, 3600);
    return () => window.clearInterval(timer);
  }, [carouselPaused]);

  useEffect(() => {
    const container = mountRef.current;
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
    renderer.toneMappingExposure = 1.16;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || 1280, container.clientHeight || 720);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071324');
    scene.fog = new THREE.FogExp2('#071324', 0.0135);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      44,
      (container.clientWidth || 1280) / (container.clientHeight || 720),
      0.2,
      175
    );
    camera.position.set(-2.6, 5.1, 12.2);

    scene.add(new THREE.HemisphereLight('#bae6fd', '#0f2942', 0.86));

    const key = new THREE.DirectionalLight('#fff7ed', 1.65);
    key.position.set(14, 22, 14);
    key.castShadow = !isSoftwareGl;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 60;
    key.shadow.camera.left = -20;
    key.shadow.camera.right = 20;
    key.shadow.camera.top = 20;
    key.shadow.camera.bottom = -20;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    scene.add(key);

    const rim = new THREE.DirectionalLight('#38bdf8', 1.05);
    rim.position.set(-14, 9, -12);
    scene.add(rim);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const env = buildArcticEnvironment(maxAniso, isSoftwareGl, 'glacier_well', 'survival', 0);
    scene.add(env.group);

    // 1. Hero Character + Frost Shield + Weapon + 2 Squad Allies (Diverse Playable Characters!)
    const heroRig = buildYetiRig({
      characterId: yeti?.characterId || 'lofi_yeti',
      colorwayId: yeti?.colorway || 'classic_lofi',
      customColors: yeti?.customColors,
      hatId: yeti?.equipped.hat || 'hat_goggles',
      scarfId: yeti?.equipped.scarf || 'scarf_lofi',
      outfitId: yeti?.equipped.outfit || 'outfit_hoodie',
      isPlayer: true,
      scale: 1.18,
      weapon: 'sword',
    });
    heroRig.shieldMesh.visible = true;
    scene.add(heroRig.root);

    const allies = [
      { rig: buildYetiRig({ characterId: 'frost_fox', colorwayId: 'glacier_mint', hatId: 'hat_beanie', scarfId: 'scarf_aurora', outfitId: 'outfit_parka', isPlayer: false, weapon: 'blaster' }), offset: 2.1, phase: 0.5 },
      { rig: buildYetiRig({ characterId: 'mecha_bot', colorwayId: 'aurora_violet', hatId: 'hat_visor', scarfId: 'scarf_lofi', outfitId: 'outfit_cyber', isPlayer: false }), offset: -2.2, phase: 2.3 },
    ];
    allies.forEach((a) => scene.add(a.rig.root));

    // 2. Sculpted 3D Monster NPCs (Dread Frost Boss, Cryo Brute, Abyssal Wraith, Stalker)
    const bossRig = buildQuestMonsterMesh('boss', '#f59e0b');
    bossRig.hpBar.group.visible = false;
    scene.add(bossRig.root);

    const wraithRig = buildQuestMonsterMesh('wraith', '#e879f9');
    wraithRig.hpBar.group.visible = false;
    scene.add(wraithRig.root);

    const bruteRig = buildQuestMonsterMesh('brute', '#fb7185');
    bruteRig.hpBar.group.visible = false;
    scene.add(bruteRig.root);

    const stalkerRig = buildQuestMonsterMesh('stalker', '#38bdf8');
    stalkerRig.hpBar.group.visible = false;
    scene.add(stalkerRig.root);

    // 3. Waystone Relic + 2 Weapon Loot Pods
    const waystone = buildWaystoneRelicMesh('#38bdf8');
    waystone.root.position.set(4.8, 0, -2.2);
    waystone.root.scale.setScalar(0.85);
    scene.add(waystone.root);

    const podAxe = buildWeaponPodMesh('ice_axe');
    podAxe.root.position.set(1.4, 0, 3.8);
    scene.add(podAxe.root);

    const podSpear = buildWeaponPodMesh('frost_spear');
    podSpear.root.position.set(7.4, 0, 2.2);
    scene.add(podSpear.root);

    // 4. Drifting Snow Buggy on Outer Loop
    const kartRig = buildYetiKartRig({
      characterId: 'cryo_penguin',
      colorwayId: 'sunset_ember',
      hatId: 'hat_crown',
      scarfId: 'scarf_crimson',
      outfitId: 'outfit_jersey',
      isPlayer: false,
    });
    scene.add(kartRig.root);

    const dropGeo = new THREE.OctahedronGeometry(0.3, 0);
    dropGeo.scale(0.85, 1.35, 0.85);
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 0.6,
      roughness: 0.12,
      clearcoat: 1.0,
    });
    const floatingItems: { mesh: THREE.Mesh; radius: number; angleOffset: number; speed: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(dropGeo, dropMat);
      m.castShadow = !isSoftwareGl;
      scene.add(m);
      floatingItems.push({
        mesh: m,
        radius: 3.1 + (i % 3) * 1.4,
        angleOffset: (i / 8) * Math.PI * 2,
        speed: 0.48 + (i % 2) * 0.22,
      });
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const onResize = () => {
      if (!container) return;
      const cw = container.clientWidth || 1280;
      const ch = container.clientHeight || 720;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    };
    window.addEventListener('resize', onResize);

    const lookTarget = new THREE.Vector3(2.2, 1.25, 0.2);
    const desiredCamPos = new THREE.Vector3(-2.6, 5.1, 12.2);
    const desiredLook = new THREE.Vector3(2.2, 1.25, 0.2);

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

      env.update(t, dt, 12.4, true);

      // Hero Yeti skating figure-8 near center-right (leaves left side open for headline)
      const hx = 2.6 + Math.sin(t * 0.72) * 2.1;
      const hz = 1.4 + Math.sin(t * 1.44) * 1.3;
      const dhx = Math.cos(t * 0.72) * 2.1 * 0.72;
      const dhz = Math.cos(t * 1.44) * 1.3 * 1.44;
      heroRig.root.position.set(hx, 0, hz);
      heroRig.root.rotation.y = Math.atan2(dhx, dhz);
      heroRig.shieldMesh.rotation.y += dt * 1.2;
      animateYetiWalk(heroRig, {
        speed: Math.hypot(dhx, dhz) * 65,
        dt,
        elapsedTime: t,
        lateralTurn: -dhx * 0.025,
      });

      allies.forEach((ally) => {
        const ax = hx + Math.cos(t * 0.65 + ally.phase) * ally.offset;
        const az = hz + Math.sin(t * 0.65 + ally.phase) * ally.offset;
        const vx = -Math.sin(t * 0.65 + ally.phase) * ally.offset * 0.65 + dhx;
        const vz = Math.cos(t * 0.65 + ally.phase) * ally.offset * 0.65 + dhz;
        ally.rig.root.position.set(ax, 0, az);
        ally.rig.root.rotation.y = Math.atan2(vx, vz);
        animateYetiWalk(ally.rig, { speed: Math.hypot(vx, vz) * 58, dt, elapsedTime: t + ally.phase });
      });

      // Sculpted Monsters patrolling & menacing hero squad
      const bossA = t * 0.34;
      const bx = 6.2 + Math.cos(bossA) * 2.6;
      const bz = -1.6 + Math.sin(bossA) * 2.2;
      bossRig.root.position.set(bx, 0, bz);
      bossRig.root.rotation.y = Math.atan2(hx - bx, hz - bz);
      animateQuestMonster(bossRig, { speed: 95, dt, elapsedTime: t, attacking: Math.sin(t * 1.8) > 0.55 });

      const wx = 8.4 + Math.sin(t * 0.9) * 1.6;
      const wz = -4.2 + Math.cos(t * 0.7) * 1.4;
      wraithRig.root.position.set(wx, 0, wz);
      wraithRig.root.rotation.y = Math.atan2(hx - wx, hz - wz);
      animateQuestMonster(wraithRig, { speed: 120, dt, elapsedTime: t + 1.0, attacking: Math.cos(t * 2.1) > 0.6 });

      const brA = t * 0.46 + 2.4;
      const brx = Math.cos(brA) * 7.8;
      const brz = Math.sin(brA) * 6.8;
      bruteRig.root.position.set(brx, 0, brz);
      bruteRig.root.rotation.y = Math.atan2(-Math.sin(brA), Math.cos(brA));
      animateQuestMonster(bruteRig, { speed: 115, dt, elapsedTime: t + 2.0 });

      const stA = t * 0.76 + 4.1;
      const sx = Math.cos(stA) * 6.4;
      const sz = Math.sin(stA) * 5.8;
      stalkerRig.root.position.set(sx, 0, sz);
      stalkerRig.root.rotation.y = Math.atan2(-Math.sin(stA), Math.cos(stA));
      animateQuestMonster(stalkerRig, { speed: 165, dt, elapsedTime: t + 3.0 });

      // Waystone Relic & Loot Pods
      animateWaystoneRelic(waystone, { charge: 0.65, completed: false, dt, elapsedTime: t });
      animateWeaponPod(podAxe, dt, t);
      animateWeaponPod(podSpear, dt, t + 1.4);

      // Snow Buggy drifting on outer perimeter
      const kartA = t * 0.42;
      const kR = 11.4;
      const kx = Math.cos(kartA) * kR;
      const kz = Math.sin(kartA) * kR;
      const kvx = -Math.sin(kartA) * kR * 0.42;
      const kvz = Math.cos(kartA) * kR * 0.42;
      kartRig.root.position.set(kx, 0, kz);
      kartRig.root.rotation.y = Math.atan2(kvx, kvz);
      animateYetiKart(kartRig, {
        speed: 280,
        steer: 0.52,
        boosting: Math.sin(t * 2.3) > 0.15,
        dt,
        elapsedTime: t,
      });

      for (const fi of floatingItems) {
        const a = fi.angleOffset + t * fi.speed;
        fi.mesh.position.set(
          Math.cos(a) * fi.radius,
          0.65 + Math.sin(t * 3 + fi.angleOffset) * 0.2,
          Math.sin(a) * fi.radius
        );
        fi.mesh.rotation.y += dt * 2.1;
      }

      // Interactive GTA V Camera Shot Switching + Mouse Parallax
      const shot = activeShotRef.current;
      const px = pointerRef.current.x;
      const py = pointerRef.current.y;

      if (shot === 'boss') {
        desiredCamPos.set(0.8 + Math.sin(t * 0.35) * 0.9 + px * 1.1, 4.1 + py * 0.6, 5.2);
        desiredLook.set(bx * 0.85 + 0.6, 2.2, bz * 0.85);
      } else if (shot === 'buggy') {
        const behindX = kx - (kvx / 4.8) * 5.6;
        const behindZ = kz - (kvz / 4.8) * 5.6;
        desiredCamPos.set(behindX + px * 0.9, 3.3 + py * 0.5, behindZ);
        desiredLook.set(kx, 1.0, kz);
      } else {
        desiredCamPos.set(-2.6 + Math.sin(t * 0.26) * 1.1 + px * 1.2, 4.9 + Math.cos(t * 0.2) * 0.35 + py * 0.6, 11.8);
        desiredLook.set(2.3, 1.25, 0.1);
      }

      camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCamPos.x, 3.5, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCamPos.y, 3.5, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCamPos.z, 3.5, dt);
      lookTarget.x = THREE.MathUtils.damp(lookTarget.x, desiredLook.x, 4.2, dt);
      lookTarget.y = THREE.MathUtils.damp(lookTarget.y, desiredLook.y, 4.2, dt);
      lookTarget.z = THREE.MathUtils.damp(lookTarget.z, desiredLook.z, 4.2, dt);
      camera.lookAt(lookTarget);

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
  }, [yeti?.characterId, yeti?.colorway, yeti?.customColors, yeti?.equipped.hat, yeti?.equipped.scarf, yeti?.equipped.outfit]);

  const carouselModes = GAME_MODES;
  const activeWorld = ARENA_MAPS.find((m) => m.id === activeWorldId) || ARENA_MAPS[0];
  const activeFeature = FEATURE_SPOTLIGHTS.find((f) => f.id === activeFeatureId) || FEATURE_SPOTLIGHTS[0];
  const activeNpc = NPC_ROSTER.find((n) => n.id === activeNpcId) || NPC_ROSTER[0];
  const activeCarouselMode = carouselModes[activeModeIndex % carouselModes.length];

  const getModeIcon = (id: GameModeId) => {
    switch (id) {
      case 'car_racing':
        return Car;
      case 'shooting':
        return Crosshair;
      case 'stickman_wrestling':
        return Crosshair;
      case 'stickman_brawl':
        return KeyRound;
      case 'stickman_run':
        return Flame;
      default:
        return Snowflake;
    }
  };

  return (
    <motion.div ref={pageRef} className="space-y-20 pb-16">
      {/* === CINEMATIC GTA V-STYLE FULL-BLEED 3D HERO === */}
      <section
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          pointerRef.current.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
          pointerRef.current.y = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
        }}
        onMouseLeave={() => {
          pointerRef.current.x = 0;
          pointerRef.current.y = 0;
        }}
        className="relative overflow-hidden min-h-screen min-h-[100dvh] flex flex-col justify-between border-b border-slate-800/80"
      >
        <motion.div
          ref={mountRef}
          style={{ y: heroY, scale: heroScale }}
          className="absolute -inset-y-12 inset-x-0 w-full pointer-events-none"
          aria-hidden="true"
        />

        {webglUnavailable && (
          <img
            src="/src/assets/images/frost_arena_banner_1794874871724.jpg"
            alt="Frozen lake arena"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
        )}

        {/* Integrated 2D Stickman Background Layer synced directly with 01 -> 02 -> 03 Director */}
        <AnimatePresence mode="wait">
          <motion.div
            key={heroShot}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.92 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 z-[2]"
            aria-hidden="true"
          >
            <Hero2DActionStage
              shotId={heroShot}
              characterId={yeti?.characterId}
              colorway={yeti?.colorway}
              customColors={yeti?.customColors}
              hatId={yeti?.equipped.hat}
              scarfId={yeti?.equipped.scarf}
              outfitId={yeti?.equipped.outfit}
            />
          </motion.div>
        </AnimatePresence>

        {/* Measured Gradient Scrims */}
        <div
          className="absolute inset-0 z-[3] bg-gradient-to-r from-[#06101f]/95 via-[#071324]/58 to-transparent pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 bottom-0 z-[3] h-36 bg-gradient-to-t from-[#081322] via-[#081322]/65 to-transparent pointer-events-none"
          aria-hidden="true"
        />

        {/* Hero Foreground Narrative & CTAs */}
        <motion.div
          style={{ y: heroContentY, opacity: heroOpacity }}
          className="relative z-10 mx-auto w-full max-w-[1200px] flex-1 flex items-center px-4 sm:px-6 pt-28 pb-10"
        >
          <div className="max-w-xl space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3"
            >
              <span className="h-[2px] w-10 bg-sky-400" aria-hidden="true" />
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">
                Lofi&apos;s Frozen Arcade · 2D &amp; 3D
              </p>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.65, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="title-3d-game text-5xl sm:text-6xl lg:text-[66px] leading-[1.0] text-balance"
            >
              Yeti Flurry Rush
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-md text-lg font-medium leading-snug text-slate-100 sm:text-xl"
            >
              Awaken Waystones with a 5-Yeti squad, race scenic snow circuits, raid Syndicate compounds in 2D slow-mo, and escape 12-room side-view cryo stations.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-center gap-3.5 pt-1"
            >
              <button
                type="button"
                onClick={onLaunchGame}
                className="arcade-btn-primary inline-flex items-center gap-2.5 rounded-lg px-6 py-3.5 text-sm font-bold whitespace-nowrap shrink-0"
              >
                <Play className="h-4 w-4 fill-current" />
                Launch 3D Arena
              </button>

              <button
                type="button"
                onClick={() => onLaunchMode('stickman_wrestling')}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-400/65 bg-[#09182c] px-5 py-3.5 text-sm font-semibold text-amber-200 hover:bg-amber-400 hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
              >
                <Crosshair className="h-4 w-4" />
                Play 2D Stickman Suite
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.32 }}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs text-slate-300 tabular-nums"
            >
              <span>4 3D Arenas (Arctic to Space)</span>
              <span aria-hidden="true">·</span>
              <span>3 2D Stickman Games</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onLaunchTunnel('glacier_well')}
                className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 underline underline-offset-4 whitespace-nowrap shrink-0"
              >
                <Users className="h-3.5 w-3.5" />
                Join Live 3D Tunnel
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onOpenMyYeti}
                className="text-sky-300 hover:text-sky-200 underline underline-offset-4 whitespace-nowrap shrink-0"
              >
                {yeti ? `Customize ${yeti.name}` : 'Mint Starter Lofi Yeti'}
              </button>
            </motion.div>
          </div>
        </motion.div>

      </section>

      {/* === CHAPTER 01: GTA-STYLE INTERACTIVE WORLDS SHOWCASE === */}
      <section id="world-showcase" className="mx-auto max-w-[1200px] px-4 sm:px-6 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">
              01. Four Battlegrounds · Including Deep Space
            </p>
            <h2 className="font-display text-3xl sm:text-4xl text-white text-balance">
              Explore the arenas
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#0A1728] p-1">
            {ARENA_MAPS.map((map) => {
              const active = map.id === activeWorldId;
              return (
                <button
                  key={map.id}
                  type="button"
                  onClick={() => setActiveWorldId(map.id)}
                  className={`relative rounded-md px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    active ? 'text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="worldTabBg"
                      transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                      className="absolute inset-0 rounded-md"
                      style={{ backgroundColor: map.accentHex }}
                    />
                  )}
                  <span className="relative z-10">{map.name}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Cinematic Live Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55 }}
            className="lg:col-span-7 relative overflow-hidden rounded-2xl border border-slate-800 bg-[#061224] min-h-[300px] sm:min-h-[370px]"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeWorld.id}
                initial={{ opacity: 0, scale: 1.03 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32 }}
                className="absolute inset-0"
              >
                <GameVideoPreview
                  mode={
                    activeWorld.id === 'volcanic_springs'
                      ? 'survival'
                      : activeWorld.id === 'aurora_summit'
                      ? 'shooting'
                      : 'car_racing'
                  }
                  mapId={activeWorld.id}
                  colorway={yeti?.colorway}
                  hatId={yeti?.equipped.hat}
                  scarfId={yeti?.equipped.scarf}
                  className="h-full w-full"
                />
              </motion.div>
            </AnimatePresence>

            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#061224] via-[#061224]/70 to-transparent pointer-events-none" />
            <div className="absolute bottom-5 left-6 right-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: activeWorld.accentHex }}>
                  {activeWorld.subtitle}
                </span>
                <h3 className="font-display text-2xl sm:text-3xl text-white mt-0.5">
                  {activeWorld.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onLaunchTunnel(activeWorld.id)}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Drop Into {activeWorld.name}
              </button>
            </div>
          </motion.div>

          {/* Right World Dossier */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#0D1C30] p-6 sm:p-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeWorld.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <Compass className="h-4 w-4" style={{ color: activeWorld.accentHex }} />
                    <span>Terrain &amp; Combat Profile</span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200">{activeWorld.description}</p>
                </div>

                <div className="divide-y divide-slate-800/90 border-y border-slate-800/90 text-sm">
                  <div className="flex items-center justify-between py-3">
                    <span className="text-slate-400">Surface Speed Boost</span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      {Math.round(activeWorld.speedMult * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-slate-400">Ice Traction Coefficient</span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      {activeWorld.friction.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-slate-400">Environmental Hazard</span>
                    <span className="font-semibold" style={{ color: activeWorld.accentHex }}>
                      {activeWorld.hazardName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-slate-400">Central Landmark</span>
                    <span className="font-semibold text-white">{activeWorld.landmarkName}</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="pt-5 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">Playable in Survival, Buggy &amp; Shooter</span>
              <button
                type="button"
                onClick={() => onLaunchMode('car_racing')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-300 hover:text-sky-200 whitespace-nowrap shrink-0"
              >
                Race This Map
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* === CHAPTER 02: ANIMATED GAME FEATURES IN ACTION === */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
              02. Combat, Loot &amp; Escape Mechanics
            </p>
            <h2 className="font-display text-3xl sm:text-4xl text-white text-balance">
              Every system built into gameplay
            </h2>
          </div>
          <span className="text-xs text-slate-400">Select a mechanic to watch it live</span>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-6 items-stretch">
          {/* Interactive Feature Selector Column */}
          <div className="lg:col-span-5 space-y-2.5">
            {FEATURE_SPOTLIGHTS.map((feat, idx) => {
              const selected = feat.id === activeFeatureId;
              return (
                <button
                  key={feat.id}
                  type="button"
                  onClick={() => setActiveFeatureId(feat.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-all duration-150 ${
                    selected
                      ? 'border-sky-400/80 bg-[#102440]'
                      : 'border-slate-800 bg-[#0B192C] hover:border-slate-700 hover:bg-[#0E1F36]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: feat.accent }}>
                        0{idx + 1} · {feat.tag}
                      </span>
                      <h3 className="font-display text-lg text-white mt-0.5 truncate">{feat.title}</h3>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 transition-transform ${
                        selected ? 'translate-x-1 text-sky-300' : 'text-slate-500'
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Live Animated Feature Stage + Mechanics Breakdown */}
          <div className="lg:col-span-7 flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0D1C30]">
            <div className="relative h-64 sm:h-72 bg-[#061224] border-b border-slate-800">
              <FeatureShowcaseStage
                featureId={activeFeature.id}
                characterId={yeti?.characterId}
                colorway={yeti?.colorway}
                customColors={yeti?.customColors}
                hatId={yeti?.equipped.hat}
                scarfId={yeti?.equipped.scarf}
                outfitId={yeti?.equipped.outfit}
              />
            </div>

            <div className="flex-1 p-6 flex flex-col justify-between gap-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeFeature.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-2xl text-white">{activeFeature.title}</h3>
                    <span className="text-xs font-semibold" style={{ color: activeFeature.accent }}>
                      {activeFeature.tag}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-300">{activeFeature.summary}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-slate-400">
                    {activeFeature.highlights.map((h, i) => (
                      <React.Fragment key={h}>
                        {i > 0 && <span aria-hidden="true">·</span>}
                        <span className="text-slate-200">{h}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {activeFeature.id === 'frost_shield' ? (
                    <Shield className="h-4 w-4 text-sky-400" />
                  ) : activeFeature.id === 'loot_weapons' ? (
                    <Sparkles className="h-4 w-4 text-sky-400" />
                  ) : (
                    <Swords className="h-4 w-4 text-amber-400" />
                  )}
                  <span>Live in-engine mechanics</span>
                </div>
                <button
                  type="button"
                  onClick={() => onLaunchMode(activeFeature.modeToLaunch)}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  {activeFeature.actionLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === CHAPTER 03: MEET THE HERO & UPGRADED NPC FACTIONS === */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-400">
              03. Heroes, Monsters &amp; Syndicate Bosses
            </p>
            <h2 className="font-display text-3xl sm:text-4xl text-white text-balance">
              Inspect the 3D &amp; 2D NPC roster
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {NPC_ROSTER.map((npc) => {
              const active = npc.id === activeNpcId;
              return (
                <button
                  key={npc.id}
                  type="button"
                  onClick={() => setActiveNpcId(npc.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-slate-950'
                      : 'border border-slate-800 bg-[#0A1728] text-slate-300 hover:border-slate-600 hover:text-white'
                  }`}
                  style={active ? { backgroundColor: npc.accent } : undefined}
                >
                  {npc.name}
                </button>
              );
            })}
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 relative overflow-hidden rounded-2xl border border-slate-800 bg-[#061224] min-h-[340px] sm:min-h-[410px]">
            <NpcShowcaseStage
              npcId={activeNpc.id}
              characterId={yeti?.characterId}
              colorway={yeti?.colorway}
              customColors={yeti?.customColors}
              hatId={yeti?.equipped.hat}
              scarfId={yeti?.equipped.scarf}
              outfitId={yeti?.equipped.outfit}
            />
            <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between text-xs text-slate-300 pointer-events-none">
              <span className="font-semibold" style={{ color: activeNpc.accent }}>
                {activeNpc.faction}
              </span>
              <span>{activeNpc.arena}</span>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#0D1C30] p-6 sm:p-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeNpc.id}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.24 }}
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: activeNpc.accent }}>
                    {activeNpc.faction} · {activeNpc.threat}
                  </span>
                  <h3 className="font-display text-3xl text-white">{activeNpc.name}</h3>
                </div>

                <p className="text-sm leading-relaxed text-slate-300">{activeNpc.bio}</p>

                <div className="space-y-2 border-t border-slate-800 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Combat Traits &amp; Signature Moves
                  </p>
                  <ul className="space-y-2 text-sm text-slate-200">
                    {activeNpc.abilities.map((ab) => (
                      <li key={ab} className="flex items-center gap-2.5">
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: activeNpc.accent }}
                          aria-hidden="true"
                        />
                        <span>{ab}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onOpenMyYeti}
                className="text-xs font-semibold text-slate-300 hover:text-white underline underline-offset-4 whitespace-nowrap shrink-0"
              >
                Customize Lofi Loadout
              </button>
              <button
                type="button"
                onClick={() =>
                  onLaunchMode(
                    activeNpc.id === 'syndicate_2d'
                      ? 'stickman_wrestling'
                      : activeNpc.id === 'warden_2d'
                      ? 'stickman_brawl'
                      : 'survival'
                  )
                }
                className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Battle In-Game
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* === CHAPTER 04: CREATIVE ORBITAL AUTO-SWITCHING GAME MODE CAROUSEL === */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.26em] text-sky-300"
        >
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-sky-400/60" />
          04. Choose Your Game Mode
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-sky-400/60" />
        </motion.div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
              Orbital Mode Deck · 3D Arenas &amp; 2D Stickman Arcade
            </p>
            <h2 className="font-display text-3xl sm:text-4xl text-white">
              Jump straight into the action
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onLaunchMode('stickman_wrestling')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/45 bg-[#0A1728] px-3.5 py-2 text-xs font-semibold text-amber-300 hover:border-amber-300 hover:text-amber-200 transition-colors whitespace-nowrap shrink-0"
            >
              2D Bean Raid
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onLaunchGame}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/45 bg-[#0A1728] px-3.5 py-2 text-xs font-semibold text-sky-300 hover:border-sky-300 hover:text-sky-200 transition-colors whitespace-nowrap shrink-0"
            >
              3D Arena Launcher
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Interactive Orbital 3D Coverflow Stage */}
        <div
          onMouseEnter={() => setCarouselPaused(true)}
          onMouseLeave={() => setCarouselPaused(false)}
          onFocus={() => setCarouselPaused(true)}
          onBlur={() => setCarouselPaused(false)}
          className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-gradient-to-b from-[#091529] via-[#071120] to-[#060d1a] px-3 py-8 sm:px-6 sm:py-10"
        >
          {/* Ambient Dimension-Matched Orbital Glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 transition-opacity duration-700"
            style={{
              background:
                activeCarouselMode.dimension === '2D'
                  ? 'radial-gradient(circle at 50% 44%, rgba(251,191,36,0.16), transparent 62%)'
                  : activeCarouselMode.id === 'car_racing'
                  ? 'radial-gradient(circle at 50% 44%, rgba(129,140,248,0.22), transparent 62%)'
                  : 'radial-gradient(circle at 50% 44%, rgba(56,189,248,0.18), transparent 62%)',
            }}
          />

          {/* Subtle Orbital Ring Decorative Arc */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-400/10"
          />

          {/* Prev / Next Floating Controls */}
          <button
            type="button"
            aria-label="Previous game mode"
            onClick={() =>
              setActiveModeIndex((prev) => (prev - 1 + carouselModes.length) % carouselModes.length)
            }
            className="absolute left-3 sm:left-5 top-1/2 z-40 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-[#0B192E]/95 text-slate-200 hover:border-sky-400 hover:text-white transition-colors shadow-lg cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            aria-label="Next game mode"
            onClick={() => setActiveModeIndex((prev) => (prev + 1) % carouselModes.length)}
            className="absolute right-3 sm:right-5 top-1/2 z-40 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-[#0B192E]/95 text-slate-200 hover:border-sky-400 hover:text-white transition-colors shadow-lg cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* 3D Perspective Card Stage */}
          <div className="relative mx-auto h-[425px] sm:h-[445px] w-full [perspective:1400px]">
            {carouselModes.map((gm, idx) => {
              const total = carouselModes.length;
              let rel = (idx - activeModeIndex) % total;
              if (rel > total / 2) rel -= total;
              if (rel < -total / 2) rel += total;

              const isCenter = rel === 0;
              const absRel = Math.abs(rel);
              const is2D = gm.dimension === '2D';
              const Icon = getModeIcon(gm.id);
              const previewMap: MapId =
                gm.id === 'car_racing'
                  ? 'orbital_rift'
                  : gm.id === 'shooting'
                  ? 'aurora_summit'
                  : gm.id === 'survival'
                  ? 'volcanic_springs'
                  : 'glacier_well';

              const translateX = rel * 285;
              const scale = isCenter ? 1 : absRel === 1 ? 0.83 : 0.66;
              const rotateY = rel * -22;
              const opacity = isCenter ? 1 : absRel === 1 ? 0.68 : absRel === 2 ? 0.26 : 0;
              const zIndex = 30 - absRel * 8;

              return (
                <motion.div
                  key={gm.id}
                  initial={false}
                  animate={{
                    x: translateX,
                    scale,
                    rotateY,
                    opacity,
                    zIndex,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 230,
                    damping: 26,
                    mass: 0.9,
                  }}
                  onClick={() => {
                    if (!isCenter) setActiveModeIndex(idx);
                  }}
                  style={{
                    transformStyle: 'preserve-3d',
                    pointerEvents: absRel > 2 ? 'none' : 'auto',
                  }}
                  className={`absolute left-1/2 top-2 -ml-[165px] sm:-ml-[195px] w-[330px] sm:w-[390px] flex flex-col justify-between overflow-hidden rounded-2xl border bg-[#0D1C30] shadow-2xl transition-colors ${
                    isCenter
                      ? is2D
                        ? 'border-amber-400/80 shadow-[0_24px_60px_rgba(251,191,36,0.16)]'
                        : gm.id === 'car_racing'
                        ? 'border-indigo-400/80 shadow-[0_24px_60px_rgba(129,140,248,0.2)]'
                        : 'border-sky-400/80 shadow-[0_24px_60px_rgba(56,189,248,0.18)]'
                      : 'border-slate-800/90 cursor-pointer hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="relative h-52 overflow-hidden bg-[#061224]">
                      <GameVideoPreview
                        mode={gm.id}
                        mapId={previewMap}
                        colorway={yeti?.colorway}
                        hatId={yeti?.equipped.hat}
                        scarfId={yeti?.equipped.scarf}
                        className="h-full w-full"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0D1C30] via-[#0D1C30]/25 to-transparent pointer-events-none" />
                      <div className="absolute inset-x-5 bottom-3 flex items-center justify-between gap-2">
                        <span
                          className={`text-[11px] font-bold uppercase tracking-wider ${
                            is2D ? 'text-amber-300' : gm.id === 'car_racing' ? 'text-indigo-300' : 'text-sky-300'
                          }`}
                        >
                          {is2D ? '2D Stickman' : gm.id === 'car_racing' ? '3D Space & Arctic' : '3D Arena'} · {gm.shortLabel}
                        </span>
                        <Icon
                          className={`h-4 w-4 ${is2D ? 'text-amber-300' : 'text-white'}`}
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 px-6 pt-4">
                      <span
                        className={`text-xs font-medium block truncate ${
                          is2D ? 'text-amber-300/90' : 'text-sky-400'
                        }`}
                      >
                        {gm.subtitle}
                      </span>
                      <h3 className="font-display text-2xl text-white leading-tight">{gm.name}</h3>
                      <p className="text-xs leading-relaxed text-slate-300 line-clamp-2 pt-0.5">
                        {gm.description}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isCenter) {
                        onLaunchMode(gm.id);
                      } else {
                        setActiveModeIndex(idx);
                      }
                    }}
                    className={`mx-6 my-5 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      is2D
                        ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                        : gm.id === 'car_racing'
                        ? 'bg-indigo-400 text-slate-950 hover:bg-indigo-300'
                        : 'bg-sky-400 text-slate-950 hover:bg-sky-300'
                    }`}
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    {isCenter ? `Play ${gm.shortLabel}` : `Focus ${gm.shortLabel}`}
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* === CHAPTER 05: CONVERSION BAND === */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#0D1C30] via-[#102642] to-[#0D1C30] p-8 sm:p-10 flex flex-wrap items-center justify-between gap-6"
        >
          <div className="max-w-xl space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-400">
              Ready to Drop In
            </p>
            <h2 className="font-display text-2xl sm:text-3xl text-white text-balance">
              Customize your Lofi Yeti and enter the arena
            </h2>
            <p className="text-sm text-slate-300">
              Unlock colorways, equip hats and scarves, gather Glacial Drops, and climb the global leaderboard across all 6 modes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenMyYeti}
              className="rounded-lg border border-slate-600 bg-[#081527] px-5 py-3 text-xs font-bold text-slate-100 hover:border-sky-400 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Customize Yeti
            </button>
            <button
              type="button"
              onClick={onLaunchGame}
              className="arcade-btn-primary inline-flex items-center gap-2 rounded-lg px-6 py-3 text-xs font-bold whitespace-nowrap shrink-0"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Play Now
            </button>
          </div>
        </motion.div>
      </section>
    </motion.div>
  );
};
