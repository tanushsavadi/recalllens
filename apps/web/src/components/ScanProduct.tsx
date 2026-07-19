/**
 * ScanProduct — the physical traceability scan experience.
 *
 * Local-only pipeline: camera (BarcodeDetector → ZXing) or image upload → parse
 * GS1 Digital Link / element string → OCR-assisted confirm of lot/date → user
 * confirms → onConfirm(normalized scan). Raw imagery never leaves the device.
 *
 * SCAN-STATE ISOLATION: every scan attempt produces one immutable normalized
 * scan object identified by a monotonically increasing sequence number.
 * Starting ANY new attempt (camera, upload, manual, Restart) first clears the
 * complete previous state — parsed payload, all fields, product name, method,
 * errors. An async decode that finishes after a newer attempt started is
 * dropped (its sequence number is stale), so an older scan can never
 * overwrite a newer one. No field ever leaks between scans.
 */
import { useEffect, useRef, useState } from "react";
import { parseScan, type Gs1Data } from "@recalllens/gs1";
import {
  detectFromSource,
  fileToImage,
  barcodeDetectorSupported,
  ocrImage,
  extractLotDateFromText,
  type ScanMethod,
} from "../lib/scan";
import { Badge } from "./ui";

type Stage = "idle" | "camera" | "detecting" | "confirm" | "error";

/** How the identifiers physically arrived. */
export type ScanOrigin = "passport-qr" | "identifier-qr" | "manual";

export interface ScanConfirm extends Gs1Data {
  method: ScanMethod;
  origin: ScanOrigin;
  /** the raw scanned QR/barcode payload (for passport signature extraction) */
  rawText: string | null;
  productName?: string;
}

/** One scan attempt's complete state — replaced wholesale, never merged. */
interface ScanState {
  seq: number;
  stage: Stage;
  method: ScanMethod;
  fields: Gs1Data;
  rawText: string | null;
  productName: string;
  error: string | null;
  ocrRunning: boolean;
  permissionDenied: boolean;
}

function freshScan(seq: number, stage: Stage = "idle"): ScanState {
  return {
    seq,
    stage,
    method: "manual",
    fields: { gtin: "", lot: "", expiry: "" },
    rawText: null,
    productName: "",
    error: null,
    ocrRunning: false,
    permissionDenied: false,
  };
}

export interface ScanProductProps {
  onConfirm: (fields: ScanConfirm) => void;
  /** show an optional product-name field (used by the consumer flow) */
  allowProductName?: boolean;
}

