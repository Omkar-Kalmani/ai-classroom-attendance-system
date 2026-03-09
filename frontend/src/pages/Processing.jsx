import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionsAPI } from '../services/api';
import { joinSession, leaveSession, onProgress, onComplete, onError } from '../services/socket';

const steps = [
  { label: 'Video loaded',          threshold: 5  },
  { label: 'Detecting faces',       threshold: 25 },
  { label: 'Analyzing engagement',  threshold: 55 },
  { label: 'Identifying students',  threshold: 80 },
  { label: 'Saving results',        threshold: 95 },
];

export default function Processing() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [progress,      setProgress]      = useState(0);
  const [studentsFound, setStudentsFound] = useState(0);
  const [message,       setMessage]       = useState('Initializing AI engine...');
  const [status,        setStatus]        = useState('processing');
  const [errorMsg,      setErrorMsg]      = useState('');
  const [sessionName,   setSessionName]   = useState('');
  const [completedData, setCompletedData] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    sessionsAPI.getOne(id).then(r => setSessionName(r.data.session.name)).catch(console.error);

    joinSession(id);

    const unsubProgress = onProgress((d) => {
      setProgress(d.progress);
      setStudentsFound(d.studentsFound);
      setMessage(d.message);
    });

    const unsubComplete = onComplete((d) => {
      setProgress(100);
      setStatus('complete');
      setCompletedData(d);
      setStudentsFound(d.totalStudents);
      setTimeout(() => navigate(`/sessions/${id}/results`), 3000);
    });

    const unsubError = onError((d) => {
      setStatus('error');
      setErrorMsg(d.error);
    });

    if (!started.current) {
      started.current = true;
      sessionsAPI.process(id)
        .then(() => setMessage('AI is analyzing your video...'))
        .catch(err => { setStatus('error'); setErrorMsg(err.response?.data?.message || 'Failed to start'); });
    }

    return () => { unsubProgress(); unsubComplete(); unsubError(); leaveSession(id); };
  }, [id]);

  return (
    <div className="p-8 flex items-center justify-center min-h-[80vh]">
      <div className="w-full max-w-lg">

        {/* Main card */}
        <div className="glass-2 rounded-3xl p-8 text-center animate-fade-up">

          {/* Animated icon */}
          <div className="flex justify-center mb-6">
            {status === 'complete' ? (
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl glow-green"
                style={{background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.3)'}}>
                ✅
              </div>
            ) : status === 'error' ? (
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
                style={{background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)'}}>
                ❌
              </div>
            ) : (
              <div className="relative w-20 h-20">
                {/* Outer ring */}
                <div className="absolute inset-0 rounded-full animate-spin-slow"
                  style={{border:'2px solid transparent',borderTopColor:'#3B82F6',borderRightColor:'#06B6D4'}} />
                {/* Inner ring */}
                <div className="absolute inset-2 rounded-full animate-spin"
                  style={{border:'2px solid transparent', borderTopColor:'rgba(59,130,246,0.3)', animationDirection:'reverse', animationDuration:'1.5s'}} />
                {/* Center */}
                <div className="absolute inset-4 rounded-full flex items-center justify-center glow-blue"
                  style={{background:'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(6,182,212,0.2))'}}>
                  <span className="text-lg">🤖</span>
                </div>
              </div>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">
            {status === 'complete' ? 'Analysis Complete!' : status === 'error' ? 'Processing Failed' : 'AI Analyzing Video'}
          </h1>
          <p className="text-sm mb-6" style={{color:'var(--text-2)'}}>{sessionName}</p>

          {/* Progress bar */}
          {status !== 'error' && (
            <div className="mb-6">
              <div className="flex justify-between text-xs mb-2">
                <span style={{color:'var(--text-2)'}}>{message}</span>
                <span className="font-mono font-bold gradient-text">{progress}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,0.06)'}}>
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    status === 'complete' ? '' : 'progress-shimmer'
                  }`}
                  style={{
                    width: `${progress}%`,
                    background: status === 'complete' ? 'linear-gradient(90deg,#10B981,#34D399)' : undefined
                  }}
                />
              </div>
              {studentsFound > 0 && (
                <p className="text-xs mt-2" style={{color:'var(--text-3)'}}>
                  {studentsFound} student{studentsFound !== 1 ? 's' : ''} detected
                </p>
              )}
            </div>
          )}

          {/* Steps */}
          {status !== 'error' && (
            <div className="text-left space-y-2.5 mb-6">
              {steps.map((step, i) => {
                const done   = progress >= step.threshold;
                const active = progress >= (steps[i-1]?.threshold ?? 0) && progress < step.threshold;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 transition-all ${
                      done
                        ? 'glow-green'
                        : active
                        ? 'animate-pulse-glow'
                        : ''
                    }`}
                      style={{
                        background: done ? 'rgba(16,185,129,0.2)' : active ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${done ? 'rgba(16,185,129,0.4)' : active ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)'}`,
                        color: done ? '#34D399' : active ? '#60A5FA' : 'var(--text-3)',
                      }}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className="text-sm" style={{color: done ? 'var(--text-1)' : active ? '#93C5FD' : 'var(--text-3)'}}>
                      {step.label}
                    </span>
                    {active && <span className="ml-auto text-xs animate-pulse" style={{color:'#60A5FA'}}>running...</span>}
                    {done   && <span className="ml-auto text-xs" style={{color:'#34D399'}}>done</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Complete stats */}
          {status === 'complete' && completedData && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Students',  value: completedData.totalStudents  },
                { label: 'Present',   value: completedData.presentCount,  color: '#34D399' },
                { label: 'Absent',    value: completedData.absentCount,   color: '#FC8181' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl p-3" style={{background:'rgba(255,255,255,0.05)'}}>
                  <div className="text-xl font-extrabold" style={{color: color || 'var(--text-1)'}}>{value}</div>
                  <div className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="rounded-xl px-4 py-3 mb-5 text-sm text-left"
              style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',color:'#FC8181'}}>
              {errorMsg}
            </div>
          )}

          {/* Footer */}
          {status === 'complete' && (
            <p className="text-xs" style={{color:'var(--text-3)'}}>Redirecting to results in 3 seconds...</p>
          )}
          {status === 'error' && (
            <div className="flex gap-3">
              <button onClick={() => navigate('/')}
                className="flex-1 py-2.5 rounded-xl text-sm transition-all"
                style={{border:'1px solid var(--border)',color:'var(--text-2)'}}>
                Go Home
              </button>
              <button onClick={() => window.location.reload()}
                className="flex-1 py-2.5 rounded-xl text-sm btn-primary">
                Retry
              </button>
            </div>
          )}
          {status === 'processing' && (
            <p className="text-xs" style={{color:'var(--text-3)'}}>
              Keep this page open. Processing takes a few minutes depending on video length.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
