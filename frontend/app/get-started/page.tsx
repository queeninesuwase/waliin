import type { Metadata } from "next";
import GetStarted from "@/components/GetStarted";

export const metadata: Metadata = {
  title: "Get started | Waliin",
};

export default function GetStartedPage() {
  return <GetStarted />;
}
