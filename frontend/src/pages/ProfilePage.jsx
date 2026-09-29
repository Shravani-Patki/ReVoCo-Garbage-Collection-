import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Shield, LogOut, Edit3 } from 'lucide-react';
import { t } from "../i18n";

const ROLE_LABEL = {
    citizen: { label: 'Citizen', color: '#10B981' },
    society: { label: 'Society Admin', color: '#0EA5E9' },
    community_helper: { label: 'Community Helper', color: '#F59E0B' },
    municipality: { label: 'Municipality Officer', color: '#EF4444' },
    admin: { label: 'Platform Admin', color: '#1F2937' },
};

const DASHBOARD_LINKS = {
    citizen: '/user',
    society: '/society',
    community_helper: '/community',
    municipality: '/municipality',
    admin: '/admin',
};

const ProfilePage = () => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const roleInfo = ROLE_LABEL[user.role] || { label: user.role, color: 'var(--color-primary)' };
    const dashboardPath = DASHBOARD_LINKS[user.role] || '/user';

    const handleLogout = () => {
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('revoco-user-changed'));
        navigate('/');
    };

    if (!user || !user.id) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
                <div className="card" style={{ padding: '48px', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
                    <h3 style={{ marginBottom: 16 }}>{t("You are not logged in.")}</h3>
                    <Link to="/login" className="btn btn-primary" style={{ padding: '14px 32px' }}>{t("Go to Login")}</Link>
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 720, margin: '60px auto', padding: '0 24px' }}>
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                {/* Header Card */}
                <div className="card" style={{ boxShadow: 'var(--shadow-lg)', padding: '48px 40px', marginBottom: 24, borderTop: `5px solid ${roleInfo.color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginBottom: 40, flexWrap: 'wrap' }}>
                        <div style={{ width: 90, height: 90, borderRadius: '50%', background: `${roleInfo.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.8rem', fontWeight: 900, color: roleInfo.color, border: `3px solid ${roleInfo.color}30`, flexShrink: 0 }}>
                            {user.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-dark)', margin: 0, marginBottom: 8 }}>{user.username}</h1>
                            <span style={{ background: `${roleInfo.color}18`, color: roleInfo.color, padding: '6px 16px', borderRadius: 99, fontSize: '0.9rem', fontWeight: 700, display: 'inline-block' }}>
                                {t(roleInfo.label)}
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {[
                            { icon: User, label: 'Username', value: user.username },
                            { icon: Mail, label: 'Email Address', value: user.email || '—' },
                            { icon: Phone, label: 'Contact Number', value: user.phone || 'Not provided' },
                            { icon: Shield, label: 'Account Role', value: roleInfo.label },
                        ].map(item => (
                            <div key={t(item.label)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'var(--color-bg)', borderRadius: 14, border: '1px solid var(--color-border)' }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${roleInfo.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <item.icon size={18} color={roleInfo.color} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{t(item.label)}</div>
                                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-dark)' }}>{item.value}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 16 }}>
                    <Link to={dashboardPath} className="btn btn-primary" style={{ flex: 1, padding: '16px', fontSize: '1rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Edit3 size={18} />{' '}{t("Go to Dashboard")}</Link>
                    <button className="btn btn-outline" onClick={handleLogout} style={{ flex: 1, padding: '16px', fontSize: '1rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <LogOut size={18} />{' '}{t("Logout")}</button>
                </div>
            </motion.div>
        </div>
    );
};

export default ProfilePage;
