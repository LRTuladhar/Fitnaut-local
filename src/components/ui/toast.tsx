"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

type ToastType = "success" | "error";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-14 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`w-full max-w-sm flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl pointer-events-auto
              ${t.type === "success" ? "bg-green-500 text-white" : "bg-destructive text-white"}`}
          >
            {t.type === "success"
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
              : <XCircle className="w-4 h-4 flex-shrink-0" strokeWidth={2} />}
            <p className="text-sm font-medium flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
