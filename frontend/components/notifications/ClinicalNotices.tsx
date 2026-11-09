"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  buildClinicalItems,
  loadClinicalSources,
  markClinicalRead,
  readSeen,
  unreadCount,
  type ClinicalItem,
  type ClinicalLoad,
} from "@/lib/clinicalNotifications";
import {
  fetchAllRequests,
  fetchMyFaults,
  fetchNotifications,
  markNoticeRead,
} from "@/lib/waliin";

const REFRESH_MS = 60_000;

type ClinicalNoticesValue = {
  items: ClinicalItem[];
  load: ClinicalLoad | null;
  loading: boolean;
  count: number;
  now: number;
  retry: () => void;
  markSeen: (targets: ClinicalItem[]) => Promise<void>;
  readFailed: ClinicalItem[];
  marking: boolean;
};

const ClinicalNoticesContext = createContext<ClinicalNoticesValue | null>(null);

export function ClinicalNoticesProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [items, setItems] = useState<ClinicalItem[]>([]);
  const [load, setLoad] = useState<ClinicalLoad | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(0);
  const [readFailed, setReadFailed] = useState<ClinicalItem[]>([]);
  const [marking, setMarking] = useState(false);
  const last = useRef<ClinicalLoad | null>(null);

  useEffect(() => {
    let active = true;
    loadClinicalSources(
      {
        notices: fetchNotifications,
        faults: () => fetchMyFaults(userId, tick > 0),
        requests: fetchAllRequests,
      },
      last.current,
    ).then((result) => {
      if (!active) return;
      last.current = result;
      setLoad(result);
      const fresh = buildClinicalItems(result, userId, readSeen(userId));
      setItems(fresh);
      setReadFailed((failed) =>
        failed.filter((item) =>
          fresh.some((next) => next.id === item.id && next.unread),
        ),
      );
      setNow(Date.now());
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [userId, tick]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setTick((value) => value + 1),
      REFRESH_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  const retry = useCallback(() => {
    setLoading(true);
    setTick((value) => value + 1);
  }, []);

  const markSeen = useCallback(
    async (targets: ClinicalItem[]) => {
      if (targets.length === 0) return;
      const ids = new Set(targets.map((item) => item.id));
      setItems((list) =>
        list.map((item) =>
          ids.has(item.id) ? { ...item, unread: false } : item,
        ),
      );
      setMarking(true);
      const failed = await markClinicalRead(targets, userId, markNoticeRead);
      setMarking(false);
      setReadFailed(failed);
      if (failed.length === 0) return;
      const failedIds = new Set(failed.map((item) => item.id));
      setItems((list) =>
        list.map((item) =>
          failedIds.has(item.id) ? { ...item, unread: true } : item,
        ),
      );
    },
    [userId],
  );

  const value = useMemo(
    () => ({
      items,
      load,
      loading,
      count: unreadCount(items),
      now,
      retry,
      markSeen,
      readFailed,
      marking,
    }),
    [items, load, loading, now, retry, markSeen, readFailed, marking],
  );

  return (
    <ClinicalNoticesContext.Provider value={value}>
      {children}
    </ClinicalNoticesContext.Provider>
  );
}

export function useClinicalNotices() {
  const value = useContext(ClinicalNoticesContext);
  if (!value) {
    throw new Error("useClinicalNotices needs ClinicalNoticesProvider");
  }
  return value;
}
