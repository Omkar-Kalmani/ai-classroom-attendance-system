import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  {
    to: '/', label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    to: '/students', label: 'Students',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    to: '/sessions/new', label: 'New Session',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    ),
  },
];

export default function Sidebar() {
  const { teacher, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(path);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 flex flex-col z-40"
      style={{background:'var(--navy-2)', borderRight:'1px solid var(--border)'}}>

      {/* Logo */}
      <div className="px-6 py-6 border-b" style={{borderColor:'var(--border)'}}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center glow-blue flex-shrink-0"
            style={{background:'linear-gradient(135deg,#3B82F6,#06B6D4)'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <p className="font-bold text-sm gradient-text">AttendAI</p>
            <p className="text-xs" style={{color:'var(--text-3)'}}>v1.0</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        <p className="text-xs font-semibold uppercase tracking-widest px-3 mb-3" style={{color:'var(--text-3)'}}>
          Navigation
        </p>
        {navItems.map(({ to, label, icon }) => (
          <Link key={to} to={to}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
              isActive(to)
                ? 'nav-active'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}>
            <span className={`transition-colors ${isActive(to) ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
              {icon}
            </span>
            {label}
            {isActive(to) && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
            )}
          </Link>
        ))}
      </nav>

      {/* AI Status indicator */}
      <div className="px-4 py-3 mx-3 mb-3 rounded-xl" style={{background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.15)'}}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-medium" style={{color:'#34D399'}}>AI Engine Active</span>
        </div>
        <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>DeepFace + MediaPipe</p>
      </div>

      {/* Teacher profile */}
      <div className="p-4 border-t" style={{borderColor:'var(--border)'}}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{background:'linear-gradient(135deg,#3B82F6,#06B6D4)'}}>
            {teacher?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{teacher?.name}</p>
            <p className="text-xs truncate" style={{color:'var(--text-3)'}}>{teacher?.institution}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full text-xs py-2 rounded-lg transition-all text-slate-400 hover:text-red-400 hover:bg-red-400/10"
          style={{border:'1px solid var(--border)'}}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
