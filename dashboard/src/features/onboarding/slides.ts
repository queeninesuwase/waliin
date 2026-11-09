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
    text: "Clinical staff can report faults and request equipment. Engineers take it from there.",
    image: "/images/onboarding-2.png",
    imageAlt:
      "A nurse with a tablet and an engineer checking a machine together",
  },
  {
    title: "Track and resolve",
    text: "Managers approve requests, track progress and generate reports.",
    image: "/images/onboarding-3.png",
    imageAlt:
      "A health manager holding a tablet beside a laptop with a checklist",
  },
];

export const TOTAL_STEPS = ONBOARDING_SLIDES.length + 1;
