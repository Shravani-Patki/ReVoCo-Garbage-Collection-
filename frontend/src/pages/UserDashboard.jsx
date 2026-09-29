import React, { useState, useEffect, useRef } from 'react';
import {
    Home, Camera, MapPin, CheckCircle, TrendingUp, Activity,
    Users, Award, Map as MapIcon, Megaphone, Upload,
    Heart, Coins, Navigation, FileText, Star, Trophy, Truck
} from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { UserWastePanel } from './WasteMarketplace';
import { formatCurrency, formatDate, formatNumber, t } from "../i18n";

const BASE = 'http://127.0.0.1:5000';

const pageVariants = {
    initial: { opacity: 0, y: 10 },
    in: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    out: { opacity: 0, y: -10, transition: { duration: 0.2 } }
};

// Convert a File object to a base64 data URL
const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

const UserDashboard = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [activeTab, setActiveTab] = useState('home');

    // ── state: report ──
    const [reportImage, setReportImage] = useState(null);      // File
    const [reportImagePreview, setReportImagePreview] = useState('');
    // reportLocation will hold { lat, lng, label, city, state, address_text }
    const [reportLocation, setReportLocation] = useState(null);
    const [gettingLocation, setGettingLocation] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [grievances, setGrievances] = useState([]);
    const [grievanceFilter, setGrievanceFilter] = useState('all');

    // ── state: society ──
    const [societyStatus, setSocietyStatus] = useState(null);
    const [societyData, setSocietyData] = useState(null);
    const [joinCode, setJoinCode] = useState('');
    const [announcements, setAnnouncements] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);

    // ── state: classify ──
    const [classifyImage, setClassifyImage] = useState(null);
    const [classifyPreview, setClassifyPreview] = useState('');
    const [classifyResult, setClassifyResult] = useState(null);
    const [classifying, setClassifying] = useState(false);

    // ── state: achievements ──
    const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
    const [topCount, setTopCount] = useState(0);

    // ── state: stats ──
    const [userStats, setUserStats] = useState({ casesReported: 0, wasteRecycled: 0, credits: 0, cityScore: user.city_score || 0 });

    // ── state: contribute ──
    const [donateAmount, setDonateAmount] = useState('');
    const [donating, setDonating] = useState(false);
    const [poolBalance, setPoolBalance] = useState(0);

    // Refs for file inputs
    const reportFileRef = useRef();
    const classifyFileRef = useRef();

    useEffect(() => {
        const fetchAll = () => {
            fetchUserData();
            fetchGlobalLeaderboard();
        };
        fetchAll();
        const intervalId = setInterval(fetchAll, 10000);
        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        if (activeTab === 'report') {
            fetchGrievances();
            const intervalId = setInterval(fetchGrievances, 10000);
            return () => clearInterval(intervalId);
        }
    }, [grievanceFilter, activeTab]);

    const fetchUserData = async () => {
        try {
            const res = await axios.get(`${BASE}/api/waste/issues?user_id=${user.id}&status=all`);
            const reports = res.data;
            let recycled = 0, credits = 0;
            reports.forEach(r => {
                if (r.status === 'verified' || r.status === 'collected') {
                    recycled += r.volume_estimated;
                    credits += r.volume_estimated * 0.5;
                }
            });
            setUserStats(prev => ({ ...prev, casesReported: reports.length, wasteRecycled: recycled, credits }));
        } catch (e) { console.error(e); }
    };

    const fetchGrievances = async () => {
        try {
            const url = grievanceFilter === 'me'
                ? `${BASE}/api/waste/issues?user_id=${user.id}&status=all`
                : `${BASE}/api/waste/issues?status=all`;
            const res = await axios.get(url);
            setGrievances(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchSocietyInfo = async () => {
        try {
            const res = await axios.get(`${BASE}/api/society/member/${user.id}`);
            if (res.data.length > 0) {
                const m = res.data[0];
                setSocietyStatus(m.status);
                setSocietyData(m);
                if (m.status === 'accepted') {
                    const [aRes, lRes] = await Promise.all([
                        axios.get(`${BASE}/api/society/${m.society_id}/announcements`),
                        axios.get(`${BASE}/api/society/${m.society_id}/leaderboard`),
                    ]);
                    setAnnouncements(aRes.data);
                    setLeaderboard(lRes.data);
                }
            } else { setSocietyStatus('none'); }
        } catch (e) { console.error(e); }
    };

    const fetchGlobalLeaderboard = async () => {
        try {
            const res = await axios.get(`${BASE}/api/gamification/leaderboard/contributors`);
            setGlobalLeaderboard(res.data);
            const count = res.data.filter((u, i) => i < 3 && u.username === user.username).length;
            setTopCount(count); // simplified: check if user appears in top 3
        } catch (e) { console.error(e); }
    };

    const handleJoinSociety = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${BASE}/api/society/join`, { user_id: user.id, society_code: joinCode });
            toast.success(t("Join request sent!"));
            fetchSocietyInfo();
        } catch (e) { toast.error(e.response?.data?.error || 'Error joining society'); }
    };

    // Live location
    const handleGetLocation = () => {
        if (!navigator.geolocation) { toast.error(t("Geolocation not supported")); return; }
        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                // Reverse geocode with nominatim (free, no key needed)
                let label = `${formatNumber(lat, { maximumFractionDigits: 5 })}, ${formatNumber(lng, { maximumFractionDigits: 5 })}`;
                let city = '';
                let state = '';
                try {
                    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
                    const d = await r.json();
                    label = d.display_name || label;
                    city = d.address?.city || d.address?.town || d.address?.village || d.address?.county || '';
                    state = d.address?.state || '';
                } catch (_) { }
                setReportLocation({ lat, lng, label, city, state, address_text: label });
                setGettingLocation(false);
                toast.success(t("Location captured!"));
            },
            () => { toast.error(t("Could not get location. Please allow GPS access.")); setGettingLocation(false); }
        );
    };

    const handleReportImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setReportImage(file);
        setReportImagePreview(URL.createObjectURL(file));
    };

    const handleReportSubmit = async (e) => {
        e.preventDefault();
        if (!reportLocation) { toast.error(t("Please capture your location first")); return; }
        setIsSubmitting(true);
        const toastId = toast.loading(t("Submitting report..."));
        try {
            let imageUrl = '';
            if (reportImage) imageUrl = await fileToBase64(reportImage);
            const res = await axios.post(`${BASE}/api/waste/report`, {
                user_id: user.id,
                image_url: imageUrl,
                latitude: reportLocation.lat,
                longitude: reportLocation.lng,
                address_text: reportLocation.address_text || reportLocation.label,
                city: reportLocation.city,
                state: reportLocation.state
            });
            toast.update(toastId, { render: `✅ Report logged! Target capacity calculated.`, type: 'success', isLoading: false, autoClose: 4000 });
            setReportImage(null); setReportImagePreview(''); setReportLocation(null);
            fetchGrievances(); fetchUserData();
        } catch (err) {
            toast.update(toastId, { render: t("Failed to submit report"), type: 'error', isLoading: false, autoClose: 3000 });
        } finally { setIsSubmitting(false); }
    };

    const handleVerifyCompletion = async (issueId) => {
        try {
            await axios.post(`${BASE}/api/waste/${issueId}/verify`, { status: 'verified' });
            toast.success(t("Cleanup verified! Rewards distributed."));
            fetchGrievances();
            fetchUserData();
        } catch (err) {
            toast.error(t("Failed to verify cleanup."));
        }
    };

    const handleClassifyImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setClassifyImage(file);
        setClassifyPreview(URL.createObjectURL(file));
        setClassifyResult(null);
    };

    const handleClassify = async (e) => {
        e.preventDefault();
        if (!classifyImage) { toast.error(t("Please select an image first")); return; }
        setClassifying(true);
        const toastId = toast.loading(t("🤖 AI is analysing your waste..."));
        try {
            const base64 = await fileToBase64(classifyImage);
            const res = await axios.post(`${BASE}/api/classify`, { image: base64 });
            setClassifyResult(res.data);
            toast.update(toastId, { render: `✅ Classified as ${res.data.category}!`, type: 'success', isLoading: false, autoClose: 3000 });
        } catch (err) {
            toast.update(toastId, { render: err.response?.data?.error || 'Classification failed', type: 'error', isLoading: false, autoClose: 3000 });
        } finally {
            setClassifying(false);
        }
    };

    const handleDonate = async (e) => {
        e.preventDefault();
        if (!donateAmount || Number(donateAmount) <= 0) { toast.error(t("Enter a valid amount")); return; }
        setDonating(true);
        const toastId = toast.loading(t("Processing donation..."));
        try {
            const res = await axios.post(`${BASE}/api/gamification/donate`, { amount: Number(donateAmount), user_id: user.id });
            setPoolBalance(res.data.total_pool);
            toast.update(toastId, { render: t('💚 Thank you! {{amount}} donated. Pool: {{total}}', { amount: formatCurrency(donateAmount), total: formatCurrency(res.data.total_pool) }), type: 'success', isLoading: false, autoClose: 4000 });
            setDonateAmount('');
        } catch (err) {
            toast.update(toastId, { render: t("Donation failed"), type: 'error', isLoading: false, autoClose: 3000 });
        } finally { setDonating(false); }
    };

    // Is this user a top performer? (appears in global top 3)
    const isTopPerformer = globalLeaderboard.slice(0, 3).some(u => u.username === user.username);
    const userRank = globalLeaderboard.findIndex(u => u.username === user.username) + 1;

    const navItems = [
        { id: 'home', label: 'Home', icon: Home },
        { id: 'classify', label: 'Classify Waste', icon: Camera },
        { id: 'pickup', label: 'Request Pickup', icon: Truck },
        { id: 'estimate', label: 'Weight Estimate', icon: Activity },
        { id: 'rates', label: 'Waste Rates', icon: Coins },
        { id: 'drives', label: 'E-waste Drives', icon: Megaphone },
        { id: 'report', label: 'Report', icon: MapIcon },
    ];

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
            {/* ── Sidebar ── */}
            <div style={{ width: '280px', background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)', height: 'calc(100vh - 80px)', position: 'sticky', top: '80px', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 16 }}>{t("Citizen Portal")}</div>
                {navItems.map(item => (
                    <button key={item.id} onClick={() => setActiveTab(item.id)}
                        style={{ width: '100%', textAlign: 'left', padding: '12px 16px', borderRadius: 12, background: activeTab === item.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: activeTab === item.id ? 'var(--color-primary)' : 'var(--color-text-dark)', fontWeight: activeTab === item.id ? 700 : 500, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s', fontSize: '1rem', marginBottom: 4 }}>
                        <item.icon size={18} /> {t(item.label)}
                    </button>
                ))}
                <div style={{ flex: 1 }} />
                <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: 16, borderRadius: 16, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{t("City Score")}</div>
                    <div style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '1.6rem' }}>{formatNumber(userStats.cityScore)} <span style={{ fontSize: '1rem', color: 'var(--color-text-light)' }}>{t('pts')}</span></div>
                    <div style={{ background: 'var(--color-border)', borderRadius: 99, height: 6, marginTop: 12 }}>
                        <div style={{ width: `${Math.min((userStats.cityScore / 200) * 100, 100)}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 99 }} />
                    </div>
                </div>
            </div>

            {/* ── Main Content ── */}
            <motion.div style={{ flex: 1, padding: '48px', overflowY: 'auto' }} initial="initial" animate="in" exit="out" variants={pageVariants}>
                {/* Top bar */}
                <div className="flex-between" style={{ marginBottom: 40, background: 'var(--color-surface)', padding: '16px 32px', borderRadius: 99, boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ color: 'var(--color-text-light)', fontSize: '0.95rem' }}>{t("Citizen Portal /")}{' '}<strong style={{ color: 'var(--color-text-dark)' }}>{navItems.find(n => n.id === activeTab)?.label}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-dark)' }}>{user.username}</div>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                            {user.username?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </div>

                {/* ── HOME TAB ── */}
                {activeTab === 'home' && (
                    <>
                        <div className="grid-3" style={{ marginBottom: 40 }}>
                            {[
                                { label: 'Cases Reported', val: formatNumber(userStats.casesReported), sub: 'Total reports filed', color: 'var(--color-primary)', icon: FileText },
                                { label: 'Waste Recycled', val: `${formatNumber(userStats.wasteRecycled, { maximumFractionDigits: 2 })} kg`, sub: 'Diverted from landfills', color: 'var(--color-secondary)', icon: TrendingUp },
                                { label: 'Credits Earned', val: formatCurrency(userStats.credits), sub: 'Redeemable balance', color: 'var(--color-success)', icon: Coins },
                            ].map(item => (
                                <div key={t(item.label)} className="card" style={{ boxShadow: 'var(--shadow-md)', borderTop: `4px solid ${item.color}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 1 }}>{t(item.label)}</div>
                                        <div style={{ background: `${item.color}15`, padding: 8, borderRadius: 10 }}><item.icon size={18} color={item.color} /></div>
                                    </div>
                                    <div style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--color-text-dark)', lineHeight: 1 }}>{item.val}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', marginTop: 10 }}>{item.sub}</div>
                                </div>
                            ))}
                        </div>
                        <div className="grid-2">
                            <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                                <h3 style={{ fontSize: '1.4rem', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ background: 'rgba(245,158,11,0.1)', padding: 10, borderRadius: 12 }}><Award size={22} color="var(--color-warning)" /></div>{t("Rank & Level")}</h3>
                                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                    <span className="badge badge-warning" style={{ fontSize: '1rem', padding: '10px 20px' }}>{t("Level 4: Eco Warrior")}</span>
                                </div>
                                <div style={{ background: 'var(--color-bg)', padding: 24, borderRadius: 16 }}>
                                    <div className="flex-between" style={{ marginBottom: 12 }}>
                                        <span style={{ fontWeight: 600 }}>{t("Progress to Level 5")}</span>
                                        <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{formatNumber(userStats.cityScore)}{' '}{t('/ 200 XP')}</span>
                                    </div>
                                    <div style={{ background: 'var(--color-border)', borderRadius: 99, height: 10 }}>
                                        <div style={{ width: `${Math.min((userStats.cityScore / 200) * 100, 100)}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 99 }} />
                                    </div>
                                </div>
                            </div>
                            <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                                <h3 style={{ fontSize: '1.4rem', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ background: 'rgba(16,185,129,0.1)', padding: 10, borderRadius: 12 }}><TrendingUp size={22} color="var(--color-primary)" /></div>{t("Quick Stats")}</h3>
                                {[
                                    { label: 'Global Rank', val: userRank > 0 ? `#${formatNumber(userRank)}` : 'Unranked', color: 'var(--color-warning)' },
                                    { label: 'Total Reports', val: formatNumber(userStats.casesReported), color: 'var(--color-primary)' },
                                    { label: 'Waste Diverted', val: `${formatNumber(userStats.wasteRecycled, { maximumFractionDigits: 2 })} kg`, color: 'var(--color-secondary)' },
                                    { label: 'Credits Balance', val: formatCurrency(userStats.credits), color: 'var(--color-success)' },
                                ].map(item => (
                                    <div key={t(item.label)} className="flex-between" style={{ padding: '14px 0', borderBottom: '1px solid var(--color-border)' }}>
                                        <span style={{ color: 'var(--color-text-light)', fontWeight: 500 }}>{t(item.label)}</span>
                                        <strong style={{ color: item.color, fontSize: '1.1rem' }}>{item.val}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* ── SOCIETY TAB ── */}
                {activeTab === 'society' && (
                    <div>
                        {societyStatus === 'none' && (
                            <div className="card" style={{ maxWidth: 560, margin: '0 auto', boxShadow: 'var(--shadow-md)', padding: '48px 40px', textAlign: 'center' }}>
                                <div style={{ background: 'rgba(52,211,153,0.1)', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                                    <Users size={40} color="var(--color-primary)" />
                                </div>
                                <h3 style={{ fontSize: '2rem', marginBottom: 16 }}>{t("Join a Society")}</h3>
                                <p style={{ marginBottom: 32, fontSize: '1.05rem', color: 'var(--color-text-light)' }}>{t("Enter your Society ID to connect with your local community.")}</p>
                                <form onSubmit={handleJoinSociety}>
                                    <input type="text" className="form-input" placeholder={t("e.g. SOC123")} value={joinCode} onChange={e => setJoinCode(e.target.value)} required style={{ marginBottom: 16, textAlign: 'center', padding: '16px', fontSize: '1.1rem', background: 'var(--color-bg)' }} />
                                    <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}>{t("Request Access")}</button>
                                </form>
                            </div>
                        )}
                        {societyStatus === 'pending' && (
                            <div className="card" style={{ maxWidth: 560, margin: '0 auto', boxShadow: 'var(--shadow-md)', padding: '48px 40px', textAlign: 'center' }}>
                                <div style={{ background: 'rgba(245,158,11,0.1)', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                                    <Activity size={40} color="var(--color-warning)" />
                                </div>
                                <h3 style={{ fontSize: '2rem', marginBottom: 16 }}>{t("Membership Pending")}</h3>
                                <p style={{ color: 'var(--color-text-light)', fontSize: '1.05rem' }}>{t("Awaiting administrator approval for")}{' '}<strong>{t("#")}{societyData?.society_code}</strong>{t(".")}</p>
                            </div>
                        )}
                        {societyStatus === 'accepted' && (
                            <div className="grid-2">
                                <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, fontSize: '1.4rem' }}>
                                        <div style={{ background: 'rgba(239,68,68,0.1)', padding: 8, borderRadius: 12 }}><Megaphone size={22} color="var(--color-danger)" /></div>{t("Announcements")}</h3>
                                    {announcements.length === 0 ? <p style={{ color: 'var(--color-text-light)' }}>{t("No broadcasts at this time.")}</p> : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            {announcements.map(a => (
                                                <div key={a.id} style={{ padding: '20px', background: 'var(--color-bg)', borderRadius: 16, borderLeft: '4px solid var(--color-primary)' }}>
                                                    <p style={{ margin: 0, color: 'var(--color-text-dark)', lineHeight: 1.6 }}>{t("\"")}{t(a.message)}{t("\"")}</p>
                                                    <div style={{ marginTop: 10, fontSize: '0.85rem', color: 'var(--color-text-light)' }}>{formatDate(a.created_at)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, fontSize: '1.4rem' }}>
                                        <div style={{ background: 'rgba(16,185,129,0.1)', padding: 8, borderRadius: 12 }}><Award size={22} color="var(--color-primary)" /></div>{t("Society Leaderboard")}</h3>
                                    {leaderboard.length === 0 ? <p style={{ color: 'var(--color-text-light)' }}>{t("No members yet.")}</p> : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {leaderboard.map((u, i) => (
                                                <div key={u.user_id} className="flex-between" style={{ padding: '14px 18px', background: i === 0 ? 'rgba(16,185,129,0.05)' : 'var(--color-bg)', borderRadius: 14, border: i === 0 ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--color-border)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: i === 0 ? 'var(--color-warning)' : 'var(--color-border)', color: i === 0 ? 'white' : 'var(--color-text-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{i + 1}</div>
                                                        <span style={{ fontWeight: 600 }}>{u.username} {user.id === u.user_id && <span style={{ color: 'var(--color-primary)', fontSize: '0.85rem' }}>{t("(You)")}</span>}</span>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontWeight: 800 }}>{formatNumber(u.total_recycled_volume, { maximumFractionDigits: 1 })}{' '}{t('kg')}</div>
                                                        <div style={{ fontSize: '0.82rem', color: 'var(--color-primary)' }}>{formatNumber(u.city_score, { maximumFractionDigits: 2 })}{' '}{t("pts")}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── ACHIEVEMENTS TAB ── */}
                {activeTab === 'achievements' && (
                    <div>
                        {/* Scorecard */}
                        <div className="grid-3" style={{ marginBottom: 32 }}>
                            <div className="card" style={{ boxShadow: 'var(--shadow-md)', borderTop: '4px solid var(--color-warning)', textAlign: 'center' }}>
                                <Trophy size={36} color="var(--color-warning)" style={{ margin: '0 auto 12px' }} />
                                <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--color-text-dark)' }}>{userRank > 0 ? `#${formatNumber(userRank)}` : '—'}</div>
                                <div style={{ color: 'var(--color-text-light)', marginTop: 8, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Global Rank")}</div>
                            </div>
                            <div className="card" style={{ boxShadow: 'var(--shadow-md)', borderTop: '4px solid var(--color-primary)', textAlign: 'center' }}>
                                <Star size={36} color="var(--color-primary)" style={{ margin: '0 auto 12px' }} />
                                <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--color-text-dark)' }}>{topCount}</div>
                                <div style={{ color: 'var(--color-text-light)', marginTop: 8, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Times Top Scorer")}</div>
                            </div>
                            <div className="card" style={{ boxShadow: 'var(--shadow-md)', borderTop: '4px solid var(--color-success)', textAlign: 'center' }}>
                                <Coins size={36} color="var(--color-success)" style={{ margin: '0 auto 12px' }} />
                                <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--color-success)' }}>{formatCurrency(userStats.credits)}</div>
                                <div style={{ color: 'var(--color-text-light)', marginTop: 8, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Credits Balance")}</div>
                            </div>
                        </div>

                        {/* Certificate — only for top performers */}
                        {isTopPerformer ? (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ boxShadow: 'var(--shadow-lg)', textAlign: 'center', padding: '48px' }}>
                                <div style={{ background: 'rgba(245,158,11,0.1)', width: 100, height: 100, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                                    <Award size={50} color="var(--color-warning)" />
                                </div>
                                <h2 style={{ fontSize: '2rem', marginBottom: 8 }}>{t("🏆 Top Performer")}</h2>
                                <h4 style={{ color: 'var(--color-text-light)', marginBottom: 32, fontWeight: 500 }}>{t("Monthly Environmental Certification")}</h4>
                                <div style={{ padding: '32px', background: 'var(--color-bg)', border: '2px dashed var(--color-warning)', borderRadius: 24, maxWidth: 500, margin: '0 auto' }}>
                                    <p style={{ color: 'var(--color-text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.85rem' }}>{t("Certificate of Excellence awarded to")}</p>
                                    <h3 style={{ color: 'var(--color-text-dark)', margin: '16px 0', fontSize: '2.2rem' }}>{user.username}</h3>
                                    <p style={{ color: 'var(--color-text-light)', lineHeight: 1.7 }}>{t('For ranking')}{' '}<strong style={{ color: 'var(--color-warning)' }}>{t('#')}{formatNumber(userRank)}</strong>{' '}{t('globally on the ReVoCo platform — an outstanding contribution to sustainable waste management.')}</p>
                                </div>
                                <div style={{ marginTop: 32 }}>
                                    <button className="btn btn-primary" style={{ padding: '14px 32px', fontSize: '1.05rem' }}>{t('Withdraw {{amount}}', { amount: formatCurrency(userStats.credits) })}</button>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="card" style={{ boxShadow: 'var(--shadow-md)', textAlign: 'center', padding: '48px' }}>
                                <div style={{ background: 'rgba(16,185,129,0.08)', width: 90, height: 90, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                                    <Trophy size={44} color="var(--color-text-light)" />
                                </div>
                                <h3 style={{ fontSize: '1.8rem', marginBottom: 12, color: 'var(--color-text-dark)' }}>{t("Keep Going!")}</h3>
                                <p style={{ color: 'var(--color-text-light)', fontSize: '1.1rem', maxWidth: 440, margin: '0 auto 28px', lineHeight: 1.7 }}>{t("You're currently ranked")}{' '}<strong style={{ color: 'var(--color-text-dark)' }}>{userRank > 0 ? `#${formatNumber(userRank)}` : t('unranked')}</strong>{' '}{t("globally. Reach the top 3 to earn your Excellence Certificate and unlock withdrawal access.")}</p>
                                <div style={{ background: 'var(--color-bg)', padding: '16px 24px', borderRadius: 12, display: 'inline-block', fontSize: '0.95rem', color: 'var(--color-text-light)' }}>{t("🎯 Report more verified waste to climb the ranks!")}</div>
                            </div>
                        )}

                        {/* Global Leaderboard preview */}
                        {globalLeaderboard.length > 0 && (
                            <div className="card" style={{ boxShadow: 'var(--shadow-md)', marginTop: 24 }}>
                                <h3 style={{ fontSize: '1.3rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <Trophy size={20} color="var(--color-warning)" />{' '}{t("Global Top Performers")}</h3>
                                {globalLeaderboard.slice(0, 5).map((u, i) => (
                                    <div key={i} className="flex-between" style={{ padding: '14px 0', borderBottom: '1px solid var(--color-border)', background: u.username === user.username ? 'rgba(16,185,129,0.04)' : 'transparent', paddingLeft: u.username === user.username ? 12 : 0, paddingRight: 12, borderRadius: u.username === user.username ? 8 : 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                            <span style={{ fontWeight: 800, color: i < 3 ? 'var(--color-warning)' : 'var(--color-text-light)', width: 24 }}>{t("#")}{i + 1}</span>
                                            <span style={{ fontWeight: 600 }}>{u.username} {u.username === user.username && <span style={{ color: 'var(--color-primary)', fontSize: '0.83rem' }}>{t("(You)")}</span>}</span>
                                        </div>
                                        <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{formatCurrency(u.total_rewards)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── CLASSIFY WASTE TAB ── */}
                {activeTab === 'classify' && (
                    <div className="card" style={{ maxWidth: 640, margin: '0 auto', boxShadow: 'var(--shadow-md)', padding: '48px 40px' }}>
                        <div style={{ textAlign: 'center', marginBottom: 40 }}>
                            <div style={{ background: 'rgba(16,185,129,0.1)', width: 80, height: 80, borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                <Camera size={40} color="var(--color-primary)" />
                            </div>
                            <h2 style={{ fontSize: '2rem', marginBottom: 12 }}>{t("Classify Waste")}</h2>
                            <p style={{ color: 'var(--color-text-light)', fontSize: '1.05rem' }}>{t("Upload a photo of waste and our AI will categorize it for you.")}</p>
                        </div>

                        <form onSubmit={handleClassify}>
                            {/* Upload Area */}
                            <input type="file" accept="image/*" ref={classifyFileRef} style={{ display: 'none' }} onChange={handleClassifyImageChange} />
                            <div
                                onClick={() => classifyFileRef.current?.click()}
                                style={{ border: '2px dashed var(--color-border)', borderRadius: 20, padding: '40px', textAlign: 'center', cursor: 'pointer', marginBottom: 24, background: classifyPreview ? 'transparent' : 'var(--color-bg)', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}
                            >
                                {classifyPreview ? (
                                    <img src={classifyPreview} alt={t("Preview")} style={{ maxHeight: 240, maxWidth: '100%', borderRadius: 12, objectFit: 'contain' }} />
                                ) : (
                                    <>
                                        <Upload size={40} color="var(--color-text-light)" style={{ margin: '0 auto 12px' }} />
                                        <p style={{ color: 'var(--color-text-light)', margin: 0 }}>{t("Click to upload an image")}</p>
                                        <p style={{ color: 'var(--color-border)', fontSize: '0.85rem', marginTop: 4 }}>{t("JPG, PNG, WEBP supported")}</p>
                                    </>
                                )}
                            </div>
                            {classifyPreview && (
                                <button type="button" onClick={() => { setClassifyImage(null); setClassifyPreview(''); setClassifyResult(null); }}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--color-text-light)', cursor: 'pointer', fontSize: '0.9rem', marginBottom: 16, display: 'block' }}>{t("× Remove image")}</button>
                            )}
                            <button type="submit" className="btn btn-primary" disabled={!classifyImage || classifying}
                                style={{ width: '100%', padding: '18px', fontSize: '1.1rem' }}>
                                {classifying ? 'Analyzing...' : 'Classify Waste'}
                            </button>
                        </form>

                        {classifyResult && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                style={{ marginTop: 32, padding: 32, background: `${classifyResult.category_color}10`, borderRadius: 24, border: `2px solid ${classifyResult.category_color}40` }}>

                                {/* Category Header */}
                                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                    <div style={{ fontSize: '3.5rem', marginBottom: 8 }}>{classifyResult.category_emoji}</div>
                                    <h3 style={{ marginBottom: 4, fontSize: '1rem', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 1.5 }}>{t("Detected Item")}</h3>
                                    <div style={{ fontWeight: 800, fontSize: '1.6rem', color: 'var(--color-text-dark)', textTransform: 'capitalize', marginBottom: 4 }}>{classifyResult.raw_class}</div>
                                    <span style={{ background: classifyResult.category_color, color: 'white', padding: '6px 18px', borderRadius: 99, fontWeight: 700, fontSize: '1rem' }}>
                                        {classifyResult.category_emoji} {classifyResult.category}
                                    </span>
                                </div>

                                {/* Confidence Bar */}
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: 6 }}>
                                        <span>{t("Confidence")}</span>
                                        <strong style={{ color: classifyResult.category_color }}>{classifyResult.confidence}{t("%")}</strong>
                                    </div>
                                    <div style={{ background: 'var(--color-border)', borderRadius: 99, height: 10, overflow: 'hidden' }}>
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${classifyResult.confidence}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
                                            style={{ height: '100%', background: classifyResult.category_color, borderRadius: 99 }} />
                                    </div>
                                </div>

                                {/* Bin Color */}
                                <div style={{ background: 'var(--color-bg)', borderRadius: 14, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ fontSize: '1.5rem' }}>{t("🗑️")}</div>
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--color-text-dark)' }}>{t("Dispose in:")}{' '}<span style={{ color: classifyResult.category_color }}>{classifyResult.bin_color}{' '}{t("Bin")}</span></div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-light)', marginTop: 2 }}>{t("Check your local Municipal guidelines")}</div>
                                    </div>
                                </div>

                                {/* Disposal Tips */}
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--color-text-dark)', marginBottom: 10, fontSize: '0.95rem' }}>{t("♻️ Safe Disposal Tips")}</div>
                                    <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {classifyResult.disposal_tips.map((tip, i) => (
                                            <li key={i} style={{ color: 'var(--color-text-light)', lineHeight: 1.6, fontSize: '0.92rem' }}>{tip}</li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Top-3 alternatives */}
                                {classifyResult.top3 && classifyResult.top3.length > 1 && (
                                    <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{t("Top Predictions")}</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {classifyResult.top3.map((alt, i) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: i === 0 ? 'var(--color-text-dark)' : 'var(--color-text-light)', fontWeight: i === 0 ? 700 : 400 }}>
                                                    <span style={{ textTransform: 'capitalize' }}>{i + 1}{t(".")}{' '}{t(alt.label)}</span>
                                                    <span>{alt.confidence}{t("%")}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>
                )}

                {/* ── REPORT TAB ── */}
                {['pickup', 'estimate', 'rates', 'drives'].includes(activeTab) && (
                    <UserWastePanel user={user} activeTab={activeTab} />
                )}

                {/* ── REPORT TAB ── */}
                {activeTab === 'report' && (
                    <div className="grid-2">
                        {/* Report Form */}
                        <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, fontSize: '1.5rem' }}>
                                <div style={{ background: 'rgba(16,185,129,0.1)', padding: 8, borderRadius: 12 }}><FileText size={22} color="var(--color-primary)" /></div>{t("Report Waste")}</h3>
                            <form onSubmit={handleReportSubmit}>
                                {/* Image Upload */}
                                <div className="form-group" style={{ marginBottom: 24 }}>
                                    <label className="form-label">{t("Upload Waste Photo")}</label>
                                    <input type="file" accept="image/*" ref={reportFileRef} style={{ display: 'none' }} onChange={handleReportImageChange} />
                                    <div onClick={() => reportFileRef.current?.click()}
                                        style={{ border: '2px dashed var(--color-border)', borderRadius: 16, padding: reportImagePreview ? '8px' : '28px', textAlign: 'center', cursor: 'pointer', background: 'var(--color-bg)', transition: 'all 0.2s' }}>
                                        {reportImagePreview ? (
                                            <img src={reportImagePreview} alt={t("Preview")} style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 10, objectFit: 'contain' }} />
                                        ) : (
                                            <>
                                                <Upload size={28} color="var(--color-text-light)" style={{ margin: '0 auto 8px' }} />
                                                <p style={{ color: 'var(--color-text-light)', margin: 0, fontSize: '0.95rem' }}>{t("Click to upload photo (optional)")}</p>
                                            </>
                                        )}
                                    </div>
                                    {reportImagePreview && (
                                        <button type="button" onClick={() => { setReportImage(null); setReportImagePreview(''); }}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--color-text-light)', cursor: 'pointer', fontSize: '0.85rem', marginTop: 6 }}>{t("× Remove")}</button>
                                    )}
                                </div>

                                {/* Location */}
                                <div className="form-group" style={{ marginBottom: 28 }}>
                                    <label className="form-label">{t("Location")}</label>
                                    {reportLocation ? (
                                        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                            <MapPin size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                                            <div style={{ width: '100%' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.85rem', marginBottom: 8 }}>{t("Location Captured")}</div>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={reportLocation.address_text}
                                                    onChange={(e) => setReportLocation({ ...reportLocation, address_text: e.target.value })}
                                                    placeholder={t("Enter exact address (optional)")}
                                                    style={{ width: '100%', marginBottom: 12, padding: '10px', fontSize: '0.9rem' }}
                                                />
                                                <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        value={reportLocation.city}
                                                        onChange={(e) => setReportLocation({ ...reportLocation, city: e.target.value })}
                                                        placeholder={t("City")}
                                                        style={{ flex: 1, padding: '10px', fontSize: '0.9rem' }}
                                                        required
                                                    />
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        value={reportLocation.state}
                                                        onChange={(e) => setReportLocation({ ...reportLocation, state: e.target.value })}
                                                        placeholder={t("State")}
                                                        style={{ width: '100px', padding: '10px', fontSize: '0.9rem' }}
                                                        required
                                                    />
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', lineHeight: 1.5 }}>{t('GPS:')}{' '}{formatNumber(reportLocation.lat, { maximumFractionDigits: 5 })}{t(",")}{' '}{formatNumber(reportLocation.lng, { maximumFractionDigits: 5 })}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <button type="button" onClick={handleGetLocation} disabled={gettingLocation}
                                            className="btn btn-outline"
                                            style={{ width: '100%', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: '1rem' }}>
                                            <Navigation size={18} />
                                            {gettingLocation ? 'Getting location...' : 'Use My Current Location'}
                                        </button>
                                    )}
                                    {reportLocation && (
                                        <button type="button" onClick={() => setReportLocation(null)}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--color-text-light)', cursor: 'pointer', fontSize: '0.85rem', marginTop: 6 }}>{t("× Change location")}</button>
                                    )}
                                </div>

                                <button type="submit" className="btn btn-primary" disabled={isSubmitting || !reportLocation}
                                    style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}>
                                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
                                </button>
                            </form>
                        </div>

                        {/* Reported Cases Feed */}
                        <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                            <div className="flex-between" style={{ marginBottom: 24 }}>
                                <h3 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ background: 'rgba(15,23,42,0.08)', padding: 8, borderRadius: 12 }}><MapIcon size={22} color="var(--color-secondary)" /></div>{t("Reported Cases")}</h3>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className={`btn ${grievanceFilter === 'all' ? 'btn-secondary' : 'btn-outline'}`} style={{ padding: '8px 14px', fontSize: '0.88rem' }} onClick={() => setGrievanceFilter('all')}>{t("All")}</button>
                                    <button className={`btn ${grievanceFilter === 'me' ? 'btn-secondary' : 'btn-outline'}`} style={{ padding: '8px 14px', fontSize: '0.88rem' }} onClick={() => setGrievanceFilter('me')}>{t("Mine")}</button>
                                </div>
                            </div>

                            <div style={{ background: 'var(--color-bg)', borderRadius: 16, border: '1px solid var(--color-border)', minHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
                                {grievances.length === 0 ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-light)' }}>{t("No waste reports yet.")}</div>
                                ) : grievances.map(g => {
                                    const statusColors = {
                                        reported: { border: '#F59E0B', bg: 'rgba(245,158,11,0.06)', badge: 'badge-warning' },
                                        seen: { border: '#0EA5E9', bg: 'rgba(14,165,233,0.06)', badge: 'badge-secondary' },
                                        assigned: { border: '#10B981', bg: 'rgba(16,185,129,0.06)', badge: 'badge-primary' },
                                        completed: { border: '#6366F1', bg: 'rgba(99,102,241,0.06)', badge: 'badge-primary' },
                                        verified: { border: '#10B981', bg: 'rgba(16,185,129,0.1)', badge: 'badge-success' },
                                    };
                                    const sc = statusColors[g.status] || statusColors.reported;

                                    return (
                                        <div key={g.id} style={{ padding: '16px 20px', borderRadius: 14, borderLeft: `5px solid ${sc.border}`, background: sc.bg, boxShadow: 'var(--shadow-sm)' }}>
                                            {/* Header */}
                                            <div className="flex-between" style={{ marginBottom: 8 }}>
                                                <div style={{ fontWeight: 700, color: 'var(--color-text-dark)', fontSize: '1rem' }}>{t("Case #")}{g.id}
                                                </div>
                                                <span className={`badge ${sc.badge}`} style={{ textTransform: 'capitalize' }}>
                                                    {t(g.status)}
                                                </span>
                                            </div>
                                            {/* Location */}
                                            <div style={{ fontSize: '0.88rem', color: 'var(--color-text-light)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <MapPin size={14} />
                                                {g.address_text || `${g.city || ''} (${formatNumber(g.latitude, { maximumFractionDigits: 4 })}, ${formatNumber(g.longitude, { maximumFractionDigits: 4 })})`}
                                            </div>

                                            {/* Status-specific context */}
                                            {g.status === 'reported' && (
                                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', padding: '8px 12px', background: 'rgba(245,158,11,0.08)', borderRadius: 8 }}>{t("⏳ Waiting for municipality to acknowledge your report.")}</div>
                                            )}
                                            {g.status === 'seen' && (
                                                <div style={{ fontSize: '0.85rem', color: '#0EA5E9', padding: '8px 12px', background: 'rgba(14,165,233,0.08)', borderRadius: 8, fontWeight: 600 }}>{t("✅ Municipality has acknowledged your report and will assign a cleanup helper soon.")}</div>
                                            )}
                                            {(g.status === 'assigned' || g.status === 'completed') && g.assigned_name && (
                                                <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.1)', borderRadius: 10, marginBottom: 10, border: '1px solid rgba(16,185,129,0.2)' }}>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{t("👷 Assigned Worker")}</div>
                                                    <div style={{ fontWeight: 700, color: 'var(--color-text-dark)', fontSize: '1rem' }}>{g.assigned_name}</div>
                                                    {g.assigned_phone && (
                                                        <div style={{ fontSize: '0.9rem', color: 'var(--color-primary)', marginTop: 4 }}>{t("📞")}{' '}{g.assigned_phone}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {g.status === 'completed' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                                    {g.completed_image_url && (
                                                        <a href={g.completed_image_url} target="_blank" rel="noreferrer"
                                                            style={{ fontSize: '0.85rem', color: 'var(--color-secondary)', textDecoration: 'underline' }}>{t("📷 View Cleanup Photo")}</a>
                                                    )}
                                                    <button className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.9rem', background: 'var(--color-success)', marginLeft: 'auto' }} onClick={() => handleVerifyCompletion(g.id)}>{t("✅ Verify Cleanup Done")}</button>
                                                </div>
                                            )}
                                            {g.status === 'verified' && (
                                                <div style={{ fontSize: '0.88rem', color: 'var(--color-success)', fontWeight: 600, padding: '8px 12px', background: 'rgba(16,185,129,0.1)', borderRadius: 8 }}>{t("🎉 Verified! You earned points for this report. Thank you for keeping your city clean!")}</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── CONTRIBUTE TAB ── */}
                {activeTab === 'contribute' && (
                    <div className="grid-2">
                        <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                            <h3 style={{ fontSize: '1.5rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ background: 'rgba(236,72,153,0.1)', padding: 10, borderRadius: 12 }}><Heart size={22} color="#EC4899" /></div>{t("Donate to the Pool")}</h3>
                            <p style={{ color: 'var(--color-text-light)', marginBottom: 32, lineHeight: 1.7 }}>{t("Your donation funds the reward pool that pays citizens for verified waste reports. Every rupee contributes to a cleaner community.")}</p>
                            <div style={{ background: 'linear-gradient(135deg, #10B981, #059669)', borderRadius: 20, padding: '24px', color: 'white', marginBottom: 32 }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.85, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{t("Current Pool Balance")}</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: 4 }}>{formatCurrency(poolBalance)}</div>
                                <div style={{ opacity: 0.8, marginTop: 4, fontSize: '0.95rem' }}>{t("Available for contributors")}</div>
                            </div>
                            <form onSubmit={handleDonate}>
                                <div className="form-group" style={{ marginBottom: 16 }}>
                                    <label className="form-label">{t("Amount (₹)")}</label>
                                    <input type="number" className="form-input" placeholder={t("e.g. 100")} min="1" value={donateAmount} onChange={e => setDonateAmount(e.target.value)} required style={{ padding: '16px 20px', fontSize: '1.1rem', background: 'var(--color-bg)' }} />
                                </div>
                                {/* Quick amount presets */}
                                <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                                    {[50, 100, 250, 500].map(amt => (
                                        <button key={amt} type="button" onClick={() => setDonateAmount(String(amt))}
                                            className="btn btn-outline"
                                            style={{ flex: 1, padding: '10px 8px', fontSize: '0.95rem', borderColor: donateAmount === String(amt) ? 'var(--color-primary)' : 'var(--color-border)', color: donateAmount === String(amt) ? 'var(--color-primary)' : 'var(--color-text-light)', background: donateAmount === String(amt) ? 'rgba(16,185,129,0.05)' : 'transparent' }}>{formatCurrency(amt)}
                                        </button>
                                    ))}
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={donating} style={{ width: '100%', padding: '16px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                    <Heart size={18} /> {donating ? t('Processing...') : t('Donate {{amount}}', { amount: donateAmount ? formatCurrency(donateAmount) : '...' })}
                                </button>
                            </form>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                                <h3 style={{ fontSize: '1.3rem', marginBottom: 20 }}>{t("Why Donate?")}</h3>
                                {[
                                    { icon: Coins, title: 'Directly Rewards Citizens', desc: 'Donations go straight into the pool that pays verified waste reporters.', color: '#10B981' },
                                    { icon: TrendingUp, title: 'Built-in Transparency', desc: 'Every transaction is public. Pool balance is displayed live on the homepage.', color: '#6366F1' },
                                    { icon: Trophy, title: 'Donor Leaderboard', desc: 'Top donors are celebrated on the public Hall of Fame on our homepage.', color: '#F59E0B' },
                                ].map(item => (
                                    <div key={t(item.title)} style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <item.icon size={20} color={item.color} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, color: 'var(--color-text-dark)', marginBottom: 4 }}>{t(item.title)}</div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-light)', lineHeight: 1.6 }}>{t(item.desc)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default UserDashboard;
