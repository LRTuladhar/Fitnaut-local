"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getHealthMetrics, upsertHealthMetric, deleteHealthMetric } from "@/db/actions";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { Plus, Scale, Activity, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { BottomSheet, BottomSheetHeader, BottomSheetTitle } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KG_TO_LBS, LBS_TO_KG } from "@/lib/units";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useDayNotes } from "@/hooks/useDayNotes";
import { NoteMarkers, type DayNote } from "@/components/NoteMarkers";

type Metric = "weight" | "bp";
type Range = "week" | "month" | "3months" | "year";

const RANGES: { label: string; value: Range; days: number }[] = [
  { label: "Week",    value: "week",    days: 7   },
  { label: "Month",   value: "month",   days: 30  },
  { label: "3 Mo",    value: "3months", days: 90  },
  { label: "Year",    value: "year",    days: 365 },
];

const METRICS: { value: Metric; label: string; icon: React.ElementType; color: string }[] = [
  { value: "weight", label: "Weight",        icon: Scale,    color: "#3b82f6" },
  { value: "bp",     label: "Blood Pressure", icon: Activity, color: "#a855f7" },
];

// Health metric dates are stored as date-only "YYYY-MM-DD" strings. Parsing
// them with `new Date(iso)` treats them as UTC midnight, which renders as the
// PREVIOUS day in negative-UTC timezones (PDT) — shifting every x-axis label
// back a day. Parse as LOCAL midnight instead.
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatChartDate(v: number | string) {
  const d = typeof v === "number" ? new Date(v) : parseLocalDate(v);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// X-axis ticks at the 1st of each month within the data's time range.
function monthStartTicks(data: any[]): number[] {
  const times = data.map((d) => d.ts).filter((t: any) => t != null);
  if (!times.length) return [];
  const min = Math.min(...times);
  const max = Math.max(...times);
  const ticks: number[] = [];
  const d = new Date(min);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  while (d.getTime() <= max) {
    if (d.getTime() >= min) ticks.push(d.getTime());
    d.setMonth(d.getMonth() + 1);
  }
  return ticks;
}

function formatDateLabel(iso: string) {
  const d = parseLocalDate(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function VitalsTab({ showNotes = false }: { showNotes?: boolean }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeMetric, setActiveMetric] = useState<Metric>("weight");
  const [range, setRange] = useState<Range>("month");
  const queryClient = useQueryClient();
  const { currentUserId } = useCurrentUser();
  const { data: notes = [] } = useDayNotes();

  const { data: allMetrics = [], isPending } = useQuery({
    queryKey: ["health_metrics", currentUserId],
    queryFn: async () => getHealthMetrics(currentUserId),
  });

  const deleteMetric = useMutation({
    mutationFn: async (id: string) => { await deleteHealthMetric(id); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["health_metrics"] }),
  });

  const rangeMetrics = useMemo(() => {
    const days = RANGES.find((r) => r.value === range)!.days;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return allMetrics.filter((m) => parseLocalDate(m.date) >= cutoff);
  }, [allMetrics, range]);

  const latest = allMetrics[0];

  const chartData = useMemo(() => {
    return [...rangeMetrics].reverse().map((m) => ({
      date: m.date,
      ts: parseLocalDate(m.date).getTime(),
      weight_lbs: m.weight_kg != null ? Math.round(m.weight_kg * KG_TO_LBS * 10) / 10 : null,
      systolic: m.systolic_bp,
      diastolic: m.diastolic_bp,
    }));
  }, [rangeMetrics]);

  const visibleNotes = useMemo(() => {
    if (!chartData.length) return [];
    const minTs = Math.min(...chartData.map((d) => d.ts));
    const maxTs = Math.max(...chartData.map((d) => d.ts));
    return notes.filter((n) => {
      const ts = parseLocalDate(n.date).getTime();
      return ts >= minTs && ts <= maxTs;
    });
  }, [notes, chartData]);

  // Approx chart width for stagger collision detection. 300px is a conservative
  // mobile-ish estimate — over-estimating collision is safe (just staggers more).
  const dayWidthPx = useMemo(() => {
    const days = RANGES.find((r) => r.value === range)!.days;
    return Math.max(300 / days, 0.5);
  }, [range]);

  if (isPending) return <PageSkeleton />;

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-5 pb-4 flex items-center justify-end">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-semibold active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Log
        </button>
      </div>

      <div className="px-5 pb-8 space-y-5">
        {/* Latest stats */}
        {latest && (
          <div className="grid grid-cols-2 gap-3">
            {latest.weight_kg != null && (
              <StatCard label="Weight" value={`${Math.round(latest.weight_kg * KG_TO_LBS * 10) / 10} lbs`} color="text-blue-400" bg="bg-blue-500/10" icon={Scale} />
            )}
            {latest.systolic_bp != null && latest.diastolic_bp != null && (
              <StatCard label="Blood Pressure" value={`${latest.systolic_bp}/${latest.diastolic_bp}`} color="text-purple-400" bg="bg-purple-500/10" icon={Activity} />
            )}
          </div>
        )}

        {allMetrics.length === 0 ? (
          <EmptyState onLog={() => setDrawerOpen(true)} />
        ) : (
          <>
            {/* Metric selector */}
            <div className="flex bg-secondary rounded-xl p-1 gap-1">
              {METRICS.map((m) => (
                <button key={m.value} onClick={() => setActiveMetric(m.value)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${activeMetric === m.value ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}>
                  {m.label}
                </button>
              ))}
            </div>

            {/* Range selector */}
            <div className="flex bg-secondary rounded-xl p-1 gap-1">
              {RANGES.map((r) => (
                <button key={r.value} onClick={() => setRange(r.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${range === r.value ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}>
                  {r.label}
                </button>
              ))}
            </div>

            {/* Chart */}
            {chartData.length > 1 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
                  {METRICS.find((m) => m.value === activeMetric)?.label} Trend
                </p>
                <TrendChart data={chartData} metric={activeMetric} notes={showNotes ? visibleNotes : []} dayWidthPx={dayWidthPx} />
              </div>
            )}

            {/* History */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">History</p>
              {rangeMetrics.map((m) => (
                <HealthRow key={m.id} metric={m} onDelete={() => deleteMetric.mutate(m.id)} />
              ))}
            </div>
          </>
        )}
      </div>

      <HealthEntryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["health_metrics"] });
          setDrawerOpen(false);
        }}
      />
    </div>
  );
}

