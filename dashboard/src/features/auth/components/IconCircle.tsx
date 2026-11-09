export default function IconCircle({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose/30 text-brand">
      {children}
    </span>
  );
}
