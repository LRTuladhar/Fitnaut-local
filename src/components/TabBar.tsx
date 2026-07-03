"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Clock, BarChart2, Heart, Settings } from "lucide-react";

const tabs = [
  { href: "/workout",   label: "Workout",   icon: Dumbbell  },
  { href: "/history",   label: "History",   icon: Clock     },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/health",    label: "Health",    icon: Heart     },
  { href: "/settings",  label: "Settings",  icon: Settings  },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex bg-card/90 backdrop-blur-xl border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center justify-center flex-1 py-2.5 gap-1 min-h-[3.5rem] transition-all"
          >
            <div className={`flex items-center justify-center w-10 h-7 rounded-xl transition-all ${active ? "bg-primary/15" : ""}`}>
              <Icon
                className={`w-5 h-5 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
                strokeWidth={active ? 2.5 : 1.8}
              />
            </div>
            <span className={`text-[10px] font-medium tracking-wide transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