function TrendChart({ data, metric, notes, dayWidthPx }: { data: any[]; metric: Metric; notes: DayNote[]; dayWidthPx: number }) {
  const config = METRICS.find((m) => m.value === metric)!;

  const xTicks = useMemo(() => {
    const monthStarts = monthStartTicks(data);
    return monthStarts.length
      ? monthStarts
      : data.map((d) => d.ts).filter((t: any) => t != null);
  }, [data]);

  if (metric === "bp") {
    return (
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="ts" type="number" scale="time" domain={["dataMin", "dataMax"]} ticks={xTicks} tick={{ fontSize: 10, fill: "#888" }} tickFormatter={formatChartDate} />
          <YAxis tick={{ fontSize: 10, fill: "#888" }} domain={["auto", "auto"]} />
          <Tooltip contentStyle={{ background: "#1c1c1e", border: "none", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(v: any) => formatChartDate(v)} />
          <Line type="monotone" dataKey="systolic"  stroke="#a855f7" strokeWidth={2} dot={false} name="Systolic"  connectNulls />
          <Line type="monotone" dataKey="diastolic" stroke="#ec4899" strokeWidth={2} dot={false} name="Diastolic" connectNulls />
          {notes.length > 0 && <NoteMarkers notes={notes} resolveX={(d) => parseLocalDate(d).getTime()} dayWidthPx={dayWidthPx} />}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="ts" type="number" scale="time" domain={["dataMin", "dataMax"]} ticks={xTicks} tick={{ fontSize: 10, fill: "#888" }} tickFormatter={formatChartDate} />
        <YAxis tick={{ fontSize: 10, fill: "#888" }} domain={["auto", "auto"]} />
        <Tooltip contentStyle={{ background: "#1c1c1e", border: "none", borderRadius: 8, fontSize: 12 }}
          labelFormatter={(v: any) => formatChartDate(v)}
          formatter={(v: any) => [`${v} lbs`, config.label]} />
        <Line type="monotone" dataKey="weight_lbs" stroke={config.color} strokeWidth={2} dot={{ r: 3, fill: config.color }} connectNulls />
        {notes.length > 0 && <NoteMarkers notes={notes} resolveX={(d) => parseLocalDate(d).getTime()} dayWidthPx={dayWidthPx} />}
      </LineChart>
    </ResponsiveContainer>
  );
}

function StatCard({ label, value, color, bg, icon: Icon }: { label: string; value: string; color: string; bg: string; icon: React.ElementType }) {
  return (
    <div className={`rounded-2xl p-4 ${bg} border border-border`}>
      <Icon className={`w-4 h-4 ${color} mb-2`} strokeWidth={1.8} />
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function HealthRow({ metric, onDelete }: { metric: any; onDelete: () => void }) {
  const entries = [
    metric.weight_kg != null   ? `${Math.round(metric.weight_kg * KG_TO_LBS * 10) / 10} lbs`           : null,
    metric.systolic_bp != null ? `${metric.systolic_bp}/${metric.diastolic_bp} mmHg`                    : null,
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{formatDateLabel(metric.date)}</p>
        <p className="text-sm font-medium mt-0.5 truncate">{entries.join("  ·  ") || "—"}</p>
      </div>
      <button onClick={onDelete} className="p-1.5 rounded-lg text-muted-foreground active:text-destructive transition-colors">
        <Trash2 className="w-4 h-4" strokeWidth={1.8} />
      </button>
    </div>
  );
}

function HealthEntryDrawer({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [weight, setWeight] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { currentUserId } = useCurrentUser();

  const canSave = weight || (systolic && diastolic);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    try {
      await upsertHealthMetric({
        userId: currentUserId,
        date: today,
        weightKg: weight ? parseFloat(weight) * LBS_TO_KG : null,
        systolicBp: systolic ? parseInt(systolic) : null,
        diastolicBp: diastolic ? parseInt(diastolic) : null,
        notes: notes.trim() || null,
      });
      setWeight(""); setSystolic(""); setDiastolic(""); setNotes("");
      toast("Health metrics saved");
      onSuccess();
    } catch (err: any) {
      toast(err.message ?? "Failed to save. Try again.", "error");
    }
    setSaving(false);
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <form onSubmit={handleSave} className="flex flex-col">
        <BottomSheetHeader>
          <BottomSheetTitle>Log Health Metrics</BottomSheetTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Fill in any metrics you want to track today.</p>
        </BottomSheetHeader>

        <div className="overflow-y-auto px-4 pb-4 space-y-4" style={{ WebkitOverflowScrolling: "touch" } as any}>
          <Field label="Weight (lbs)">
            <Input type="number" inputMode="decimal" placeholder="e.g. 185" value={weight}
              onChange={(e) => setWeight(e.target.value)} className="bg-secondary border-0 rounded-xl h-12 text-base" />
          </Field>

          <Field label="Blood Pressure (mmHg)">
            <div className="flex items-center gap-2">
              <Input type="number" inputMode="numeric" placeholder="Systolic" value={systolic}
                onChange={(e) => setSystolic(e.target.value)} className="bg-secondary border-0 rounded-xl h-12 text-base" />
              <span className="text-muted-foreground font-bold text-lg">/</span>
              <Input type="number" inputMode="numeric" placeholder="Diastolic" value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)} className="bg-secondary border-0 rounded-xl h-12 text-base" />
            </div>
          </Field>

          <Field label="Notes (optional)">
            <Input placeholder="e.g. felt great today" value={notes}
              onChange={(e) => setNotes(e.target.value)} className="bg-secondary border-0 rounded-xl" />
          </Field>
        </div>

        <div className="px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button type="submit" disabled={!canSave || saving}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary shadow-lg shadow-blue-500/20">
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

function EmptyState({ onLog }: { onLog: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
      <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center">
        <Scale className="w-8 h-8 text-blue-400" strokeWidth={1.5} />
      </div>
      <div>
        <p className="font-semibold text-sm">No Health Data</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Track your weight and blood pressure over time.</p>
      </div>
      <button onClick={onLog}
        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-white text-sm font-semibold active:scale-95 transition-transform">
        <Plus className="w-4 h-4" strokeWidth={2.5} /> Log First Entry
      </button>
    </div>
  );
}
