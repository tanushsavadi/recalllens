/**
 * ScanProduct — the physical traceability scan experience.
 *
 * Local-only pipeline: camera (BarcodeDetector → ZXing) or image upload → parse
 * GS1 Digital Link / element string → OCR-assisted confirm of lot/date → user
 * confirms → onConfirm(gtin, lot, expiry). Raw imagery never leaves the device.
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

export interface ScanConfirm extends Gs1Data {
  method: ScanMethod;
  /** the raw scanned QR/barcode payload (for passport signature extraction) */
  rawText: string | null;
  productName?: string;
}

export interface ScanProductProps {
  onConfirm: (fields: ScanConfirm) => void;
  /** show an optional product-name field (used by the consumer flow) */
  allowProductName?: boolean;
}

export function ScanProduct({ onConfirm, allowProductName }: ScanProductProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [method, setMethod] = useState<ScanMethod>("manual");
  const [fields, setFields] = useState<Gs1Data>({ gtin: "", lot: "", expiry: "" });
  const [rawText, setRawText] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    setError(null);
    setPermissionDenied(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setStage("camera");
      // wait a tick for the video element
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          scanLoop();
        }
      });
    } catch (e) {
      setPermissionDenied(true);
      setStage("error");
      setError(
        "Camera unavailable or permission denied. Upload a photo of the label or enter the values manually.",
      );
    }
  }

  let scanning = false;
  async function scanLoop() {
    if (scanning) return;
    scanning = true;
    const tick = async () => {
      if (!videoRef.current || !streamRef.current) {
        scanning = false;
        return;
      }
      const raw = await detectFromSource(videoRef.current).catch(() => null);
      if (raw) {
        handleRaw(raw.text, raw.method);
        stopCamera();
        scanning = false;
        return;
      }
      setTimeout(tick, 600);
    };
    tick();
  }

  function handleRaw(text: string, m: ScanMethod) {
    try {
      const parsed = parseScan(text);
      setFields(parsed.data);
      setRawText(text);
      setMethod(m);
      setStage("confirm");
      setError(null);
    } catch (e) {
      setError(
        `Scanned code is not a recognized GS1 label (${
          e instanceof Error ? e.message : String(e)
        }). Try again or enter values manually.`,
      );
      setStage("error");
    }
  }

  async function handleFile(file: File) {
    setStage("detecting");
    setError(null);
    try {
      const img = await fileToImage(file);
      const raw = await detectFromSource(img);
      if (raw) {
        handleRaw(raw.text, raw.method);
        return;
      }
      // No barcode → OCR the printed text as a fallback.
      setOcrRunning(true);
      const ocr = await ocrImage(img);
      setOcrRunning(false);
      const extracted = extractLotDateFromText(ocr.text);
      setFields({ gtin: "", lot: extracted.lot ?? "", expiry: extracted.expiry ?? "" });
      setMethod("ocr");
      setStage("confirm");
      if (!extracted.lot) {
        setError(
          "No barcode found and OCR could not read a lot code — please confirm/enter the fields manually.",
        );
      }
    } catch {
      setOcrRunning(false);
      setStage("error");
      setError("Could not read that image. Enter the values manually.");
    }
  }

  function beginManual() {
    setMethod("manual");
    setFields({ gtin: "", lot: "", expiry: "" });
    setRawText(null);
    setStage("confirm");
    setError(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-verified/40 bg-verified-bg px-3 py-2 text-xs text-verified-fg">
        🔒 All scanning and OCR run locally in your browser. The raw image never
        leaves your device.
      </div>

      {stage === "idle" && (
        <div className="flex flex-col gap-3">
          <button className="btn-primary" onClick={startCamera}>
            📷 Scan with camera
          </button>
          <label className="btn-ghost cursor-pointer text-center">
            🖼 Upload a photo of the label
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
          <button className="btn-ghost" onClick={beginManual}>
            ⌨ Enter values manually
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
            className="absolute right-2 top-2 rounded bg-white/90 px-2 py-1 text-xs font-semibold"
            onClick={() => {
              stopCamera();
              setStage("idle");
            }}
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
            onChange={(v) => setFields((f) => ({ ...f, gtin: v }))}
            placeholder="00810099110042"
          />
          <Field
            label="Lot / batch (AI 10)"
            value={fields.lot ?? ""}
            onChange={(v) => setFields((f) => ({ ...f, lot: v }))}
            placeholder="NFP-SHRED-26164-07"
          />
          <Field
            label="Best-by (AI 17)"
            value={fields.expiry ?? ""}
            onChange={(v) => setFields((f) => ({ ...f, expiry: v }))}
            placeholder="2026-06-28"
          />
          {allowProductName && (
            <Field
              label="Product name / brand (optional)"
              value={productName}
              onChange={setProductName}
              placeholder="GreenWise Organic Frozen Blueberries"
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
              className="btn-primary flex-1"
              disabled={!/^\d{8,14}$/.test(fields.gtin) || (!fields.lot && !allowProductName)}
              onClick={() =>
                onConfirm({
                  ...fields,
                  method,
                  rawText,
                  productName: productName || undefined,
                })
              }
            >
              Confirm &amp; verify
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                setStage("idle");
                setError(null);
              }}
            >
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
