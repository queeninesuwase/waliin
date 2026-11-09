type FormMessageProps = {
  kind: "error" | "success";
  children: React.ReactNode;
};

export default function FormMessage({ kind, children }: FormMessageProps) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={
        kind === "error"
          ? "rounded-lg bg-[#e8b4c0]/30 px-4 py-3 text-base text-brand"
          : "rounded-lg bg-green-50 px-4 py-3 text-center text-base text-green-800"
      }
    >
      {children}
    </p>
  );
}
