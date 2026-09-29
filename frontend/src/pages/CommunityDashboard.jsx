import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircle, AlertTriangle, ShieldAlert, Users, Megaphone, Award, Building, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { formatNumber, t } from "../i18n";

// Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const helperSequenceIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const pageVariants = {
    initial: { opacity: 0, y: 15 },
    in: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    out: { opacity: 0, y: -15, transition: { duration: 0.2 } }
};

const tabVariants = {
    initial: { opacity: 0, scale: 0.98 },
    in: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
    out: { opacity: 0, scale: 0.98, transition: { duration: 0.2 } }
};

const CommunityDashboard = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [activeTab, setActiveTab] = useState('verify');

    // Grievance/Verification State
    const [issues, setIssues] = useState([]);
    const [assignedTasks, setAssignedTasks] = useState([]);
    const [assignedCollections, setAssignedCollections] = useState([]);
    const [completionImage, setCompletionImage] = useState({});
    const [submittingTaskId, setSubmittingTaskId] = useState(null);
    const [submittingReqId, setSubmittingReqId] = useState(null);
    const [routeSequence, setRouteSequence] = useState(null);

    // Society Admin State
    const [society, setSociety] = useState(null);
    const [members, setMembers] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [announcements, setAnnouncements] = useState([]);

    // Forms
    const [createSocietyData, setCreateSocietyData] = useState({ name: '', society_code: '' });
    const [announcementMsg, setAnnouncementMsg] = useState('');

    useEffect(() => {
        const fetchAll = () => {
            fetchIssues();
            fetchAssignedTasks();
            fetchAssignedCollections();
            fetchSociety();
            fetchRoute();
        };
        fetchAll();
        const intervalId = setInterval(fetchAll, 10000);
        return () => clearInterval(intervalId);
    }, []);

    const fetchIssues = async () => {
        try {
            const res = await axios.get('http://127.0.0.1:5000/api/waste/issues?status=reported');
            setIssues(res.data);
        } catch (err) {
            toast.error(t("Connection to central database lost."));
        }
    };

    const fetchAssignedTasks = async () => {
        try {
            const res = await axios.get(`http://127.0.0.1:5000/api/waste/issues?assigned_to=${user.id}&status=assigned`);
            setAssignedTasks(res.data);
        } catch (err) { }
    };

    const fetchAssignedCollections = async () => {
        try {
            const res = await axios.get(`http://127.0.0.1:5000/api/waste/requests?assigned_to=${user.id}&status=assigned`);
            setAssignedCollections(res.data);
        } catch (err) { }
    };

    const fetchRoute = async () => {
        try {
            const res = await axios.get(`http://127.0.0.1:5000/api/routing/helper/${user.id}`);
            setRouteSequence(res.data);
        } catch (err) { }
    };

    const fetchSociety = async () => {
        try {
            const res = await axios.get(`http://127.0.0.1:5000/api/society/admin/${user.id}`);
            if (res.data.length > 0) {
                setSociety(res.data[0]);
                fetchSocietyContent(res.data[0].id);
            }
        } catch (err) {
            console.error("No society found or error");
        }
    };

    const fetchSocietyContent = async (societyId) => {
        try {
            const [mRes, lRes, aRes] = await Promise.all([
                axios.get(`http://127.0.0.1:5000/api/society/${societyId}/members`),
                axios.get(`http://127.0.0.1:5000/api/society/${societyId}/leaderboard`),
                axios.get(`http://127.0.0.1:5000/api/society/${societyId}/announcements`)
            ]);
            setMembers(mRes.data);
            setLeaderboard(lRes.data);
            setAnnouncements(aRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateSociety = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://127.0.0.1:5000/api/society/create', {
                ...createSocietyData,
                admin_id: user.id
            });
            toast.success(t("Society established successfully."));
            fetchSociety();
        } catch (err) {
            toast.error(err.response?.data?.error || "Error creating society");
        }
    };

    const handleUpdateMemberStatus = async (membershipId, status) => {
        try {
            await axios.put(`http://127.0.0.1:5000/api/society/membership/${membershipId}/status`, { status });
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
            await axios.post(`http://127.0.0.1:5000/api/society/${society.id}/announcements`, {
                message: announcementMsg,
                author_id: user.id
            });
            toast.success(t("Announcement broadcasted."));
            setAnnouncementMsg('');
            fetchSocietyContent(society.id);
        } catch (err) {
            toast.error(t("Broadcast failed."));
        }
    };

    const verifyIssue = async (id) => {
        try {
            await axios.post(`http://127.0.0.1:5000/api/waste/${id}/verify`, { status: 'seen' });
            toast.success(`Verification complete for Report #${id}. Proceeding to Fleet Command.`);
            fetchIssues();
            if (society) fetchSocietyContent(society.id);
        } catch (err) {
            toast.error(t("Decryption Error: Unable to verify payload."));
        }
    };

    // Convert file to base64
    const fileToBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const handleMarkComplete = async (taskId) => {
        const img = completionImage[taskId];
        if (!img) { toast.warning(t("Please select an image as proof of completion.")); return; }
        setSubmittingTaskId(taskId);
        try {
            const base64Img = await fileToBase64(img);
            await axios.post(`http://127.0.0.1:5000/api/waste/${taskId}/verify`, { status: 'completed', completed_image_url: base64Img });
            toast.success(t("Task marked as completed. Awaiting citizen verification."));
            setCompletionImage(p => { const n = { ...p }; delete n[taskId]; return n; });
            fetchAssignedTasks();
        } catch { toast.error(t("Failed to submit completion proof.")); }
        finally { setSubmittingTaskId(null); }
    };

    const handleMarkCollectionComplete = async (reqId) => {
        const img = completionImage[`req_${reqId}`];
        if (!img) { toast.warning(t("Please select an image as proof of completion.")); return; }
        setSubmittingReqId(reqId);
        const toastId = toast.loading(t("Uploading & estimating waste volume via AI..."));
        try {
            const base64Img = await fileToBase64(img);
            const res = await axios.post(`http://127.0.0.1:5000/api/waste/requests/${reqId}/complete`, { completed_image_url: base64Img });
            toast.update(toastId, { render: t('✅ Completed! AI estimated {{weight}} kg. Awaiting society verification.', { weight: formatNumber(res.data.volume_estimated) }), type: 'success', isLoading: false, autoClose: 5000 });
            setCompletionImage(p => { const n = { ...p }; delete n[`req_${reqId}`]; return n; });
            fetchAssignedCollections();
        } catch { toast.update(toastId, { render: t("Failed to submit."), type: 'error', isLoading: false, autoClose: 3000 }); }
        finally { setSubmittingReqId(null); }
    };

    const pendingMembers = members.filter(m => m.status === 'pending');

    return (
        <motion.div className="container" initial="initial" animate="in" exit="out" variants={pageVariants}>
            <div className="flex-between" style={{ marginBottom: 40, marginTop: 16 }}>
                <div>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 700, letterSpacing: '2px', fontSize: '0.9rem', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>{t("Helper Node")}</span>
                    <h1 style={{ fontSize: '2.5rem', color: 'var(--color-text-dark)', margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>{t("Verification Hub")}{' '}<ShieldAlert size={32} color="var(--color-warning)" />
                    </h1>
                    <p style={{ marginTop: 8, color: 'var(--color-text-light)', fontSize: '1.05rem' }}>{t("Community Helper Dashboard: Verify waste intel and manage local societies.")}</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 32, borderBottom: '2px solid var(--color-border)', paddingBottom: 16 }}>
                <button className={`btn ${activeTab === 'verify' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('verify')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 24px', borderRadius: 99, fontSize: '1.05rem' }}>
                    <AlertTriangle size={18} />{' '}{t("Field Tasks")}{assignedTasks.length > 0 && (
                        <span style={{ background: activeTab === 'verify' ? 'rgba(255,255,255,0.2)' : 'var(--color-danger)', padding: '2px 8px', borderRadius: 12, fontSize: '0.8rem', color: 'white', fontWeight: 800 }}>
                            {assignedTasks.length}
                        </span>
                    )}
                </button>
                <button className={`btn ${activeTab === 'society' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('society')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 24px', borderRadius: 99, fontSize: '1.05rem' }}>
                    <Users size={18} />{' '}{t("Society Admin")}{pendingMembers.length > 0 && (
                        <span style={{ background: activeTab === 'society' ? 'rgba(255,255,255,0.2)' : 'var(--color-warning)', padding: '2px 8px', borderRadius: 12, fontSize: '0.8rem', color: activeTab === 'society' ? 'white' : 'white', fontWeight: 800 }}>
                            {pendingMembers.length}
                        </span>
                    )}
                </button>
            </div>

            {activeTab === 'verify' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                    {/* Assigned Tasks Section */}
                    <motion.div variants={tabVariants} initial="initial" animate="in" exit="out" className="card" style={{ borderLeft: '6px solid var(--color-primary)', boxShadow: 'var(--shadow-md)', padding: '40px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, fontSize: '1.5rem', color: 'var(--color-text-dark)' }}>
                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 10, borderRadius: 12 }}><Navigation size={24} color="var(--color-primary)" /></div>{t("Optimal Route Sequence")}</h3>

                        {routeSequence && routeSequence.sequence && routeSequence.sequence.length > 0 ? (
                            <div style={{ marginBottom: 40 }}>
                                <div className="flex-between" style={{ marginBottom: 16 }}>
                                    <p style={{ color: 'var(--color-text-light)', margin: 0 }}>{t("This is your mathematically optimal shortest-path collection flight-path, generated by City Command.")}</p>
                                    <span className="badge badge-success" style={{ fontSize: '1rem', padding: '10px 16px' }}>{t("Total Est. Distance:")}{' '}{routeSequence.total_distance_km}{' '}{t("km")}</span>
                                </div>
                                <div style={{ minHeight: 400, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--color-border)', position: 'relative' }}>
                                    <MapContainer center={[routeSequence.sequence[0].lat, routeSequence.sequence[0].lng]} zoom={12} style={{ height: 400, width: '100%', zIndex: 1 }}>
                                        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; OpenStreetMap' />

                                        <Polyline
                                            positions={routeSequence.sequence.map(s => [s.lat, s.lng])}
                                            color="var(--color-success)"
                                            weight={4}
                                            opacity={0.8}
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
                            </div>
                        ) : (
                            <div style={{ padding: 24, textAlign: 'center', background: 'var(--color-bg)', borderRadius: 12, border: '1px dashed var(--color-border)', color: 'var(--color-text-light)', marginBottom: 40 }}>{t("No active route generated. You have no pending tasks with valid spatial data.")}</div>
                        )}

                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, fontSize: '1.5rem', color: 'var(--color-text-dark)', paddingTop: 24, borderTop: '1px solid var(--color-border)' }}>
                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 10, borderRadius: 12 }}><ShieldAlert size={24} color="var(--color-primary)" /></div>{t("Assigned Garbage Cleaning Tasks")}</h3>

                        {assignedTasks.length === 0 ? (
                            <div style={{ padding: '40px 20px', background: 'var(--color-bg)', borderRadius: '16px', textAlign: 'center', border: '1px solid var(--color-border)' }}>
                                <CheckCircle size={48} color="var(--color-success)" style={{ margin: '0 auto 16px' }} />
                                <h4 style={{ fontSize: '1.2rem', marginBottom: 8, color: 'var(--color-text-dark)' }}>{t("No active missions.")}</h4>
                                <p style={{ color: 'var(--color-text-light)', fontSize: '1rem' }}>{t("Stand by for dispatch orders from City Command. You will be notified when a task is assigned to you.")}</p>
                            </div>
                        ) : (
                            <div className="grid-3" style={{ marginTop: 24 }}>
                                <AnimatePresence>
                                    {assignedTasks.map(task => (
                                        <motion.div
                                            key={task.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                            layout className="card" style={{ padding: 24, background: 'var(--color-bg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
                                        >
                                            <div style={{ color: 'var(--color-text-dark)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{t("Task #")}{task.id}</span>
                                                <span className="badge badge-primary">{t("ACTIVE")}</span>
                                            </div>
                                            <div style={{ fontSize: '0.95rem', marginBottom: 16, color: 'var(--color-text-light)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <span style={{ background: 'var(--color-surface)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                                                    <strong>{t("Address:")}</strong> {task.address_text || `${task.latitude}, ${task.longitude}`}
                                                </span>
                                                <span style={{ background: 'var(--color-surface)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                                                    <strong>{t("City:")}</strong> {task.city || 'N/A'}
                                                </span>
                                                <span style={{ display: 'block', marginTop: 8, color: 'var(--color-primary)', fontWeight: 600, fontSize: '1.05rem' }}>{t("Est. Waste Volume:")}{' '}{formatNumber(task.volume_estimated, { maximumFractionDigits: 2 })}{' '}{t("kg")}</span>
                                            </div>

                                            <div style={{ background: 'var(--color-surface)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-dark)', marginBottom: 8, display: 'block' }}>{t("Upload Proof Photo (required)")}</label>
                                                <input type="file" accept="image/*" onChange={(e) => setCompletionImage(p => ({ ...p, [task.id]: e.target.files[0] }))} style={{ fontSize: '0.85rem', width: '100%' }} />
                                            </div>

                                            <motion.button
                                                className="btn btn-primary"
                                                style={{ width: '100%', padding: '14px', fontSize: '1rem', background: 'var(--color-success)' }}
                                                onClick={() => handleMarkComplete(task.id)}
                                                disabled={submittingTaskId === task.id}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                <CheckCircle size={18} style={{ marginRight: 8 }} /> {submittingTaskId === task.id ? 'Uploading...' : 'Mark as Complete & Submit Photo'}
                                            </motion.button>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </motion.div>

                    {/* Society Collection Tasks Section */}
                    <motion.div variants={tabVariants} initial="initial" animate="in" exit="out" className="card" style={{ borderLeft: '6px solid var(--color-secondary)', boxShadow: 'var(--shadow-md)', padding: '40px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, fontSize: '1.5rem', color: 'var(--color-text-dark)' }}>
                            <div style={{ background: 'rgba(14,165,233,0.1)', padding: 10, borderRadius: 12 }}><Building size={24} color="var(--color-secondary)" /></div>{t("Assigned Society Collection Tasks")}</h3>
                        <p style={{ color: 'var(--color-text-light)', marginBottom: 24, fontSize: '0.95rem' }}>{t("After uploading your proof photo, our AI will automatically estimate the waste volume from the image. Points for both you and the society will be calculated based on that estimate.")}</p>

                        {assignedCollections.length === 0 ? (
                            <div style={{ padding: '30px 20px', background: 'var(--color-bg)', borderRadius: 16, textAlign: 'center', border: '1px solid var(--color-border)' }}>
                                <p style={{ color: 'var(--color-text-light)' }}>{t("No society collection tasks assigned to you.")}</p>
                            </div>
                        ) : (
                            <div className="grid-3" style={{ marginTop: 8 }}>
                                <AnimatePresence>
                                    {assignedCollections.map(req => (
                                        <motion.div key={req.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                            layout className="card" style={{ padding: 24, background: 'var(--color-bg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                                            <div style={{ color: 'var(--color-text-dark)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{t("Collection #")}{req.id}</span>
                                                <span className="badge badge-secondary">{t("SOCIETY")}</span>
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-light)', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <span style={{ background: 'var(--color-surface)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}><strong>{t("Location:")}</strong> {req.location_details}</span>
                                                <span style={{ background: 'var(--color-surface)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}><strong>{t("City:")}</strong> {req.city || 'N/A'}</span>
                                                <span style={{ fontSize: '0.8rem', padding: '6px 10px', background: 'rgba(14,165,233,0.06)', borderRadius: 8, color: 'var(--color-secondary)' }}>{t("🤖 AI will estimate waste volume from your photo")}</span>
                                            </div>
                                            <div style={{ background: 'var(--color-surface)', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-dark)', marginBottom: 8, display: 'block' }}>{t("Upload Proof Photo (required)")}</label>
                                                <input type="file" accept="image/*" onChange={(e) => setCompletionImage(p => ({ ...p, [`req_${req.id}`]: e.target.files[0] }))} style={{ fontSize: '0.85rem', width: '100%' }} />
                                            </div>
                                            <motion.button className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1rem', background: 'var(--color-secondary)' }}
                                                onClick={() => handleMarkCollectionComplete(req.id)}
                                                disabled={submittingReqId === req.id}
                                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                                <CheckCircle size={18} style={{ marginRight: 8 }} />
                                                {submittingReqId === req.id ? 'Uploading & Estimating...' : 'Mark Complete & Estimate Volume'}
                                            </motion.button>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}

            {activeTab === 'society' && !society && (
                <motion.div variants={tabVariants} initial="initial" animate="in" exit="out" className="card" style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', boxShadow: 'var(--shadow-md)', padding: '48px 40px' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', width: 80, height: 80, borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <Users size={40} color="var(--color-primary)" />
                    </div>
                    <h3 style={{ fontSize: '2rem', marginBottom: 16 }}>{t("Create a Society")}</h3>
                    <p style={{ color: 'var(--color-text-light)', marginBottom: 32, fontSize: '1.1rem' }}>{t("Establish a new society hub to manage local citizens, gamify recycling efforts, and post vital announcements.")}</p>

                    <form onSubmit={handleCreateSociety}>
                        <div className="form-group" style={{ textAlign: 'left', marginBottom: 24 }}>
                            <label className="form-label" style={{ fontSize: '1rem' }}>{t("Official Society Name")}</label>
                            <input type="text" className="form-input" value={createSocietyData.name} onChange={e => setCreateSocietyData({ ...createSocietyData, name: e.target.value })} required placeholder={t("e.g. Green Valley Residents")} style={{ padding: '16px 20px', fontSize: '1.05rem' }} />
                        </div>
                        <div className="form-group" style={{ textAlign: 'left', marginBottom: 32 }}>
                            <label className="form-label" style={{ fontSize: '1rem' }}>{t("Unique Registration Code")}</label>
                            <input type="text" className="form-input" value={createSocietyData.society_code} onChange={e => setCreateSocietyData({ ...createSocietyData, society_code: e.target.value })} required placeholder={t("e.g. GVR123")} style={{ padding: '16px 20px', fontSize: '1.05rem' }} />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}>{t("Initialize Protocol")}</button>
                    </form>
                </motion.div>
            )}

            {activeTab === 'society' && society && (
                <motion.div variants={tabVariants} initial="initial" animate="in" exit="out" className="grid-2">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                        <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                            <div className="flex-between">
                                <div>
                                    <h3 style={{ fontSize: '1.6rem', color: 'var(--color-text-dark)', margin: 0 }}>{society.name}</h3>
                                    <div style={{ fontSize: '0.95rem', color: 'var(--color-text-light)', marginTop: 4 }}>{t("Command Interface")}</div>
                                </div>
                                <div className="badge badge-primary" style={{ fontSize: '1rem', padding: '10px 16px', borderRadius: 12 }}>{t("ID:")}{' '}{society.society_code}</div>
                            </div>
                        </div>

                        <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>
                            <div className="flex-between" style={{ marginBottom: 24 }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '1.4rem', margin: 0 }}>
                                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: 8, borderRadius: 12 }}><Users size={20} color="var(--color-warning)" /></div>{t("Membership Requests")}</h3>
                                {pendingMembers.length > 0 && <div className="badge badge-warning">{pendingMembers.length}{' '}{t("Pending")}</div>}
                            </div>

                            {pendingMembers.length === 0 ? <p style={{ fontSize: '1rem', color: 'var(--color-text-light)', padding: '20px', background: 'var(--color-bg)', borderRadius: 12, textAlign: 'center' }}>{t("No pending clearance requests.")}</p> : (
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
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, fontSize: '1.4rem' }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 8, borderRadius: 12 }}><Megaphone size={20} color="var(--color-primary)" /></div>{t("Broadcast Transmission")}</h3>
                            <form onSubmit={handlePostAnnouncement}>
                                <textarea className="form-input" rows="4" placeholder={t("Enter directive to transmit to all active members...")} value={announcementMsg} onChange={e => setAnnouncementMsg(e.target.value)} required style={{ marginBottom: 16, resize: 'none', padding: '16px 20px', fontSize: '1rem' }}></textarea>
                                <button type="submit" className="btn btn-primary" style={{ padding: '14px 24px', width: '100%', fontSize: '1.05rem' }}>{t("Transmit Alert")}</button>
                            </form>
                        </div>
                    </div>

                    <div className="card" style={{ boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, fontSize: '1.5rem' }}>
                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 10, borderRadius: 12 }}><Award size={24} color="var(--color-primary)" /></div>{t("Local Hub Leaderboard")}</h3>

                        {leaderboard.length === 0 ? <p style={{ color: 'var(--color-text-light)', padding: '32px', textAlign: 'center', background: 'var(--color-bg)', borderRadius: 16 }}>{t("No active metrics logged from authorized residents yet.")}</p> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
                                {leaderboard.map((u, i) => (
                                    <div key={u.user_id} className="flex-between" style={{ padding: '20px 24px', background: i === 0 ? 'rgba(16, 185, 129, 0.05)' : 'var(--color-bg)', borderRadius: 16, border: i === 0 ? '2px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--color-border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: i === 0 ? 'var(--color-warning)' : 'var(--color-surface)', color: i === 0 ? 'white' : 'var(--color-text-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', border: i !== 0 ? '1px solid var(--color-border)' : 'none' }}>
                                                {formatNumber(i + 1)}
                                            </div>
                                            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text-dark)' }}>{u.username}</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ color: 'var(--color-text-dark)', fontWeight: 800, fontSize: '1.1rem' }}>{formatNumber(u.total_recycled_volume, { maximumFractionDigits: 1 })}{' '}{t('kg')}</div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--color-success)', fontWeight: 700 }}>{formatNumber(u.city_score, { maximumFractionDigits: 2 })}{' '}{t("XP")}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
};

export default CommunityDashboard;
