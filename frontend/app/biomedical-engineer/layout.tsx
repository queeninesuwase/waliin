import React, { Suspense } from "react";
import Sidebar from "../shared-paths/Sidebar";
import Header from "../shared-paths/Header";
import { UserProfileProvider } from "@/components/providers/UserProfileProvider";
import EngineerGuard from "@/components/providers/EngineerGuard";
import { MobileNavProvider } from "@/components/nav/MobileNav";

export default function BiomedicalEngineerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProfileProvider>
      <EngineerGuard>
        <MobileNavProvider>
          <div className="flex min-h-screen w-full bg-[#F8F6F3]">
            <Suspense
              fallback={
                <aside className="hidden w-72 shrink-0 bg-[#650D30] md:block" />
              }
            >
              <Sidebar />
            </Suspense>

            <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-hidden">
              <Header />

              <main className="min-h-0 w-full flex-1 overflow-y-auto bg-[#F8F6F3]">
                <div className="min-h-full w-full min-w-0">{children}</div>
              </main>
            </div>
          </div>
        </MobileNavProvider>
      </EngineerGuard>
    </UserProfileProvider>
  );
}
