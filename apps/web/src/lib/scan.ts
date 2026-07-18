/**
 * Local barcode/QR scanning + OCR. ALL processing is on-device; raw imagery
 * never leaves the browser. Strategy:
 *   1. Native BarcodeDetector (Chrome/Android) when available.
 *   2. ZXing (@zxing/browser) fallback for other browsers.
 *   3. Manual entry fallback if neither detects.
 * OCR (Tesseract.js) reads printed lot/date text when the QR is missing or the
 * user wants to confirm the printed fields.
 */
import { BrowserMultiFormatReader } from "@zxing/browser";

export type ScanMethod = "native-barcode-detector" | "zxing" | "ocr" | "manual";

export interface RawScan {
  text: string;
  method: ScanMethod;
  /** 0..1 where the detector reports it; undefined otherwise */
  confidence?: number;
}

export function barcodeDetectorSupported(): boolean {
  return typeof (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector !==
    "undefined";
}

/** Detect a barcode/QR from a video element or image bitmap source. */
export async function detectFromSource(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<RawScan | null> {
  // 1. Native BarcodeDetector
  const BD = (globalThis as { BarcodeDetector?: any }).BarcodeDetector;
  if (BD) {
    try {
      const detector = new BD({
        formats: ["qr_code", "data_matrix", "code_128", "ean_13", "upc_a"],
      });
      const codes = await detector.detect(source as CanvasImageSource);
      if (codes && codes.length > 0) {
        return {
          text: codes[0].rawValue as string,
          method: "native-barcode-detector",
        };
      }
    } catch {
      /* fall through to ZXing */
    }
  }

  // 2. ZXing fallback (works on an image element or canvas)
  try {
    const reader = new BrowserMultiFormatReader();
    let img: HTMLImageElement | HTMLCanvasElement;
    if (source instanceof HTMLVideoElement) {
      const canvas = document.createElement("canvas");
      canvas.width = source.videoWidth || 640;
      canvas.height = source.videoHeight || 480;
      canvas.getContext("2d")!.drawImage(source, 0, 0);
      img = canvas;
    } else {
      img = source as HTMLImageElement | HTMLCanvasElement;
    }
    const result =
      img instanceof HTMLCanvasElement
        ? await reader.decodeFromCanvas(img)
        : await reader.decodeFromImageElement(img);
    if (result) return { text: result.getText(), method: "zxing" };
  } catch {
    /* no code found */
  }
  return null;
}

/** Load an uploaded File into an HTMLImageElement. */
export function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export interface OcrResult {
  text: string;
  confidence: number;
}

/**
 * Run OCR on an image to extract printed lot/date text. Tesseract is heavy, so
 * it is dynamically imported only when OCR is actually invoked.
 */
export async function ocrImage(
  source: HTMLImageElement | HTMLCanvasElement,
): Promise<OcrResult> {
  const Tesseract = await import("tesseract.js");
  const { data } = await Tesseract.recognize(source, "eng");
  return { text: data.text, confidence: (data.confidence ?? 0) / 100 };
}

/**
 * Heuristic extraction of LOT and best-by date from free OCR text (for the
 * manual-confirm path). Looks for "LOT xxx" and a date-like token.
 */
export function extractLotDateFromText(text: string): {
  lot?: string;
  expiry?: string;
} {
  const out: { lot?: string; expiry?: string } = {};
  const lotMatch = text.match(/LOT[:#\s]*([A-Z0-9-]{4,})/i);
  if (lotMatch) out.lot = lotMatch[1].toUpperCase();
  const dateMatch = text.match(
    /(20\d{2}[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01]))/,
  );
  if (dateMatch) out.expiry = dateMatch[1].replace(/[/.]/g, "-");
  return out;
}
