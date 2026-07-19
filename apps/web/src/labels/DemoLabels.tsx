import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, Badge, SyntheticBadge, Mono } from "../components/ui";
import {
  DEMO_LABELS,
  labelDigitalLink,
  FDA_TEST_CARD,
  type DemoLabel,
} from "./label-data";

/**
 * Printable demo kit: three signed RecallLens Product Passports (A, B,
 * partner shipment) + the FDA official-recall test card (public identifiers
 * only). Passport cards are OUTCOME-NEUTRAL: the printed face never says what
 * result to expect — the signed payload and live network state decide.
 *
 * Print output is optimized in print.css: white background, black text,
 * high-contrast QR with a quiet zone, no globe texture, one card per region.
 */
export function DemoLabels() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Physical demo kit</h1>
          <p className="text-sm text-slate-500">
            Signed RecallLens Product Passports + the FDA official-recall test
            card. Print, cut out, and scan with the Consumer Check or Partner
            Vault camera.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyntheticBadge />
          <button className="btn btn-primary" onClick={() => window.print()}>
            Print kit
          </button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 print:block">
        {DEMO_LABELS.map((label) => (
          <PassportCard key={label.id} label={label} />
        ))}
        <FdaTestCard />
      </div>

      <Card className="p-5 print:hidden">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">
          Demonstration instructions (presenter only — not printed)
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>Print on plain paper and cut out the cards.</li>
          <li>Tape <strong>Passport A</strong> to an ordinary (safe) bag of lettuce.</li>
          <li><strong>Sentinel:</strong> approve the final signal as its owner, issue the hold, then scan Passport A as a consumer → proof-verified precautionary hold.</li>
          <li><strong>Traceback:</strong> as Meridian, scan the <strong>Partner Shipment Passport</strong> in the Partner Vault, review the predicate, approve → genuine proof → 3/3 shared lineage.</li>
          <li><strong>Recall:</strong> after the investigator authorizes the targeted recall, scan Passport A again → matches authorized recall scope.</li>
          <li>Scan <strong>Passport B</strong> anytime → no verified match (neutral result).</li>
          <li>Scan the <strong>FDA test card</strong> in Consumer Check → exact official recall match from the live/cached FDA source (lot + best-by; the advisory publishes no GTIN).</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          Passports carry only public identifiers + a random passport ID + an
          ECDSA signature — no lineage token, secret, or key material. The
          printed cards never state an expected outcome; the live state decides.
          The FDA card uses public advisory identifiers; do not obtain recalled
          food.
        </p>
      </Card>
    </div>
  );
}

function PassportCard({ label }: { label: DemoLabel }) {
  const [link, setLink] = useState<string | null>(null);
  useEffect(() => {
    labelDigitalLink(label).then(setLink).catch(() => setLink(null));
  }, [label]);

  return (
    <Card className="print-card overflow-hidden print:break-inside-avoid">
      <div className="print-card-head bg-midnight-950 px-4 py-2 text-center text-[11px] font-extrabold uppercase tracking-widest text-white">
        {label.title}
      </div>
      <div className="flex flex-col items-center gap-3 p-5">
        <Badge tone="amber">Synthetic demonstration data</Badge>
        <p className="text-center text-[11px] text-slate-500">{label.subtitle}</p>
        <div className="print-qr rounded-lg border border-slate-200 bg-white p-4">
          {link ? (
            <QRCodeSVG value={link} size={168} level="M" marginSize={2} />
          ) : (
            <div className="flex h-[168px] w-[168px] items-center justify-center text-xs text-slate-400">
              signing…
            </div>
          )}
        </div>
        <dl className="w-full space-y-1 text-sm">
          <Row k="GTIN (AI 01)" v={label.data.gtin} />
          <Row k="LOT (AI 10)" v={label.data.lot ?? "—"} />
          <Row k="BEST BY (AI 17)" v={label.data.expiry ?? "—"} />
          <Row k="PASSPORT" v={`${label.passportId.slice(0, 10)}… (signed)`} />
        </dl>
      </div>
    </Card>
  );
}

function FdaTestCard() {
  return (
    <Card className="print-card overflow-hidden border-outbreak/40 print:break-inside-avoid">
      <div className="print-card-head bg-outbreak px-4 py-2 text-center text-[10px] font-extrabold uppercase tracking-widest text-white">
        {FDA_TEST_CARD.title}
      </div>
      <div className="flex flex-col items-center gap-3 p-5">
        <Badge tone="outbreak">Official FDA recall — real public identifiers</Badge>
        <div className="print-qr rounded-lg border border-slate-200 bg-white p-4">
          <QRCodeSVG value={FDA_TEST_CARD.qrPayload} size={168} level="M" marginSize={2} />
        </div>
        <dl className="w-full space-y-1 text-sm">
          <Row k="PRODUCT" v={FDA_TEST_CARD.productName} />
          <Row k="SIZE" v={FDA_TEST_CARD.size} />
          <Row k="LOT" v={FDA_TEST_CARD.lot} />
          <Row k="BEST BY" v={FDA_TEST_CARD.bestBy} />
          <Row k="GTIN/UPC" v="not published by the FDA advisory" />
        </dl>
        <Mono className="break-all text-center text-[10px] text-slate-400">
          {FDA_TEST_CARD.sourceUrl}
        </Mono>
        <p className="text-center text-[10px] text-slate-500">{FDA_TEST_CARD.note}</p>
      </div>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt>
      <dd className="text-right font-mono text-xs font-semibold text-hi">{v}</dd>
    </div>
  );
}
