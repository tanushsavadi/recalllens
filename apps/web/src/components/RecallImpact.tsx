import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { api, DEMO_CASE_ID } from "../lib/api";
import { Card, SectionTitle, Stat, Badge } from "./ui";

export function RecallImpact() {
  const impact = useQuery({
    queryKey: ["recall-impact", DEMO_CASE_ID],
    queryFn: () => api.recallImpact(DEMO_CASE_ID),
  });

  if (!impact.data) {
    return (
      <Card className="p-5">
        <SectionTitle>Recall blast radius</SectionTitle>
        <p className="text-sm text-slate-500">Computing from fixtures…</p>
      </Card>
    );
  }

  const d = impact.data;
  const chartData = [
    { name: "Traditional broad recall", value: d.broad.cases, kind: "broad" },
    { name: "RecallLens targeted", value: d.targeted.cases, kind: "targeted" },
  ];

  // "Cases" here are SHIPPING CASES (inventory units) — labeled explicitly so
  // they can never be confused with human illness cases.
  return (
    <Card className="p-5">
      <SectionTitle hint={d.label}>Recall blast radius — inventory</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Broad recall — shipping cases"
          value={d.broad.cases.toLocaleString()}
          tone="outbreak"
          sub={`${d.broad.stores} stores · ${d.broad.states.length} states`}
        />
        <Stat
          label="Targeted — shipping cases"
          value={d.targeted.cases.toLocaleString()}
          tone="verified"
          sub={`${d.targeted.stores} stores · ${d.targeted.states.length} states`}
        />
        <Stat
          label="Product spared"
          value={`${d.reductionPct}%`}
          tone="verified"
        />
      </div>
      <div className="mt-4 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(v: number) => [`${v.toLocaleString()} shipping cases`, "Inventory scope"]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.kind}
                  fill={entry.kind === "broad" ? "#c8352b" : "#1f9d63"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        <Badge tone="amber">Simulated</Badge> Shipping-case counts derived from
        demonstration supply records — inventory units, not human illnesses.
        RecallLens did not produce these savings in the actual CDC
        investigation.
      </p>
    </Card>
  );
}
