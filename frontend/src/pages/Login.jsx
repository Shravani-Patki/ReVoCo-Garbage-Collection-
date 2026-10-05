import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { User, Building, Truck, ShieldAlert, LogIn, UserPlus } from 'lucide-react';
import { t } from "../i18n";

const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
    exit: { opacity: 0, scale: 0.95 }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

const ROLES = [
    { role: 'citizen', icon: User, title: 'User', color: '#10B981', desc: 'Identify waste, request collection, and check local material rates.' },
    { role: 'community_helper', icon: Truck, title: 'Informal Collector', color: '#F59E0B', desc: 'Find pickup requests, respond to company demand, and track transactions.' },
    { role: 'society', icon: Building, title: 'Recycling Company', color: '#0EA5E9', desc: 'Request recyclable lots from collectors and track payments.' },
    { role: 'municipality', icon: ShieldAlert, title: 'Municipality', color: '#EF4444', desc: 'Register companies, organize e-waste drives, and monitor local rates.' },
];

// Indian states and cities mapping (reduced to popular for demo purposes)
const LOCATIONS = {
    "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik"],
    "Karnataka": ["Bengaluru", "Mysuru", "Mangaluru", "Hubli"],
    "Delhi": ["New Delhi", "North Delhi", "South Delhi"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai"],
    "Gujarat": ["Ahmedabad", "Surat", "Vadodara"]
};

