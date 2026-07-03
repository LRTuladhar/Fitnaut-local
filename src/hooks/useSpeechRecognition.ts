"use client";

import { useState, useRef, useCallback } from "react";

export type SpeechState = "idle" | "listening" | "processing" | "success" | "error";

interface UseSpeechRecognitionResult {
  state: SpeechState;
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(
  onResult: (transcript: string) => Promise<void>
): UseSpeechRecognitionResult {
  const [state, setState] = useState<SpeechState>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setTranscript("");
    setError(null);
  }, []);

  const start = useCallback(async () => {
    // Explicitly request mic permission first — required on iOS Safari
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied. Check your browser settings.");
      setState("error");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Voice not supported in this browser.");
      setState("error");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setState("listening");

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setState("processing");
      try {
        await onResult(text);
        setState("success");
        setTimeout(() => setState("idle"), 1500);
      } catch (e: any) {
        setError(e?.message ?? "Couldn't parse that. Try again.");
        setState("error");
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        setError("No speech detected. Try again.");
      } else if (event.error === "not-allowed") {
        setError("Microphone access denied. Check browser settings.");
      } else {
        setError(`Error: ${event.error}`);
      }
      setState("error");
    };

    recognition.start();
  }, [onResult]);

  return { state, transcript, error, start, stop, reset };
}
