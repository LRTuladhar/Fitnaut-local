"use client";

import { Mic, AudioLines, Loader2, CheckCircle2 } from "lucide-react";
import type { SpeechState } from "@/hooks/useSpeechRecognition";

interface Props {
  state: SpeechState;
  onPress: () => void;
  disabled?: boolean;
}

const CONFIG = {
  idle:       { bg: "bg-primary",         shadow: "shadow-blue-500/40",  Icon: Mic,          label: "Tap to speak" },
  listening:  { bg: "bg-red-500",          shadow: "shadow-red-500/40",   Icon: AudioLines,   label: "Listening…" },
  processing: { bg: "bg-orange-500",       shadow: "shadow-orange-500/40",Icon: Loader2,      label: "Processing…" },
  success:    { bg: "bg-green-500",        shadow: "shadow-green-500/40", Icon: CheckCircle2, label: "Logged!" },
  error:      { bg: "bg-destructive",      shadow: "shadow-red-900/40",   Icon: Mic,          label: "Try again" },
};

export default function VoiceButton({ state, onPress, disabled }: Props) {
  const { bg, shadow, Icon, label } = CONFIG[state];
  const isListening = state === "listening";
  const isProcessing = state === "processing";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={onPress}
        disabled={disabled || isProcessing}
        className={`
          relative w-24 h-24 rounded-full ${bg} shadow-xl ${shadow}
          flex items-center justify-center
          active:scale-95 transition-transform
          disabled:opacity-60 disabled:cursor-not-allowed
        `}
      >
        {/* Pulsing rings when listening */}
        {isListening && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />
            <span className="absolute inset-[-8px] rounded-full border border-red-500/30 animate-pulse" />
          </>
        )}
        <Icon
          className={`w-10 h-10 text-white relative z-10 ${isProcessing ? "animate-spin" : ""}`}
          strokeWidth={1.8}
        />
      </button>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
