type StepDotsProps = {
  current: number;
  total: number;
};

export default function StepDots({ current, total }: StepDotsProps) {
  return (
    <div className="flex justify-center gap-2" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={
            i === current
              ? "h-2 w-2 rounded-full bg-gold"
              : "h-2 w-2 rounded-full bg-gray-300"
          }
        />
      ))}
    </div>
  );
}
