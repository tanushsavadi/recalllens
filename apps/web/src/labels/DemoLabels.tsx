import { QRCodeSVG } from "qrcode.react";
import { Card, Badge, SyntheticBadge, Mono } from "../components/ui";
import { DEMO_LABELS, labelDigitalLink, type DemoLabel } from "./label-data";

/**
 * Printable physical demonstration labels. Attach to an ordinary bag of lettuce
 * for the live demo. Each encodes a GS1 Digital Link (GTIN + lot + expiry) —
 * public lookup keys only, no secrets.
 */
export function DemoLabels() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">
            Physical demonstration labels
          </h1>
          <p className="text-sm text-slate-500">
            Print, attach to a lettuce bag, and scan with the Consumer Check
            camera. The affected label triggers the live convergence proof; the
            control label returns no intersection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyntheticBadge />
          <button className="btn-primary" onClick={() => window.print()}>
            Print labels
          </button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {DEMO_LABELS.map((label) => (
          <LabelCard key={label.id} label={label} />
        ))}
      </div>

      <Card className="p-5 print:hidden">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">
          Printing &amp; demonstration instructions
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>Click <strong>Print labels</strong> and print on plain paper (color not required).</li>
          <li>Cut out a label and tape it to an ordinary bag of lettuce.</li>
          <li>Open <strong>Consumer Check</strong> on a phone or laptop with a camera.</li>
          <li>Choose <strong>Scan a product</strong> and point the camera at the QR code (or upload a photo).</li>
          <li>Confirm the extracted GTIN, lot, and best-by date.</li>
          <li>
            The <strong>affected</strong> label runs the genuine third Compact
            proof and converges the case; the <strong>control</strong> label
            returns “No verified intersection found”.
          </li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          Every value on these labels is public (GTIN, lot, best-by). The private
          256-bit lineage token and EPCIS events stay in the partner vault and
          never appear on the label or the public ledger.
        </p>
      </Card>
    </div>
  );
}

function LabelCard({ label }: { label: DemoLabel }) {
  const link = labelDigitalLink(label);
  return (
    <Card className="overflow-hidden print:break-inside-avoid">
      <div className="bg-midnight-950 px-4 py-2 text-center text-[11px] font-extrabold uppercase tracking-widest text-white">
        RecallLens Synthetic Demonstration Label
      </div>
      <div className="flex flex-col items-center gap-3 p-5">
        <Badge tone={label.id === "affected" ? "outbreak" : "verified"}>
          {label.id === "affected" ? "Affected lot" : "Control lot (unaffected)"}
        </Badge>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <QRCodeSVG value={link} size={168} level="M" />
        </div>
        <dl className="w-full space-y-1 text-sm">
          <Row k="GTIN (AI 01)" v={label.data.gtin} />
          <Row k="LOT (AI 10)" v={label.data.lot ?? "—"} />
          <Row k="BEST BY (AI 17)" v={label.data.expiry ?? "—"} />
        </dl>
        <Mono className="break-all text-center text-[10px] text-slate-400">
          {link}
        </Mono>
      </div>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt>
      <dd className="font-mono font-semibold text-hi">{v}</dd>
    </div>
  );
}
