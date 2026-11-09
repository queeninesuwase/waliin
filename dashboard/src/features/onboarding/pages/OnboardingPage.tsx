"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

import StepDots from "@/features/onboarding/components/StepDots";
import { ONBOARDING_SLIDES, TOTAL_STEPS } from "@/features/onboarding/slides";
import { markOnboardingSeen } from "@/features/onboarding/storage";

export default function OnboardingPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const slide = ONBOARDING_SLIDES[index];
  const isLast = index === ONBOARDING_SLIDES.length - 1;

  function finish() {
    markOnboardingSeen();
    router.push("/welcome");
  }

  function next() {
    if (isLast) {
      finish();
    } else {
      setIndex(index + 1);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-1 flex-col bg-background md:flex-row">
      <button
        type="button"
        onClick={finish}
        className="absolute top-4 right-6 z-10 hidden min-h-11 px-2 text-base font-medium text-brand hover:text-brand-dark md:block"
      >
        Skip
      </button>

      <div className="relative h-[52vh] w-full md:h-auto md:min-h-screen md:w-1/2">
        <Image
          key={slide.image}
          src={slide.image}
          alt={slide.imageAlt}
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover object-top"
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 md:w-1/2 md:px-12 md:py-10">
        <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 text-center md:max-w-md md:items-start md:text-left">
          <h1 className="text-2xl leading-tight font-bold text-brand md:text-5xl md:leading-tight lg:text-6xl">
            {slide.title}
          </h1>
          <p className="text-sm leading-relaxed text-gray-500 md:text-xl">
            {slide.text}
          </p>
          <button
            type="button"
            onClick={next}
            className="mt-8 flex h-12 w-full items-center justify-center rounded-lg bg-brand text-base font-semibold text-white hover:bg-brand-dark md:mt-6 md:h-14 md:max-w-xs md:text-lg"
          >
            Next
          </button>
          <div className="w-full pt-2 md:max-w-xs md:pt-1">
            <StepDots current={index} total={TOTAL_STEPS} />
          </div>
          <p className="sr-only" aria-live="polite">
            Step {index + 1} of {TOTAL_STEPS}
          </p>
        </div>
      </div>
    </main>
  );
}
