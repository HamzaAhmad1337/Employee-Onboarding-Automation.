import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Employee, EmployeeProgress, Template } from "../types";
import NewEmployeeForm from "../components/NewEmployeeForm";

export default function Dashboard() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [progressById, setProgressById] = useState<Record<number, EmployeeProgress>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadEmployees() {
    setLoading(true);
    const res = await api.get<Employee[]>("/employees");
    setEmployees(res.data);
    const entries = await Promise.all(
      res.data.map(async (e) => {
        const p = await api.get<EmployeeProgress>(`/employees/${e.id}/progress`);
        return [e.id, p.data] as const;
      })
    );
    setProgressById(Object.fromEntries(entries));
    setLoading(false);
  }

  useEffect(() => {
    loadEmployees();
    if (user?.role === "hr_admin") {
      api.get<Template[]>("/templates").then((res) => setTemplates(res.data));
    }
  }, [user]);

  return (
    <Layout>
      <div className="page-header">
        <h1>
          {user?.role === "hr_admin" && "All Onboarding Employees"}
          {user?.role === "manager" && "Your Team's Onboarding"}
          {user?.role === "it" && "IT Provisioning Tasks"}
          {user?.role === "new_hire" && "Your Onboarding"}
        </h1>
        {user?.role === "hr_admin" && (
          <button onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "+ New Employee"}
          </button>
        )}
      </div>

      {showForm && (
        <NewEmployeeForm
          templates={templates}
          onCreated={() => {
            setShowForm(false);
            loadEmployees();
          }}
        />
      )}

      {loading && <p>Loading...</p>}
      {!loading && employees.length === 0 && <p className="empty-state">Nothing here yet.</p>}

      {!loading && employees.length > 0 && (
        <input
          className="search-input"
          type="search"
          placeholder="Search by name or department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {(() => {
        const query = search.trim().toLowerCase();
        const filtered = query
          ? employees.filter(
              (emp) =>
                emp.full_name.toLowerCase().includes(query) ||
                emp.department?.toLowerCase().includes(query) ||
                emp.job_title?.toLowerCase().includes(query)
            )
          : employees;

        if (!loading && employees.length > 0 && filtered.length === 0) {
          return <p className="empty-state">No employees match "{search}".</p>;
        }

        return (
          <div className="card-grid">
            {filtered.map((emp) => {
          const progress = progressById[emp.id];
          const overdueCount = emp.tasks.filter((t) => t.is_overdue).length;
          return (
            <Link to={`/employees/${emp.id}`} key={emp.id} className="employee-card">
              <h3>
                {emp.full_name}
                {overdueCount > 0 && (
                  <span className="tag-overdue">
                    {overdueCount} overdue
                  </span>
                )}
              </h3>
              <p className="muted">
                {emp.job_title || "—"} {emp.department ? `· ${emp.department}` : ""}
              </p>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress?.percent_complete ?? 0}%` }}
                />
              </div>
              <p className="muted small">
                {progress ? `${progress.completed_tasks}/${progress.total_tasks} tasks done` : "..."}
              </p>
            </Link>
          );
            })}
          </div>
        );
      })()}
    </Layout>
  );
}
