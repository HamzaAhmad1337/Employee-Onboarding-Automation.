import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  LayoutGrid,
  ListChecks,
  LogOut,
  Users,
  UserCircle2,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import type { Notification } from "../types";

const ROLE_LABELS: Record<string, string> = {
  hr_admin: "HR Admin",
  manager: "Manager",
  it: "IT",
  new_hire: "New Hire",
};

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    function poll() {
      api.get("/notifications").then((res) => {
        if (!cancelled) setNotifications(res.data);
      });
    }
    poll();
    const interval = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markRead(id: number) {
    await api.post(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  async function markAllRead() {
    await api.post("/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const initials = (user?.full_name || "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutGrid, show: true },
    { to: "/templates", label: "Templates", icon: ListChecks, show: user?.role === "hr_admin" },
    { to: "/team", label: "Team", icon: Users, show: user?.role === "hr_admin" },
  ];

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">O</span>
          <span className="brand-name">Onboarding Hub</span>
        </Link>
        <nav className="side-nav">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
              return (
                <Link key={item.to} to={item.to} className={`side-nav-link ${active ? "active" : ""}`}>
                  <Icon size={18} strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
        </nav>
        <div className="sidebar-footer">
          <div className="user-card">
            <span className="avatar">{initials || <UserCircle2 size={20} />}</span>
            <div className="user-card-text">
              <span className="user-card-name">{user?.full_name}</span>
              <span className="user-card-role">{ROLE_LABELS[user?.role || ""] || user?.role}</span>
            </div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <div className="topbar-spacer" />
          <div className="notif-wrap" ref={notifRef}>
            <button
              className={`icon-btn ${showNotifs ? "active" : ""}`}
              onClick={() => setShowNotifs((s) => !s)}
              aria-label="Notifications"
            >
              <Bell size={19} />
              {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
            </button>
            {showNotifs && (
              <div className="notif-dropdown">
                <div className="notif-dropdown-header">
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <button className="link-btn" onClick={markAllRead}>
                      Mark all as read
                    </button>
                  )}
                </div>
                {notifications.length === 0 && (
                  <div className="notif-empty">You're all caught up.</div>
                )}
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`notif-item ${n.read ? "read" : "unread"}`}
                    onClick={() => markRead(n.id)}
                  >
                    <span className="notif-dot" />
                    <span>{n.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
