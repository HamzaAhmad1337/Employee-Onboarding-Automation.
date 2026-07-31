import { useEffect, useState } from "react";
import { PowerOff, Power } from "lucide-react";
import Layout from "../components/Layout";
import { api } from "../api/client";
import type { User } from "../types";

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
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Could not update account");
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
      </div>
      {error && <div className="error-banner">{error}</div>}
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Layout>
  );
}
