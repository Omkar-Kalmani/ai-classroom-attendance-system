import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { resultsAPI, sessionsAPI, reportsAPI } from '../services/api';

// ── Circular score gauge ───────────────────────────────────
const ScoreGauge = ({ score }) => {
  const color = score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
  const glow  = score >= 70 ? 'rgba(16,185,129,0.3)' : score >= 50 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)';
  const r = 34;
  const circ  = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="relative inline-flex items-center justify-center" style={{filter:`drop-shadow(0 0 8px ${glow})`}}>
      <svg width="88" height="88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7"/>
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 44 44)"
          style={{transition:'stroke-dashoffset 1s ease'}}/>
      </svg>
      <div className="absolute text-center">
        <div className="text-base font-extrabold leading-none" style={{color}}>{Math.round(score)}%</div>
      </div>
    </div>
  );
};

// ── Signal bar ─────────────────────────────────────────────
const SignalBar = ({ label, value, color = '#3B82F6' }) => (
  <div>
    <div className="flex justify-between text-xs mb-1">
      <span style={{color:'var(--text-3)'}}>{label}</span>
      <span className="font-mono font-semibold" style={{color}}>{Math.round(value * 100)}%</span>
    </div>
    <div className="h-1.5 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,0.06)'}}>
      <div className="h-full rounded-full transition-all duration-700"
        style={{width:`${value*100}%`, background:`linear-gradient(90deg,${color},${color}88)`}} />
    </div>
  </div>
);

