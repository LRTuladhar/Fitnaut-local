"use client";

import { useState, useEffect } from "react";
import { Check, Eye, EyeOff, Key, UserCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getUserProfile } from "@/db/actions";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { useToast } from "@/components/ui/toast";

type Provider = "openrouter" | "anthropic";

export default function SettingsPage() {
  const [provider, setProvider] = useState<Provider>("openrouter");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    getUserProfile(DEFAULT_USER_ID).then((profile) => {
      if (profile?.name) {
        setUsername(profile.name);
      }
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/ai/save-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, key: key.trim() }),
    });

    if (res.ok) {
      setSaved(true);
      setKey("");
      toast("API key saved");
      setTimeout(() => setSaved(false), 3000);
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save key");
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-5 pt-12 pb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>

      <div className="flex-1 px-5 pb-8 space-y-6">

        {/* Account */}
        <section className="space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Account</p>
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
              <UserCircle className="w-6 h-6 text-primary" strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              {username && <p className="font-semibold text-sm truncate">{username}</p>}
              {!username && <p className="text-sm text-muted-foreground">Fitnaut User</p>}
            </div>
          </div>
        </section>

        {/* AI Provider */}
        <section className="space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">AI Provider</p>

          <div className="flex bg-secondary rounded-xl p-1 gap-1">
            {(["openrouter", "anthropic"] as Provider[]).map((p) => (
              <button key={p} onClick={() => setProvider(p)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${provider === p ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}>
                {p === "openrouter" ? "OpenRouter" : "Anthropic"}
              </button>
            ))}
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 text-xs text-muted-foreground space-y-1">
            {provider === "openrouter" ? (
              <>
                <p className="font-medium text-foreground">OpenRouter</p>
                <p>Routes to many models (GPT-4o, Claude, Llama, etc.). Get a key at openrouter.ai</p>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">Anthropic</p>
                <p>Uses Claude Haiku directly. Get a key at console.anthropic.com</p>
              </>
            )}
          </div>
        </section>

        {/* API Key */}
        <section className="space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            {provider === "openrouter" ? "OpenRouter" : "Anthropic"} API Key
          </p>

          <form onSubmit={handleSave} className="space-y-3">
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showKey ? "text" : "password"}
                placeholder={provider === "openrouter" ? "sk-or-..." : "sk-ant-..."}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="pl-9 pr-10 bg-secondary border-0 rounded-xl h-12"
              />
              <button type="button" onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button type="submit" disabled={!key.trim() || saving}
              className="w-full h-12 font-semibold rounded-xl bg-primary shadow-lg shadow-blue-500/20">
              {saved ? (
                <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Saved</span>
              ) : saving ? "Saving…" : "Save Key"}
            </Button>
          </form>

          <p className="text-[11px] text-muted-foreground">
            Your key is stored securely on the server and never returned to the browser.
          </p>
        </section>
      </div>
    </div>
  );
}