const RoleCard = ({ icon: Icon, title, description, onClick, color }) => (
    <motion.div
        variants={itemVariants}
        className="card"
        style={{ cursor: 'pointer', textAlign: 'center', padding: '32px', boxShadow: 'var(--shadow-md)', borderTop: `4px solid ${color}` }}
        whileHover={{ y: -8, boxShadow: `0 20px 40px ${color}22` }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
    >
        <div style={{ background: `${color}18`, width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Icon size={38} color={color} />
        </div>
        <h3 style={{ fontSize: '1.2rem', marginBottom: 10, color: 'var(--color-text-dark)' }}>{t(title)}</h3>
        <p style={{ fontSize: '0.93rem', margin: 0, color: 'var(--color-text-light)', lineHeight: 1.6 }}>{t(description)}</p>
    </motion.div>
);

const Login = () => {
    const [selectedRole, setSelectedRole] = useState(null);
    const [isRegister, setIsRegister] = useState(false);
    const [registrationPending, setRegistrationPending] = useState(false);
    const [formData, setFormData] = useState({ username: '', email: '', password: '', phone: '', address: '', cpcbCode: '', state: '', city: '' });
    const navigate = useNavigate();

    const isAdmin = selectedRole === 'admin';
    const roleInfo = ROLES.find(r => r.role === selectedRole);

    const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    // Handle state selection to clear city if state changes
    const handleStateChange = (e) => setFormData({ ...formData, state: e.target.value, city: '' });

    const handleRoleSelect = (role) => {
        setSelectedRole(role);
        setIsRegister(role === 'society');
        setRegistrationPending(false);
        setFormData({ username: '', email: '', password: '', phone: '', address: '', cpcbCode: '', state: '', city: '', role });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isRegister && selectedRole === 'society' && !/^\d{10}$/.test(formData.cpcbCode)) {
            toast.error(t("Enter a valid 10-digit CPCB code."));
            return;
        }
        const url = isRegister
            ? '/api/auth/register'
            : '/api/auth/login';
        const toastId = toast.loading(isRegister ? 'Creating account...' : 'Verifying credentials...');

        try {
            const payload = isRegister
                ? { username: formData.username, email: formData.email, password: formData.password, phone: formData.phone, address: formData.address, cpcb_code: selectedRole === 'society' ? formData.cpcbCode : undefined, state: formData.state, city: formData.city, role: selectedRole }
                : { email: formData.email, password: formData.password };

            const res = await axios.post(url, payload);
            if (isRegister && selectedRole === 'society' && res.status === 202) {
                setIsRegister(false);
                setRegistrationPending(true);
                toast.update(toastId, { render: res.data.message, type: 'success', isLoading: false, autoClose: 6000 });
                return;
            }
            const user = { ...res.data.user, token: res.data.token };
            localStorage.setItem('user', JSON.stringify(user));
            window.dispatchEvent(new Event('revoco-user-changed'));

            toast.update(toastId, { render: `Welcome to ReVoCo, ${user.username}!`, type: 'success', isLoading: false, autoClose: 3000 });

            setTimeout(() => {
                switch (user.role) {
                    case 'society': navigate('/society'); break;
                    case 'municipality': navigate('/municipality'); break;
                    case 'community_helper': navigate('/community'); break;
                    case 'admin': navigate('/admin'); break;
                    default: navigate('/user'); break;
                }
            }, 1000);
        } catch (err) {
            toast.update(toastId, { render: err.response?.data?.error || 'Authentication Failed', type: 'error', isLoading: false, autoClose: 4000 });
        }
    };

    return (
        <AnimatePresence mode="wait">

            {/* ── Role Selection ── */}
            {!selectedRole && (
                <motion.div key="roles" className="container" variants={containerVariants} initial="hidden" animate="show" exit="exit"
                    style={{ paddingTop: '80px', paddingBottom: '80px' }}>
                    <motion.div variants={itemVariants} className="text-center" style={{ marginBottom: 60 }}>
                        <h2 style={{ fontSize: '3rem', marginBottom: 16, color: 'var(--color-text-dark)', fontWeight: 800 }}>{t("Who are you?")}</h2>
                        <p style={{ fontSize: '1.15rem', color: 'var(--color-text-light)', maxWidth: 600, margin: '0 auto' }}>{t("Select your role to access the right dashboard and features for your account type.")}</p>
                    </motion.div>
                    <div className="grid-3" style={{ maxWidth: '1100px', margin: '0 auto' }}>
                        {ROLES.map(r => (
                            <RoleCard key={r.role} icon={r.icon} title={t(r.title)} description={t(r.desc)} color={r.color} onClick={() => handleRoleSelect(r.role)} />
                        ))}
                    </div>
                </motion.div>
            )}

            {/* ── Login / Sign Up Form ── */}
            {selectedRole && (
                <motion.div key="form" className="container flex-center" style={{ minHeight: '80vh' }} variants={containerVariants} initial="hidden" animate="show" exit="exit">
                    <motion.div variants={itemVariants} className="card" style={{ width: '100%', maxWidth: '480px', padding: '48px 40px', boxShadow: 'var(--shadow-lg)' }}>

                        <button type="button" className="btn" style={{ background: 'transparent', padding: 0, marginBottom: 32, fontSize: '0.95rem', color: 'var(--color-text-light)', fontWeight: 600 }}
                            onClick={() => setSelectedRole(null)}>{t("← Change Role")}</button>

                        <div className="text-center" style={{ marginBottom: 32 }}>
                            <div style={{ background: `${roleInfo?.color}18`, width: 72, height: 72, borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                {isRegister
                                    ? <UserPlus size={36} color={roleInfo?.color || 'var(--color-primary)'} />
                                    : <LogIn size={36} color={roleInfo?.color || 'var(--color-primary)'} />}
                            </div>
                            <h2 style={{ fontSize: '2rem', textTransform: 'capitalize', marginBottom: 8, color: 'var(--color-text-dark)', fontWeight: 800 }}>
                                {selectedRole === 'society' && isRegister ? 'Company Registration' : `${roleInfo?.title} ${isRegister ? 'Sign Up' : 'Login'}`}
                            </h2>
                            <p style={{ color: 'var(--color-text-light)' }}>
                                {isRegister ? 'Create your account to get started.' : 'Enter your credentials to continue.'}
                            </p>
                        </div>

                        {registrationPending && selectedRole === 'society' && (
                            <div role="status" style={{ marginBottom: 24, padding: 14, borderRadius: 10, background: 'rgba(245,158,11,0.1)', color: 'var(--color-text-dark)', border: '1px solid rgba(245,158,11,0.35)' }}>
                                Your company registration is pending municipality verification. You can sign in after it is approved.
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <AnimatePresence mode="popLayout">
                                {isRegister && (
                                    <motion.div
                                        key="signup-fields"
                                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <div className="form-group" style={{ marginBottom: 20 }}>
                                            <label className="form-label">{selectedRole === 'society' ? t("Company name") : t("Full Name")}</label>
                                            <input type="text" name="username" className="form-input" placeholder={t("Your display name")} required={isRegister} onChange={handleInputChange} value={formData.username} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 20 }}>
                                            <label className="form-label">{t("Contact Number")}</label>
                                            <input type="tel" name="phone" className="form-input" placeholder={t("+91 98765 43210")} required={isRegister} onChange={handleInputChange} value={formData.phone} />
                                        </div>
                                        {selectedRole === 'society' && (
                                            <div className="form-group" style={{ marginBottom: 20 }}>
                                                <label className="form-label">{t("10-digit CPCB Code")}</label>
                                                <input type="text" name="cpcbCode" className="form-input" placeholder={t("Enter CPCB registration code")} inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required={isRegister} onChange={handleInputChange} value={formData.cpcbCode} />
                                            </div>
                                        )}
                                        <div className="form-group" style={{ marginBottom: 20 }}>
                                            <label className="form-label">{t("Address")}</label>
                                            <textarea name="address" className="form-input" placeholder={t("Street address and area")} required={isRegister} onChange={handleInputChange} value={formData.address} rows={2} />
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                                            <div className="form-group">
                                                <label className="form-label">{t("State")}</label>
                                                <select name="state" className="form-input" required={isRegister} onChange={handleStateChange} value={formData.state}>
                                                    <option value="">{t("Select State")}</option>
                                                    {Object.keys(LOCATIONS).map(state => (
                                                        <option key={state} value={state}>{t(state)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">{t("City")}</label>
                                                <select name="city" className="form-input" required={isRegister} onChange={handleInputChange} value={formData.city} disabled={!formData.state}>
                                                    <option value="">{t("Select City")}</option>
                                                    {formData.state && LOCATIONS[formData.state].map(city => (
                                                        <option key={city} value={city}>{t(city)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="form-group" style={{ marginBottom: 20 }}>
                                <label className="form-label">{t("Email Address")}</label>
                                <input type="email" name="email" className="form-input" placeholder={t("you@example.com")} required onChange={handleInputChange} value={formData.email} />
                            </div>

                            <div className="form-group" style={{ marginBottom: 8 }}>
                                <label className="form-label">{t("Password")}</label>
                                <input type="password" name="password" className="form-input" placeholder={t("••••••••")} required onChange={handleInputChange} value={formData.password} />
                            </div>

                            <motion.button type="submit" className="btn btn-primary"
                                style={{ width: '100%', marginTop: 28, padding: '16px', fontSize: '1.1rem', background: roleInfo?.color }}
                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                {isRegister ? (selectedRole === 'society' ? 'Register Company' : 'Create Account') : 'Login'}
                            </motion.button>
                        </form>

                        {/* Admin: no register option */}
                        {!isAdmin && (
                            <div className="text-center" style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--color-border)' }}>
                                <span style={{ color: 'var(--color-text-light)', fontSize: '0.95rem' }}>
                                    {isRegister ? (selectedRole === 'society' ? 'Already registered? ' : 'Already have an account? ') : "Don't have an account? "}
                                </span>
                                <button type="button" className="btn" style={{ background: 'transparent', color: roleInfo?.color || 'var(--color-primary)', padding: 0, fontWeight: 700, fontSize: '0.95rem' }}
                                    onClick={() => setIsRegister(!isRegister)}>
                                    {isRegister ? 'Log in here.' : (selectedRole === 'society' ? 'Register company.' : 'Sign up here.')}
                                </button>
                            </div>
                        )}

                        {isAdmin && (
                            <p style={{ textAlign: 'center', marginTop: 24, color: 'var(--color-text-light)', fontSize: '0.88rem', background: 'var(--color-bg)', padding: '10px 16px', borderRadius: 8 }}>{t("🔒 Admin access is pre-configured. Contact the system owner for credentials.")}</p>
                        )}
                    </motion.div>
                </motion.div>
            )}

        </AnimatePresence>
    );
};

export default Login;
