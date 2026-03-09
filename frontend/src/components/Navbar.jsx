import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { teacher, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) =>
    location.pathname === path
      ? 'text-blue-600 font-semibold border-b-2 border-blue-600'
      : 'text-slate-600 hover:text-blue-600';

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">AI</span>
          </div>
          <span className="font-bold text-slate-800 text-lg">AttendAI</span>
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-8">
          <Link to="/"           className={`text-sm pb-1 transition-all ${isActive('/')}`}>Dashboard</Link>
          <Link to="/students"   className={`text-sm pb-1 transition-all ${isActive('/students')}`}>Students</Link>
          <Link to="/sessions/new" className={`text-sm pb-1 transition-all ${isActive('/sessions/new')}`}>New Session</Link>
        </div>

        {/* Teacher info + logout */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-800">{teacher?.name}</p>
            <p className="text-xs text-slate-400">{teacher?.institution}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-500 hover:text-red-500 transition-colors border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded-lg"
          >
            Logout
          </button>
        </div>

      </div>
    </nav>
  );
}
