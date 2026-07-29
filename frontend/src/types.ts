export type Role = "hr_admin" | "manager" | "it" | "new_hire";
export type TaskStatus = "pending" | "in_progress" | "done" | "blocked";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
}

export interface OnboardingTask {
  id: number;
  title: string;
  description: string | null;
  assigned_role: Role;
  status: TaskStatus;
  due_date: string | null;
  completed_at: string | null;
  order: number;
}

export interface Employee {
  id: number;
  full_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  start_date: string;
  manager_id: number | null;
  tasks: OnboardingTask[];
}

export interface EmployeeProgress {
  employee_id: number;
  full_name: string;
  total_tasks: number;
  completed_tasks: number;
  percent_complete: number;
}

export interface TaskDefinition {
  id: number;
  title: string;
  description: string | null;
  assigned_role: Role;
  due_offset_days: number;
  order: number;
}

export interface Template {
  id: number;
  name: string;
  department: string | null;
  task_definitions: TaskDefinition[];
}

export interface Document {
  id: number;
  employee_id: number;
  name: string;
  file_path: string;
  signed: boolean;
  uploaded_at: string;
}

export interface Notification {
  id: number;
  message: string;
  read: boolean;
  created_at: string;
}
