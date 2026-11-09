"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SearchIcon } from "@/components/layout/navIcons";
import AddDepartmentDialog from "@/features/departments/AddDepartmentDialog";
import { isSignedOutError } from "@/lib/api/client";

import {
  resendInvite,
  revokeUser,
  sendResetLink,
  updateUser,
  type ManagedUser,
  type UpdateUserInput,
} from "../api";
import EditUserDialog from "../components/EditUserDialog";
import Pagination from "../components/Pagination";
import RevokeDialog from "../components/RevokeDialog";
import UsersTable from "../components/UsersTable";
import { useDepartments } from "../hooks/useDepartments";
import { useUsersData } from "../hooks/useUsersData";
import {
  actionErrorMessage,
  departmentNames,
  filterUsers,
  paginate,
  readUserQuery,
  roleForTab,
  showingText,
  USER_TABS,
  writeUserQuery,
  type UserAction,
  type UserQuery,
} from "../userHelpers";

const NOTICE_MS = 5000;
const SEARCH_DELAY_MS = 300;

export default function UsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = readUserQuery(searchParams);
  const [searchText, setSearchText] = useState(query.search);
  const {
    departments,
    error: departmentsError,
    retry: retryDepartments,
    addDepartment,
  } = useDepartments();
  const { users, loading, error, retry, replaceUser } = useUsersData({
    role: roleForTab(query.tab),
    department_id: query.departmentId || undefined,
  });
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [revoking, setRevoking] = useState<ManagedUser | null>(null);
  const [addingDepartment, setAddingDepartment] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const setQuery = useCallback(
    (changes: Partial<UserQuery>) => {
      const next = writeUserQuery({
        ...readUserQuery(searchParams),
        ...changes,
      });
      router.replace(next ? `/users?${next}` : "/users", { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    const term = searchText.trim();
    if (term === query.search) return;
    const timer = window.setTimeout(
      () => setQuery({ search: term, page: 1 }),
      SEARCH_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [searchText, query.search, setQuery]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const departmentList = useMemo(() => departments ?? [], [departments]);
  const names = useMemo(
    () => departmentNames(departmentList),
    [departmentList],
  );
  const filtered = useMemo(
    () => filterUsers(users ?? [], query.tab, query.search, ""),
    [users, query.tab, query.search],
  );
  const view = paginate(filtered, query.page);
  const hasFilters = Boolean(
    query.search || query.departmentId || query.tab !== "all",
  );

  function departmentName(id: string | null) {
    if (!id) return "—";
    return names.get(id) ?? (departments ? "Unknown department" : "…");
  }

  async function run(
    action: UserAction,
    user: ManagedUser,
    request: () => Promise<ManagedUser | null>,
    success: string,
    inDialog: boolean,
  ) {
    setBusyUserId(user.user_id);
    setDialogError("");
    try {
      const updated = await request();
      if (updated) replaceUser(updated);
      setEditing(null);
      setRevoking(null);
      setNotice({ kind: "success", text: success });
    } catch (err) {
      if (isSignedOutError(err)) {
        router.replace("/login");
        return;
      }
      const message = actionErrorMessage(action, err);
      if (inDialog) setDialogError(message);
      else setNotice({ kind: "error", text: message });
    } finally {
      setBusyUserId(null);
    }
  }

  function who(user: ManagedUser) {
    return user.full_name || user.email;
  }

  function saveEdit(changes: UpdateUserInput) {
    if (!editing) return;
    const user = editing;
    run(
      "update",
      user,
      () => updateUser(user.user_id, changes),
      `${who(user)} was updated.`,
      true,
    );
  }

  function confirmRevoke() {
    if (!revoking) return;
    const user = revoking;
    run(
      "revoke",
      user,
      () => revokeUser(user.user_id),
      `Access for ${who(user)} was revoked.`,
      true,
    );
  }

  function resend(user: ManagedUser) {
    run(
      "resend",
      user,
      () => resendInvite(user.user_id),
      `A new invitation was sent to ${user.email}.`,
      false,
    );
  }

  function sendReset(user: ManagedUser) {
    run(
      "reset",
      user,
      async () => {
        await sendResetLink(user.user_id);
        return null;
      },
      `A password reset link was sent to ${user.email}.`,
      false,
    );
  }

  function closeDialogs() {
    setEditing(null);
    setRevoking(null);
    setDialogError("");
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-brand">Users</h1>
          <p className="mt-2 text-lg text-gray-500">
            Manage staff, engineers and invitations across your facilities.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setAddingDepartment(true)}
            className="flex h-12 items-center rounded-lg border border-rose bg-white px-6 text-base font-semibold text-brand hover:bg-cream"
          >
            + Add department
          </button>
          <Link
            href="/users/invite"
            className="flex h-12 items-center rounded-lg bg-brand px-6 text-base font-semibold text-white hover:bg-brand-dark"
          >
            + Invite user
          </Link>
        </div>
      </div>

      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`flex items-center justify-between gap-4 rounded-lg px-4 py-3 text-base ${
            notice.kind === "error"
              ? "bg-rose/30 text-brand"
              : "bg-green-50 text-green-800"
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {departmentsError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-lg bg-rose/30 px-4 py-3 text-base text-brand"
        >
          <span>{departmentsError}</span>
          <button
            type="button"
            onClick={retryDepartments}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Filter users"
        className="flex flex-wrap gap-2"
      >
        {USER_TABS.map((option) => {
          const selected = query.tab === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setQuery({ tab: option.value, page: 1 })}
              className={`rounded-md px-4 py-2 text-base ${
                selected
                  ? "bg-gold/20 font-semibold text-gold"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="relative flex-1">
          <span className="sr-only">Search users</span>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={searchText}
            maxLength={100}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search users by name or email..."
            className="h-12 w-full rounded-lg border border-rose bg-gray-50 pr-3 pl-10 text-base text-foreground placeholder:text-gray-400 focus:border-brand focus:outline-none"
          />
        </label>
        <div className="flex flex-col gap-1 md:w-80">
          <label
            htmlFor="department-filter"
            className="text-base text-gray-500"
          >
            Department
          </label>
          <select
            id="department-filter"
            value={query.departmentId}
            disabled={!departments}
            onChange={(event) =>
              setQuery({ departmentId: event.target.value, page: 1 })
            }
            className="h-12 rounded-lg border border-gray-200 bg-white px-3 text-base text-foreground focus:border-brand focus:outline-none"
          >
            <option value="">
              {departments
                ? "All departments"
                : departmentsError
                  ? "Departments unavailable"
                  : "Loading departments..."}
            </option>
            {departmentList.map((department) => (
              <option
                key={department.department_id}
                value={department.department_id}
              >
                {department.department_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section
        aria-busy={loading}
        className="overflow-hidden rounded-lg border border-rose bg-white"
      >
        {error ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-4 px-6 py-12 text-center"
          >
            <p className="text-base text-brand">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="h-11 rounded-lg bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Retry
            </button>
          </div>
        ) : !users ? (
          <p role="status" className="px-6 py-12 text-center text-gray-500">
            Loading users...
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-12 text-center text-gray-500">
            {hasFilters
              ? "No users match your search."
              : "No users yet. Invite your first user."}
          </p>
        ) : (
          <>
            <UsersTable
              users={view.items}
              departmentName={departmentName}
              busyUserId={busyUserId}
              onEdit={(user) => {
                if (!departments) {
                  setNotice({
                    kind: "error",
                    text: "Departments are not loaded yet. Retry, then edit the user.",
                  });
                  return;
                }
                setDialogError("");
                setEditing(user);
              }}
              onResend={resend}
              onSendReset={sendReset}
              onRevoke={(user) => {
                setDialogError("");
                setRevoking(user);
              }}
            />
            <Pagination
              page={view.page}
              pageCount={view.pageCount}
              summary={showingText(view.from, view.to, view.total)}
              onChange={(page) => setQuery({ page })}
            />
          </>
        )}
      </section>

      {editing && departments && (
        <EditUserDialog
          user={editing}
          departments={departmentList}
          saving={busyUserId === editing.user_id}
          error={dialogError}
          onSave={saveEdit}
          onClose={closeDialogs}
        />
      )}

      {revoking && (
        <RevokeDialog
          user={revoking}
          saving={busyUserId === revoking.user_id}
          error={dialogError}
          onConfirm={confirmRevoke}
          onClose={closeDialogs}
        />
      )}

      {addingDepartment && (
        <AddDepartmentDialog
          onAdded={(department) => {
            addDepartment(department);
            setAddingDepartment(false);
            setNotice({
              kind: "success",
              text: `${department.department_name} was added.`,
            });
          }}
          onClose={() => setAddingDepartment(false)}
        />
      )}
    </div>
  );
}
