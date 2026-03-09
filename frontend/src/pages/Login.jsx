import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    institution: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      mode === "login"
        ? await login(form.email, form.password)
        : await register(form);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mesh dot-grid flex items-center justify-center px-4 relative overflow-hidden">
      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-500 rounded-full opacity-5 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500 rounded-full opacity-5 blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-10 animate-fade-up">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 glow-blue animate-pulse-glow"
            style={{ background: "linear-gradient(135deg,#3B82F6,#06B6D4)" }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold gradient-text tracking-tight">
            AttendAI
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--text-2)" }}>
            AI-Powered Classroom Attendance System
          </p>
        </div>

        {/* Card */}
        <div className="glass-2 rounded-3xl p-8 animate-fade-up delay-1">
          {/* Toggle */}
          <div
            className="flex rounded-xl p-1 mb-7"
            style={{ background: "rgba(0,0,0,0.3)" }}
          >
            {["login", "register"].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === m
                    ? "btn-primary rounded-lg"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 mb-5 text-sm flex items-center gap-2"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#FC8181",
              }}
            >
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <>
                <div>
                  <label
                    className="text-xs font-semibold uppercase tracking-wider mb-1.5 block"
                    style={{ color: "var(--text-2)" }}
                  >
                    Full Name
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Dr. Ramesh Kumar"
                    required
                    className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label
                    className="text-xs font-semibold uppercase tracking-wider mb-1.5 block"
                    style={{ color: "var(--text-2)" }}
                  >
                    Institution
                  </label>
                  <input
                    name="institution"
                    value={form.institution}
                    onChange={handleChange}
                    placeholder="PICT, Pune"
                    required
                    className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                  />
                </div>
              </>
            )}

            <div>
              <label
                className="text-xs font-semibold uppercase tracking-wider mb-1.5 block"
                style={{ color: "var(--text-2)" }}
              >
                Email
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="teacher@school.edu"
                required
                className="input-dark w-full rounded-xl px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label
                className="text-xs font-semibold uppercase tracking-wider mb-1.5 block"
                style={{ color: "var(--text-2)" }}
              >
                Password
              </label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                minLength={6}
                className="input-dark w-full rounded-xl px-4 py-3 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 rounded-xl text-sm mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {mode === "login" ? "Signing in..." : "Creating account..."}
                </span>
              ) : mode === "login" ? (
                "→ Sign In"
              ) : (
                "→ Create Account"
              )}
            </button>
          </form>
        </div>

        <p
          className="text-center text-xs mt-6"
          style={{ color: "var(--text-3)" }}
        >
          MERN Stack · Python · MediaPipe · DeepFace · Socket.IO
        </p>
      </div>
    </div>
  );
}
