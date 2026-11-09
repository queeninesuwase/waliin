import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type AuthScreenProps = {
  children: React.ReactNode;
  backHref?: string;
};

export default function AuthScreen({ children, backHref }: AuthScreenProps) {
  return (
    <main className="flex min-h-screen flex-1 flex-col bg-background md:flex-row">
      <div className="hidden items-center justify-center bg-brand px-6 md:flex md:w-1/2">
        <Image
          src="/images/waliin-logo.png"
          alt="Waliin logo"
          width={1024}
          height={1024}
          priority
          className="h-auto w-full max-w-[480px] lg:max-w-[560px]"
        />
      </div>

      <div className="relative flex flex-1 flex-col justify-center px-6 py-12 md:w-1/2 md:px-12">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Back"
            className="absolute top-6 left-4 flex h-11 w-11 items-center justify-center text-brand hover:text-brand-dark md:left-8"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        )}
        <div className="mx-auto w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}
