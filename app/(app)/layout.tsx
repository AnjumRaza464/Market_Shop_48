import { Sidebar } from "@/components/layout/sidebar";
import { isAuthEnabled } from "@/lib/auth";
import { SHOP } from "@/lib/constants";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full">
      <Sidebar shopName={SHOP.name} authEnabled={isAuthEnabled()} />
      <main className="min-h-screen lg:pl-64">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
