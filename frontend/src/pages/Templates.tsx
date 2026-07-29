import { useEffect, useState, type FormEvent } from "react";
import Layout from "../components/Layout";
import { api } from "../api/client";
import type { Role, Template } from "../types";

const ROLES: Role[] = ["hr_admin", "manager", "it", "new_hire"];

interface DraftTask {
  title: string;
  assigned_role: Role;
  due_offset_days: number;
}

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [tasks, setTasks] = useState<DraftTask[]>([
    { title: "", assigned_role: "it", due_offset_days: 0 },
  ]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api.get<Template[]>("/templates");
    setTemplates(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  function updateTask(i: number, patch: Partial<DraftTask>) {
    setTasks((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  function addTaskRow() {
    setTasks((prev) => [...prev, { title: "", assigned_role: "it", due_offset_days: 0 }]);
  }

  function removeTaskRow(i: number) {
    setTasks((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/templates", {
        name,
        department: department || null,
        task_definitions: tasks
          .filter((t) => t.title.trim())
          .map((t, i) => ({ ...t, order: i })),
      });
      setName("");
      setDepartment("");
      setTasks([{ title: "", assigned_role: "it", due_offset_days: 0 }]);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create template");
    }
  }

  return (
    <Layout>
      <h1>Onboarding Templates</h1>
      {error && <div className="error-banner">{error}</div>}

      <form className="panel-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Template name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Department
            <input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </label>
        </div>

        <h3>Tasks</h3>
        {tasks.map((task, i) => (
          <div className="form-row" key={i}>
            <input
              placeholder="Task title"
              value={task.title}
              onChange={(e) => updateTask(i, { title: e.target.value })}
            />
            <select
              value={task.assigned_role}
              onChange={(e) => updateTask(i, { assigned_role: e.target.value as Role })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace("_", " ")}
                </option>
              ))}
            </select>
            <input
              type="number"
              title="Due offset (days from start date)"
              value={task.due_offset_days}
              onChange={(e) => updateTask(i, { due_offset_days: Number(e.target.value) })}
            />
            <button type="button" className="link-btn" onClick={() => removeTaskRow(i)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="secondary" onClick={addTaskRow}>
          + Add task
        </button>
        <div>
          <button type="submit">Save template</button>
        </div>
      </form>

      <section className="panel">
        <h2>Existing Templates</h2>
        {templates.map((t) => (
          <div key={t.id} className="template-card">
            <h3>
              {t.name} {t.department && <span className="muted">· {t.department}</span>}
            </h3>
            <ul>
              {t.task_definitions.map((td) => (
                <li key={td.id}>
                  {td.title} — {td.assigned_role.replace("_", " ")} (day {td.due_offset_days})
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </Layout>
  );
}
