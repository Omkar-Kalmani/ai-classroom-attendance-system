import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { sessionsAPI } from "../services/api";

export default function NewSession() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [name, setName] = useState("");
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleVideo = (file) => {
    if (file && file.type.startsWith("video/")) setVideo(file);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleVideo(e.dataTransfer.files[0]);
  };
  const formatSize = (b) =>
    b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${(b / 1e6).toFixed(1)} MB`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!video) {
      setError("Please select a video.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter a session name.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("video", video);
      const res = await sessionsAPI.create(fd);
      navigate(`/sessions/${res.data.session._id}/processing`);
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed.");
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8 animate-fade-up">
        <h1 className="text-3xl font-extrabold tracking-tight">New Session</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
          Upload a classroom video — AI will analyze engagement and generate
          attendance
        </p>
      </div>

      <div className="glass rounded-2xl p-8 animate-fade-up delay-1">
        {error && (
          <div
            className="rounded-xl px-4 py-3 mb-6 text-sm flex items-center gap-2"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#FC8181",
            }}
          >
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Session name */}
          <div>
            <label
              className="text-xs font-semibold uppercase tracking-wider mb-2 block"
              style={{ color: "var(--text-2)" }}
            >
              Session Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Data Structures — Lecture 12"
              required
              className="input-dark w-full rounded-xl px-4 py-3 text-sm"
            />
          </div>

          {/* Video upload */}
          <div>
            <label
              className="text-xs font-semibold uppercase tracking-wider mb-2 block"
              style={{ color: "var(--text-2)" }}
            >
              Classroom Video
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => !video && fileRef.current?.click()}
              className={`rounded-2xl p-10 text-center transition-all ${!video ? "cursor-pointer" : ""}`}
              style={{
                border: `2px dashed ${dragOver ? "#3B82F6" : video ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.1)"}`,
                background: dragOver
                  ? "rgba(59,130,246,0.05)"
                  : video
                    ? "rgba(59,130,246,0.04)"
                    : "rgba(255,255,255,0.02)",
              }}
            >
              {video ? (
                <div>
                  <div
                    className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl"
                    style={{
                      background:
                        "linear-gradient(135deg,rgba(59,130,246,0.2),rgba(6,182,212,0.2))",
                    }}
                  >
                    🎬
                  </div>
                  <p className="font-semibold text-sm">{video.name}</p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--text-2)" }}
                  >
                    {formatSize(video.size)}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setVideo(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="text-xs mt-3 px-3 py-1 rounded-lg transition-all"
                    style={{
                      color: "#FC8181",
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.2)",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <div className="text-5xl mb-3">📹</div>
                  <p className="font-semibold text-sm">
                    Drag & drop your video here
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--text-2)" }}
                  >
                    or click to browse files
                  </p>
                  <p
                    className="text-xs mt-3 px-4 py-1.5 rounded-full inline-block"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      color: "var(--text-3)",
                    }}
                  >
                    MP4, AVI, MOV, MKV · Max 500MB
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              onChange={(e) => handleVideo(e.target.files[0])}
              className="hidden"
            />
          </div>

          {/* Tips */}
          <div
            className="rounded-xl p-4 space-y-1.5"
            style={{
              background: "rgba(6,182,212,0.06)",
              border: "1px solid rgba(6,182,212,0.15)",
            }}
          >
            <p
              className="text-xs font-semibold mb-2"
              style={{ color: "#67E8F9" }}
            >
              📌 Tips for best results
            </p>
            {[
              "Camera should face students (front of classroom view)",
              "Ensure good lighting — faces must be clearly visible",
              "5–15 minute videos work best for testing",
              "Register students first to enable identification by name",
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-xs mt-0.5" style={{ color: "#06B6D4" }}>
                  →
                </span>
                <span className="text-xs" style={{ color: "var(--text-2)" }}>
                  {tip}
                </span>
              </div>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div>
              <div
                className="flex justify-between text-xs mb-2"
                style={{ color: "var(--text-2)" }}
              >
                <span>Uploading video...</span>
              </div>
              <div
                className="w-full h-2 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <div className="h-full rounded-full progress-shimmer w-3/4" />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !video}
            className="btn-primary w-full py-3.5 rounded-xl text-sm font-semibold"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Uploading...
              </span>
            ) : (
              "→ Upload & Start AI Analysis"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
