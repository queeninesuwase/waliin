import Image from "next/image";

export default function AuthBrandPanel() {
  return (
    <div className="hidden flex-col items-center justify-center gap-3 bg-brand px-6 text-center md:flex md:w-1/2">
      <Image
        src="/images/waliin-logo.png"
        alt="Waliin logo"
        width={1024}
        height={1024}
        priority
        className="h-auto w-full max-w-[380px] lg:max-w-[440px]"
      />
      <p className="text-sm font-medium tracking-widest text-gold uppercase">
        Equipment management
      </p>
      <p className="mt-4 text-xl text-white/85">
        Simpler. Faster. More reliable.
      </p>
    </div>
  );
}
