import Image from "next/image";
import Link from "next/link";

import RoleIcon from "./RoleIcon";
import { DASHBOARD_URL, loginPathFor, ROLE_OPTIONS } from "./roles";

export default function ContinueAs() {
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

      <div className="flex flex-1 flex-col items-center px-6 py-12 md:w-1/2 md:justify-center md:px-12 md:py-10">
        <div className="flex w-full max-w-md flex-col">
          <div className="flex flex-col items-center text-center md:hidden">
            <Image
              src="/images/getStarted-logo.png"
              alt="Waliin logo"
              width={502}
              height={483}
              priority
              className="h-auto w-20"
            />
            <p className="mt-2 text-xl font-semibold text-brand">Waliin</p>
            <p className="mt-1 text-base text-muted">
              Keep equipment ready for care.
            </p>
          </div>

          <h1 className="mt-12 text-center text-2xl font-bold text-brand md:mt-0 md:text-5xl">
            Continue as
          </h1>
          <p className="mt-2 text-center text-base text-foreground md:mt-3 md:text-xl">
            Choose how you will use Waliin.
          </p>

          <ul className="mt-8 flex flex-col gap-5">
            {ROLE_OPTIONS.map(({ role, title, text }) => (
              <li key={role}>
                <Link
                  href={loginPathFor(role)}
                  className="flex items-start gap-4 rounded-2xl border border-zinc-100 bg-white p-5 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-brand md:p-6"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                    <RoleIcon role={role} />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-xl font-bold text-brand md:text-2xl">
                      {title}
                    </span>
                    <span className="text-sm leading-relaxed text-muted md:text-base">
                      {text}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {DASHBOARD_URL && (
            <p className="mt-10 text-center text-sm text-muted md:text-base">
              Health manager?{" "}
              <a
                href={DASHBOARD_URL}
                className="font-semibold text-brand hover:underline"
              >
                Use the admin dashboard
              </a>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
