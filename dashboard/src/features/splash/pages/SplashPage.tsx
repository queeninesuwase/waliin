// Figma : Splash Screen
import Image from "next/image";

import SplashRedirect from "@/features/splash/components/SplashRedirect";

export default function SplashPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-brand px-6">
      <Image
        src="/images/waliin-logo.png"
        alt="Waliin logo"
        width={1024}
        height={1024}
        priority
        className="h-auto w-[65vw] max-w-[320px] sm:max-w-[420px] md:max-w-[500px] lg:max-w-[560px] xl:max-w-[620px]"
      />
      <SplashRedirect />
    </main>
  );
}
