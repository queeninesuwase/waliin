import Image from "next/image";
import Link from "next/link";
import StepDots from "@/components/onboarding/StepDots";
import { TOTAL_STEPS } from "@/components/onboarding/slides";

export default function GetStarted() {
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

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 md:w-1/2 md:px-12 md:py-10">
        <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center md:max-w-md md:items-start md:gap-4 md:text-left">
          <Image
            src="/images/getStarted-logo.png"
            alt="Waliin logo"
            width={502}
            height={483}
            priority
            className="h-auto w-[150px] md:hidden"
          />

          <h1 className="mt-12 text-2xl leading-snug font-bold text-brand md:mt-0 md:text-5xl md:leading-tight lg:text-6xl">
            Simpler. Faster.
            <br />
            More reliable.
          </h1>

          <p className="hidden text-base leading-relaxed text-muted md:block md:text-xl">
            Medical equipment care for your hospital, in one place.
          </p>

          <Link
            href="/continue-as"
            className="mt-12 flex h-12 w-full items-center justify-center rounded-lg bg-brand text-base font-semibold text-white hover:bg-brand-dark md:mt-6 md:h-14 md:max-w-xs md:text-lg"
          >
            Get started
          </Link>

          <div className="mt-6 w-full md:mt-0 md:max-w-xs md:pt-1">
            <StepDots current={TOTAL_STEPS - 1} total={TOTAL_STEPS} />
          </div>
          <p className="sr-only">
            Step {TOTAL_STEPS} of {TOTAL_STEPS}
          </p>
        </div>
      </div>
    </main>
  );
}
