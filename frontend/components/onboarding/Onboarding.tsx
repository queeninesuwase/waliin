"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { markOnboardingSeen } from "@/lib/onboarding";
import StepDots from "./StepDots";
import { ONBOARDING_SLIDES, TOTAL_STEPS } from "./slides";

export default function Onboarding() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const slide = ONBOARDING_SLIDES[index];
  const isLast = index === ONBOARDING_SLIDES.length - 1;

  function finish() {
    markOnboardingSeen();
    router.push("/get-started");
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
        className="absolute top-4 right-4 z-10 min-h-11 rounded-full bg-background/85 px-4 text-base font-medium text-brand hover:text-brand-dark"
      >
        Skip
      </button>

      <div className="relative h-[52vh] w-full md:h-auto md:w-1/2">
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

      <div className="flex flex-1 flex-col justify-center px-6 py-10 md:w-1/2 md:pl-8 lg:pl-6">
        <div className="mx-auto flex w-full max-w-md flex-col items-start gap-4 text-left">
          <h1 className="text-3xl leading-tight font-bold text-brand sm:text-4xl md:text-[46px] lg:text-[50px]">
            {slide.title}
          </h1>
          <p className="text-base leading-relaxed text-muted sm:text-lg md:text-[18px] lg:text-[19px]">
            {slide.text}
          </p>
          <button
            type="button"
            onClick={next}
            className="mt-6 h-12 w-full max-w-xs rounded-lg bg-brand text-base font-semibold text-white hover:bg-brand-dark sm:h-14 sm:text-lg md:text-xl lg:text-[23px]"
          >
            Next
          </button>
          <div className="w-full max-w-xs pt-1">
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
