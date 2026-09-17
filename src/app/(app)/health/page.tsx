"use client";

import { useState } from "react";
import PebbleTab from "@/components/health/PebbleTab";
import VitalsTab from "@/components/health/VitalsTab";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { NotesToggle } from "@/components/NotesToggle";

type Tab = "pebble" | "vitals";

const TABS: { value: Tab; label: string }[] = [
  { value: "pebble", label: "Pebble" },
  { value: "vitals", label: "Vitals" },
];

export default function HealthPage() {
  const [tab, setTab] = useState<Tab>("pebble");
  const [showNotes, setShowNotes] = useState(false);
  const { currentUserId } = useCurrentUser();
  // Pebble data belongs to Looja's watch — only surface it on his account.
  const showPebble = currentUserId === DEFAULT_USER_ID;
  const activeTab: Tab = showPebble ? tab : "vitals";

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Health</h1>
        <NotesToggle checked={showNotes} onChange={setShowNotes} />
      </div>

      {showPebble && (
        <div className="px-5 pb-5">
          <div className="flex bg-secondary rounded-xl p-1 gap-1">
            {TABS.map((t) => (
              <button key={t.value} onClick={() => setTab(t.value)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.value ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === "pebble" ? <PebbleTab showNotes={showNotes} /> : <VitalsTab showNotes={showNotes} />}
    </div>
  );
}
