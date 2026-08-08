import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Search, UserPlus, Users } from "lucide-react";
import Layout from "../components/Layout";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Employee, EmployeeProgress, Template } from "../types";
import NewEmployeeForm from "../components/NewEmployeeForm";

const TITLES: Record<string, string> = {
  hr_admin: "All Onboarding Employees",
  manager: "Your Team's Onboarding",
  it: "IT Provisioning Tasks",
  new_hire: "Your Onboarding",
};

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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

  const query = search.trim().toLowerCase();
  const filtered = query
    ? employees.filter(
        (emp) =>
          emp.full_name.toLowerCase().includes(query) ||
          emp.department?.toLowerCase().includes(query) ||
          emp.job_title?.toLowerCase().includes(query)
      )
    : employees;

  // A new hire only ever has one employee record (their own) - skip the
  // roster UI (search box, "N people onboarding" framing) that only makes
  // sense when browsing a list, and take them straight to their tasks.
  if (!loading && user?.role === "new_hire" && employees.length === 1) {
    return <Navigate to={`/employees/${employees[0].id}`} replace />;
  }

  const totalOverdue = employees.reduce(
    (sum, e) => sum + e.tasks.filter((t) => t.is_overdue).length,
    0
  );
  const totalTasks = employees.reduce((sum, e) => sum + e.tasks.length, 0);
  const totalDone = employees.reduce(
    (sum, e) => sum + e.tasks.filter((t) => t.status === "done").length,
    0
  );

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>{TITLES[user?.role || ""] || "Dashboard"}</h1>
          {!(user?.role === "new_hire" && employees.length === 0) && (
            <p className="muted" style={{ marginTop: 4 }}>
              {employees.length} {employees.length === 1 ? "person" : "people"} onboarding
            </p>
          )}
        </div>
        {user?.role === "hr_admin" && (
          <button onClick={() => setShowForm((s) => !s)}>
            <UserPlus size={15} style={{ marginRight: 6, verticalAlign: -3 }} />
            {showForm ? "Cancel" : "New Employee"}
          </button>
        )}
      </div>

      {!loading && employees.length > 0 && (
        <div className="stat-row">
          <div className="stat-card">
            <span className="stat-card-label">
              <Users size={13} /> Onboarding
            </span>
            <span className="stat-card-value">{employees.length}</span>
          </div>
          <div className="stat-card success">
            <span className="stat-card-label">
              <CheckCircle2 size={13} /> Tasks Done
            </span>
            <span className="stat-card-value">
              {totalDone}/{totalTasks}
            </span>
          </div>
          <div className="stat-card danger">
            <span className="stat-card-label">
              <AlertTriangle size={13} /> Overdue
            </span>
            <span className="stat-card-value">{totalOverdue}</span>
          </div>
        </div>
      )}

      {showForm && (
        <NewEmployeeForm
          templates={templates}
          onCreated={() => {
            setShowForm(false);
            loadEmployees();
          }}
        />
      )}

      {loading && (
        <div className="card-grid">
          {[1, 2, 3].map((i) => (
            <div className="employee-card skeleton-card" key={i}>
              <div className="skeleton skeleton-avatar" />
              <div className="skeleton skeleton-line" style={{ width: "70%" }} />
              <div className="skeleton skeleton-line" style={{ width: "45%" }} />
            </div>
          ))}
        </div>
      )}

      {!loading && employees.length === 0 && user?.role === "new_hire" && (
        <p className="empty-state">
          Your onboarding record hasn't been linked to this account yet. Check with HR — this
          usually resolves itself once they create your employee record with this email address.
        </p>
      )}

      {!loading && employees.length === 0 && user?.role !== "new_hire" && (
        <p className="empty-state">Nothing here yet.</p>
      )}

      {!loading && employees.length > 0 && (
        <div className="search-wrap">
          <Search size={15} className="search-icon" />
          <input
            className="search-input"
            type="search"
            placeholder="Search by name or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {!loading && employees.length > 0 && filtered.length === 0 && (
        <p className="empty-state">No employees match "{search}".</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="card-grid">
          {filtered.map((emp) => {
            const progress = progressById[emp.id];
            const overdueCount = emp.tasks.filter((t) => t.is_overdue).length;
            return (
              <Link to={`/employees/${emp.id}`} key={emp.id} className="employee-card">
                <div className="employee-card-top">
                  <span className="avatar">{initialsOf(emp.full_name)}</span>
                  <span className="employee-card-name">{emp.full_name}</span>
                </div>
                <p className="muted">
                  {emp.job_title || "—"} {emp.department ? `· ${emp.department}` : ""}
                  {overdueCount > 0 && (
                    <span className="tag-overdue">{overdueCount} overdue</span>
                  )}
                </p>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress?.percent_complete ?? 0}%` }}
                  />
                </div>
                <p className="muted small">
                  {progress
                    ? `${progress.completed_tasks}/${progress.total_tasks} tasks done · ${progress.percent_complete}%`
                    : "..."}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
