import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { api } from "../api/client";
import type { User } from "../types";

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
      <h1>Team Accounts</h1>
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
                <td>{u.full_name}</td>
                <td>{u.email}</td>
                <td>{u.role.replace("_", " ")}</td>
                <td>{u.is_active ? "Active" : "Deactivated"}</td>
                <td>
                  <button className="secondary" onClick={() => toggleActive(u)}>
                    {u.is_active ? "Deactivate" : "Reactivate"}
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
