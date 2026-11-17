import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { YetiColorId, YetiEmoteKind } from '../types';
import { animateYetiWalk, buildYetiRig } from '../three/yetiBuilder';

interface MyYetiPreview3DProps {
  colorwayId: YetiColorId;
  hatId: string;
  scarfId: string;
}

export const MyYetiPreview3D: React.FC<MyYetiPreview3DProps> = ({
  colorwayId,
  hatId,
  scarfId,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({ colorwayId, hatId, scarfId });
  const dirtyRef = useRef(true);
  const [previewEmote, setPreviewEmote] = useState<YetiEmoteKind>('none');
  const emoteRef = useRef<YetiEmoteKind>('none');

  useEffect(() => {
    emoteRef.current = previewEmote;
  }, [previewEmote]);

  useEffect(() => {
    propsRef.current = { colorwayId, hatId, scarfId };
    dirtyRef.current = true;
  }, [colorwayId, hatId, scarfId]);

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
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || 360, container.clientHeight || 300);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#09192e');
    scene.fog = new THREE.FogExp2('#09192e', 0.045);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      38,
      (container.clientWidth || 360) / (container.clientHeight || 300),
      0.1,
      50
    );
    camera.position.set(0, 1.75, 5.25);
    camera.lookAt(0, 1.32, 0);

    scene.add(new THREE.HemisphereLight('#bae6fd', '#0f2942', 0.85));

    const key = new THREE.DirectionalLight('#fff7ed', 1.6);
    key.position.set(4, 7, 5);
    key.castShadow = !isSoftwareGl;
    key.shadow.mapSize.set(512, 512);
    key.shadow.bias = -0.0005;
    scene.add(key);

    const rim = new THREE.DirectionalLight('#38bdf8', 1.0);
    rim.position.set(-5, 4, -4);
    scene.add(rim);

    // Pedestal ice plinth
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.55, 0.28, 32),
      new THREE.MeshPhysicalMaterial({
        color: '#0e3454',
        roughness: 0.22,
        clearcoat: 0.85,
      })
    );
    plinth.position.y = -0.14;
    plinth.receiveShadow = true;
    scene.add(plinth);

    const plinthRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.36, 0.035, 8, 48),
      new THREE.MeshBasicMaterial({ color: '#38bdf8' })
    );
    plinthRing.rotation.x = Math.PI / 2;
    plinthRing.position.y = 0.01;
    scene.add(plinthRing);

    const actorHolder = new THREE.Group();
    scene.add(actorHolder);

    let rig = buildYetiRig({
      colorwayId: propsRef.current.colorwayId,
      hatId: propsRef.current.hatId,
      scarfId: propsRef.current.scarfId,
      isPlayer: true,
    });
    actorHolder.add(rig.root);

    let dragYaw = 0.28;
    let isDragging = false;
    let lastX = 0;

    const onDown = (e: PointerEvent) => {
      isDragging = true;
      lastX = e.clientX;
    };
    const onMove = (e: PointerEvent) => {
      if (!isDragging) return;
      dragYaw += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    };
    const onUp = () => {
      isDragging = false;
    };

    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    const onResize = () => {
      if (!container) return;
      const cw = container.clientWidth || 360;
      const ch = container.clientHeight || 300;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
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

      if (dirtyRef.current) {
        actorHolder.remove(rig.root);
        rig = buildYetiRig({
          colorwayId: propsRef.current.colorwayId,
          hatId: propsRef.current.hatId,
          scarfId: propsRef.current.scarfId,
          isPlayer: true,
        });
        actorHolder.add(rig.root);
        dirtyRef.current = false;
      }

      if (!isDragging) {
        dragYaw += dt * 0.45;
      }
      rig.root.rotation.y = dragYaw;
      const activeEmote = emoteRef.current;
      animateYetiWalk(rig, {
        speed: activeEmote === 'none' ? 48 : 0,
        dt,
        elapsedTime: t,
        emote: activeEmote,
      });

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
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', onResize);
      envTex.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-xl border border-slate-800 bg-[#09192e]">
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/90 p-1">
        {(
          [
            { id: 'none', label: 'Walk' },
            { id: 'wave', label: 'Wave' },
            { id: 'dance', label: 'Dance' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPreviewEmote(item.id)}
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
              previewEmote === item.id
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <span className="pointer-events-none absolute bottom-2.5 right-3 text-[11px] text-slate-400">
        Drag to rotate 3D Yeti
      </span>
    </div>
  );
};
