import { PageTitle } from "@/components/maintenance/ui";

import FaultRequestList from "./FaultRequestList";

export default function FaultRequestsPage() {
  return (
    <section className="min-h-full bg-[#F8F6F3] px-4 py-6 text-[#263346] md:px-8 md:py-8 lg:px-10">
      <div className="flex w-full flex-col gap-6">
        <PageTitle
          title="Faults"
          subtitle="Faults reported by clinical staff. Assess new ones so they join the priority list."
        />

        <div>
          <FaultRequestList />
        </div>
      </div>
    </section>
  );
}
