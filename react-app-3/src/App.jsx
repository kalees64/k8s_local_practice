import { useState, useEffect } from "react";
import "./App.css";

const ROLE_CONFIG = {
  admin: { color: "#a78bfa", bg: "rgba(167,139,250,0.12)", label: "Admin" },
  user:  { color: "#34d399", bg: "rgba(52,211,153,0.12)",  label: "User"  },
};

function StatusBadge({ status }) {
  const ok = status === "OK";
  return (
    <span className={`status-badge ${ok ? "status-ok" : "status-err"}`}>
      <span className="status-dot" />
      {ok ? "Healthy" : status || "Unknown"}
    </span>
  );
}

function RolePill({ role }) {
  const cfg = ROLE_CONFIG[role] || { color: "#94a3b8", bg: "rgba(148,163,184,0.12)", label: role };
  return (
    <span className="role-pill" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

function HealthCard({ data, loading, error }) {
  return (
    <div className="card health-card">
      <div className="card-header">
        <div className="card-icon health-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <h2 className="card-title">API Health</h2>
      </div>

      {loading && <div className="skeleton-block" />}
      {error   && <p className="error-msg">⚠ {error}</p>}
      {data && !loading && (
        <div className="health-body">
          <div className="health-row">
            <span className="label">Status</span>
            <StatusBadge status={data.status} />
          </div>
          <div className="health-row">
            <span className="label">Success</span>
            <span className={`value ${data.success ? "text-green" : "text-red"}`}>
              {data.success ? "true" : "false"}
            </span>
          </div>
          <div className="health-row">
            <span className="label">Timestamp</span>
            <span className="value mono">
              {new Date(data.timestamp).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function UsersCard({ data, loading, error }) {
  return (
    <div className="card users-card">
      <div className="card-header">
        <div className="card-icon users-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <h2 className="card-title">
          Users
          {data && <span className="count-badge">{data.count}</span>}
        </h2>
      </div>

      {loading && (
        <div className="users-list">
          {[1, 2, 3].map(i => <div key={i} className="skeleton-row" />)}
        </div>
      )}
      {error && <p className="error-msg">⚠ {error}</p>}
      {data && !loading && (
        <div className="users-list">
          {data.data.map((user, idx) => (
            <div className="user-row" key={user.id} style={{ "--idx": idx }}>
              <div className="avatar">{user.name.charAt(0)}</div>
              <div className="user-info">
                <span className="user-name">{user.name}</span>
                <span className="user-email">{user.email}</span>
              </div>
              <RolePill role={user.role} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [health, setHealth]       = useState(null);
  const [users, setUsers]         = useState(null);
  const [healthErr, setHealthErr] = useState(null);
  const [usersErr, setUsersErr]   = useState(null);
  const [loadingH, setLoadingH]   = useState(true);
  const [loadingU, setLoadingU]   = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchAll = async () => {
    setLoadingH(true);
    setLoadingU(true);
    setHealthErr(null);
    setUsersErr(null);

    const [hRes, uRes] = await Promise.allSettled([
      fetch("/api/health"),
      fetch("/api/users"),
    ]);

    if (hRes.status === "fulfilled" && hRes.value.ok) {
      setHealth(await hRes.value.json());
    } else {
      setHealthErr(hRes.reason?.message || "Failed to fetch health");
    }
    setLoadingH(false);

    if (uRes.status === "fulfilled" && uRes.value.ok) {
      setUsers(await uRes.value.json());
    } else {
      setUsersErr(uRes.reason?.message || "Failed to fetch users");
    }
    setLoadingU(false);
    setLastRefresh(new Date());
  };

  useEffect(() => { fetchAll(); }, []);

  return (
    <div className="app-wrapper">
      {/* Ambient blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />

      <div className="dashboard">
        <header className="dash-header">
          <div>
            <h1 className="dash-title">Dashboard</h1>
            <p className="dash-sub">
              {lastRefresh
                ? `Last refreshed at ${lastRefresh.toLocaleTimeString()}`
                : "Fetching data…"}
            </p>
          </div>
          <button className="refresh-btn" onClick={fetchAll} id="refresh-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
        </header>

        <div className="cards-grid">
          <HealthCard data={health} loading={loadingH} error={healthErr} />
          <UsersCard  data={users}  loading={loadingU} error={usersErr}  />
        </div>
      </div>
    </div>
  );
}

export default App;
