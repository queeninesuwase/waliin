export type OnboardingSlide = {
  title: string;
  text: string;
  image: string;
  imageAlt: string;
};

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    title: "Keep equipment ready for care",
    text: "Track faults, plan maintenance and reduce downtime in Ethiopian public hospitals.",
    image: "/images/onboarding-1.png",
    imageAlt: "A doctor standing next to a patient monitor",
  },
  {
    title: "Report faults and requests",
    text: "Clinical staff report faults and request equipment in a few taps. Engineers take it from there.",
    image: "/images/onboarding-2.png",
    imageAlt:
      "A nurse with a tablet and an engineer checking a machine together",
  },
  {
    title: "Track and resolve",
    text: "Follow every fault from report to repair, and see when a machine is back in use.",
    image: "/images/onboarding-3.png",
    imageAlt:
      "A hospital worker holding a tablet beside a laptop with a checklist",
  },
];

export const TOTAL_STEPS = ONBOARDING_SLIDES.length + 1;
