import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { connectSocket, disconnectSocket, joinTeacherRoom } from '../services/socket';

// ─────────────────────────────────────────────────────────────
//  AuthContext
//  Stores teacher login state and makes it available
//  to every page and component in the app.
//
//  Usage in any component:
//    const { teacher, login, logout, loading } = useAuth();
// ─────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [teacher, setTeacher]   = useState(null);
  const [loading, setLoading]   = useState(true);  // True while checking if logged in

  // ── On app load — check if already logged in ─────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authAPI.getMe()
        .then(res => {
          setTeacher(res.data.teacher);
          // Connect socket and join teacher room for notifications
          connectSocket();
          joinTeacherRoom(res.data.teacher._id);
        })
        .catch(() => {
          // Token invalid — clear it
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // ── Login ─────────────────────────────────────────────────
  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { token, teacher: teacherData } = res.data;

    localStorage.setItem('token', token);
    setTeacher(teacherData);

    // Connect socket after login
    connectSocket();
    joinTeacherRoom(teacherData._id);

    return teacherData;
  };

  // ── Register ──────────────────────────────────────────────
  const register = async (data) => {
    const res = await authAPI.register(data);
    const { token, teacher: teacherData } = res.data;

    localStorage.setItem('token', token);
    setTeacher(teacherData);

    connectSocket();
    joinTeacherRoom(teacherData._id);

    return teacherData;
  };

  // ── Logout ────────────────────────────────────────────────
  const logout = () => {
    localStorage.removeItem('token');
    setTeacher(null);
    disconnectSocket();
  };

  return (
    <AuthContext.Provider value={{ teacher, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook — use this in any component
export const useAuth = () => useContext(AuthContext);
