import type { Metadata } from "next";

import ContinueAs from "@/components/continue-as/ContinueAs";

export const metadata: Metadata = {
  title: "Continue as | Waliin",
};

export default function ContinueAsPage() {
  return <ContinueAs />;
}
