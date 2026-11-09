"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useState } from "react";
import ClinicalBell from "@/components/notifications/ClinicalBell";
import { ClinicalNoticesProvider } from "@/components/notifications/ClinicalNotices";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import { ErrorBox, Loading } from "@/components/requests/Feedback";
import { clinicalRedirect } from "@/lib/engineerAccess";
import { HttpError, errorText } from "@/lib/http";
import { CurrentUser, fetchMe, prettyRole } from "@/lib/session";
import styles from "./AppShell.module.css";

type Props = {
  active: "home" | "requests" | "equipment" | "profile";
  title?: string;
  children: (user: CurrentUser) => ReactNode;
};

export default function AppShell({ active, title, children }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMe()
      .then((u) => {
        if (!alive) return;
        const away = clinicalRedirect(u.role, u.next_step);
        if (away) {
          router.replace(away);
          return;
        }
        setUser(u);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof HttpError && e.status === 401) {
          router.replace(clinicalRedirect(null) ?? "/continue-as");
        } else {
          setError(errorText(e));
        }
      });
    return () => {
      alive = false;
    };
  }, [router, attempt]);

  const retry = useCallback(() => {
    setError("");
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 820) setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const name = user?.full_name ?? user?.email ?? "";
  const role = user ? prettyRole(user.role) : "";

  const shell = (
    <div className={styles.shell}>
      <div
        className={`${styles.sidebarWrap} ${menuOpen ? styles.sidebarOpen : ""}`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setMenuOpen(false);
        }}
      >
        <Sidebar
          active={active}
          userName={name}
          userRole={role}
          userId={user?.user_id ?? null}
          email={user?.email ?? ""}
        />
      </div>

      {menuOpen && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main className={styles.main}>
        <div className={styles.top}>
          <div className={styles.titleRow}>
            <button
              type="button"
              className={styles.menuBtn}
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1>{title ?? ""}</h1>
          </div>
          <div className={styles.who}>
            <ThemeToggle />
            {user && <ClinicalBell />}
            <div className={styles.avatarRow}>
              {user ? (
                <ProfileAvatar
                  userId={user.user_id}
                  fullName={user.full_name}
                  email={user.email}
                  className="h-8 w-8 text-xs"
                />
              ) : (
                <span className={styles.avatar} aria-hidden="true" />
              )}
              <div>
                <b>{name}</b>
                <small>{role}</small>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.content}>
          {error ? (
            <ErrorBox message={error} onRetry={retry} />
          ) : user ? (
            children(user)
          ) : (
            <Loading />
          )}
        </div>
      </main>
    </div>
  );

  return user ? (
    <ClinicalNoticesProvider userId={user.user_id}>
      {shell}
    </ClinicalNoticesProvider>
  ) : (
    shell
  );
}
