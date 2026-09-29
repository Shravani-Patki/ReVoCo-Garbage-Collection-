import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Leaf, ShieldCheck, Recycle, Heart, CheckCircle2, Navigation, Send, MapPin, Camera, Users, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import { formatNumber, t } from "../i18n";

const LandingPage = () => {
    const [stats, setStats] = useState({ pool_balance: 0, total_volume_reduced: 0, total_reports: 0, total_citizens: 0, total_donations: 0 });
    const [loading, setLoading] = useState(true);
    const [publicIssues, setPublicIssues] = useState([]);

    useEffect(() => {
        const BASE = 'http://127.0.0.1:5000/api';

        // Fetch stats
        fetch(`${BASE}/gamification/stats`).then(r => r.json()).then(s => {
            setStats(s);
            setLoading(false);
        }).catch(() => setLoading(false));

        // Fetch public issues for the map
        fetch(`${BASE}/waste/issues?status=all`).then(r => r.json()).then(issues => {
            setPublicIssues(issues || []);
        }).catch(() => { });
    }, []);

    const fmt = (n) => formatNumber(n >= 1000 ? n / 1000 : n, { maximumFractionDigits: 1 }) + (n >= 1000 ? 'k' : '');

    return (
        <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh', overflowX: 'hidden' }}>

            {/* ─── NAVBAR ─── */}
            <nav style={{ padding: '24px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1440, margin: '0 auto' }}>
                <Link to="/" style={{ fontWeight: 900, color: 'var(--color-primary-dark)', fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                    <Leaf fill="currentColor" size={24} /> <span style={{ letterSpacing: '-0.5px' }}>{t("ReVoCo")}</span>
                </Link>
                <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
                    <a href="#how-it-works" style={{ color: 'var(--color-text-dark)', textDecoration: 'none', fontWeight: 600, fontSize: '1.05rem' }}>{t("How it Works")}</a>
                    <a href="#map" style={{ color: 'var(--color-text-dark)', textDecoration: 'none', fontWeight: 600, fontSize: '1.05rem' }}>{t("Live Map")}</a>
                    <a href="#features" style={{ color: 'var(--color-text-dark)', textDecoration: 'none', fontWeight: 600, fontSize: '1.05rem' }}>{t("Features")}</a>
                    <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-dark)', textDecoration: 'none', fontWeight: 600 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-text-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ArrowRight color="white" size={16} />
                        </div>{t("Login")}</Link>
                </div>
            </nav>

            {/* ─── HERO SECTION ─── */}
            <section style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 48px 120px', display: 'flex', alignItems: 'center', gap: 60 }}>
                <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} style={{ flex: 1.2 }}>
                    <h1 style={{ fontSize: 'clamp(3.5rem, 5vw, 4.5rem)', lineHeight: 1.1, color: 'var(--color-text-dark)', marginBottom: 24, letterSpacing: '-1.5px', fontWeight: 900 }}>{t("Reward. Verify.")}<br />{t("Collect. Make Your")}<br />{t("City Cleaner!")}</h1>
                    <div style={{ marginBottom: 32 }}>
                        <div style={{ fontSize: '1.1rem', color: 'var(--color-primary)', fontWeight: 700, marginBottom: 16 }}>{t("The ReVoCo ecosystem benefits")}</div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {[
                                "Spot & Report Waste Anomalies",
                                "Verified Community Cleanups",
                                "Earn Eco-Credits & Rewards",
                                "Transparent NGO Donations"
                            ].map((item, i) => (
                                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--color-text-light)', fontSize: '1.05rem', fontWeight: 500 }}>
                                    <CheckCircle2 size={18} color="var(--color-primary)" /> {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <Link to="/login" style={{ display: 'inline-block', background: 'var(--color-primary)', color: 'white', textDecoration: 'none', padding: '16px 36px', borderRadius: 8, fontSize: '1.05rem', fontWeight: 700, boxShadow: 'var(--shadow-sm)' }}>{t("EXPLORE PLATFORM")}</Link>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} style={{ flex: 1 }}>
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '4/5', borderRadius: 24, overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
                        <img src="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80" alt={t("Eco action")} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <Leaf size={180} color="var(--color-primary)" style={{ position: 'absolute', right: -60, bottom: -60, opacity: 0.15, transform: 'rotate(-45deg)' }} />
                    </div>
                </motion.div>
            </section>

            {/* ─── MULTI-QUOTES / INSPIRATION ─── */}
            <section style={{ maxWidth: 1000, margin: '0 auto 120px', padding: '0 48px' }}>
                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ background: 'var(--pastel-green)', padding: '40px 60px', borderRadius: 24, position: 'relative', borderLeft: '6px solid var(--color-primary)' }}>
                    <div style={{ fontSize: '4rem', color: 'var(--color-primary)', position: 'absolute', top: 10, left: 20, opacity: 0.2, fontFamily: 'serif', lineHeight: 1 }}>{t("\"")}</div>
                    <p style={{ fontSize: '1.25rem', color: 'var(--color-primary-dark)', lineHeight: 1.8, fontWeight: 500, margin: 0, position: 'relative', zIndex: 1 }}>{t("We ensure safety from all dangerous chemicals by replacing harmful materials with natural elements. Using eco-friendly products improves your quality of life in terms of mortality, age, diseases, and illnesses.")}</p>
                    <div style={{ fontSize: '4rem', color: 'var(--color-primary)', position: 'absolute', bottom: -10, right: 30, opacity: 0.2, fontFamily: 'serif', lineHeight: 1, transform: 'rotate(180deg)' }}>{t("\"")}</div>
                </motion.div>
            </section>

            {/* ─── HOW IT WORKS SECTION ─── */}
            <section id="how-it-works" style={{ background: 'var(--pastel-blue)', padding: '120px 48px' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <h2 style={{ fontSize: '2.8rem', color: 'var(--color-text-dark)', fontWeight: 900, marginBottom: 16, textAlign: 'center', letterSpacing: '-1px' }}>{t("How ReVoCo Works")}</h2>
                    <p style={{ textAlign: 'center', color: 'var(--color-text-light)', fontSize: '1.2rem', marginBottom: 64, maxWidth: 600, margin: '0 auto 64px' }}>{t("A complete end-to-end lifecycle powered by community participation, municipality coordination, and AI verification.")}</p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 32 }}>
                        {[
                            { step: '01', title: 'Spot & Report', desc: 'Citizens click a photo of unmanaged waste. AI estimates the volume and auto-tags the location.', icon: Camera },
                            { step: '02', title: 'Route & Assign', desc: 'Municipalities review the report and assign a registered community helper to the task.', icon: Navigation },
                            { step: '03', title: 'Clean & Verify', desc: 'Helpers clean the area and upload proof. Citizens verify the cleanup to ensure quality.', icon: ShieldCheck },
                            { step: '04', title: 'Earn Rewards', desc: 'Both citizens and municipalities earn Eco-Points. Societies can donate them to verified NGOs.', icon: Coins }
                        ].map((item, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} style={{ background: 'white', padding: '40px 32px', borderRadius: 24, boxShadow: 'var(--shadow-sm)', position: 'relative' }}>
                                <div style={{ fontSize: '4rem', fontWeight: 900, color: 'var(--pastel-green)', position: 'absolute', top: 16, right: 24, lineHeight: 1, opacity: 0.5 }}>{item.step}</div>
                                <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--pastel-green)', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, position: 'relative', zIndex: 1 }}>
                                    <item.icon size={32} />
                                </div>
                                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-dark)', marginBottom: 12, position: 'relative', zIndex: 1 }}>{t(item.title)}</h3>
                                <p style={{ color: 'var(--color-text-light)', lineHeight: 1.6, position: 'relative', zIndex: 1 }}>{t(item.desc)}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── LIVE IMPACT MAP ─── */}
            <section id="map" style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 48px' }}>
                <h2 style={{ fontSize: '2.5rem', color: 'var(--color-text-dark)', fontWeight: 800, marginBottom: 16, textAlign: 'center', letterSpacing: '-1px' }}>{t("Live Impact Map")}</h2>
                <p style={{ textAlign: 'center', color: 'var(--color-text-light)', fontSize: '1.1rem', marginBottom: 48, maxWidth: 600, margin: '0 auto 48px' }}>{t("See real-time civic reports and successful cleanups across your region.")}</p>

                {/* Legend overlay */}
                <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', boxShadow: 'var(--shadow-md)', border: '4px solid white' }}>
                    <div style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(255,255,255,0.95)', padding: '12px 20px', borderRadius: 14, boxShadow: 'var(--shadow-sm)', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text-dark)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
                            <MapPin size={16} color="var(--color-primary)" />{' '}{t("Live Signals (")}{publicIssues.length}{t(")")}</div>
                        <div style={{ display: 'flex', gap: 14, fontSize: '0.82rem', color: 'var(--color-text-light)', fontWeight: 600 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#D32F2F', display: 'inline-block' }} />{' '}{t("Pending")}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#388E3C', display: 'inline-block' }} />{' '}{t("Cleaned")}</span>
                        </div>
                    </div>

                    <MapContainer
                        center={[20.5937, 78.9629]}
                        zoom={5}
                        style={{ height: 450, width: '100%', zIndex: 1 }}
                        scrollWheelZoom={false}
                    >
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        {publicIssues.filter(i => i.latitude && i.longitude).map((issue, idx) => {
                            const isSolved = issue.status === 'completed' || issue.status === 'verified';
                            return (
                                <CircleMarker
                                    key={idx}
                                    center={[parseFloat(issue.latitude), parseFloat(issue.longitude)]}
                                    radius={10}
                                    pathOptions={{
                                        color: isSolved ? '#388E3C' : '#D32F2F',
                                        fillColor: isSolved ? '#81C784' : '#EF9A9A',
                                        fillOpacity: 0.85,
                                        weight: 2
                                    }}
                                >
                                    <Tooltip>
                                        <div style={{ fontWeight: 600 }}>{t("📍")}{' '}{issue.city || issue.address_text || 'Unknown Location'}<br />{t("Status:")}{' '}<strong>{t(issue.status)}</strong>
                                        </div>
                                    </Tooltip>
                                </CircleMarker>
                            );
                        })}
                        {publicIssues.filter(i => i.latitude && i.longitude).length === 0 && (
                            <CircleMarker center={[20.5937, 78.9629]} radius={0} />
                        )}
                    </MapContainer>
                </div>
            </section>

            {/* ─── OUR GROWTH (CIRCULAR STATS) ─── */}
            <section id="stats" style={{ background: 'var(--color-surface-hover)', padding: '120px 48px' }}>
                <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '2.5rem', color: 'var(--color-text-dark)', fontWeight: 800, marginBottom: 64, letterSpacing: '-1px' }}>{t("Our Growth")}</h2>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: 60, flexWrap: 'wrap' }}>
                        {[
                            { value: loading ? '...' : `${fmt(stats.total_citizens)}+`, label: 'Happy Citizens', icon: Leaf },
                            { value: loading ? '...' : `${fmt(stats.total_volume_reduced)}kg`, label: 'Waste Recycled', icon: Recycle },
                            { value: '98%', label: 'Cleanliness Rating', icon: Heart }
                        ].map((stat, i) => (
                            <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: 180, height: 180, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', border: '5px solid var(--pastel-green)', boxShadow: 'var(--shadow-md)', position: 'relative' }}>
                                    <div style={{ position: 'absolute', inset: -15, border: '1px dashed var(--color-primary)', borderRadius: '50%', opacity: 0.3 }} />
                                    <h3 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--color-text-dark)', margin: 0, letterSpacing: '-1px' }}>{stat.value}</h3>
                                    <p style={{ fontSize: '1rem', color: 'var(--color-text-light)', margin: 0, fontWeight: 600, textAlign: 'center', padding: '0 20px' }}>{t(stat.label)}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── ECO-ACTIVITIES (CARDS UI) ─── */}
            <section id="features" style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 48px' }}>
                <h2 style={{ fontSize: '2.5rem', color: 'var(--color-text-dark)', fontWeight: 800, marginBottom: 64, textAlign: 'center', letterSpacing: '-1px' }}>{t("Platform Capabilities")}</h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 40 }}>
                    {[
                        { title: 'Report Waste Anomalies', desc: 'Pinpoint locations and upload imagery for the municipality.', img: 'https://images.unsplash.com/photo-1611288875691-031e60dcba0d?auto=format&fit=crop&w=600&q=80', action: 'START REPORTING' },
                        { title: 'Community Cleans', desc: 'Registered helpers are dispatched to verify and resolve the reports.', img: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80', action: 'VIEW MISSIONS' },
                        { title: 'Earn & Donate Rewards', desc: 'Secure ecosystem points upon verification. Transfer value to local NGOs.', img: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=600&q=80', action: 'VIEW REWARDS' }
                    ].map((card, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} style={{ background: 'white', padding: 24, borderRadius: 24, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' }}>
                            <div style={{ width: '100%', height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
                                <img src={card.img} alt={t(card.title)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <h3 style={{ fontSize: '1.4rem', color: 'var(--color-text-dark)', fontWeight: 800, marginBottom: 12 }}>{t(card.title)}</h3>
                            <p style={{ color: 'var(--color-text-light)', fontSize: '1rem', lineHeight: 1.6, marginBottom: 24 }}>{t(card.desc)}</p>
                            <Link to="/login" style={{ display: 'block', textAlign: 'center', border: '2px solid var(--color-primary)', color: 'var(--color-primary-dark)', padding: '10px 24px', borderRadius: 999, fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s', fontSize: '0.9rem' }} onMouseOver={e => { e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.color = 'white'; }} onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-primary-dark)'; }}>
                                {card.action}
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ─── FOOTER (DARK GREEN NEWSLETTER) ─── */}
            <footer style={{ background: 'var(--color-primary-dark)', padding: '80px 48px', color: 'white' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>

                    {/* Newsletter Box */}
                    <div style={{ background: 'white', padding: '40px 60px', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 64, gap: 40, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 300 }}>
                            <h3 style={{ color: 'var(--color-text-dark)', fontSize: '2rem', fontWeight: 800, marginBottom: 16 }}>{t("Join Our Green Letter")}</h3>
                            <p style={{ color: 'var(--color-text-light)', margin: 0, fontSize: '1.05rem' }}>{t("Stay in the loop with eco tips, platform updates, and local impact stories — straight to your inbox.")}</p>
                        </div>
                        <div style={{ flex: 1, minWidth: 300, display: 'flex', background: 'var(--color-bg)', border: '2px solid var(--pastel-green)', borderRadius: 8, padding: 8 }}>
                            <input type="email" placeholder={t("Enter Your E-Mail.....")} style={{ flex: 1, border: 'none', background: 'transparent', padding: '12px 20px', fontSize: '1.05rem', outline: 'none', color: 'var(--color-text-dark)' }} />
                            <button style={{ background: 'var(--color-text-dark)', color: 'white', border: 'none', padding: '12px 32px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: '1.05rem' }}>{t("Subscribe")}</button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 40, marginBottom: 48 }}>
                        <div>
                            <h4 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Leaf />{' '}{t("ReVoCo")}</h4>
                            <p style={{ opacity: 0.8, fontSize: '0.95rem', margin: 0 }}>{t("Bring nature closer to you.")}</p>
                        </div>
                        <div>
                            <h5 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>{t("Customer Support")}</h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.8, fontSize: '0.95rem' }}>
                                <span>{t("FAQs")}</span>
                                <span>{t("Platform Safety")}</span>
                                <span>{t("Return & Refund Policy")}</span>
                                <span>{t("Eco-Credits Help")}</span>
                            </div>
                        </div>
                        <div>
                            <h5 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>{t("Connect With Us")}</h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.8, fontSize: '0.95rem' }}>
                                <span>{t("Email: support@revoco.eco")}</span>
                                <span>{t("Phone: +1 234-567-890")}</span>
                                <span>{t("Location: 123 Green Grove, Central City")}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, textAlign: 'center', opacity: 0.7, fontSize: '0.9rem' }}>{t("© 2026 REVOCO PLATFORM INC.")}<br />{t("Made with 💚 for nature lovers.")}</div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
