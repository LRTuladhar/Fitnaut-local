"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserCircle, Check } from "lucide-react";
import { listUsers } from "@/db/actions";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { useCurrentUser } from "@/components/CurrentUserProvider";

interface Account {
  user_id: string;
  name: string | null;
}

function displayName(account: Account | undefined): string {
  return account?.name?.trim() || "Unnamed";
}

export default function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { currentUserId, setCurrentUserId } = useCurrentUser();

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["users"],
    queryFn: () => listUsers(),
    staleTime: Infinity,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Owner (Looja) first, then remaining accounts alphabetically.
  const ordered = [...accounts].sort((a, b) => {
    if (a.user_id === DEFAULT_USER_ID) return -1;
    if (b.user_id === DEFAULT_USER_ID) return 1;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  const current = ordered.find((a) => a.user_id === currentUserId);

  function select(id: string) {
    setCurrentUserId(id);
    setOpen(false);
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-9 px-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        aria-label="Switch account"
      >
        <UserCircle className="w-6 h-6" strokeWidth={1.8} />
        {current && (
          <span className="text-xs font-semibold max-w-[96px] truncate">{displayName(current)}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-56 z-50 bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Accounts
          </p>
          <div className="py-1">
            {ordered.map((account) => {
              const active = account.user_id === currentUserId;
              return (
                <button
                  key={account.user_id}
                  onClick={() => select(account.user_id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    active ? "bg-secondary/70" : "hover:bg-secondary/40"
                  }`}
                >
                  <span className="flex-1 text-left font-medium truncate">{displayName(account)}</span>
                  {active && <Check className="w-4 h-4 text-primary" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
