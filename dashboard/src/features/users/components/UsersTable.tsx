import type { ManagedUser } from "../api";
import { roleName } from "../userHelpers";
import { PencilIcon } from "./icons";
import StatusBadge from "./StatusBadge";
import UserRowMenu from "./UserRowMenu";

type UsersTableProps = {
  users: ManagedUser[];
  departmentName: (departmentId: string | null) => string;
  busyUserId: string | null;
  onEdit: (user: ManagedUser) => void;
  onResend: (user: ManagedUser) => void;
  onSendReset: (user: ManagedUser) => void;
  onRevoke: (user: ManagedUser) => void;
};

const HEAD_CLASS = "px-6 py-4 text-left text-base font-semibold text-brand";
const CELL_CLASS = "px-6 py-4 text-base";

export default function UsersTable({
  users,
  departmentName,
  busyUserId,
  onEdit,
  onResend,
  onSendReset,
  onRevoke,
}: UsersTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse">
        <thead className="bg-rose/70">
          <tr>
            <th scope="col" className={HEAD_CLASS}>
              Name
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Email
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Role
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Department
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Status
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const revoked = user.status === "revoked";
            const muted = revoked ? "text-gray-400" : "text-foreground";
            return (
              <tr key={user.user_id} className="border-t border-gray-100">
                <td className={`${CELL_CLASS} ${muted}`}>
                  {user.full_name ? (
                    user.full_name
                  ) : (
                    <span className="text-gray-400">Not set yet</span>
                  )}
                </td>
                <td className={`${CELL_CLASS} ${muted}`}>{user.email}</td>
                <td className={`${CELL_CLASS} ${muted}`}>
                  {roleName(user.role)}
                </td>
                <td className={`${CELL_CLASS} ${muted}`}>
                  {departmentName(user.department_id)}
                </td>
                <td className={CELL_CLASS}>
                  <StatusBadge status={user.status} />
                </td>
                <td className={CELL_CLASS}>
                  <div className="flex items-center gap-1">
                    {!revoked && (
                      <button
                        type="button"
                        aria-label={`Edit ${user.full_name || user.email}`}
                        disabled={busyUserId === user.user_id}
                        onClick={() => onEdit(user)}
                        className="flex h-10 w-10 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                    )}
                    <UserRowMenu
                      user={user}
                      busy={busyUserId === user.user_id}
                      onResend={() => onResend(user)}
                      onSendReset={() => onSendReset(user)}
                      onRevoke={() => onRevoke(user)}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
