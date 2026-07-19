/**
 * GlobeStage — the massive CENTERED interactive globe that is the primary
 * interface. Fixed, full-viewport, sized to the smaller viewport dimension so
 * the sphere dominates the screen. Glass panels float around it (in the app
 * shell). Handles resize, lazy-load, hover state, and a 2D fallback.
 */
import {
  Suspense,
  lazy,
  useEffect,
  useState,
  Component,
  type ReactNode,
} from "react";
import { useOutbreakState } from "../../lib/case-state";
import { StatesMap } from "../StatesMap";

const BackgroundGlobe = lazy(() => import("./BackgroundGlobe"));

function reducedMotion() {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
function webglOk() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext &&
      (c.getContext("webgl") || c.getContext("experimental-webgl")));
  } catch { return false; }
}

class Boundary extends Component<{ children: ReactNode; onError: () => void }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.err ? null : this.props.children; }
}

export function GlobeStage() {
  const { affectedStates, confirmedCount, converged, replayNonce } = useOutbreakState();
  const [vp, setVp] = useState({ w: 1440, h: 900 });
  const [use3D, setUse3D] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    setUse3D(webglOk() && !reducedMotion());
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const show3D = use3D && !failed;
  // The globe canvas must COVER the whole viewport in both dimensions (plus a
  // small bleed) so a zoomed earth is never clipped to a visible square box on
  // wide or tall screens — the WebGL clip edge always lies past the viewport
  // edge. The sphere's apparent size is set by the camera, not the canvas.
  const cw = Math.round(vp.w * 1.12);
  const ch = Math.round(vp.h * 1.12);

  return (
    <div className="globe-stage fixed inset-0 z-0 flex items-center justify-center overflow-hidden">
      {show3D ? (
        <Boundary onError={() => setFailed(true)}>
          <Suspense fallback={null}>
            <div style={{ width: cw, height: ch }} className="relative">
              <BackgroundGlobe
                affectedStates={affectedStates}
                confirmedCount={confirmedCount}
                converged={converged}
                replayNonce={replayNonce}
                width={cw}
                height={ch}
                autoRotate={vp.w >= 640}
              />
            </div>
          </Suspense>
        </Boundary>
      ) : (
        <div className="flex h-full w-full items-center justify-center p-8 opacity-70">
          <div className="w-full max-w-md">
            <StatesMap affected={affectedStates} />
          </div>
        </div>
      )}

      {/* Radial + edge vignette keeps floating glass panels readable while
          leaving the globe's center bright. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 120% at 50% 50%, transparent 42%, color-mix(in oklab, var(--bg-0) 55%, transparent) 72%, var(--bg-0) 100%)",
        }}
      />
    </div>
  );
}
