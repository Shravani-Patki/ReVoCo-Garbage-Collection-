import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import VoiceLanguageControls from './components/VoiceLanguageControls';

import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import UserDashboard from './pages/UserDashboard';
import MunicipalityDashboard from './pages/MunicipalityDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ProfilePage from './pages/ProfilePage';
import LotTrackingPage from './pages/LotTrackingPage';
import { MarketRoleDashboard } from './pages/WasteMarketplace';
import { t, useI18n } from "./i18n";

const DASHBOARD_LINKS = {
  citizen: { path: '/user', label: 'User Portal' },
  society: { path: '/society', label: 'Company Portal' },
  municipality: { path: '/municipality', label: 'Municipality Portal' },
  community_helper: { path: '/community', label: 'Collector Portal' },
  admin: { path: '/admin', label: 'Admin Panel' },
};

// Re-reads user from localStorage on every route change
function Navbar() {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('revoco-user-changed'));
    window.location.href = '/';
  };

  const dashLink = user && DASHBOARD_LINKS[user.role];

  return (
    <nav className="navbar">
      <Link to="/" className="nav-logo">{t("ReVoCo")}</Link>
      <div className="nav-links">
        <VoiceLanguageControls />
        {!user && <Link to="/" className="nav-link">{t("Home")}</Link>}
        {!user && <Link to="/login" className="nav-link">{t("Login")}</Link>}
        {user && dashLink && (
          <Link to={dashLink.path} className="nav-link">{t(dashLink.label)}</Link>
        )}
        {user && (
          <>
            <Link to="/profile" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--color-primary)', color: 'white',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '0.85rem'
              }}>
                {user.username?.charAt(0).toUpperCase()}
              </span>{t("Profile")}</Link>
            <button
              onClick={handleLogout}
              className="btn"
              style={{ background: 'transparent', color: 'var(--color-danger)', fontWeight: 600, padding: '8px 16px' }}
            >{t("Logout")}</button>
          </>
        )}
      </div>
    </nav>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/track/:token" element={<LotTrackingPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/user/*" element={user && user.role === 'citizen' ? <UserDashboard /> : <Login />} />
        <Route path="/society/*" element={user && user.role === 'society' ? <MarketRoleDashboard role="company" /> : <Login />} />
        <Route path="/municipality/*" element={user && user.role === 'municipality' ? <MunicipalityDashboard /> : <Login />} />
        <Route path="/community/*" element={user && user.role === 'community_helper' ? <MarketRoleDashboard role="collector" /> : <Login />} />
        <Route path="/admin/*" element={user && user.role === 'admin' ? <AdminDashboard /> : <Login />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  useI18n();
  return (
    <Router>
      <Navbar />
      <main>
        <AnimatedRoutes />
      </main>
      <ToastContainer
        position="bottom-right"
        theme="light"
        toastStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-dark)' }}
      />
    </Router>
  );
}

export default App;