export default function Results() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [session,     setSession]     = useState(null);
  const [students,    setStudents]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState('all');
  const [downloading, setDownloading] = useState('');

  useEffect(() => {
    Promise.all([sessionsAPI.getOne(id), resultsAPI.getResults(id)])
      .then(([s, r]) => { setSession(s.data.session); setStudents(r.data.students || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const download = async (type) => {
    setDownloading(type);
    try {
      const res = type === 'pdf' ? await reportsAPI.downloadPDF(id) : await reportsAPI.downloadCSV(id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a   = document.createElement('a');
      a.href = url; a.download = `attendance-${id}.${type}`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Download failed.'); }
    finally { setDownloading(''); }
  };

  const filtered    = students.filter(s => filter === 'all' ? true : s.attendanceStatus === filter);
  const presentCount = students.filter(s => s.attendanceStatus === 'present').length;
  const absentCount  = students.length - presentCount;
  const identified   = students.filter(s => s.identified).length;
  const attendanceRate = students.length ? Math.round(presentCount / students.length * 100) : 0;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-8 animate-fade-up">
        <div>
          <button onClick={() => navigate('/')}
            className="text-xs flex items-center gap-1 mb-2 transition-colors"
            style={{color:'var(--text-3)'}}
            onMouseEnter={e => e.currentTarget.style.color='#60A5FA'}
            onMouseLeave={e => e.currentTarget.style.color='var(--text-3)'}>
            ← Dashboard
          </button>
          <h1 className="text-3xl font-extrabold tracking-tight">{session?.name}</h1>
          <p className="text-sm mt-1" style={{color:'var(--text-2)'}}>
            {new Date(session?.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}
            {session?.videoDurationSec && ` · ${Math.round(session.videoDurationSec/60)} min video`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => download('csv')} disabled={!!downloading}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{background:'rgba(255,255,255,0.05)',border:'1px solid var(--border)',color:'var(--text-2)'}}>
            {downloading==='csv' ? '...' : '⬇ CSV'}
          </button>
          <button onClick={() => download('pdf')} disabled={!!downloading}
            className="btn-primary px-4 py-2 rounded-xl text-sm">
            {downloading==='pdf' ? '...' : '⬇ PDF Report'}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="glass rounded-2xl p-6 mb-6 animate-fade-up delay-1">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 items-center">
          <div className="text-center">
            <div className="stat-number gradient-text">{students.length}</div>
            <div className="text-xs mt-1" style={{color:'var(--text-2)'}}>Total Students</div>
          </div>
          <div className="text-center">
            <div className="stat-number" style={{color:'#34D399'}}>{presentCount}</div>
            <div className="text-xs mt-1" style={{color:'var(--text-2)'}}>Present</div>
          </div>
          <div className="text-center">
            <div className="stat-number" style={{color:'#FC8181'}}>{absentCount}</div>
            <div className="text-xs mt-1" style={{color:'var(--text-2)'}}>Absent</div>
          </div>
          <div className="text-center">
            <div className="stat-number gradient-text">{session?.avgClassEngagement ?? 0}%</div>
            <div className="text-xs mt-1" style={{color:'var(--text-2)'}}>Avg Engagement</div>
          </div>
          {/* Mini donut */}
          <div className="flex items-center justify-center gap-3">
            <div className="relative">
              <svg width="56" height="56">
                <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(239,68,68,0.2)" strokeWidth="6"/>
                <circle cx="28" cy="28" r="22" fill="none" stroke="#10B981" strokeWidth="6"
                  strokeDasharray={138.2} strokeDashoffset={138.2 * (1 - attendanceRate/100)}
                  strokeLinecap="round" transform="rotate(-90 28 28)"/>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{color:'#34D399'}}>
                {attendanceRate}%
              </div>
            </div>
            <div className="text-xs" style={{color:'var(--text-2)'}}>Attendance<br/>Rate</div>
          </div>
        </div>
      </div>

      {/* Identified banner */}
      {identified > 0 && (
        <div className="rounded-xl px-4 py-3 mb-5 text-sm animate-fade-up delay-2"
          style={{background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.2)',color:'#93C5FD'}}>
          👤 <strong>{identified}</strong> of <strong>{students.length}</strong> students identified by face recognition
          {students.length - identified > 0 && ` · ${students.length - identified} shown as Unknown`}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 animate-fade-up delay-2">
        {[
          {key:'all',     label:`All (${students.length})`    },
          {key:'present', label:`Present (${presentCount})`   },
          {key:'absent',  label:`Absent (${absentCount})`     },
        ].map(({key, label}) => (
          <button key={key} onClick={() => setFilter(key)}
            className="text-xs px-4 py-2 rounded-full font-semibold transition-all"
            style={filter === key
              ? {background:'linear-gradient(135deg,#3B82F6,#06B6D4)', color:'white'}
              : {background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', color:'var(--text-2)'}
            }>
            {label}
          </button>
        ))}
      </div>

      {/* Student grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-fade-up delay-3">
        {filtered.map((s) => {
          const present = s.attendanceStatus === 'present';
          const color   = present ? '#10B981' : '#EF4444';
          const signals = s.signalBreakdown;
          return (
            <div key={s._id}
              className="glass card-hover rounded-2xl p-5"
              style={{borderColor: present ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)'}}>

              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{
                      background: s.identified
                        ? 'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(6,182,212,0.2))'
                        : 'rgba(255,255,255,0.06)',
                      color: s.identified ? '#60A5FA' : 'var(--text-3)',
                    }}>
                    {s.identified ? s.name?.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">
                      {s.identified ? s.name : s.label}
                    </p>
                    {s.prn && (
                      <p className="text-xs mt-0.5 font-mono" style={{color:'var(--text-3)'}}>
                        {s.prn}
                      </p>
                    )}
                    {s.className && (
                      <p className="text-xs" style={{color:'var(--text-3)'}}>{s.className}</p>
                    )}
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${present ? 'badge-present' : 'badge-absent'}`}>
                  {present ? 'Present' : 'Absent'}
                </span>
              </div>

              {/* Score + signals */}
              <div className="flex items-center gap-4 mb-4">
                <ScoreGauge score={s.engagementScore} />
                <div className="flex-1 space-y-2">
                  {signals && (
                    <>
                      <SignalBar label="Gaze"      value={signals.gazeAvg}        color="#3B82F6" />
                      <SignalBar label="Head Pose" value={signals.headPoseAvg}    color="#06B6D4" />
                      <SignalBar label="Eye Open"  value={signals.eyeOpenAvg}     color="#8B5CF6" />
                      <SignalBar label="Face"      value={signals.faceVisibleAvg} color="#F59E0B" />
                    </>
                  )}
                </div>
              </div>

              {/* Frame count */}
              <div className="flex items-center justify-between pt-3"
                style={{borderTop:'1px solid var(--border)'}}>
                <span className="text-xs" style={{color:'var(--text-3)'}}>
                  {s.attentiveFrames} / {s.totalFrames} frames attentive
                </span>
                <span className="text-xs font-mono font-semibold" style={{color}}>
                  {s.engagementScore.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-3xl mb-2">🔍</p>
          <p style={{color:'var(--text-2)'}}>No students in this category.</p>
        </div>
      )}
    </div>
  );
}
