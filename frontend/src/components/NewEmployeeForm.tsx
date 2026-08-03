import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { useToast } from "./Toast";
import type { Template, User } from "../types";

export default function NewEmployeeForm({
  templates,
  onCreated,
}: {
  templates: Template[];
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [managerId, setManagerId] = useState<string>("");
  const [managers, setManagers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    api
      .get<User[]>("/auth/users", { params: { role: "manager" } })
      .then((res) => setManagers(res.data.filter((m) => m.is_active)));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/employees", {
        full_name: fullName,
        email,
        job_title: jobTitle || null,
        department: department || null,
        start_date: new Date(startDate).toISOString(),
        template_id: templateId ? Number(templateId) : null,
        manager_id: managerId ? Number(managerId) : null,
      });
      showToast(`${fullName} was added to onboarding.`);
      setFullName("");
      setEmail("");
      setJobTitle("");
      setDepartment("");
      setStartDate("");
      setTemplateId("");
      setManagerId("");
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create employee");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="panel-form" onSubmit={handleSubmit}>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-grid">
        <label>
          Full name
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Job title
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        </label>
        <label>
          Department
          <input value={department} onChange={(e) => setDepartment(e.target.value)} />
        </label>
        <label>
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </label>
        <label>
          Manager
          <select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">No manager</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name} ({m.email})
              </option>
            ))}
          </select>
        </label>
        <label>
          Onboarding template
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">No template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="submit" disabled={submitting}>
        {submitting ? "Creating..." : "Create employee"}
      </button>
    </form>
  );
}
