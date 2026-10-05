import React, { useEffect, useState } from 'react';
import axios from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Megaphone, Trash2, LayoutDashboard, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'react-toastify';
import { formatDate, t, formatNumber } from "../i18n";

const pageVariants = {
    initial: { opacity: 0, x: -20 },
    in: { opacity: 1, x: 0, transition: { duration: 0.4 } },
    out: { opacity: 0, x: 20, transition: { duration: 0.2 } }
};

const SocietyDashboard = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [activeTab, setActiveTab] = useState('overview');

    // Society Data
    const [society, setSociety] = useState(null);
    const [members, setMembers] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [collectionRequests, setCollectionRequests] = useState([]);

    // Forms
    const [createSocietyData, setCreateSocietyData] = useState({ name: '', society_code: '' });
    const [announcementMsg, setAnnouncementMsg] = useState('');
    const [collectionDetails, setCollectionDetails] = useState('');

    const fetchSociety = async () => {
        try {
            const res = await axios.get(`/api/society/admin/${user.id}`);
            if (res.data.length > 0) {
                const soc = res.data[0];
                setSociety(soc);
                fetchSocietyContent(soc.id);
                fetchCollectionRequests(); // Fetch specifically for this society admin
            }
        } catch {
            console.error("No society found or error");
        }
    };

    useEffect(() => {
        fetchSociety();
        const intervalId = setInterval(fetchSociety, 10000);
        return () => clearInterval(intervalId);
    }, []);

    const fetchSocietyContent = async (societyId) => {
        try {
            const [mRes, aRes] = await Promise.all([
                axios.get(`/api/society/${societyId}/members`),
                axios.get(`/api/society/${societyId}/announcements`)
            ]);
            setMembers(mRes.data);
            setAnnouncements(aRes.data);
        } catch (err) {
            console.error("Failed to fetch society content", err);
        }
    };

    const fetchCollectionRequests = async () => {
        try {
            const res = await axios.get(`/api/waste/requests/society/${user.id}`);
            setCollectionRequests(res.data);
        } catch (err) {
            console.error("Failed to fetch requests", err);
        }
    };

    const handleCreateSociety = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/society/create', { ...createSocietyData, admin_id: user.id });
            toast.success(t("Society established successfully."));
            fetchSociety();
        } catch (err) {
            toast.error(err.response?.data?.error || "Error creating society");
        }
    };

    const handleUpdateMemberStatus = async (membershipId, status) => {
        try {
            await axios.put(`/api/society/membership/${membershipId}/status`, { status });
            toast.success(`Member request ${status}.`);
            fetchSocietyContent(society.id);
        } catch (err) {
            toast.error(t("Error updating member status."));
        }
    };

    const handlePostAnnouncement = async (e) => {
        e.preventDefault();
        if (!announcementMsg.trim()) return;
        try {
            await axios.post(`/api/society/${society.id}/announcements`, {
                message: announcementMsg, author_id: user.id
            });
            toast.success(t("Announcement broadcasted."));
            setAnnouncementMsg('');
            fetchSocietyContent(society.id);
        } catch (err) {
            toast.error(t("Broadcast failed."));
        }
    };

    const handleCollectionRequest = async (e) => {
        e.preventDefault();
        if (!collectionDetails.trim()) return;

        const toastId = toast.loading(t("Acquiring precise GNSS coordinates..."));

        navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
                await axios.post('/api/waste/requests', {
                    user_id: user.id,
                    location_details: collectionDetails,
                    city: user.city || '',
                    state: user.state || '',
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude
                });
                toast.update(toastId, { render: `Request sent to ${user.city} Municipality with spatial data!`, type: 'success', isLoading: false, autoClose: 3000 });
                setCollectionDetails('');
                fetchCollectionRequests();
            } catch (err) {
                toast.update(toastId, { render: err.response?.data?.error || 'Failed to send request.', type: 'error', isLoading: false, autoClose: 3000 });
            }
        }, () => {
            toast.update(toastId, { render: t("GNSS lock failed. Ensure location permissions are active."), type: 'error', isLoading: false, autoClose: 4000 });
        });
    };

    const handleVerifyRequest = async (reqId) => {
        try {
            const res = await axios.post(`/api/waste/requests/${reqId}/verify`);
            const pts = res.data.points_awarded;
            toast.success(`✅ Verified! Points awarded — You: +${pts.society}, Helper: +${pts.helper}, Municipality: +${pts.municipality}`);
            fetchCollectionRequests();
        } catch (err) {
            toast.error(t("Verification failed."));
        }
    };

    const pendingMembers = members.filter(m => m.status === 'pending');
    const acceptedMembers = members.filter(m => m.status === 'accepted');

    const navItems = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'members', label: 'Residents', icon: Users, badge: pendingMembers.length },
        { id: 'announcements', label: 'Announcements', icon: Megaphone },
        { id: 'waste', label: 'Waste Collection', icon: Trash2 },
    ];

    const renderSidebar = () => (
        <div className="dashboard-sidebar" style={{ width: '280px', background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)', height: 'calc(100vh - 80px)', position: 'sticky', top: '80px', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 16 }}>{t("Society Management")}</div>
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    style={{ width: '100%', textAlign: 'left', padding: '12px 16px', borderRadius: 12, background: activeTab === item.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: activeTab === item.id ? 'var(--color-primary)' : 'var(--color-text-dark)', fontWeight: activeTab === item.id ? 700 : 500, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s', fontSize: '1rem', marginBottom: 4 }}
                >
                    <item.icon size={18} />
                    {t(item.label)}
                    {item.badge > 0 && <span style={{ background: 'var(--color-danger)', color: 'white', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 800, marginLeft: 'auto' }}>{item.badge}</span>}
                </button>
            ))}

            <div style={{ flex: 1 }} />

            {society && (
                <div style={{ background: 'rgba(15, 23, 42, 0.03)', padding: 16, borderRadius: 16, border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{t("Active Society")}</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text-dark)', fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{society.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 600, marginTop: 4 }}>{t("Code:")}{' '}{society.society_code}</div>
                </div>
            )}
        </div>
    );


    if (!society) {
        return (
            <div className="container" style={{ padding: '60px 20px', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
                <div style={{ background: 'var(--color-surface)', padding: '48px', borderRadius: 24, boxShadow: 'var(--shadow-lg)' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', width: 80, height: 80, borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <Users size={40} color="var(--color-primary)" />
                    </div>
                    <h3 style={{ fontSize: '2rem', marginBottom: 16, color: 'var(--color-text-dark)' }}>{t("Establish Headquarters")}</h3>
                    <p style={{ color: 'var(--color-text-light)', marginBottom: 32, fontSize: '1.1rem' }}>{t("Register your Society to manage residents, post announcements, and coordinate large-scale waste collection with the Municipality.")}</p>

                    <form onSubmit={handleCreateSociety}>
                        <div className="form-group" style={{ textAlign: 'left', marginBottom: 24 }}>
                            <label className="form-label" style={{ fontSize: '1rem' }}>{t("Official Society Name")}</label>
                            <input type="text" className="form-input" value={createSocietyData.name} onChange={e => setCreateSocietyData({ ...createSocietyData, name: e.target.value })} required placeholder={t("e.g. Green Valley Residents")} style={{ padding: '16px 20px', fontSize: '1.05rem', background: 'var(--color-bg)' }} />
                        </div>
                        <div className="form-group" style={{ textAlign: 'left', marginBottom: 32 }}>
                            <label className="form-label" style={{ fontSize: '1rem' }}>{t("Unique Registration Code")}</label>
                            <input type="text" className="form-input" value={createSocietyData.society_code} onChange={e => setCreateSocietyData({ ...createSocietyData, society_code: e.target.value })} required placeholder={t("e.g. GVR123")} style={{ padding: '16px 20px', fontSize: '1.05rem', background: 'var(--color-bg)' }} />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}>{t("Initialize Society")}</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
            {renderSidebar()}

            <motion.div className="dashboard-main" style={{ flex: 1, padding: '48px', maxWidth: 1200 }} initial="initial" animate="in" exit="out" variants={pageVariants}>

                {/* Search / Top Bar Area (Mocking the inspiration image top bar) */}
                <div className="flex-between" style={{ marginBottom: 48, background: 'var(--color-surface)', padding: '16px 32px', borderRadius: 99, boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ color: 'var(--color-text-light)', fontSize: '0.95rem' }}>{t("Dashboard /")}{' '}<strong style={{ color: 'var(--color-text-dark)' }}>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-dark)' }}>{user.username}</div>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </div>

                {activeTab === 'overview' && (
                    <div className="grid-3" style={{ marginBottom: 40 }}>
                        <div className="card" style={{ boxShadow: 'var(--shadow-md)', borderTop: '4px solid var(--color-primary)' }}>
                            <div className="flex-between">
                                <h3 style={{ margin: 0, color: 'var(--color-text-light)', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Total Residents")}</h3>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 8, borderRadius: 10 }}><Users size={20} color="var(--color-primary)" /></div>
                            </div>
                            <h1 style={{ fontSize: '3rem', margin: '24px 0 0 0', color: 'var(--color-text-dark)' }}>{acceptedMembers.length}</h1>
                        </div>
                        <div className="card" style={{ boxShadow: 'var(--shadow-md)', borderTop: '4px solid var(--color-secondary)' }}>
                            <div className="flex-between">
                                <h3 style={{ margin: 0, color: 'var(--color-text-light)', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Pending Requests")}</h3>
                                <div style={{ background: 'rgba(15, 23, 42, 0.1)', padding: 8, borderRadius: 10 }}><Clock size={20} color="var(--color-secondary)" /></div>
                            </div>
                            <h1 style={{ fontSize: '3rem', margin: '24px 0 0 0', color: 'var(--color-text-dark)' }}>{pendingMembers.length}</h1>
                        </div>
                        <div className="card" style={{ boxShadow: 'var(--shadow-md)', borderTop: '4px solid var(--color-warning)' }}>
                            <div className="flex-between">
                                <h3 style={{ margin: 0, color: 'var(--color-text-light)', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Pending Collections")}</h3>
                                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: 8, borderRadius: 10 }}><Trash2 size={20} color="var(--color-warning)" /></div>
                            </div>
                            <h1 style={{ fontSize: '3rem', margin: '24px 0 0 0', color: 'var(--color-text-dark)' }}>{collectionRequests.filter(r => r.status === 'pending').length}</h1>
                        </div>
                    </div>
                )}

                {activeTab === 'members' && (
                    <div className="grid-2">
                        <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                            <div className="flex-between" style={{ marginBottom: 24 }}>
                                <h3 style={{ fontSize: '1.4rem', color: 'var(--color-text-dark)', margin: 0 }}>{t("Pending Clearances")}</h3>
                                <div className="badge badge-warning">{pendingMembers.length}</div>
                            </div>

                            {pendingMembers.length === 0 ? <p style={{ fontSize: '1rem', color: 'var(--color-text-light)', padding: '20px', background: 'var(--color-bg)', borderRadius: 12, textAlign: 'center' }}>{t("No pending architectural clearances.")}</p> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {pendingMembers.map(m => (
                                        <div key={m.membership_id} className="flex-between" style={{ padding: '16px 20px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 16 }}>
                                            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-dark)' }}>{m.username}</span>
                                            <div style={{ display: 'flex', gap: 12 }}>
                                                <button className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.9rem' }} onClick={() => handleUpdateMemberStatus(m.membership_id, 'accepted')}>{t("Authorize")}</button>
                                                <button className="btn btn-outline" style={{ padding: '8px 20px', fontSize: '0.9rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => handleUpdateMemberStatus(m.membership_id, 'rejected')}>{t("Deny")}</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                            <h3 style={{ fontSize: '1.4rem', color: 'var(--color-text-dark)', margin: 0, marginBottom: 24 }}>{t("Official Roster (")}{acceptedMembers.length}{t(")")}</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {acceptedMembers.map(m => (
                                    <div key={m.membership_id} style={{ padding: '16px 20px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--color-primary)' }}>{m.username.charAt(0).toUpperCase()}</div>
                                        <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{m.username}</span>
                                    </div>
                                ))}
                                {acceptedMembers.length === 0 && <p style={{ color: 'var(--color-text-light)' }}>{t("No authorized residents yet.")}</p>}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'announcements' && (
                    <div className="grid-2">
                        <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, fontSize: '1.4rem' }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 8, borderRadius: 12 }}><Megaphone size={20} color="var(--color-primary)" /></div>{t("Broadcast Transmission")}</h3>
                            <form onSubmit={handlePostAnnouncement}>
                                <textarea className="form-input" rows="5" placeholder={t("Enter directive to transmit to all active residents...")} value={announcementMsg} onChange={e => setAnnouncementMsg(e.target.value)} required style={{ marginBottom: 16, resize: 'none', padding: '16px 20px', fontSize: '1rem', background: 'var(--color-bg)' }}></textarea>
                                <button type="submit" className="btn btn-primary" style={{ padding: '14px 24px', width: '100%', fontSize: '1.05rem' }}>{t("Transmit Alert")}</button>
                            </form>
                        </div>
                        <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                            <h3 style={{ fontSize: '1.4rem', marginBottom: 24 }}>{t("Recent Transmissions")}</h3>
                            {announcements.length === 0 ? <p style={{ color: 'var(--color-text-light)' }}>{t("No broadcasts active.")}</p> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {announcements.map(a => (
                                        <div key={a.id} style={{ padding: '20px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 16 }}>
                                            <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--color-text-dark)' }}>{t("\"")}{t(a.message)}{t("\"")}</p>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', marginTop: 12, fontWeight: 500 }}>{formatDate(a.created_at)}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'waste' && (
                    <div className="grid-2">
                        <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, fontSize: '1.4rem' }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 8, borderRadius: 12 }}><Trash2 size={20} color="var(--color-primary)" /></div>{t("Request Bulk Collection")}</h3>

                            {/* Auto-detected municipality info */}
                            <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.06)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.2)', marginBottom: 20, fontSize: '0.9rem' }}>
                                <div style={{ fontWeight: 700, marginBottom: 2, color: 'var(--color-primary)' }}>{t("📍 Auto-detected Location")}</div>
                                <div style={{ color: 'var(--color-text-dark)', fontWeight: 600 }}>{user.city}{t(",")}{' '}{user.state}</div>
                                <div style={{ color: 'var(--color-text-light)', marginTop: 2, fontSize: '0.82rem' }}>{t("This request will be routed to")}{' '}<strong>{user.city}{' '}{t("Municipality")}</strong>{' '}{t("automatically.")}</div>
                            </div>

                            <p style={{ color: 'var(--color-text-light)', marginBottom: 20, lineHeight: 1.6 }}>{t("Describe the pick-up point inside your society. A Community Helper will be dispatched by the municipality.")}</p>
                            <form onSubmit={handleCollectionRequest}>
                                <div className="form-group" style={{ marginBottom: 24 }}>
                                    <label className="form-label">{t("Drop-off / Pick-up Location Details")}</label>
                                    <textarea className="form-input" rows="3"
                                        placeholder={`e.g. Near North Gate of ${society?.name}, large blue bins`}
                                        value={collectionDetails}
                                        onChange={e => setCollectionDetails(e.target.value)}
                                        required style={{ resize: 'none', background: 'var(--color-bg)' }}>
                                    </textarea>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }}>{t("Submit Request to Municipality")}</button>
                            </form>
                        </div>

                        <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                            <h3 style={{ fontSize: '1.4rem', marginBottom: 24 }}>{t("Active Requests")}</h3>
                            {collectionRequests.length === 0 ? (
                                <p style={{ color: 'var(--color-text-light)' }}>{t("No active collection requests.")}</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {collectionRequests.map(req => {
                                        const sc = {
                                            pending: { badge: 'badge-warning', border: '#F59E0B' },
                                            seen: { badge: 'badge-secondary', border: '#0EA5E9' },
                                            assigned: { badge: 'badge-primary', border: '#10B981' },
                                            completed: { badge: 'badge-primary', border: '#6366F1' },
                                            verified: { badge: 'badge-success', border: '#10B981' },
                                        }[req.status] || { badge: 'badge-warning', border: '#F59E0B' };

                                        return (
                                            <div key={req.id} style={{ padding: '18px 20px', background: 'var(--color-bg)', borderLeft: `5px solid ${sc.border}`, borderRadius: 14, border: `1px solid var(--color-border)` }}>
                                                <div className="flex-between" style={{ marginBottom: 10 }}>
                                                    <strong style={{ fontSize: '1.05rem', color: 'var(--color-text-dark)' }}>{t("Request #")}{req.id}</strong>
                                                    <span className={`badge ${sc.badge}`} style={{ textTransform: 'capitalize' }}>{t(req.status)}</span>
                                                </div>
                                                <p style={{ margin: '0 0 10px 0', color: 'var(--color-text-light)', fontSize: '0.9rem' }}>{req.location_details}</p>

                                                {req.status === 'pending' && (
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', padding: '6px 10px', background: 'rgba(245,158,11,0.08)', borderRadius: 8 }}>{t("⏳ Waiting for municipality to acknowledge.")}</div>
                                                )}
                                                {req.status === 'seen' && (
                                                    <div style={{ fontSize: '0.85rem', color: '#0EA5E9', padding: '6px 10px', background: 'rgba(14,165,233,0.08)', borderRadius: 8, fontWeight: 600 }}>{t("✅ Municipality acknowledged. Assigning a helper shortly.")}</div>
                                                )}
                                                {(req.status === 'assigned' || req.status === 'completed') && req.assigned_to_name && (
                                                    <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.08)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)', marginBottom: req.status === 'completed' ? 10 : 0 }}>
                                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{t("👷 Assigned Helper")}</div>
                                                        <div style={{ fontWeight: 700 }}>{req.assigned_to_name}</div>
                                                        {req.assigned_to_phone && <div style={{ fontSize: '0.9rem', color: 'var(--color-primary)' }}>{t("📞")}{' '}{req.assigned_to_phone}</div>}
                                                    </div>
                                                )}
                                                {req.status === 'completed' && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                        {req.volume_estimated && (
                                                            <div style={{ fontSize: '0.88rem', padding: '6px 12px', background: 'rgba(99,102,241,0.06)', borderRadius: 8, color: '#6366F1', fontWeight: 600 }}>{t("🤖 AI estimated:")}{' '}{formatNumber(req.volume_estimated, { maximumFractionDigits: 2 })}{' '}{t("kg of waste collected")}</div>
                                                        )}
                                                        {req.completed_image_url && (
                                                            <a href={req.completed_image_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem', color: 'var(--color-secondary)', textDecoration: 'underline' }}>{t("📷 View Proof Photo")}</a>
                                                        )}
                                                        <button className="btn btn-primary" style={{ background: 'var(--color-success)', padding: '10px 16px', fontSize: '0.95rem' }} onClick={() => handleVerifyRequest(req.id)}>{t("✅ Verify Completion & Award Points")}</button>
                                                    </div>
                                                )}
                                                {req.status === 'verified' && (
                                                    <div style={{ fontSize: '0.88rem', color: 'var(--color-success)', fontWeight: 600, padding: '8px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: 8 }}>{t("🎉 Verified! Points awarded to helper and municipality.")}</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default SocietyDashboard;
