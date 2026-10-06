import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import R3fGlobe, { type GlobeMethods } from "r3f-globe";
import * as THREE from "three";
import { MAP_NONQUAKE_CAP, type LiveEvent } from "../types";
import { GLOBE_FRAGMENT, GLOBE_VERTEX } from "../globe/shaders";
import { GLOBE_RADIUS, polarToVec3, subsolarLatLng, sunDirection } from "../globe/sun";
import { reducedMotion, registerGlobe, syncGlobeEvents } from "../utils/globeController";
import styles from "./GlobeView.module.css";

export interface CountryFeature {
  type: string;
  geometry: { type: string; coordinates: unknown };
  properties?: Record<string, unknown>;
}

interface PointDatum {
  id: string;
  lat: number;
  lng: number;
  color: string;
  radius: number;
  altitude: number;
}

interface Props {
  events: LiveEvent[];
  hoveredId: string | null;
  selectedId: string | null;
  countryFeature: CountryFeature | null;
  onHoverEvent: (id: string | null) => void;
  onSelectEvent: (id: string | null) => void;
  active?: boolean;
}

const TYPE_COLOR: Record<LiveEvent["type"], string> = {
  quake: "#E85D4A",
  fire: "#F39C12",
  flood: "#3FA7D6",
  storm: "#BB7AE0",
};
const ACCENT = "#D4C4A8";
const TILE_ON_REL = 0.45;
const TILE_OFF_REL = 0.6;
const TILE_POV_INTERVAL = 0.2;

