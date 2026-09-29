import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Users, IndianRupee, Server, Database, Activity, ShieldCheck, Home, Trash2, FolderEdit, Map as MapIcon } from 'lucide-react';
import { toast } from 'react-toastify';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { formatCurrency, t, formatNumber } from "../i18n";

// Fix for default Leaflet marker icons in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const userIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const wasteIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const pageVariants = {
    initial: { opacity: 0, x: -20 },
    in: { opacity: 1, x: 0, transition: { duration: 0.4 } },
    out: { opacity: 0, x: 20, transition: { duration: 0.2 } }
};

const volumeData = [
    { name: 'Mon', volume: 400 },
    { name: 'Tue', volume: 300 },
    { name: 'Wed', volume: 550 },
    { name: 'Thu', volume: 480 },
    { name: 'Fri', volume: 600 },
    { name: 'Sat', volume: 380 },
    { name: 'Sun', volume: 430 },
];

const AdminDashboard = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [activeTab, setActiveTab] = useState('overview');

    // Stats state
    const [stats, setStats] = useState({ pool_balance: 0, total_volume_reduced: 0, total_donations: 0, total_rewards_given: 0 });

    // Entities state
    const [users, setUsers] = useState([]);
    const [societies, setSocieties] = useState([]);
    const [wasteIssues, setWasteIssues] = useState([]);

    useEffect(() => {
        const fetchAll = () => {
            fetchStats();
            if (activeTab === 'users' || activeTab === 'maps') fetchUsers();
            if (activeTab === 'societies') fetchSocieties();
            if (activeTab === 'waste' || activeTab === 'maps') fetchWasteIssues();
        };
        fetchAll();
        const intervalId = setInterval(fetchAll, 10000);
        return () => clearInterval(intervalId);
    }, [activeTab]);

    const fetchStats = async () => {
        try {
            const res = await axios.get('http://127.0.0.1:5000/api/gamification/stats');
            setStats(res.data);
        } catch (err) { }
    };

    const fetchUsers = async () => {
        try {
            const res = await axios.get('http://127.0.0.1:5000/api/admin/users');
            setUsers(res.data);
        } catch (e) { toast.error(t("Failed to fetch users")); }
    };

    const fetchSocieties = async () => {
        try {
            const res = await axios.get('http://127.0.0.1:5000/api/admin/societies');
            setSocieties(res.data);
        } catch (e) { toast.error(t("Failed to fetch societies")); }
    };

    const fetchWasteIssues = async () => {
        try {
            const res = await axios.get('http://127.0.0.1:5000/api/waste/issues?status=all');
            setWasteIssues(res.data);
        } catch (e) { toast.error(t("Failed to fetch waste issues")); }
    };

    // Deletion Handlers
    const deleteUser = async (id) => {
        if (!window.confirm(`Delete user ${id}? This cannot be undone.`)) return;
        try {
            await axios.delete(`http://127.0.0.1:5000/api/admin/users/${id}`);
            toast.success(t("User purged from system"));
            fetchUsers();
        } catch (e) { toast.error(t("Failed to delete user")); }
    };

    const deleteSociety = async (id) => {
        if (!window.confirm(`Delete society ${id}?`)) return;
        try {
            await axios.delete(`http://127.0.0.1:5000/api/admin/societies/${id}`);
            toast.success(t("Society deleted"));
            fetchSocieties();
        } catch (e) { toast.error(t("Failed to delete society")); }
    };

    const deleteWasteReport = async (id) => {
        if (!window.confirm(`Delete report ${id}?`)) return;
        try {
            await axios.delete(`http://127.0.0.1:5000/api/admin/waste/${id}`);
            toast.success(t("Waste report deleted"));
            fetchWasteIssues();
        } catch (e) { toast.error(t("Failed to delete report")); }
    };

    const handleSimulateDonation = async () => {
        const toastId = toast.loading(t("Transmitting funds to the global pool..."));
        try {
            await axios.post('http://127.0.0.1:5000/api/gamification/donate', { amount: 10000 });
            toast.update(toastId, { render: t("Injection Successful: +₹10,000 received."), type: "success", isLoading: false, autoClose: 3000 });
            fetchStats();
        } catch (e) {
            toast.update(toastId, { render: t("Transaction failed."), type: "error", isLoading: false, autoClose: 3000 });
        }
    };

    const navItems = [
        { id: 'overview', label: 'Network Overview', icon: Home },
        { id: 'users', label: 'User Directory', icon: Users },
        { id: 'societies', label: 'Registered Societies', icon: FolderEdit },
        { id: 'waste', label: 'Waste Intel', icon: Trash2 },
        { id: 'maps', label: 'Global Intel Map', icon: MapIcon },
    ];

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
            {/* Sidebar */}
            <div style={{ width: '280px', background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)', height: 'calc(100vh - 80px)', position: 'sticky', top: '80px', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 16 }}>{t("Root Navigation")}</div>
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            style={{ width: '100%', textAlign: 'left', padding: '12px 16px', borderRadius: 12, background: activeTab === item.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: activeTab === item.id ? 'var(--color-primary)' : 'var(--color-text-dark)', fontWeight: activeTab === item.id ? 700 : 500, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s', marginBottom: 4, fontSize: '1rem' }}
                        >
                            <item.icon size={18} />
                            {t(item.label)}
                        </button>
                    ))}
                </div>

                <div style={{ flex: 1 }} />

                <div style={{ background: 'rgba(15, 23, 42, 0.03)', padding: 16, borderRadius: 16, border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-success)', fontWeight: 700, marginBottom: 8 }}>
                        <ShieldCheck size={18} />{' '}{t("Root Authorized")}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>{t("All critical systems currently responding normally.")}</div>
                </div>
            </div>

            {/* Main Content */}
            <motion.div style={{ flex: 1, padding: '48px', maxWidth: 1200 }} initial="initial" animate="in" exit="out" variants={pageVariants}>

                {/* Top Bar */}
                <div className="flex-between" style={{ marginBottom: 40, background: 'var(--color-surface)', padding: '16px 32px', borderRadius: 99, boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ color: 'var(--color-text-light)', fontSize: '0.95rem' }}>{t("Admin /")}{' '}<strong style={{ color: 'var(--color-text-dark)' }}>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ display: 'flex', gap: 16, marginRight: 16 }}>
                            <div className="badge badge-success flex-center" style={{ gap: 6, padding: '6px 12px' }}><Activity size={14} />{' '}{t("Node Active")}</div>
                            <div className="badge badge-primary flex-center" style={{ gap: 6, padding: '6px 12px' }}><Database size={14} />{' '}{t("DB Synced")}</div>
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-dark)' }}>{user.username || 'Admin'}</div>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-text-dark)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                            {user.username?.charAt(0).toUpperCase() || 'A'}
                        </div>
                    </div>
                </div>

                {activeTab === 'overview' && (
                    <motion.div variants={pageVariants} initial="initial" animate="in" exit="out">
                        {/* KPI Cards */}
                        <div className="grid-3" style={{ marginBottom: 40 }}>
                            <motion.div className="card" style={{ boxShadow: 'var(--shadow-md)', borderTop: '4px solid var(--color-success)' }} whileHover={{ y: -5 }}>
                                <div className="flex-between">
                                    <h3 style={{ margin: 0, color: 'var(--color-text-light)', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Global Core Pool")}</h3>
                                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 8, borderRadius: 10 }}><IndianRupee size={20} color="var(--color-success)" /></div>
                                </div>
                                <motion.h1
                                    style={{ fontSize: '3rem', margin: '24px 0 0 0', color: 'var(--color-text-dark)' }}
                                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', delay: 0.1 }}
                                >
                                    {formatCurrency(stats.pool_balance)}
                                </motion.h1>
                            </motion.div>

                            <motion.div className="card" style={{ boxShadow: 'var(--shadow-md)', borderTop: '4px solid var(--color-secondary)' }} whileHover={{ y: -5 }}>
                                <div className="flex-between">
                                    <h3 style={{ margin: 0, color: 'var(--color-text-light)', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Waste Eradicated")}</h3>
                                    <div style={{ background: 'rgba(15, 23, 42, 0.1)', padding: 8, borderRadius: 10 }}><BarChart3 size={20} color="var(--color-secondary)" /></div>
                                </div>
                                <motion.h1
                                    style={{ fontSize: '3rem', margin: '24px 0 0 0', color: 'var(--color-text-dark)' }}
                                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', delay: 0.2 }}
                                >
                                    {formatNumber(stats.total_volume_reduced, { maximumFractionDigits: 2 })} <span style={{ fontSize: '1.2rem', color: 'var(--color-text-light)' }}>{t("kg")}</span>
                                </motion.h1>
                            </motion.div>

                            <motion.div className="card" style={{ boxShadow: 'var(--shadow-md)', borderTop: '4px solid var(--color-primary)' }} whileHover={{ y: -5 }}>
                                <div className="flex-between">
                                    <h3 style={{ margin: 0, color: 'var(--color-text-light)', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Tokens Dispersed")}</h3>
                                    <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: 8, borderRadius: 10 }}><Users size={20} color="var(--color-primary-dark)" /></div>
                                </div>
                                <motion.h1
                                    style={{ fontSize: '3rem', margin: '24px 0 0 0', color: 'var(--color-text-dark)' }}
                                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', delay: 0.3 }}
                                >
                                    {formatCurrency(stats.total_rewards_given)}
                                </motion.h1>
                            </motion.div>
                        </div>

                        {/* Charts & Controls */}
                        <div className="grid-2">
                            <motion.div className="card" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-md)' }}>
                                <h3 style={{ marginBottom: 32, fontSize: '1.4rem' }}>{t("Weekly Eradication Output (kg)")}</h3>
                                <div style={{ flex: 1, background: 'var(--color-bg)', padding: '24px 24px 24px 0', borderRadius: 16, border: '1px solid var(--color-border)' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={volumeData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                            <XAxis dataKey="name" stroke="var(--color-text-light)" axisLine={false} tickLine={false} dy={10} />
                                            <YAxis stroke="var(--color-text-light)" axisLine={false} tickLine={false} dx={-10} />
                                            <RechartsTooltip contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '12px', boxShadow: 'var(--shadow-lg)' }} itemStyle={{ color: 'var(--color-text-dark)', fontWeight: 600 }} />
                                            <Line type="monotone" dataKey="volume" stroke="var(--color-secondary)" strokeWidth={4} dot={{ r: 6, fill: 'var(--color-surface)', strokeWidth: 2, stroke: 'var(--color-secondary)' }} activeDot={{ r: 8, fill: 'var(--color-secondary)', stroke: 'white', strokeWidth: 2 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </motion.div>

                            <motion.div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                                <h3 style={{ marginBottom: 16, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: 10, borderRadius: 12 }}><Server size={24} color="var(--color-danger)" /></div>{t("Network Controls")}</h3>
                                <p style={{ color: 'var(--color-text-light)', fontSize: '1.05rem', lineHeight: 1.6 }}>{t("Elevated privileges granted. Manage user nodes, tweak algorithmic AI parameters, and inject mock capital for simulation testing.")}</p>

                                <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <motion.button className="btn btn-secondary" style={{ width: '100%', padding: '18px', fontSize: '1.1rem' }} onClick={() => setActiveTab('users')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>{t("Initialize User Purge / Management")}</motion.button>
                                    <motion.button
                                        className="btn btn-primary"
                                        style={{ width: '100%', padding: '18px', fontSize: '1.1rem', background: 'var(--color-success)', boxShadow: '0 8px 30px rgba(16, 185, 129, 0.4)' }}
                                        onClick={handleSimulateDonation}
                                        whileHover={{ scale: 1.02, background: '#059669' }}
                                        whileTap={{ scale: 0.98 }}
                                    >{t("Inject Capital: +₹10,000 to Global Pool")}</motion.button>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'users' && (
                    <motion.div variants={pageVariants} initial="initial" animate="in" exit="out" className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                        <h3 style={{ marginBottom: 24, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 8, borderRadius: 10 }}><Users size={20} color="var(--color-primary)" /></div>{t("User Directory")}</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: 'var(--color-bg)', borderBottom: '2px solid var(--color-border)' }}>
                                        <th style={{ padding: '16px', color: 'var(--color-text-light)', fontWeight: 600 }}>{t("ID")}</th>
                                        <th style={{ padding: '16px', color: 'var(--color-text-light)', fontWeight: 600 }}>{t("Username")}</th>
                                        <th style={{ padding: '16px', color: 'var(--color-text-light)', fontWeight: 600 }}>{t("Email")}</th>
                                        <th style={{ padding: '16px', color: 'var(--color-text-light)', fontWeight: 600 }}>{t("Role")}</th>
                                        <th style={{ padding: '16px', color: 'var(--color-text-light)', fontWeight: 600 }}>{t("Score")}</th>
                                        <th style={{ padding: '16px', color: 'var(--color-text-light)', fontWeight: 600 }}>{t("Actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: '16px', fontWeight: 600 }}>{t("#")}{u.id}</td>
                                            <td style={{ padding: '16px', fontWeight: 600 }}>{u.username}</td>
                                            <td style={{ padding: '16px', color: 'var(--color-text-light)' }}>{u.email}</td>
                                            <td style={{ padding: '16px' }}>
                                                <span className={`badge ${u.role === 'admin' ? 'badge-danger' : 'badge-primary'}`}>{u.role}</span>
                                            </td>
                                            <td style={{ padding: '16px', color: 'var(--color-success)', fontWeight: 700 }}>{formatNumber(u.city_score, { maximumFractionDigits: 2 })}</td>
                                            <td style={{ padding: '16px' }}>
                                                <button className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.85rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => deleteUser(u.id)}>{t("Purge")}</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && <tr><td colSpan="6" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-light)' }}>{t("No users found.")}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'societies' && (
                    <motion.div variants={pageVariants} initial="initial" animate="in" exit="out" className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                        <h3 style={{ marginBottom: 24, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: 8, borderRadius: 10 }}><FolderEdit size={20} color="var(--color-secondary)" /></div>{t("Registered Societies")}</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: 'var(--color-bg)', borderBottom: '2px solid var(--color-border)' }}>
                                        <th style={{ padding: '16px', color: 'var(--color-text-light)', fontWeight: 600 }}>{t("ID")}</th>
                                        <th style={{ padding: '16px', color: 'var(--color-text-light)', fontWeight: 600 }}>{t("Society Name")}</th>
                                        <th style={{ padding: '16px', color: 'var(--color-text-light)', fontWeight: 600 }}>{t("Root Code")}</th>
                                        <th style={{ padding: '16px', color: 'var(--color-text-light)', fontWeight: 600 }}>{t("Admin ID")}</th>
                                        <th style={{ padding: '16px', color: 'var(--color-text-light)', fontWeight: 600 }}>{t("Actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {societies.map(s => (
                                        <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: '16px', fontWeight: 600 }}>{t("#")}{s.id}</td>
                                            <td style={{ padding: '16px', fontWeight: 600 }}>{s.name}</td>
                                            <td style={{ padding: '16px' }}><span className="badge badge-primary">{s.society_code}</span></td>
                                            <td style={{ padding: '16px', color: 'var(--color-text-light)' }}>{t("User #")}{s.admin_id}</td>
                                            <td style={{ padding: '16px' }}>
                                                <button className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.85rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => deleteSociety(s.id)}>{t("Revoke")}</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {societies.length === 0 && <tr><td colSpan="5" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-light)' }}>{t("No societies currently registered.")}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'waste' && (
                    <motion.div variants={pageVariants} initial="initial" animate="in" exit="out" className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                        <h3 style={{ marginBottom: 24, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: 8, borderRadius: 10 }}><Trash2 size={20} color="var(--color-danger)" /></div>{t("Global Waste Intel Array")}</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: 'var(--color-bg)', borderBottom: '2px solid var(--color-border)' }}>
                                        <th style={{ padding: '16px', color: 'var(--color-text-light)', fontWeight: 600 }}>{t("Report ID")}</th>
                                        <th style={{ padding: '16px', color: 'var(--color-text-light)', fontWeight: 600 }}>{t("User ID")}</th>
                                        <th style={{ padding: '16px', color: 'var(--color-text-light)', fontWeight: 600 }}>{t("Est. Mass")}</th>
                                        <th style={{ padding: '16px', color: 'var(--color-text-light)', fontWeight: 600 }}>{t("Status")}</th>
                                        <th style={{ padding: '16px', color: 'var(--color-text-light)', fontWeight: 600 }}>{t("Actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {wasteIssues.map(w => (
                                        <tr key={w.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: '16px', fontWeight: 600 }}>{t("#")}{w.id}</td>
                                            <td style={{ padding: '16px', color: 'var(--color-text-light)' }}>{t("User #")}{w.user_id}</td>
                                            <td style={{ padding: '16px', fontWeight: 600 }}>{formatNumber(w.volume_estimated, { maximumFractionDigits: 2 })}{' '}{t("kg")}</td>
                                            <td style={{ padding: '16px' }}>
                                                <span className={`badge ${w.status === 'collected' ? 'badge-success' : w.status === 'verified' ? 'badge-primary' : 'badge-warning'}`}>{t(w.status)}</span>
                                            </td>
                                            <td style={{ padding: '16px' }}>
                                                <button className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.85rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => deleteWasteReport(w.id)}>{t("Scrub Log")}</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {wasteIssues.length === 0 && <tr><td colSpan="5" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-light)' }}>{t("No active signals.")}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'maps' && (
                    <motion.div variants={pageVariants} initial="initial" animate="in" exit="out" className="card" style={{ boxShadow: 'var(--shadow-md)', height: '70vh', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', zIndex: 10 }}>
                            <h3 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 8, borderRadius: 10 }}><MapIcon size={20} color="var(--color-primary)" /></div>{t("Global Spatial Intelligence")}</h3>
                            <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', color: 'var(--color-text-dark)' }}>
                                    <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png" alt={t("user")} style={{ height: 20 }} />{' '}{t("Registered Nodes")}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', color: 'var(--color-text-dark)' }}>
                                    <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png" alt={t("waste")} style={{ height: 20 }} />{' '}{t("Waste Signals")}</span>
                            </div>
                        </div>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <MapContainer center={[42.3314, -83.0458]} zoom={11} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                                <TileLayer
                                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                />
                                {users.filter(u => u.latitude && u.longitude).map(u => (
                                    <Marker key={`user-${u.id}`} position={[u.latitude, u.longitude]} icon={userIcon}>
                                        <Popup>
                                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-primary)' }}>{u.username}</div>
                                            <div style={{ color: 'var(--color-text-light)', marginTop: 4 }}>{t("Role:")}{' '}{u.role}</div>
                                            <div style={{ color: 'var(--color-text-light)', marginTop: 2 }}>{t("City Score:")}{' '}{formatNumber(u.city_score, { maximumFractionDigits: 2 })}{' '}{t("XP")}</div>
                                        </Popup>
                                    </Marker>
                                ))}
                                {wasteIssues.filter(w => w.latitude && w.longitude).map(w => (
                                    <Marker key={`waste-${w.id}`} position={[w.latitude, w.longitude]} icon={wasteIcon}>
                                        <Popup>
                                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-danger)' }}>{t("Waste Signal #")}{w.id}</div>
                                            <div style={{ color: 'var(--color-text-light)', marginTop: 4 }}>{t("Est. Volume:")}{' '}{formatNumber(w.volume_estimated, { maximumFractionDigits: 2 })}{t("kg")}</div>
                                            <div style={{ color: 'var(--color-text-light)', marginTop: 2 }}>{t("Status:")}{' '}<span style={{ textTransform: 'capitalize' }}>{t(w.status)}</span></div>
                                            {w.address_text && <div style={{ marginTop: 4, fontStyle: 'italic', fontSize: '0.85rem' }}>{w.address_text}</div>}
                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                        </div>
                    </motion.div>
                )}

            </motion.div>
        </div>
    );
};

export default AdminDashboard;
