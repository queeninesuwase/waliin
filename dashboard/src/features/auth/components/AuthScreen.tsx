import Link from "next/link";

import AuthBrandPanel from "@/features/auth/components/AuthBrandPanel";
import { ArrowLeftIcon } from "@/features/auth/components/icons";

type AuthScreenProps = {
  children: React.ReactNode;
  backHref?: string;
};

export default function AuthScreen({ children, backHref }: AuthScreenProps) {
  return (
    <main className="flex min-h-screen flex-1 flex-col bg-background md:flex-row">
      <AuthBrandPanel />

      <div className="relative flex flex-1 flex-col justify-center px-6 py-12 md:w-1/2 md:px-12">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Back"
            className="absolute top-6 left-4 flex h-11 w-11 items-center justify-center text-brand hover:text-brand-dark md:left-8"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
        )}
        <div className="mx-auto w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}