function streetTileUrl(x: number, y: number, l: number): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${l}/${y}/${x}`;
}

interface TileEngineLike {
  updatePov: (cam: THREE.Camera) => void;
  clearTiles: () => void;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Phones get the 1k texture set — roughly a quarter of the bytes for a globe
 *  that is never wider than a few hundred CSS pixels anyway. */
function isPhone(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

/** Run `fn` once the browser is idle, with a timeout so it always runs. */
function whenIdle(fn: () => void): void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(fn, { timeout: 2500 });
  else window.setTimeout(fn, 400);
}

function SceneRig({
  controlsRef,
  globeRef,
  cloudsRef,
  sunLightRef,
  material,
  tilesActive,
  active,
  resetPos,
  onProximityChange,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  globeRef: React.RefObject<GlobeMethods | undefined>;
  cloudsRef: React.RefObject<THREE.Mesh | null>;
  sunLightRef: React.RefObject<THREE.DirectionalLight | null>;
  material: THREE.ShaderMaterial;
  tilesActive: boolean;
  active: boolean;
  resetPos: [number, number, number];
  onProximityChange: (active: boolean) => void;
}) {
  const desired = useRef<THREE.Vector3 | null>(null);
  const flying = useRef(false);
  const idleTimer = useRef(0);
  const povTimer = useRef(0);
  const wasClose = useRef(false);
  const tileEngine = useRef<TileEngineLike | null>(null);
  const motionOK = !reducedMotion();

  useEffect(() => {
    if (!active) return;
    const api = {
      flyTo: (lat: number, lng: number, relAltitude = 0.7) => {
        const target = polarToVec3(lat, lng, relAltitude, new THREE.Vector3());
        if (!motionOK) {
          const cam = controlsRef.current?.object;
          if (cam) {
            cam.position.copy(target);
            controlsRef.current?.update();
          }
          return;
        }
        desired.current = target;
        flying.current = true;
      },
      reset: () => {
        const target = new THREE.Vector3(resetPos[0], resetPos[1], resetPos[2]);
        if (!motionOK) {
          const cam = controlsRef.current?.object;
          if (cam) {
            cam.position.copy(target);
            controlsRef.current?.update();
          }
          return;
        }
        desired.current = target;
        flying.current = true;
      },
    };
    registerGlobe("3d", api);
    return () => registerGlobe("3d", null);
  }, [controlsRef, motionOK, active, resetPos]);

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.05);
    if (cloudsRef.current && motionOK) cloudsRef.current.rotation.y += d * 0.004;
    idleTimer.current += d;
    if (idleTimer.current > 1) {
      idleTimer.current = 0;
      const sun = sunDirection(new Date(), new THREE.Vector3());
      (material.uniforms.sunDirection as THREE.IUniform).value.copy(sun);
      if (sunLightRef.current) sunLightRef.current.position.copy(sun.clone().multiplyScalar(400));
    }
    if (flying.current && desired.current) {
      const cam = state.camera;
      const k = 1 - Math.exp(-2.6 * d);
      cam.position.lerp(desired.current, k);
      const stopEps = Math.max(0.03, desired.current.length() * 0.0005);
      if (cam.position.distanceTo(desired.current) < stopEps) {
        flying.current = false;
        desired.current = null;
      }
    }
    const globe = globeRef.current;
    if (globe) globe.setPointOfView(state.camera);
    const cam = state.camera;
    const surfDist = cam.position.length() - GLOBE_RADIUS;
    const persp = cam as THREE.PerspectiveCamera;
    const near = Math.min(2, Math.max(0.003, surfDist * 0.35));
    if (Math.abs(persp.near - near) > near * 0.15 + 0.0001) {
      persp.near = near;
      persp.updateProjectionMatrix();
    }
    const rel = surfDist / GLOBE_RADIUS;
    const close = rel < TILE_ON_REL || (wasClose.current && rel < TILE_OFF_REL);
    if (close !== wasClose.current) {
      wasClose.current = close;
      onProximityChange(close);
    }
    if (!tileEngine.current) {
      state.scene.traverse((o) => {
        const cand = o as unknown as { updatePov?: unknown; clearTiles?: unknown };
        if (
          !tileEngine.current &&
          typeof cand.updatePov === "function" &&
          typeof cand.clearTiles === "function"
        ) {
          tileEngine.current = cand as unknown as TileEngineLike;
        }
      });
    }
    if (tilesActive && tileEngine.current) {
      povTimer.current -= d;
      if (povTimer.current <= 0) {
        povTimer.current = TILE_POV_INTERVAL;
        tileEngine.current.updatePov(cam);
      }
    }
  });

  return null;
}

export default function GlobeView({ events, hoveredId, selectedId, countryFeature, onHoverEvent, onSelectEvent, active = true }: Props) {
  const [hasWebgl] = useState(webglAvailable);
  const [pageVisible, setPageVisible] = useState(typeof document === "undefined" ? true : !document.hidden);
  const [ready, setReady] = useState(false);
  const [auto, setAuto] = useState(!reducedMotion());
  const [tilesClose, setTilesClose] = useState(false);
  const [phone] = useState(isPhone);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cloudsRef = useRef<THREE.Mesh | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const resumeTimer = useRef<number | null>(null);
  const motionOK = useMemo(() => !reducedMotion(), []);
  const base = import.meta.env.BASE_URL;

  useEffect(() => {
    syncGlobeEvents(events);
  }, [events]);

  useEffect(() => {
    const onVis = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    return () => {
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    };
  }, []);

  useEffect(() => {
    globeRef.current?.globeTileEngineClearCache();
  }, [tilesClose]);

  // Chosen once: phones pull the 1k texture set (roughly a quarter of the
  // bytes), larger screens get the full 2k files.
  const [texPaths] = useState(() =>
    isPhone()
      ? {
          day: "textures/1k/earth_daymap.jpg",
          night: "textures/1k/earth_nightmap.jpg",
          clouds: "textures/1k/earth_clouds.jpg",
        }
      : {
          day: "textures/2k_earth_daymap.jpg",
          night: "textures/2k_earth_nightmap.jpg",
          clouds: "textures/2k_earth_clouds.jpg",
        },
  );

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: GLOBE_VERTEX,
      fragmentShader: GLOBE_FRAGMENT,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
      uniforms: {
        dayMap: { value: null },
        nightMap: { value: null },
        sunDirection: { value: sunDirection(new Date(), new THREE.Vector3()) },
      },
    });
    // Only the day map blocks the first frame; everything else waits for idle.
    new THREE.TextureLoader().load(`${base}${texPaths.day}`, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      mat.uniforms.dayMap.value = tex;
      mat.needsUpdate = true;
    });
    return mat;
  }, [base, texPaths.day]);

  // Night-side city lights are invisible until the terminator moves, so they
  // are safe to fetch after the page has settled.
  useEffect(() => {
    let live = true;
    whenIdle(() => {
      if (!live) return;
      new THREE.TextureLoader().load(`${base}${texPaths.night}`, (tex) => {
        if (!live) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        material.uniforms.nightMap.value = tex;
        material.needsUpdate = true;
      });
    });
    return () => {
      live = false;
    };
  }, [base, material, texPaths.night]);

  useEffect(() => {
    return () => {
      material.uniforms.dayMap.value?.dispose();
      material.uniforms.nightMap.value?.dispose();
      material.dispose();
    };
  }, [material]);

  // The cloud shell is the largest texture (~1 MB). It waits until the globe
  // has drawn, or until a hard deadline fires in case onGlobeReady never does.
  const [cloudDeadline, setCloudDeadline] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setCloudDeadline(true), 2500);
    return () => window.clearTimeout(t);
  }, []);
  const cloudsWanted = ready || cloudDeadline;

  const [cloudsTex, setCloudsTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!cloudsWanted) return;
    let live = true;
    whenIdle(() => {
      if (!live) return;
      new THREE.TextureLoader().load(`${base}${texPaths.clouds}`, (tex) => {
        if (!live) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        setCloudsTex(tex);
      });
    });
    return () => {
      live = false;
    };
  }, [base, cloudsWanted, texPaths.clouds]);

  useEffect(() => {
    return () => {
      cloudsTex?.dispose();
    };
  }, [cloudsTex]);

  const points = useMemo(() => {
    const seen: Record<string, number> = {};
    const out: PointDatum[] = [];
    for (const ev of events) {
      if (ev.type !== "quake") {
        seen[ev.type] = (seen[ev.type] || 0) + 1;
        if (seen[ev.type] as number > MAP_NONQUAKE_CAP) continue;
      }
      const isSel = ev.id === selectedId;
      const isHov = ev.id === hoveredId;
      const mag = ev.magnitude ?? 0;
      // Quakes scale with magnitude; the rest fall back to the source's alert
      // level (GDACS), then to a neutral mid-severity when neither is reported.
      const severity = ev.severity ?? 0.5;
      const baseRadius = ev.type === "quake" ? 0.24 + mag * 0.075 : 0.36 + severity * 0.2;
      out.push({
        id: ev.id,
        lat: ev.lat,
        lng: ev.lng,
        color: isSel ? ACCENT : isHov ? "#FFFFFF" : TYPE_COLOR[ev.type],
        radius: baseRadius * (isSel ? 1.6 : isHov ? 1.3 : 1),
        altitude:
          (ev.type === "quake" ? 0.01 + mag * 0.004 : 0.022) + (isSel ? 0.006 : 0),
      });
    }
    return out;
  }, [events, hoveredId, selectedId]);

  const initialPos = useMemo(
    () => polarToVec3(-12, subsolarLatLng(new Date()).lng - 30, 1.5, new THREE.Vector3()).toArray() as [number, number, number],
    [],
  );

  if (!hasWebgl) {
    return (
      <div className={styles.fallback} role="status">
        <p>3D view unavailable — showing data only. The event list and filters still work.</p>
        <p className="tiny">You can also switch to the 2D map using the control in the top bar.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.stage} ${ready ? styles.live : ""}`}>
      <Canvas
        dpr={[1, phone ? 1.5 : 2]}
        camera={{ position: initialPos, fov: 42, near: 1, far: 4000 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, alpha: false }}
        frameloop={pageVisible && active ? "always" : "never"}
        onPointerMissed={() => onSelectEvent(null)}
      >
        <color attach="background" args={["#020307"]} />
        <ambientLight intensity={0.9} />
        <directionalLight ref={sunLightRef} intensity={1.6} />
        <Stars
          radius={800}
          depth={120}
          count={phone ? 2500 : 5000}
          factor={4}
          saturation={0}
          fade
          speed={motionOK ? 0.4 : 0}
        />
        <R3fGlobe
          ref={globeRef}
          globeMaterial={material}
          globeTileEngineUrl={tilesClose ? streetTileUrl : null}
          showAtmosphere={!tilesClose}
          atmosphereColor="#8FB4FF"
          atmosphereAltitude={0.22}
          pointsData={points as object[]}
          pointLat={(d: object) => (d as PointDatum).lat}
          pointLng={(d: object) => (d as PointDatum).lng}
          pointColor={(d: object) => (d as PointDatum).color}
          pointAltitude={(d: object) => (d as PointDatum).altitude}
          pointRadius={(d: object) => (d as PointDatum).radius}
          pointResolution={12}
          pointsTransitionDuration={0}
          polygonsData={countryFeature ? [countryFeature as object] : []}
          polygonCapColor={() => "rgba(0,0,0,0)"}
          polygonSideColor={() => "rgba(0,0,0,0)"}
          polygonStrokeColor={() => "rgba(212,196,168,0.6)"}
          polygonAltitude={0.004}
          polygonsTransitionDuration={0}
          onHover={(layer, d) => {
            if (layer === "points" && d) onHoverEvent((d as PointDatum).id);
            else onHoverEvent(null);
          }}
          onClick={(layer, d) => {
            if (layer === "points" && d) onSelectEvent((d as PointDatum).id);
          }}
          onGlobeReady={() => setReady(true)}
        />
        {cloudsTex && !tilesClose && (
          <mesh ref={cloudsRef}>
            <sphereGeometry args={[GLOBE_RADIUS * 1.018, 48, 48]} />
            <meshLambertMaterial map={cloudsTex} transparent opacity={0.5} depthWrite={false} />
          </mesh>
        )}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.55}
          minDistance={GLOBE_RADIUS * 1.0001}
          maxDistance={GLOBE_RADIUS * 5}
          autoRotate={motionOK && auto && !tilesClose && active}
          autoRotateSpeed={0.7}
          onStart={() => {
            setAuto(false);
            if (resumeTimer.current) {
              window.clearTimeout(resumeTimer.current);
              resumeTimer.current = null;
            }
          }}
          onEnd={() => {
            if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
            if (!motionOK) return;
            // Long enough that the globe reads as "stopped" while you work,
            // short enough that it drifts back to life if you walk away.
            resumeTimer.current = window.setTimeout(() => setAuto(true), 15000);
          }}
        />
        <SceneRig
          controlsRef={controlsRef}
          globeRef={globeRef}
          cloudsRef={cloudsRef}
          sunLightRef={sunLightRef}
          material={material}
          tilesActive={tilesClose}
          active={active}
          resetPos={initialPos}
          onProximityChange={setTilesClose}
        />
      </Canvas>
    </div>
  );
}