export function ScanProduct({ onConfirm, allowProductName }: ScanProductProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const seqRef = useRef(0);
  const [scan, setScan] = useState<ScanState>(() => freshScan(0));

  useEffect(() => {
    return () => stopCamera();
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  /** Begin a brand-new scan attempt: clears ALL previous state. */
  function beginAttempt(stage: Stage): number {
    stopCamera();
    const seq = ++seqRef.current;
    setScan(freshScan(seq, stage));
    return seq;
  }

  /** Apply an update only if it belongs to the current attempt. */
  function applyIfCurrent(seq: number, update: (s: ScanState) => ScanState) {
    setScan((s) => (s.seq === seq ? update(s) : s));
  }

  async function startCamera() {
    const seq = beginAttempt("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (seqRef.current !== seq) {
        // a newer attempt started while permission was pending
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      // wait a tick for the video element
      requestAnimationFrame(() => {
        if (videoRef.current && seqRef.current === seq) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          scanLoop(seq);
        }
      });
    } catch {
      applyIfCurrent(seq, (s) => ({
        ...s,
        stage: "error",
        permissionDenied: true,
        error:
          "Camera unavailable or permission denied. Upload a photo of the label or enter the values manually.",
      }));
    }
  }

  function scanLoop(seq: number) {
    const tick = async () => {
      if (seqRef.current !== seq || !videoRef.current || !streamRef.current) return;
      const raw = await detectFromSource(videoRef.current).catch(() => null);
      if (seqRef.current !== seq) return; // stale decode — drop
      if (raw) {
        stopCamera();
        handleRaw(seq, raw.text, raw.method);
        return;
      }
      setTimeout(tick, 600);
    };
    tick();
  }

  function originOf(rawText: string | null): ScanOrigin {
    if (!rawText) return "manual";
    return rawText.includes("rlp=") ? "passport-qr" : "identifier-qr";
  }

  function handleRaw(seq: number, text: string, m: ScanMethod) {
    try {
      const parsed = parseScan(text);
      applyIfCurrent(seq, (s) => ({
        ...s,
        stage: "confirm",
        method: m,
        fields: parsed.data,
        rawText: text,
        error: null,
      }));
    } catch (e) {
      applyIfCurrent(seq, (s) => ({
        ...s,
        stage: "error",
        error: `Scanned code is not a recognized GS1 label (${
          e instanceof Error ? e.message : String(e)
        }). Try again or enter values manually.`,
      }));
    }
  }

  async function handleFile(file: File) {
    const seq = beginAttempt("detecting");
    try {
      const img = await fileToImage(file);
      const raw = await detectFromSource(img);
      if (seqRef.current !== seq) return; // a newer scan superseded this one
      if (raw) {
        handleRaw(seq, raw.text, raw.method);
        return;
      }
      // No barcode → OCR the printed text as a fallback.
      applyIfCurrent(seq, (s) => ({ ...s, ocrRunning: true }));
      const ocr = await ocrImage(img);
      if (seqRef.current !== seq) return;
      const extracted = extractLotDateFromText(ocr.text);
      applyIfCurrent(seq, (s) => ({
        ...s,
        stage: "confirm",
        method: "ocr",
        ocrRunning: false,
        fields: { gtin: "", lot: extracted.lot ?? "", expiry: extracted.expiry ?? "" },
        error: extracted.lot
          ? null
          : "No barcode found and OCR could not read a lot code — please confirm/enter the fields manually.",
      }));
    } catch {
      applyIfCurrent(seq, (s) => ({
        ...s,
        stage: "error",
        ocrRunning: false,
        error: "Could not read that image. Enter the values manually.",
      }));
    }
  }

  function beginManual() {
    beginAttempt("confirm");
  }

  function restart() {
    beginAttempt("idle");
  }

  const { stage, method, fields, rawText, productName, error, ocrRunning, permissionDenied } =
    scan;

  // Confirm requires at least one usable identifier. A GTIN, when present,
  // must look like one — but a label may honestly carry no GTIN (the FDA
  // advisory publishes none), in which case lot (or product name, consumer
  // flow) suffices.
  const gtinOk = fields.gtin === "" || /^\d{8,14}$/.test(fields.gtin);
  const hasIdentifier =
    /^\d{8,14}$/.test(fields.gtin) ||
    !!fields.lot ||
    (!!allowProductName && !!productName);
  const canConfirm = gtinOk && hasIdentifier;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-lg border border-verified/40 bg-verified-bg px-3 py-2 text-xs text-verified-fg">
        <LockIcon />
        <span>
          All scanning and OCR run locally in your browser. The raw image never
          leaves your device.
        </span>
      </div>

      {stage === "idle" && (
        <div className="flex flex-col gap-3">
          <button className="btn btn-primary" onClick={startCamera}>
            <CameraIcon /> Scan with camera
          </button>
          <label className="btn btn-glass cursor-pointer">
            <ImageIcon /> Upload a photo of the label
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
          <button className="btn btn-glass" onClick={beginManual}>
            <KeyboardIcon /> Enter values manually
          </button>
          {!barcodeDetectorSupported() && (
            <p className="text-[11px] text-slate-400">
              Native BarcodeDetector is unavailable in this browser; RecallLens
              falls back to the ZXing decoder.
            </p>
          )}
        </div>
      )}

      {stage === "camera" && (
        <div className="relative overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            className="h-64 w-full object-cover"
            muted
            playsInline
          />
          {/* framing overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-40 rounded-lg border-2 border-verified/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
          <div className="absolute bottom-2 left-0 right-0 text-center text-xs text-white">
            Point at the QR / barcode…
          </div>
          <button
            className="absolute right-2 top-2 rounded bg-white/90 px-2 py-1 text-xs font-semibold text-slate-900"
            onClick={restart}
          >
            Cancel
          </button>
        </div>
      )}

      {stage === "detecting" && (
        <div className="rounded-lg border border-slate-200 p-4 text-center text-sm text-slate-500">
          {ocrRunning ? "Reading label text (local OCR)…" : "Detecting code…"}
        </div>
      )}

      {(stage === "confirm" || stage === "error") && (
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <span className="stat-label">Confirm extracted fields</span>
            <Badge tone="info">method: {method}</Badge>
          </div>
          {error && (
            <p className="rounded bg-amber-bg px-2 py-1.5 text-xs text-amber-safety">
              {error}
              {permissionDenied &&
                " — check your browser's camera permission and reload to retry."}
            </p>
          )}
          <Field
            label="GTIN (AI 01)"
            value={fields.gtin}
            onChange={(v) =>
              setScan((s) => ({ ...s, fields: { ...s.fields, gtin: v } }))
            }
            placeholder="14-digit GTIN (leave empty if not printed)"
          />
          <Field
            label="Lot / batch (AI 10)"
            value={fields.lot ?? ""}
            onChange={(v) =>
              setScan((s) => ({ ...s, fields: { ...s.fields, lot: v } }))
            }
            placeholder="Printed lot code"
          />
          <Field
            label="Best-by (AI 17)"
            value={fields.expiry ?? ""}
            onChange={(v) =>
              setScan((s) => ({ ...s, fields: { ...s.fields, expiry: v } }))
            }
            placeholder="YYYY-MM-DD"
          />
          {allowProductName && (
            <Field
              label="Product name / brand (optional)"
              value={productName}
              onChange={(v) => setScan((s) => ({ ...s, productName: v }))}
              placeholder="As printed on the package"
            />
          )}
          <p className="text-[11px] text-slate-400">
            You can correct any field before submitting.{" "}
            {method === "ocr" && (
              <span>OCR results often need a correction — please verify.</span>
            )}
          </p>
          <div className="flex gap-2">
            <button
              className="btn btn-primary flex-1"
              disabled={!canConfirm}
              onClick={() =>
                onConfirm({
                  ...fields,
                  method,
                  origin: originOf(rawText),
                  rawText,
                  productName: productName || undefined,
                })
              }
            >
              Confirm &amp; verify
            </button>
            <button className="btn btn-glass" onClick={restart}>
              Restart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const id = `scan-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-slate-500">
        {label}
      </label>
      <input
        id={id}
        name={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
      />
    </div>
  );
}

/* ── inline stroke icons (match the app's icon language, no emoji) ──────── */
function CameraIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1l1.4-2h6.2L16.5 6h1A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}
function ImageIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4.5 17.5 9 13l3 3 3.5-3.5 4 4" />
    </svg>
  );
}
function KeyboardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <rect x="3.5" y="7" width="17" height="10.5" rx="2" />
      <path d="M7 10.5h.01M10.3 10.5h.01M13.6 10.5h.01M16.9 10.5h.01M7.5 14h9" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" className="shrink-0" aria-hidden>
      <rect x="5.5" y="10.5" width="13" height="9" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </svg>
  );
}
