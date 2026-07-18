/**
 * BackgroundGlobe — the full-screen interactive globe that sits behind the
 * whole app as the primary interface. Same privacy/truthfulness rules as
 * OutbreakGlobe: state-granularity markers only, coarse anonymous proof arcs,
 * convergence camera driven by REAL on-chain state.
 *
 * Rendered fixed at z-0; glass panels float above at higher z. It fills the
 * viewport and slowly auto-rotates for ambient life (paused on reduced motion).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { useTheme } from "../../lib/theme";
import { OUTBREAK_FOCUS, US_VIEW, centroidFor } from "./state-centroids";

const TEX_BASE = import.meta.env.VITE_GLOBE_TEX_BASE ?? "/globe/";

const ARC_ORIGINS = [
  { lat: 48.0, lng: -104.0 },
  { lat: 31.0, lng: -95.0 },
  { lat: 43.0, lng: -71.0 },
];

export interface BackgroundGlobeProps {
  affectedStates: string[];
  confirmedCount: number;
  converged: boolean;
  replayNonce: number;
  width: number;
  height: number;
  autoRotate: boolean;
}

interface Marker { lat: number; lng: number; code: string; name: string }
interface Arc {
  startLat: number; startLng: number; endLat: number; endLng: number; color: string[];
}

export default function BackgroundGlobe({
  affectedStates,
  confirmedCount,
  converged,
  replayNonce,
  width,
  height,
  autoRotate,
}: BackgroundGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const theme = useTheme((s) => s.theme);

  const markers: Marker[] = useMemo(
    () =>
      affectedStates
        .map((s) => centroidFor(s))
        .filter((c): c is NonNullable<typeof c> => !!c)
        .map((c) => ({ lat: c.lat, lng: c.lng, code: c.code, name: c.name })),
    [affectedStates],
  );

  const arcs: Arc[] = useMemo(() => {
    const n = Math.min(confirmedCount, 3);
    return ARC_ORIGINS.slice(0, n).map((o) => ({
      startLat: o.lat,
      startLng: o.lng,
      endLat: OUTBREAK_FOCUS.lat,
      endLng: OUTBREAK_FOCUS.lng,
      color: ["rgba(52,227,155,0.12)", "rgba(127,240,193,0.95)"],
    }));
  }, [confirmedCount]);

  useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      const g = globeRef.current;
      tries++;
      if (g) {
        g.pointOfView(converged ? OUTBREAK_FOCUS : US_VIEW, 0);
        const controls = g.controls();
        if (controls) {
          controls.enableZoom = true;
          controls.autoRotate = autoRotate;
          controls.autoRotateSpeed = 0.28;
          controls.minDistance = 180;
          controls.maxDistance = 640;
          controls.enablePan = false;
        }
        setReady(true);
        clearInterval(id);
      } else if (tries > 40) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause auto-rotation when converged so the money-shot holds still.
  useEffect(() => {
    const g = globeRef.current;
    if (!g || !ready) return;
    const controls = g.controls();
    if (controls) controls.autoRotate = autoRotate && !converged;
    if (converged) g.pointOfView(OUTBREAK_FOCUS, 2200);
  }, [converged, replayNonce, ready, autoRotate]);

  const globeImg =
    theme === "light"
      ? `${TEX_BASE}earth-blue-marble.jpg`
      : `${TEX_BASE}earth-night.jpg`;

  return (
    <Globe
      ref={globeRef as never}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl={globeImg}
      bumpImageUrl={`${TEX_BASE}earth-topology.png`}
      showAtmosphere
      atmosphereColor={theme === "light" ? "#8fb2ff" : "#3355aa"}
      atmosphereAltitude={0.22}
      pointsData={markers}
      pointLat={(d: object) => (d as Marker).lat}
      pointLng={(d: object) => (d as Marker).lng}
      pointColor={() => "#ff5c52"}
      pointAltitude={0.07}
      pointRadius={0.5}
      pointLabel={(d: object) =>
        `<div style="font:600 12px Geist,sans-serif;color:#0d1220;background:#fff;padding:6px 9px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.25)">
          <b>${(d as Marker).name}</b><br/>Affected state · CDC (state-level)
        </div>`
      }
      ringsData={markers}
      ringLat={(d: object) => (d as Marker).lat}
      ringLng={(d: object) => (d as Marker).lng}
      ringColor={() => (t: number) => `rgba(255,92,82,${1 - t})`}
      ringMaxRadius={3.6}
      ringPropagationSpeed={1.5}
      ringRepeatPeriod={1300}
      arcsData={arcs}
      arcColor={(d: object) => (d as Arc).color}
      arcStroke={0.7}
      arcDashLength={0.5}
      arcDashGap={0.22}
      arcDashAnimateTime={1500}
      arcAltitude={0.3}
    />
  );
}
