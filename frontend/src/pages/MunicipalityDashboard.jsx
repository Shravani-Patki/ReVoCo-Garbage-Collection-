import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Bell, Users, CheckCircle, ShieldAlert, Building,
    Truck, MapPin, Activity, BarChart2, Navigation, Layers
} from 'lucide-react';
import { toast } from 'react-toastify';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MunicipalMarketPanel } from './WasteMarketplace';
import { t, formatNumber } from "../i18n";

// Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const reportIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const requestIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const helperSequenceIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const BASE = 'http://127.0.0.1:5000';

const fadeIn = {
    initial: { opacity: 0, x: 20 },
    in: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    out: { opacity: 0, x: -20, transition: { duration: 0.2 } }
};

// ─── Stat Card ───────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color, sub }) => (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, boxShadow: 'var(--shadow-sm)', borderTop: `4px solid ${color}` }}>
        <div style={{ background: `${color}15`, padding: 14, borderRadius: 16 }}>
            <Icon size={28} color={color} />
        </div>
        <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>{t(label)}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-dark)', lineHeight: 1.1 }}>{typeof value === 'number' ? formatNumber(value) : value}</div>
            {sub && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginTop: 2 }}>{sub}</div>}
        </div>
    </div>
);

// ─── Issue/Request Card helpers ───────────────────────────────────────────────
const statusBadgeClass = (status) => {
    if (status === 'reported' || status === 'pending') return 'badge-danger';
    if (status === 'seen') return 'badge-warning';
    if (status === 'assigned') return 'badge-primary';
    if (status === 'completed') return 'badge-secondary';
    if (status === 'verified') return 'badge-success';
    return 'badge-warning';
};

