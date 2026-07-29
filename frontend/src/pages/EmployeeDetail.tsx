import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Document, Employee, TaskStatus } from "../types";

const STATUS_OPTIONS: TaskStatus[] = ["pending", "in_progress", "done", "blocked"];

export default function EmployeeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      </div>

      {error && <div className="error-banner">{error}</div>}

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
                  <td>{task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}</td>
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
              {d.name} {d.signed && <span className="tag">signed</span>}
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
