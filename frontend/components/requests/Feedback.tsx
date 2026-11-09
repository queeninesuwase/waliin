import { ReactNode } from "react";
import ui from "@/components/AppShell.module.css";

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={ui.skeleton} />
      ))}
    </div>
  );
}

export function ErrorBox({
  title = "Could not load this page",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className={ui.state} role="alert">
      <strong>{title}</strong>
      {message}
      {onRetry && (
        <>
          <br />
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </>
      )}
    </div>
  );
}

export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={ui.state}>
      <strong>{title}</strong>
      {children}
    </div>
  );
}
