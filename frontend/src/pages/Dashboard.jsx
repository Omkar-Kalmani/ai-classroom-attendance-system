import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { dashboardAPI, sessionsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";

const StatCard = ({ label, value, icon, gradient, delay, suffix = "" }) => (
  <div className={`glass card-hover rounded-2xl p-6 animate-fade-up ${delay}`}>
    <div className="flex items-start justify-between mb-4">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl`}
        style={{ background: gradient }}
      >
        {icon}
      </div>
      <span
        className="text-xs px-2 py-1 rounded-full"
        style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-2)" }}
      >
        All time
      </span>
    </div>
    <div className="stat-number gradient-text">
      {value ?? "—"}
      {suffix}
    </div>
    <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
      {label}
    </p>
  </div>
);

const statusConfig = {
  completed: { label: "Completed", cls: "badge-present" },
  processing: { label: "Processing", cls: "badge-processing" },
  pending: { label: "Pending", cls: "badge-pending" },
  failed: { label: "Failed", cls: "badge-absent" },
};

export default function Dashboard() {
  const { teacher } = useAuth();
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([dashboardAPI.getSummary(), sessionsAPI.getAll()])
      .then(([s, r]) => {
        setSummary(s.data.summary);
        setSessions(r.data.sessions.slice(0, 6));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-up">
        <div>
          <p className="text-sm mb-1" style={{ color: "var(--text-2)" }}>
            {greeting},{" "}
            <span className="gradient-text font-semibold">
              {teacher?.name?.split(" ")[0]}
            </span>{" "}
            👋
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
            {teacher?.institution}
          </p>
        </div>
        <Link
          to="/sessions/new"
          className="btn-primary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span> New Session
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Sessions"
          value={summary?.totalSessions}
          icon="📹"
          gradient="linear-gradient(135deg,rgba(59,130,246,0.3),rgba(59,130,246,0.1))"
          delay="delay-1"
        />
        <StatCard
          label="Completed"
          value={summary?.completedSessions}
          icon="✅"
          gradient="linear-gradient(135deg,rgba(16,185,129,0.3),rgba(16,185,129,0.1))"
          delay="delay-2"
        />
        <StatCard
          label="Avg Engagement"
          value={summary?.avgEngagement}
          icon="📊"
          gradient="linear-gradient(135deg,rgba(6,182,212,0.3),rgba(6,182,212,0.1))"
          delay="delay-3"
          suffix="%"
        />
        <StatCard
          label="Avg Attendance"
          value={summary?.avgAttendance}
          icon="👥"
          gradient="linear-gradient(135deg,rgba(245,158,11,0.3),rgba(245,158,11,0.1))"
          delay="delay-4"
          suffix="%"
        />
      </div>

      {/* Recent sessions */}
      <div className="glass rounded-2xl overflow-hidden animate-fade-up delay-5">
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h2 className="font-bold">Recent Sessions</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-2)" }}>
              Your latest classroom recordings
            </p>
          </div>
          <Link
            to="/sessions/new"
            className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: "rgba(59,130,246,0.1)",
              color: "#60A5FA",
              border: "1px solid rgba(59,130,246,0.2)",
            }}
          >
            + Upload
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🎬</div>
            <p className="font-semibold mb-1">No sessions yet</p>
            <p className="text-sm mb-4" style={{ color: "var(--text-2)" }}>
              Upload your first classroom video to get started
            </p>
            <Link
              to="/sessions/new"
              className="btn-primary px-5 py-2.5 rounded-xl text-sm inline-block"
            >
              Upload Video
            </Link>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div
              className="grid grid-cols-12 px-6 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{
                color: "var(--text-3)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span className="col-span-4">Session</span>
              <span className="col-span-2">Date</span>
              <span className="col-span-2 text-center">Students</span>
              <span className="col-span-2 text-center">Engagement</span>
              <span className="col-span-2 text-center">Status</span>
            </div>
            {sessions.map((s, i) => {
              const cfg = statusConfig[s.status] || statusConfig.pending;
              return (
                <div
                  key={s._id}
                  className={`grid grid-cols-12 px-6 py-4 items-center transition-all hover:bg-white/5 ${
                    i < sessions.length - 1 ? "border-b" : ""
                  }`}
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="col-span-4">
                    <p className="font-medium text-sm">{s.name}</p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--text-3)" }}
                    >
                      {s.videoDurationSec
                        ? `${Math.round(s.videoDurationSec / 60)} min`
                        : "Video uploaded"}
                    </p>
                  </div>
                  <div
                    className="col-span-2 text-sm"
                    style={{ color: "var(--text-2)" }}
                  >
                    {new Date(s.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                  <div className="col-span-2 text-center">
                    <span className="text-sm font-semibold">
                      {s.totalStudents ?? "—"}
                    </span>
                  </div>
                  <div className="col-span-2 text-center">
                    {s.avgClassEngagement != null ? (
                      <span className="font-mono text-sm font-bold gradient-text">
                        {s.avgClassEngagement}%
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-3)" }}>—</span>
                    )}
                  </div>
                  <div className="col-span-2 flex items-center justify-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.cls}`}
                    >
                      {cfg.label}
                    </span>
                    {s.status === "completed" && (
                      <Link
                        to={`/sessions/${s._id}/results`}
                        className="text-xs transition-colors"
                        style={{ color: "var(--text-3)" }}
                        onMouseEnter={(e) => (e.target.style.color = "#60A5FA")}
                        onMouseLeave={(e) =>
                          (e.target.style.color = "var(--text-3)")
                        }
                      >
                        →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
