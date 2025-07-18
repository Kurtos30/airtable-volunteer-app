import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CalendarPage from './pages/CalendarPage';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import AdminEventsPage from './pages/AdminEventsPage';
import AdminAddEventPage from './pages/AdminAddEventPage';
import AdminRoosterPage from './pages/AdminRoosterPage';
import './App.css';

// 1. Maak de Theme Context
const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

// 2. Maak de Theme Provider Component
const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Separate component that uses useLocation inside Router context
function AppContent() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user data is in localStorage on initial load
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLoginSuccess = (loggedInUser) => {
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  const handleUserUpdate = (updatedUser) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <div className="app-container">
      {user && (
        <div className="header">
          <p>Ingelogd als: {user.Roepnaam}</p>
          <button onClick={handleLogout} className="logout-button">Uitloggen</button>
        </div>
      )}
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <LoginPage onLoginSuccess={handleLoginSuccess} />}
        />
        <Route
          path="/"
          element={
            !user ? <Navigate to="/login" /> : 
            user.isAdmin ? <Navigate to="/admin" /> : 
            <HomePage user={user} />
          }
        />
        <Route
          path="/kalender"
          element={user ? <CalendarPage user={user} onUserUpdate={handleUserUpdate} /> : <Navigate to="/login" />}
        />
        <Route
          path="/profiel"
          element={user ? <ProfilePage user={user} onUserUpdate={handleUserUpdate} /> : <Navigate to="/login" />}
        />
        <Route
          path="/admin"
          element={user && user.isAdmin ? <AdminPage /> : <Navigate to="/" />}
        />
        <Route
          path="/admin/events"
          element={user && user.isAdmin ? <AdminEventsPage /> : <Navigate to="/" />}
        />
        <Route
          path="/admin/add-event"
          element={user && user.isAdmin ? <AdminAddEventPage /> : <Navigate to="/" />}
        />
        <Route
          path="/admin/rooster"
          element={user ? <AdminRoosterPage user={user} /> : <Navigate to="/login" />}
        />
      </Routes>
      {/* Sticky bottom nav alleen als user is ingelogd - REMOVED */}
      {/* {user && (
        <nav className="bottom-nav">
          <Link to="/" className={`bottom-nav__item${location.pathname === '/' ? ' bottom-nav__item--active' : ''}`}>🏠<span>Home</span></Link>
          <Link to="/kalender" className={`bottom-nav__item${location.pathname.startsWith('/kalender') ? ' bottom-nav__item--active' : ''}`}>📅<span>Kalender</span></Link>
          <Link to="/profiel" className={`bottom-nav__item${location.pathname.startsWith('/profiel') ? ' bottom-nav__item--active' : ''}`}>👤<span>Profiel</span></Link>
          <Link to="/admin/rooster" className={`bottom-nav__item${location.pathname.startsWith('/admin/rooster') ? ' bottom-nav__item--active' : ''}`}>🗂️<span>Rooster</span></Link>
        </nav>
      )} */}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}

export default App; 