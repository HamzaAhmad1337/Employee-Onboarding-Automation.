import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Document, Employee, TaskStatus, User } from "../types";

const STATUS_OPTIONS: TaskStatus[] = ["pending", "in_progress", "done", "blocked"];

export default function EmployeeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    job_title: "",
    department: "",
    start_date: "",
    manager_id: "",
  });
  const [managers, setManagers] = useState<User[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    const [empRes, docsRes] = await Promise.all([
      api.get<Employee>(`/employees/${id}`),
      api.get<Document[]>(`/employees/${id}/documents`),
    ]);
    setEmployee(empRes.data);
    setDocuments(docsRes.data);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function updateStatus(taskId: number, status: TaskStatus) {
    setError(null);
    try {
      const res = await api.patch<Employee>(`/employees/${id}/tasks/${taskId}`, { status });
      setEmployee(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Could not update task");
    }
  }

  async function handleDownload(doc: Document) {
    setError(null);
    try {
      const res = await api.get(`/employees/${id}/documents/${doc.id}/download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError("Could not download document");
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/employees/${id}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const docsRes = await api.get<Document[]>(`/employees/${id}/documents`);
      setDocuments(docsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function startEdit() {
    if (!employee) return;
    setEditForm({
      full_name: employee.full_name,
      job_title: employee.job_title || "",
      department: employee.department || "",
      start_date: employee.start_date.slice(0, 10),
      manager_id: employee.manager_id ? String(employee.manager_id) : "",
    });
    if (managers.length === 0) {
      api
        .get<User[]>("/auth/users", { params: { role: "manager" } })
        .then((res) => setManagers(res.data.filter((m) => m.is_active)));
    }
    setEditing(true);
  }

  async function handleSaveEdit() {
    setSavingEdit(true);
    setError(null);
    try {
      const res = await api.patch<Employee>(`/employees/${id}`, {
        full_name: editForm.full_name,
        job_title: editForm.job_title || null,
        department: editForm.department || null,
        start_date: new Date(editForm.start_date).toISOString(),
        manager_id: editForm.manager_id ? Number(editForm.manager_id) : null,
      });
      setEmployee(res.data);
      setEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Could not save changes");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Remove ${employee?.full_name} and all their onboarding data? This can't be undone.`)) {
      return;
    }
    try {
      await api.delete(`/employees/${id}`);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Could not delete employee");
    }
  }

  if (!employee) {
    return (
      <Layout>
        <p>Loading...</p>
      </Layout>
    );
  }

  const canEditTask = (assignedRole: string) =>
    user?.role === "hr_admin" || user?.role === assignedRole;

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>{employee.full_name}</h1>
          <p className="muted">
            {employee.job_title || "—"} {employee.department ? `· ${employee.department}` : ""} ·
            Starts {new Date(employee.start_date).toLocaleDateString()}
          </p>
        </div>
        {user?.role === "hr_admin" && !editing && (
          <div>
            <button className="secondary" onClick={startEdit}>
              Edit details
            </button>{" "}
            <button className="secondary" onClick={handleDelete}>
              Delete employee
            </button>
          </div>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {editing && (
        <section className="panel-form">
          <div className="form-grid">
            <label>
              Full name
              <input
                value={editForm.full_name}
                onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </label>
            <label>
              Job title
              <input
                value={editForm.job_title}
                onChange={(e) => setEditForm((f) => ({ ...f, job_title: e.target.value }))}
              />
            </label>
            <label>
              Department
              <input
                value={editForm.department}
                onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))}
              />
            </label>
            <label>
              Start date
              <input
                type="date"
                value={editForm.start_date}
                onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </label>
            <label>
              Manager
              <select
                value={editForm.manager_id}
                onChange={(e) => setEditForm((f) => ({ ...f, manager_id: e.target.value }))}
              >
                <option value="">No manager</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.email})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? "Saving..." : "Save changes"}
            </button>{" "}
            <button className="link-btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </section>
      )}

      <section className="panel">
        <h2>Onboarding Tasks</h2>
        <table className="task-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Assigned to</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {employee.tasks
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((task) => (
                <tr key={task.id}>
                  <td>{task.title}</td>
                  <td>{task.assigned_role.replace("_", " ")}</td>
                  <td>
                    {task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}
                    {task.is_overdue && <span className="tag tag-overdue">overdue</span>}
                  </td>
                  <td>
                    <select
                      value={task.status}
                      disabled={!canEditTask(task.assigned_role)}
                      onChange={(e) => updateStatus(task.id, e.target.value as TaskStatus)}
                      className={`status-select status-${task.status}`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Documents</h2>
        <ul className="doc-list">
          {documents.map((d) => (
            <li key={d.id}>
              <button className="link-btn" onClick={() => handleDownload(d)}>
                {d.name}
              </button>{" "}
              {d.signed && <span className="tag">signed</span>}
            </li>
          ))}
          {documents.length === 0 && <li className="muted">No documents uploaded yet.</li>}
        </ul>
        <label className="upload-btn">
          {uploading ? "Uploading..." : "Upload document"}
          <input type="file" onChange={handleUpload} disabled={uploading} hidden />
        </label>
      </section>
    </Layout>
  );
}
