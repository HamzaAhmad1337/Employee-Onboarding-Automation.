import { useEffect, useState, type FormEvent } from "react";
import { PowerOff, Power, UserPlus } from "lucide-react";
import Layout from "../components/Layout";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/Toast";
import type { Role, User } from "../types";

const ROLES: Role[] = ["manager", "it", "new_hire", "hr_admin"];

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Team() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("manager");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  async function load() {
    const res = await api.get<User[]>("/auth/users");
    setUsers(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(u: User) {
    setError(null);
    try {
      await api.patch(`/auth/users/${u.id}`, { is_active: !u.is_active });
      showToast(`${u.full_name} ${u.is_active ? "deactivated" : "reactivated"}.`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Could not update account");
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await api.post("/auth/users", { full_name: fullName, email, role, password });
      showToast(`Account created for ${fullName}.`);
      setFullName("");
      setEmail("");
      setRole("manager");
      setPassword("");
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Could not create account");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Team Accounts</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {users.length} {users.length === 1 ? "account" : "accounts"}
          </p>
        </div>
        <button onClick={() => setShowForm((s) => !s)}>
          <UserPlus size={15} style={{ marginRight: 6, verticalAlign: -3 }} />
          {showForm ? "Cancel" : "New Account"}
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}

      {showForm && (
        <form className="panel-form" onSubmit={handleCreate}>
          <p className="muted small" style={{ marginTop: -4 }}>
            Creates a login for a manager, IT staff member, new hire, or another HR admin.
            If the email matches an existing employee record, it's linked automatically.
          </p>
          <div className="form-grid">
            <label>
              Full name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Role
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Temporary password
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                placeholder="At least 8 characters"
              />
            </label>
          </div>
          <div>
            <button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create account"}
            </button>
          </div>
        </form>
      )}

      <section className="panel">
        <table className="task-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="avatar">{initialsOf(u.full_name)}</span>
                    <span className="task-title-cell">{u.full_name}</span>
                  </div>
                </td>
                <td className="muted">{u.email}</td>
                <td>
                  <span className="pill pill-role">{u.role.replace("_", " ")}</span>
                </td>
                <td>
                  <span className={`pill ${u.is_active ? "status-done" : "status-blocked"}`}>
                    {u.is_active ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td>
                  {u.id === currentUser?.id ? (
                    <span className="muted small" title="You can't deactivate your own account">
                      This is you
                    </span>
                  ) : (
                    <button
                      className={`secondary ${u.is_active ? "danger-hover" : ""}`}
                      onClick={() => toggleActive(u)}
                    >
                      {u.is_active ? (
                        <>
                          <PowerOff size={13} style={{ marginRight: 5, verticalAlign: -2 }} />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Power size={13} style={{ marginRight: 5, verticalAlign: -2 }} />
                          Reactivate
                        </>
                      )}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Layout>
  );
}
