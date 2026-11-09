export default function IconCircle({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e8b4c0]/30 text-brand">
      {children}
    </span>
  );
}
