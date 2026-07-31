import { type ReactNode, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import type { Notification } from "../types";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

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

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markRead(id: number) {
    await api.post(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          Onboarding Hub
        </Link>
        <nav>
          <Link to="/">Dashboard</Link>
          {user?.role === "hr_admin" && <Link to="/templates">Templates</Link>}
          {user?.role === "hr_admin" && <Link to="/team">Team</Link>}
        </nav>
        <div className="header-right">
          <div className="notif-wrap">
            <button className="icon-btn" onClick={() => setShowNotifs((s) => !s)}>
              🔔{unreadCount > 0 && <span className="badge">{unreadCount}</span>}
            </button>
            {showNotifs && (
              <div className="notif-dropdown">
                {notifications.length === 0 && <div className="notif-empty">No notifications</div>}
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`notif-item ${n.read ? "read" : "unread"}`}
                    onClick={() => markRead(n.id)}
                  >
                    {n.message}
                  </div>
                ))}
              </div>
            )}
          </div>
          <span className="user-chip">
            {user?.full_name} ({user?.role.replace("_", " ")})
          </span>
          <button className="link-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
