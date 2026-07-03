export const dynamic = "force-dynamic";
import TabBar from "@/components/TabBar";
import ProfileMenu from "@/components/ProfileMenu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full min-h-screen">
      <header className="sticky top-0 z-40 flex items-center justify-end px-4 h-12 bg-background/80 backdrop-blur-xl border-b border-border/50"
        style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <ProfileMenu />
      </header>
      <main className="flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <TabBar />
    </div>
  );
}