// ─── Map Real ──────────────────────────────────────────────────────────
const LiveMap = ({ data, type, defaultCenter }) => (
    <div style={{ minHeight: '400px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--color-border)', position: 'relative' }}>
        <MapContainer center={defaultCenter || [42.3314, -83.0458]} zoom={12} style={{ height: '100%', width: '100%', minHeight: 400, zIndex: 1 }}>
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {data.filter(i => i.latitude && i.longitude).map((item, idx) => (
                <Marker key={idx} position={[item.latitude, item.longitude]} icon={type === 'society' ? requestIcon : reportIcon}>
                    <Popup>
                        <strong style={{ color: type === 'society' ? 'var(--color-secondary)' : 'var(--color-danger)' }}>
                            {type === 'society' ? `Society Request #${item.id}` : `Waste Report #${item.id}`}
                        </strong>
                        <div style={{ marginTop: 4 }}>{t("Status:")}{' '}{t(item.status)}</div>
                        <div style={{ marginTop: 4 }}>{t('Est:')}{' '}{item.volume_estimated ? formatNumber(item.volume_estimated, { maximumFractionDigits: 2 }) : t('Pending')}{' '}{t('kg')}</div>
                        {item.assigned_name && <div style={{ marginTop: 4, fontWeight: 600 }}>{t("Assigned:")}{' '}{item.assigned_name}</div>}
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
        <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(255,255,255,0.95)', padding: '8px 16px', borderRadius: '12px', boxShadow: 'var(--shadow-md)', zIndex: 10, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
            <div style={{ background: type === 'society' ? 'rgba(14, 165, 233, 0.1)' : 'rgba(245, 158, 11, 0.1)', padding: 6, borderRadius: 8 }}>
                {type === 'society' ? <Building size={16} color="var(--color-secondary)" /> : <Activity size={16} color="var(--color-warning)" />}
            </div>
            <strong style={{ fontSize: '0.9rem' }}>{data.length}{' '}{t("Signals Active")}</strong>
        </div>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const MunicipalityDashboard = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [activeTab, setActiveTab] = useState('overview');
    const [issues, setIssues] = useState([]);
    const [societyRequests, setSocietyRequests] = useState([]);
    const [helpers, setHelpers] = useState([]);
    const [selectedHelper, setSelectedHelper] = useState({});
    const [routeSequence, setRouteSequence] = useState(null);
    const [routingHelper, setRoutingHelper] = useState('');

    useEffect(() => {
        const fetchAll = () => { fetchIssues(); fetchSocietyRequests(); fetchHelpers(); };
        fetchAll();
        const id = setInterval(fetchAll, 10000);
        return () => clearInterval(id);
    }, []);

    const fetchIssues = async () => {
        try {
            const res = await axios.get(`${BASE}/api/waste/issues?city=${user.city}&status=all`);
            setIssues(res.data);
        } catch { toast.error(t("Failed to sync issues.")); }
    };

    const fetchSocietyRequests = async () => {
        try {
            const res = await axios.get(`${BASE}/api/waste/requests?city=${user.city}&status=all`);
            setSocietyRequests(res.data);
        } catch { }
    };

    const fetchHelpers = async () => {
        try {
            const res = await axios.get(`${BASE}/api/auth/users?role=community_helper`);
            setHelpers(res.data);
        } catch { }
    };

    // ── Citizen Issue Actions ─────────────────────────────────────────────────
    const markIssueSeen = async (id) => {
        try {
            await axios.post(`${BASE}/api/waste/${id}/verify`, { status: 'seen' });
            toast.success(t("Issue acknowledged.")); fetchIssues();
        } catch { toast.error(t("Failed.")); }
    };

    const assignIssue = async (id) => {
        const h = selectedHelper[id];
        if (!h) return toast.warning(t("Select a helper first."));
        try {
            await axios.post(`${BASE}/api/waste/${id}/verify`, { status: 'assigned', helper_id: h });
            toast.success(t("Helper dispatched!")); fetchIssues();
        } catch { toast.error(t("Dispatch failed.")); }
    };

    const fetchRoute = async () => {
        if (!routingHelper) return toast.warning(t("Select a helper to map routing sequence."));
        const toastId = toast.loading(t("Calculating optimal shortest-path collection sequence (Dijkstra algorithm)..."));
        try {
            const res = await axios.get(`${BASE}/api/routing/helper/${routingHelper}`);
            setRouteSequence(res.data);
            toast.update(toastId, { render: `Sequence calculated. Total Flight Path: ${res.data.total_distance_km} km`, type: 'success', isLoading: false, autoClose: 5000 });
        } catch {
            toast.update(toastId, { render: t("Failed to generate optimal sequence."), type: 'error', isLoading: false, autoClose: 3000 });
        }
    };

    // ── Derived data ──────────────────────────────────────────────────────────
    const newIssues = issues.filter(i => i.status === 'reported');
    const seenIssues = issues.filter(i => i.status === 'seen');
    const assignedIssues = issues.filter(i => i.status === 'assigned');
    const completedIssues = issues.filter(i => i.status === 'completed');
    const verifiedIssues = issues.filter(i => i.status === 'verified');

    const totalActive = newIssues.length + seenIssues.length + assignedIssues.length;

    // ── Sidebar nav ───────────────────────────────────────────────────────────
    const NAV = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard, color: 'var(--color-primary)' },
        { id: 'new_reports', label: 'New Reports', icon: Bell, color: 'var(--color-danger)', badge: newIssues.length },
        { id: 'assign_issues', label: 'Assign Helper', icon: Users, color: 'var(--color-warning)', badge: seenIssues.length },
        { id: 'in_progress', label: 'In Progress', icon: Truck, color: 'var(--color-primary)', badge: assignedIssues.length },
        { id: 'awaiting_verify', label: 'Awaiting Verify', icon: CheckCircle, color: 'var(--color-success)', badge: completedIssues.length },
        { id: 'divider1' },
        { id: 'divider2' },
        { id: 'maps', label: 'Maps', icon: Layers, color: 'var(--color-text-light)' },
        { id: 'market', label: 'Companies & Rates', icon: BarChart2, color: 'var(--color-success)' },
    ];

    const HelperSelect = ({ stateKey, label }) => (
        helpers.length === 0
            ? <p style={{ color: 'var(--color-danger)', fontSize: '0.88rem', margin: 0 }}>{t("⚠ No community helpers registered yet.")}</p>
            : <div style={{ display: 'flex', gap: 10 }}>
                <select className="form-input" style={{ flex: 1, margin: 0, padding: '10px' }}
                    value={selectedHelper[stateKey] || ''}
                    onChange={e => setSelectedHelper(p => ({ ...p, [stateKey]: e.target.value }))}>
                    <option value="">{t("Select Helper...")}</option>
                    {helpers.map(h => <option key={h.id} value={h.id}>{h.username}</option>)}
                </select>
                <button className="btn btn-primary" style={{ padding: '10px 22px', whiteSpace: 'nowrap' }} onClick={t(label)}>{t("Dispatch")}</button>
            </div>
    );

    // ─── Issue Card (reusable) ────────────────────────────────────────────────
    const IssueCard = ({ item, onAck, onAssign, stateKey, type = 'issue' }) => {
        const status = item.status;
        return (
            <div style={{ padding: '20px', border: '1px solid var(--color-border)', borderRadius: 16, background: 'var(--color-bg)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{t("#")}{item.id}{' '}{t("—")}{' '}{type === 'request' ? (item.location_details || item.city) : (item.city || 'Unknown')}</span>
                    <span className={`badge ${statusBadgeClass(status)}`}>{status.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--color-text-light)', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {type === 'issue' ? (
                        <>
                            <span>{t("📍")}{' '}{item.address_text || `${item.city}, ${item.state}`}</span>
                            <span>{t('🗑 Est. Waste:')}{' '}{item.volume_estimated ? `${formatNumber(item.volume_estimated, { maximumFractionDigits: 2 })} kg` : t('N/A')}</span>
                        </>
                    ) : (
                        <>
                            <span>{t("📍")}{' '}{item.location_details}</span>
                            <span>{t("🏙")}{' '}{item.city || 'N/A'}</span>
                        </>
                    )}
                </div>
                {onAck && <button className="btn btn-primary" style={{ width: '100%', background: 'var(--color-danger)' }} onClick={onAck}>{t("Acknowledge & Mark Seen")}</button>}
                {onAssign && (
                    <div style={{ display: 'flex', gap: 10 }}>
                        <select className="form-input" style={{ flex: 1, margin: 0, padding: '10px' }}
                            value={selectedHelper[stateKey] || ''}
                            onChange={e => setSelectedHelper(p => ({ ...p, [stateKey]: e.target.value }))}>
                            <option value="">{t("Select Helper...")}</option>
                            {helpers.map(h => <option key={h.id} value={h.id}>{h.username}</option>)}
                        </select>
                        <button className="btn btn-primary" style={{ padding: '10px 22px', whiteSpace: 'nowrap' }} onClick={onAssign}>{t("Dispatch")}</button>
                    </div>
                )}
                {status === 'assigned' && item.assigned_name && (
                    <p style={{ margin: 0, color: 'var(--color-primary)', fontWeight: 600 }}>{t("👷")}{' '}{item.assigned_name}</p>
                )}
                {status === 'completed' && (
                    <div style={{ padding: '10px', background: 'rgba(16,185,129,0.08)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-success)', marginBottom: 4 }}>{t("Cleaned by")}{' '}{item.assigned_name}</div>
                        {type === 'request' && item.volume_estimated && (
                            <div style={{ fontSize: '0.88rem', color: 'var(--color-text-light)' }}>{t("AI estimated:")}{' '}<strong>{formatNumber(item.volume_estimated, { maximumFractionDigits: 2 })}{' '}{t("kg")}</strong></div>
                        )}
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>{t("Awaiting society verification.")}</div>
                    </div>
                )}
            </div>
        );
    };

    // ─── Page content per tab ─────────────────────────────────────────────────
    const renderContent = () => {
        switch (activeTab) {

            case 'overview':
                return (
                    <motion.div key="overview" variants={fadeIn} initial="initial" animate="in" exit="out">
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>{t("👋 Welcome,")}{' '}{user.city}{' '}{t("Municipality")}</h2>
                        <p style={{ color: 'var(--color-text-light)', marginBottom: 32 }}>{t("Fleet management and spatial coordination for")}{' '}{user.city}{t(",")}{' '}{user.state}{t(".")}</p>
                        <div className="grid-3" style={{ marginBottom: 32 }}>
                            <StatCard icon={Bell} label="New Reports" value={newIssues.length} color="var(--color-danger)" sub="Needing acknowledgement" />
                            <StatCard icon={Users} label="Active Tasks" value={totalActive} color="var(--color-warning)" sub="In lifecycle pipeline" />
                            <StatCard icon={CheckCircle} label="Verified Today" value={verifiedIssues.length} color="var(--color-success)" sub="Fully resolved issues" />
                            <StatCard icon={Truck} label="Helpers Available" value={helpers.length} color="var(--color-primary)" sub="Registered field operatives" />
                            <StatCard icon={BarChart2} label="Dept. Score" value={`${formatNumber(user.city_score || 0)} pts`} color="#8B5CF6" sub="Municipality leaderboard" />
                        </div>
                        <div style={{ background: 'var(--color-surface)', borderRadius: 20, padding: 28, border: '1px solid var(--color-border)' }}>
                            <h3 style={{ marginBottom: 16, fontSize: '1.2rem' }}>{t("Workflow Guide")}</h3>
                            {[
                                { step: 1, label: 'New citizen reports appear → go to "New Reports" and acknowledge them', tab: 'new_reports', color: 'var(--color-danger)' },
                                { step: 2, label: 'Acknowledged issues → go to "Assign Helper" and dispatch a field operative', tab: 'assign_issues', color: 'var(--color-warning)' },
                                { step: 3, label: 'Dispatched issues → monitor under "In Progress"', tab: 'in_progress', color: 'var(--color-primary)' },
                                { step: 4, label: 'Worker completes task → appears in "Awaiting Verify" (citizen verifies)', tab: 'awaiting_verify', color: 'var(--color-success)' },
                            ].map(s => (
                                <div key={s.step} onClick={() => setActiveTab(s.tab)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${s.color}20`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', flexShrink: 0 }}>{s.step}</div>
                                    <span style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{t(s.label)}</span>
                                    <span style={{ marginLeft: 'auto', color: s.color, fontWeight: 700, fontSize: '0.85rem' }}>{t("→")}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                );

            case 'new_reports':
                return (
                    <motion.div key="new_reports" variants={fadeIn} initial="initial" animate="in" exit="out">
                        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6, color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 12 }}><Bell size={24} />{' '}{t("Step 1 — New Citizen Reports")}</h2>
                        <p style={{ color: 'var(--color-text-light)', marginBottom: 24 }}>{t("Acknowledge these reports so the citizen knows their issue has been seen.")}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {newIssues.map(i => <IssueCard key={i.id} item={i} onAck={() => markIssueSeen(i.id)} />)}
                            {newIssues.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-light)' }}>{t("✅ No new reports pending acknowledgement.")}</div>}
                        </div>
                    </motion.div>
                );

            case 'assign_issues':
                return (
                    <motion.div key="assign_issues" variants={fadeIn} initial="initial" animate="in" exit="out">
                        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6, color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: 12 }}><Users size={24} />{' '}{t("Step 2 — Assign Community Helper")}</h2>
                        <p style={{ color: 'var(--color-text-light)', marginBottom: 24 }}>{t("Dispatch a community helper to address these acknowledged issues.")}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {seenIssues.map(i => <IssueCard key={i.id} item={i} onAssign={() => assignIssue(i.id)} stateKey={i.id} />)}
                            {seenIssues.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-light)' }}>{t("✅ No issues waiting for a helper.")}</div>}
                        </div>
                    </motion.div>
                );

            case 'in_progress':
                return (
                    <motion.div key="in_progress" variants={fadeIn} initial="initial" animate="in" exit="out">
                        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 12 }}><Truck size={24} />{' '}{t("Step 3 — In Progress")}</h2>
                        <p style={{ color: 'var(--color-text-light)', marginBottom: 24 }}>{t("These issues have a helper dispatched and are being addressed on-site.")}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {assignedIssues.map(i => <IssueCard key={i.id} item={i} />)}
                            {assignedIssues.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-light)' }}>{t("No issues currently in progress.")}</div>}
                        </div>
                    </motion.div>
                );

            case 'awaiting_verify':
                return (
                    <motion.div key="awaiting_verify" variants={fadeIn} initial="initial" animate="in" exit="out">
                        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 12 }}><CheckCircle size={24} />{' '}{t("Step 4 — Awaiting Citizen Verification")}</h2>
                        <p style={{ color: 'var(--color-text-light)', marginBottom: 24 }}>{t("Workers have marked these as complete. Waiting for the citizen to verify.")}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {completedIssues.map(i => <IssueCard key={i.id} item={i} />)}
                            {completedIssues.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-light)' }}>{t("✅ No completed issues awaiting verification.")}</div>}
                        </div>
                    </motion.div>
                );

            case 'maps':
                return (
                    <motion.div key="maps" variants={fadeIn} initial="initial" animate="in" exit="out">
                        <div className="flex-between" style={{ marginBottom: 24 }}>
                            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 12, margin: 0 }}><Layers size={24} />{' '}{t("Spatial Overview & Routing")}</h2>
                        </div>

                        <div className="card" style={{ marginBottom: 32, boxShadow: 'var(--shadow-md)', borderTop: '4px solid var(--color-success)' }}>
                            <h3 style={{ marginBottom: 16, fontSize: '1.2rem', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Navigation size={20} />{' '}{t("Sequence Tracker (Dijkstra Subroutine)")}</h3>
                            <p style={{ color: 'var(--color-text-light)', marginBottom: 20 }}>{t("Select a Community Helper to compute their mathematically optimal collection flight-path. The algorithm calculates the shortest continuous route through all their assigned tasks.")}</p>

                            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
                                <select className="form-input" style={{ maxWidth: 300, margin: 0, background: 'var(--color-bg)' }} value={routingHelper} onChange={e => setRoutingHelper(e.target.value)}>
                                    <option value="">{t("Select Helper...")}</option>
                                    {helpers.map(h => <option key={h.id} value={h.id}>{h.username}{' '}{t('(Level')}{' '}{formatNumber(Math.floor((h.city_score || 0) / 100))}{t(')')}</option>)}
                                </select>
                                <button className="btn btn-primary" style={{ padding: '12px 24px', background: 'var(--color-success)' }} onClick={fetchRoute}>{t("Map Optimal Sequence")}</button>
                                {routeSequence && routeSequence.total_distance_km > 0 && (
                                    <span className="badge badge-success" style={{ fontSize: '1rem', padding: '10px 16px' }}>{t("Total Est. Distance:")}{' '}{routeSequence.total_distance_km}{' '}{t("km")}</span>
                                )}
                            </div>

                            {routeSequence && routeSequence.sequence && routeSequence.sequence.length > 0 && (
                                <div style={{ minHeight: 450, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--color-border)', position: 'relative' }}>
                                    <MapContainer center={[routeSequence.sequence[0].lat, routeSequence.sequence[0].lng]} zoom={12} style={{ height: 450, width: '100%', zIndex: 1 }}>
                                        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; OpenStreetMap' />

                                        {/* Polyline rendering the path */}
                                        <Polyline
                                            positions={routeSequence.sequence.map(s => [s.lat, s.lng])}
                                            color="var(--color-success)"
                                            weight={4}
                                            opacity={0.7}
                                            dashArray="10, 10"
                                        />

                                        {routeSequence.sequence.map((node, index) => (
                                            <Marker key={`${node.id}-${index}`} position={[node.lat, node.lng]} icon={helperSequenceIcon}>
                                                <Popup>
                                                    <div style={{ fontWeight: 800, color: 'var(--color-text-dark)' }}>{index === 0 ? "Dispatch Start" : `Step ${index}`}</div>
                                                    <div style={{ color: 'var(--color-success)', fontWeight: 700 }}>{t(node.title)}</div>
                                                    <div style={{ color: 'var(--color-text-light)', fontSize: '0.85rem' }}>{node.address}</div>
                                                    {index > 0 && <div style={{ marginTop: 4, fontWeight: 600, fontSize: '0.85rem' }}>{t("Travel: +")}{node.distance_from_previous_km}{' '}{t("km")}</div>}
                                                </Popup>
                                            </Marker>
                                        ))}
                                    </MapContainer>
                                </div>
                            )}
                            {routeSequence && routeSequence.sequence && routeSequence.sequence.length === 0 && (
                                <div style={{ padding: 24, textAlign: 'center', background: 'var(--color-bg)', borderRadius: 12, border: '1px dashed var(--color-border)', color: 'var(--color-text-light)' }}>{t("No active task locations found for this helper.")}</div>
                            )}
                        </div>

                        <div className="grid-2" style={{ gap: 24 }}>
                            <div>
                                <h3 style={{ marginBottom: 12, color: 'var(--color-danger)' }}>{t("Citizen Waste Signals")}</h3>
                                <LiveMap data={issues.filter(i => i.status !== 'verified')} type="citizen" defaultCenter={user.latitude && user.longitude ? [user.latitude, user.longitude] : null} />
                            </div>
                            <div>
                                <h3 style={{ marginBottom: 12, color: 'var(--color-secondary)' }}>{t("Society Pickup Requests")}</h3>
                                <LiveMap data={societyRequests.filter(r => r.status !== 'verified')} type="society" defaultCenter={user.latitude && user.longitude ? [user.latitude, user.longitude] : null} />
                            </div>
                        </div>
                    </motion.div>
                );

            case 'market':
                return <motion.div key="market" variants={fadeIn} initial="initial" animate="in" exit="out"><MunicipalMarketPanel /></motion.div>;

            default:
                return null;
        }
    };

    return (
        <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>

            {/* ── Sidebar ─────────────────────────────────────────────────── */}
            <div className="dashboard-sidebar" style={{ width: 260, background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)', height: 'calc(100vh - 80px)', position: 'sticky', top: '80px', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', flexShrink: 0 }}>
                {/* City header */}
                <div style={{ padding: '12px 16px', marginBottom: 8, background: 'rgba(16,185,129,0.06)', borderRadius: 14, border: '1px solid rgba(16,185,129,0.15)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>{t("Municipality")}</div>
                    <div style={{ fontWeight: 800, color: 'var(--color-text-dark)', fontSize: '1.1rem' }}>{user.city}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--color-primary)', fontWeight: 600 }}>{formatNumber(user.city_score || 0)}{' '}{t('pts')}</div>
                </div>

                {NAV.map((item) => {
                    if (item.id.startsWith('divider')) {
                        return <div key={item.id} style={{ height: 1, background: 'var(--color-border)', margin: '8px 0' }} />;
                    }
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;
                    return (
                        <button key={item.id} onClick={() => setActiveTab(item.id)}
                            style={{ width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 12, background: isActive ? `${item.color}15` : 'transparent', color: isActive ? item.color : 'var(--color-text-dark)', fontWeight: isActive ? 700 : 500, border: isActive ? `1px solid ${item.color}30` : '1px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.18s', fontSize: '0.95rem' }}>
                            <Icon size={17} />
                            <span style={{ flex: 1 }}>{t(item.label)}</span>
                            {item.badge > 0 && (
                                <span style={{ background: isActive ? item.color : 'var(--color-danger)', color: 'white', borderRadius: 99, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 800, minWidth: 20, textAlign: 'center' }}>
                                    {item.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── Main panel ──────────────────────────────────────────────── */}
            <div className="dashboard-main" style={{ flex: 1, padding: '40px 48px', overflowY: 'auto', maxHeight: 'calc(100vh - 80px)' }}>
                <AnimatePresence mode="wait">
                    {renderContent()}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default MunicipalityDashboard;
