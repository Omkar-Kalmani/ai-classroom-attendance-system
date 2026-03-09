import { useState, useEffect, useRef } from "react";
import { studentsAPI } from "../services/api";
import { onEncodingComplete } from "../services/socket";

const EncodingBadge = ({ status }) => {
  const cfg = {
    success: { cls: "badge-success", label: "✓ Face Ready" },
    pending: { cls: "badge-pending", label: "⏳ Processing" },
    failed: { cls: "badge-absent", label: "✗ Failed" },
  }[status] || { cls: "badge-pending", label: "Unknown" };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ name: "", prn: "", className: "" });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    studentsAPI
      .getAll()
      .then((r) => setStudents(r.data.students))
      .catch(console.error)
      .finally(() => setLoading(false));

    const unsub = onEncodingComplete((data) => {
      setStudents((prev) =>
        prev.map((s) =>
          s._id === data.studentId
            ? { ...s, encodingStatus: data.success ? "success" : "failed" }
            : s,
        ),
      );
      setSuccess(data.message);
      setTimeout(() => setSuccess(""), 4000);
    });
    return unsub;
  }, []);

  const handlePhoto = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!photo) {
      setError("Please select a photo.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("prn", form.prn);
      fd.append("className", form.className);
      fd.append("photo", photo);
      const res = await studentsAPI.register(fd);
      setStudents((prev) => [...prev, res.data.student]);
      setSuccess(`${form.name} registered! Generating face encoding...`);
      setForm({ name: "", prn: "", className: "" });
      setPhoto(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed.");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Remove ${name}?`)) return;
    try {
      await studentsAPI.delete(id);
      setStudents((prev) => prev.filter((s) => s._id !== id));
    } catch {
      setError("Delete failed.");
    }
  };

  const ready = students.filter((s) => s.encodingStatus === "success").length;
  const pending = students.filter((s) => s.encodingStatus === "pending").length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 animate-fade-up">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Student Register
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
          Register students with photos to enable face recognition during video
          processing
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4 mb-8 animate-fade-up delay-1">
        {[
          { label: "Registered", value: students.length, color: "#60A5FA" },
          { label: "Face Ready", value: ready, color: "#34D399" },
          { label: "Processing", value: pending, color: "#FCD34D" },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass rounded-2xl p-4 text-center">
            <div className="text-2xl font-extrabold" style={{ color }}>
              {value}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-2)" }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add form */}
        <div className="glass rounded-2xl p-6 animate-fade-up delay-2">
          <h2 className="font-bold mb-5 flex items-center gap-2">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
              style={{ background: "linear-gradient(135deg,#3B82F6,#06B6D4)" }}
            >
              +
            </span>
            Add Student
          </h2>

          {error && (
            <div
              className="rounded-xl px-4 py-2.5 mb-4 text-sm"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#FC8181",
              }}
            >
              {error}
            </div>
          )}
          {success && (
            <div
              className="rounded-xl px-4 py-2.5 mb-4 text-sm"
              style={{
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.2)",
                color: "#34D399",
              }}
            >
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Photo drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              className="rounded-xl h-40 flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative"
              style={{
                border: preview
                  ? "1px solid rgba(59,130,246,0.4)"
                  : "2px dashed rgba(255,255,255,0.1)",
                background: preview ? "transparent" : "rgba(255,255,255,0.03)",
              }}
            >
              {preview ? (
                <img
                  src={preview}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <>
                  <span className="text-4xl mb-2">📷</span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--text-2)" }}
                  >
                    Click to upload photo
                  </span>
                  <span
                    className="text-xs mt-0.5"
                    style={{ color: "var(--text-3)" }}
                  >
                    JPG or PNG, max 5MB
                  </span>
                </>
              )}
              {preview && (
                <div
                  className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-all"
                  style={{ background: "rgba(0,0,0,0.5)" }}
                >
                  <span className="text-sm font-semibold">Change Photo</span>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handlePhoto}
              className="hidden"
            />

            {[
              { name: "name", label: "Full Name", ph: "Rahul Sharma" },
              { name: "prn", label: "PRN / Roll No", ph: "2021CS001" },
              {
                name: "className",
                label: "Class / Division",
                ph: "CS-A",
                required: false,
              },
            ].map(({ name, label, ph, required = true }) => (
              <div key={name}>
                <label
                  className="text-xs font-semibold uppercase tracking-wider mb-1.5 block"
                  style={{ color: "var(--text-2)" }}
                >
                  {label}
                </label>
                <input
                  value={form[name]}
                  onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                  placeholder={ph}
                  required={required}
                  className="input-dark w-full rounded-xl px-4 py-2.5 text-sm"
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={adding}
              className="btn-primary w-full py-3 rounded-xl text-sm"
            >
              {adding ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registering...
                </span>
              ) : (
                "→ Register Student"
              )}
            </button>
          </form>
        </div>

        {/* Student list */}
        <div className="lg:col-span-2 glass rounded-2xl overflow-hidden animate-fade-up delay-3">
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <h2 className="font-bold">Registered Students</h2>
            <span
              className="text-xs px-2.5 py-1 rounded-full"
              style={{ background: "rgba(59,130,246,0.1)", color: "#60A5FA" }}
            >
              {students.length} total
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">👤</div>
              <p className="font-semibold">No students yet</p>
              <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
                Register students to enable face recognition
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {students.map((s) => (
                <div
                  key={s._id}
                  className="flex items-center justify-between px-6 py-3.5 transition-all hover:bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{
                        background:
                          "linear-gradient(135deg,rgba(59,130,246,0.2),rgba(6,182,212,0.2))",
                        color: "#60A5FA",
                      }}
                    >
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{s.name}</p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "var(--text-3)" }}
                      >
                        PRN: <span className="font-mono">{s.prn}</span>
                        {s.className && <span> · {s.className}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <EncodingBadge status={s.encodingStatus} />
                    <button
                      onClick={() => handleDelete(s._id, s.name)}
                      className="text-xs transition-all px-2 py-1 rounded-lg"
                      style={{ color: "var(--text-3)" }}
                      onMouseEnter={(e) => {
                        e.target.style.color = "#FC8181";
                        e.target.style.background = "rgba(239,68,68,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = "var(--text-3)";
                        e.target.style.background = "transparent";
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div
        className="mt-6 rounded-2xl p-5 animate-fade-up"
        style={{
          background: "rgba(59,130,246,0.06)",
          border: "1px solid rgba(59,130,246,0.15)",
        }}
      >
        <p className="text-sm font-semibold mb-1" style={{ color: "#60A5FA" }}>
          💡 How face recognition works
        </p>
        <p
          className="text-xs leading-relaxed"
          style={{ color: "var(--text-2)" }}
        >
          After uploading a photo, DeepFace generates a unique 512-dimensional
          face embedding. During video processing, each detected face is
          compared against all stored embeddings. A match (cosine distance &lt;
          0.68) identifies the student by name and PRN automatically.
          <strong style={{ color: "var(--text-1)" }}> Face Ready</strong> status
          means the student will be recognized in videos.
        </p>
      </div>
    </div>
  );
}
