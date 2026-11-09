type SubmitButtonProps = {
  children: React.ReactNode;
  loading: boolean;
  loadingText: string;
  disabled?: boolean;
};

export default function SubmitButton({
  children,
  loading,
  loadingText,
  disabled = false,
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="mt-2 h-14 w-full rounded-lg bg-brand text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
    >
      {loading ? loadingText : children}
    </button>
  );
}
