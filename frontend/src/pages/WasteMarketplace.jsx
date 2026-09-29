import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Activity, ImagePlus, IndianRupee, MapPin, Package, Truck, X } from 'lucide-react';
import { formatCurrency, formatDate, formatNumber, t } from "../i18n";

const BASE = 'http://127.0.0.1:5000';
const WASTE_TYPES = ['E-waste', 'Paper', 'Cardboard', 'Plastic', 'Metal', 'Glass', 'Other'];

const cardStyle = { boxShadow: 'var(--shadow-md)' };
const fieldStyle = { background: 'var(--color-bg)' };
const emptyMarket = { pickups: [], lots: [], trades: [], rates: [], drives: [], companies: [] };

const compressImage = (file) => new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
        const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(imageUrl);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    image.onerror = () => { URL.revokeObjectURL(imageUrl); reject(new Error('Image could not be decoded.')); };
    image.src = imageUrl;
});

const MarketRates = ({ rates }) => (
    <div className="card" style={cardStyle}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><IndianRupee size={20} color="var(--color-primary)" />{' '}{t("Published Local Rates")}</h3>
        <p>{t("Rates published by your municipality. Confirm the effective date before making a sale.")}</p>
        {rates.length ? (
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead><tr>{['Material', 'Rate', 'Effective date', 'Source'].map(label => <th key={t(label)} style={{ padding: 12, borderBottom: '1px solid var(--color-border)' }}>{t(label)}</th>)}</tr></thead>
                    <tbody>{rates.map(rate => (
                        <tr key={rate.id}>
                            <td style={{ padding: 12, borderBottom: '1px solid var(--color-border)' }}>{t(rate.material)}</td>
                            <td style={{ padding: 12, borderBottom: '1px solid var(--color-border)', fontWeight: 700 }}>{formatCurrency(rate.price)}{t('/kg')}</td>
                            <td style={{ padding: 12, borderBottom: '1px solid var(--color-border)' }}>{formatDate(rate.effectiveDate)}</td>
                            <td style={{ padding: 12, borderBottom: '1px solid var(--color-border)' }}>{rate.source || 'Municipality'}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
        ) : <p style={{ padding: 16, background: 'var(--color-bg)', borderRadius: 12, margin: 0 }}>{t("Your municipality has not published local rates yet.")}</p>}
    </div>
);

const UserWastePanel = ({ user, activeTab }) => {
    const [market, setMarket] = useState(emptyMarket);
    const [pickup, setPickup] = useState({ material: WASTE_TYPES[0], quantity: '', address: user.address || '' });
    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState('');
    const pickupFileRef = useRef(null);
    const [estimateImage, setEstimateImage] = useState(null);
    const [estimate, setEstimate] = useState(null);
    const [estimating, setEstimating] = useState(false);

    useEffect(() => () => {
        if (photoPreview) URL.revokeObjectURL(photoPreview);
    }, [photoPreview]);

    useEffect(() => {
        let active = true;
        const loadMarket = async () => {
            const location = new URLSearchParams({ city: user.city || '', state: user.state || '' });
            try {
                const [pickups, rates, drives] = await Promise.all([
                    axios.get(`${BASE}/api/market/pickups?user_id=${user.id}`),
                    axios.get(`${BASE}/api/market/rates?${location}`),
                    axios.get(`${BASE}/api/market/drives?${location}`),
                ]);
                if (active) setMarket({ ...emptyMarket, pickups: pickups.data, rates: rates.data, drives: drives.data });
            } catch (error) {
                if (active) console.error('Failed to load marketplace data', error);
            }
        };
        loadMarket();
        const interval = setInterval(loadMarket, 10000);
        return () => { active = false; clearInterval(interval); };
    }, [user.id, user.city, user.state]);

    const handlePickup = async (event) => {
        event.preventDefault();
        if (!photo) return toast.error(t("Upload a photo of the waste lot."));
        if (photo.size > 20 * 1024 * 1024) return toast.error(t("Choose an image smaller than 20 MB."));
        const form = event.currentTarget;
        try {
            const response = await axios.post(`${BASE}/api/market/pickups`, {
                user_id: user.id,
                material: pickup.material,
                quantity: Number(pickup.quantity),
                address: pickup.address,
                image_url: await compressImage(photo),
            });
            setMarket(current => ({ ...current, pickups: [response.data, ...current.pickups] }));
            setPhoto(null);
            setPhotoPreview('');
            if (pickupFileRef.current) pickupFileRef.current.value = '';
            form.reset();
            setPickup({ material: WASTE_TYPES[0], quantity: '', address: user.address || '' });
            toast.success(t("Pickup request shared with collectors."));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not submit the pickup request.');
        }
    };

    const selectPickupPhoto = (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) return toast.error(t("Choose an image file."));
        if (file.size > 20 * 1024 * 1024) return toast.error(t("Choose an image smaller than 20 MB."));
        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(file));
    };

    const handleEstimate = async (event) => {
        event.preventDefault();
        if (!estimateImage) return toast.error(t("Choose a waste photo first."));
        setEstimating(true);
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const response = await axios.post(`${BASE}/api/waste/estimate`, { image: reader.result });
                setEstimate(response.data);
            } catch (error) {
                toast.error(error.response?.data?.error || 'The weight and volume estimation service is not available.');
            } finally {
                setEstimating(false);
            }
        };
        reader.onerror = () => { setEstimating(false); toast.error(t("Could not read the selected photo.")); };
        reader.readAsDataURL(estimateImage);
    };

    if (activeTab === 'pickup') return (
        <div className="grid-2">
            <div className="card" style={cardStyle}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Truck size={22} color="var(--color-primary)" />{' '}{t("Request a Pickup")}</h3>
                <p>{t("Your request and photo will be visible to informal collectors using this browser-based prototype.")}</p>
                <form onSubmit={handlePickup}>
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">{t("Waste type")}</label>
                        <select className="form-input" style={fieldStyle} value={pickup.material} onChange={event => setPickup({ ...pickup, material: event.target.value })}>{WASTE_TYPES.map(type => <option key={type}>{t(type)}</option>)}</select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">{t("Approximate quantity (kg)")}</label>
                        <input className="form-input" style={fieldStyle} type="number" min="0.1" step="0.1" required value={pickup.quantity} onChange={event => setPickup({ ...pickup, quantity: event.target.value })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">{t("Pickup address")}</label>
                        <textarea className="form-input" style={fieldStyle} rows={2} required value={pickup.address} onChange={event => setPickup({ ...pickup, address: event.target.value })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="form-label" htmlFor="pickup-photo">{t("Waste photo")}</label>
                        <input ref={pickupFileRef} id="pickup-photo" type="file" accept="image/*" required onChange={event => selectPickupPhoto(event.target.files?.[0])} style={{ display: 'none' }} />
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => pickupFileRef.current?.click()}
                            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pickupFileRef.current?.click(); } }}
                            onDragOver={event => event.preventDefault()}
                            onDrop={event => { event.preventDefault(); selectPickupPhoto(event.dataTransfer.files?.[0]); }}
                            style={{ border: '2px dashed var(--color-primary)', borderRadius: 14, padding: photoPreview ? 10 : '24px 16px', background: 'var(--pastel-green)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s, border-color 0.2s' }}
                        >
                            {photoPreview ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}>
                                    <img src={photoPreview} alt={t("Selected waste")} style={{ width: 104, height: 88, objectFit: 'cover', borderRadius: 9, flexShrink: 0 }} />
                                    <div style={{ minWidth: 0 }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{photo.name}</strong><span style={{ color: 'var(--color-text-light)', fontSize: '0.88rem' }}>{t("Photo ready · click to replace")}</span></div>
                                </div>
                            ) : (
                                <><ImagePlus size={28} color="var(--color-primary)" style={{ margin: '0 auto 8px' }} /><strong style={{ display: 'block', color: 'var(--color-text-dark)' }}>{t("Choose a waste photo")}</strong><span style={{ color: 'var(--color-text-light)', fontSize: '0.9rem' }}>{t("Browse or drag an image here · JPG, PNG, WEBP · max 20 MB")}</span></>
                            )}
                        </div>
                        {photoPreview && <button type="button" className="btn" onClick={() => { setPhoto(null); setPhotoPreview(''); if (pickupFileRef.current) pickupFileRef.current.value = ''; }} style={{ background: 'transparent', color: 'var(--color-danger)', padding: '6px 0', gap: 6 }}><X size={16} />{' '}{t("Remove photo")}</button>}
                    </div>
                    <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>{t("Post Pickup Request")}</button>
                </form>
            </div>
            <div className="card" style={cardStyle}>
                <h3>{t("My Pickup Requests")}</h3>
                {market.pickups.map(item => (
                    <div key={item.id} style={{ display: 'flex', gap: 14, padding: 14, background: 'var(--color-bg)', borderRadius: 12, marginBottom: 12 }}>
                        {item.image_url && <img src={item.image_url} alt={t("Waste lot")} style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 8 }} />}
                        <div><strong>{t(item.material)}{' '}{t("·")}{' '}{formatNumber(item.quantity, { maximumFractionDigits: 2 })}{' '}{t("kg")}</strong><div>{item.address}</div><span className="badge badge-primary" style={{ marginTop: 6 }}>{t(item.status)}</span>{item.collector_name && <div>{t("Collector:")}{' '}{item.collector_name}</div>}</div>
                    </div>
                ))}
                {!market.pickups.length && <p>{t("No pickup requests yet.")}</p>}
            </div>
        </div>
    );

    if (activeTab === 'estimate') return (
        <div className="card" style={{ ...cardStyle, maxWidth: 680, margin: '0 auto' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Activity size={22} color="var(--color-primary)" />{' '}{t("Weight and Volume Estimate")}</h3>
            <p>{t("Upload a clear photo. The estimate requires the configured waste-estimation model.")}</p>
            <form onSubmit={handleEstimate}>
                <input className="form-input" style={{ ...fieldStyle, marginBottom: 20 }} type="file" accept="image/*" required onChange={event => { setEstimateImage(event.target.files?.[0] || null); setEstimate(null); }} />
                <button className="btn btn-primary" disabled={!estimateImage || estimating}>{estimating ? 'Estimating...' : 'Estimate Weight and Volume'}</button>
            </form>
            {estimate && <div style={{ marginTop: 24, padding: 20, background: 'var(--pastel-green)', borderRadius: 12 }}><strong>{t("Estimated weight:")}</strong> {estimate.weight_kg ?? 'Unavailable'}{' '}{t("kg")}{' '}<br /><strong>{t("Estimated volume:")}</strong> {estimate.volume_liters ?? 'Unavailable'}{' '}{t("L")}</div>}
        </div>
    );

    if (activeTab === 'rates') return <MarketRates rates={market.rates} />;
    if (activeTab === 'drives') return (
        <div className="card" style={cardStyle}>
            <h3>{t("Upcoming E-waste Drives")}</h3>
            {market.drives.map(drive => <div key={drive.id} style={{ padding: 16, borderBottom: '1px solid var(--color-border)' }}><strong>{t(drive.title)}</strong><div>{drive.date}{' '}{t("·")}{' '}{drive.location}</div><p style={{ margin: '6px 0 0' }}>{drive.details}</p></div>)}
            {!market.drives.length && <p>{t("No upcoming drives have been announced.")}</p>}
        </div>
    );
    return null;
};

const MarketRoleDashboard = ({ role }) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [market, setMarket] = useState(emptyMarket);
    const [activeTab, setActiveTab] = useState(role === 'collector' ? 'pickups' : 'lots');
    const [lot, setLot] = useState({ material: WASTE_TYPES[0], quantity: '', price: '' });
    const isCollector = role === 'collector';

    useEffect(() => {
        let active = true;
        const loadMarket = async () => {
            const location = new URLSearchParams({ city: user.city || '', state: user.state || '' });
            try {
                const [pickups, lots, trades, rates] = await Promise.all([
                    isCollector ? axios.get(`${BASE}/api/market/pickups?collector_id=${user.id}`) : Promise.resolve({ data: [] }),
                    axios.get(isCollector ? `${BASE}/api/market/lots?collector_id=${user.id}` : `${BASE}/api/market/lots`),
                    axios.get(`${BASE}/api/market/trades?user_id=${user.id}`),
                    axios.get(`${BASE}/api/market/rates?${location}`),
                ]);
                if (active) setMarket({ ...emptyMarket, pickups: pickups.data, lots: lots.data, trades: trades.data, rates: rates.data });
            } catch (error) {
                if (active) console.error('Failed to load marketplace data', error);
            }
        };
        loadMarket();
        const interval = setInterval(loadMarket, 10000);
        return () => { active = false; clearInterval(interval); };
    }, [isCollector, user.id, user.city, user.state]);

    const acceptPickup = async (pickupId) => {
        try {
            const response = await axios.post(`${BASE}/api/market/pickups/${pickupId}/accept`, { collector_id: user.id });
            setMarket(current => ({ ...current, pickups: current.pickups.map(item => item.id === pickupId ? response.data : item) }));
            toast.success(t("Pickup accepted."));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not accept this pickup.');
        }
    };

    const acceptTrade = async (tradeId) => {
        try {
            const response = await axios.post(`${BASE}/api/market/trades/${tradeId}/accept`, { collector_id: user.id });
            setMarket(current => ({ ...current, trades: current.trades.map(item => item.id === tradeId ? response.data : item) }));
            toast.success(t("Lot request accepted. Payment is pending."));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not accept this lot request.');
        }
    };

    const publishLot = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
            const response = await axios.post(`${BASE}/api/market/lots`, { collector_id: user.id, ...lot });
            setMarket(current => ({ ...current, lots: [response.data, ...current.lots] }));
            setLot({ material: WASTE_TYPES[0], quantity: '', price: '' });
            form.reset();
            toast.success(t("Waste lot listed for companies."));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not publish this lot.');
        }
    };

    const requestLot = async (selectedLot) => {
        try {
            const response = await axios.post(`${BASE}/api/market/lots/${selectedLot.id}/request`, { company_id: user.id });
            setMarket(current => ({ ...current, trades: [response.data, ...current.trades], lots: current.lots.filter(item => item.id !== selectedLot.id) }));
            toast.success(t("Lot request sent to the collector."));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not request this lot.');
        }
    };

    const markPaid = async (tradeId) => {
        try {
            const response = await axios.post(`${BASE}/api/market/trades/${tradeId}/payments`, { company_id: user.id });
            setMarket(current => ({ ...current, trades: current.trades.map(item => item.id === tradeId ? response.data : item) }));
            toast.success(t("Payment recorded."));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not record payment.');
        }
    };

    const navItems = isCollector
        ? [{ id: 'pickups', label: 'Pickup Requests' }, { id: 'demand', label: 'Company Requests' }, { id: 'lots', label: 'My Waste Lots' }, { id: 'transactions', label: 'Cash Transactions' }, { id: 'rates', label: 'Local Rates' }]
        : [{ id: 'lots', label: 'Collector Lots' }, { id: 'payments', label: 'Payment Tracking' }, { id: 'rates', label: 'Local Rates' }];

    const ownTrades = market.trades;

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
            <aside style={{ width: 280, background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)', minHeight: 'calc(100vh - 80px)', position: 'sticky', top: 80, padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>{isCollector ? 'Collector Portal' : 'Company Portal'}</div>
                {navItems.map(item => <button type="button" key={item.id} className={`btn ${activeTab === item.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab(item.id)} style={{ justifyContent: 'flex-start', padding: '12px 14px', fontSize: '0.92rem' }}>{t(item.label)}</button>)}
            </aside>
            <main style={{ flex: 1, padding: '40px 48px', maxWidth: 1280 }}>
                <div className="flex-between" style={{ marginBottom: 32 }}><div><div style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{isCollector ? 'Informal Collector' : 'Recycling Company'}</div><h1 style={{ margin: 0 }}>{navItems.find(item => item.id === activeTab)?.label}</h1></div><div>{user.username}</div></div>

                {isCollector && activeTab === 'pickups' && <div className="grid-2">{market.pickups.filter(item => item.status === 'requested').map(item => <div className="card" key={item.id} style={cardStyle}>{item.image_url && <img src={item.image_url} alt={t("Waste lot")} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, marginBottom: 16 }} />}<h3>{t(item.material)}{' '}{t("·")}{' '}{formatNumber(item.quantity, { maximumFractionDigits: 2 })}{' '}{t("kg")}</h3><p>{t("Requested by")}{' '}{item.user_name}</p><p style={{ display: 'flex', gap: 8, alignItems: 'center' }}><MapPin size={16} />{item.address}</p><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ marginRight: 8 }}>{t("View location")}</a><button type="button" className="btn btn-primary" onClick={() => acceptPickup(item.id)}>{t("Accept")}</button></div>)}{!market.pickups.some(item => item.status === 'requested') && <div className="card">{t("No pickup requests are available.")}</div>}</div>}

                {isCollector && activeTab === 'demand' && <div className="grid-2">{market.trades.filter(item => item.status === 'requested').map(item => <div className="card" key={item.id} style={cardStyle}><h3>{t(item.material)}{' '}{t("lot request")}</h3><p>{item.company_name}{' '}{t("requested")}{' '}{formatNumber(item.quantity, { maximumFractionDigits: 2 })}{' '}{t("kg.")}</p><p>{t("Proposed total: ₹")}{formatCurrency(item.amount)}</p><button type="button" className="btn btn-primary" onClick={() => acceptTrade(item.id)}>{t("Accept company request")}</button></div>)}{!market.trades.some(item => item.status === 'requested') && <div className="card">{t("No company requests for your lots.")}</div>}</div>}

                {isCollector && activeTab === 'lots' && <div className="grid-2"><div className="card" style={cardStyle}><h3>{t("List a Waste Lot")}</h3><form onSubmit={publishLot}><label className="form-label">{t("Material")}</label><select className="form-input" style={fieldStyle} value={lot.material} onChange={event => setLot({ ...lot, material: event.target.value })}>{WASTE_TYPES.map(type => <option key={type}>{t(type)}</option>)}</select><label className="form-label" style={{ marginTop: 14 }}>{t("Quantity (kg)")}</label><input className="form-input" style={fieldStyle} type="number" min="0.1" step="0.1" required value={lot.quantity} onChange={event => setLot({ ...lot, quantity: event.target.value })} /><label className="form-label" style={{ marginTop: 14 }}>{t("Asking price (₹/kg)")}</label><input className="form-input" style={fieldStyle} type="number" min="0" step="0.01" required value={lot.price} onChange={event => setLot({ ...lot, price: event.target.value })} /><button className="btn btn-primary" style={{ marginTop: 20 }} type="submit">{t("Publish lot")}</button></form></div><div className="card" style={cardStyle}><h3>{t("My Lots")}</h3>{market.lots.map(item => <p key={item.id} style={{ padding: 12, borderBottom: '1px solid var(--color-border)' }}><Package size={16} /> {t(item.material)}{' '}{t("·")}{' '}{formatNumber(item.quantity, { maximumFractionDigits: 2 })}{' '}{t("kg · ₹")}{formatCurrency(item.price)}{t("/kg ·")}{' '}{t(item.status)}</p>)}{!market.lots.length && <p>{t("No lots listed.")}</p>}</div></div>}

                {!isCollector && activeTab === 'lots' && <div className="grid-2">{market.lots.filter(item => item.status === 'available').map(item => <div className="card" key={item.id} style={cardStyle}><h3>{t(item.material)}{' '}{t("·")}{' '}{formatNumber(item.quantity, { maximumFractionDigits: 2 })}{' '}{t("kg")}</h3><p>{t("Collector:")}{' '}{item.collector_name}</p><p>{t("Asking price: ₹")}{formatCurrency(item.price)}{t("/kg")}</p><button type="button" className="btn btn-primary" onClick={() => requestLot(item)}>{t("Request this lot")}</button></div>)}{!market.lots.some(item => item.status === 'available') && <div className="card">{t("No collector lots have been listed yet.")}</div>}</div>}

                {!isCollector && activeTab === 'payments' && <div className="card" style={cardStyle}><h3>{t("Payment Tracking")}</h3>{ownTrades.map(item => <div key={item.id} className="flex-between" style={{ padding: 14, borderBottom: '1px solid var(--color-border)', gap: 16 }}><div><strong>{t(item.material)}{' '}{t("·")}{' '}{formatNumber(item.quantity, { maximumFractionDigits: 2 })}{' '}{t("kg")}</strong><div>{t("Collector:")}{' '}{item.collector_name}{' '}{t("· ₹")}{formatCurrency(item.amount)}</div><span className="badge badge-warning">{t(item.status)}{' '}{t("/ payment")}{' '}{item.payment_status}</span></div>{item.status === 'accepted' && item.payment_status !== 'recorded' && <button className="btn btn-primary" type="button" onClick={() => markPaid(item.id)}>{t("Record payment")}</button>}</div>)}{ownTrades.length === 0 && <p>{t("No lot requests or payments yet.")}</p>}</div>}

                {isCollector && activeTab === 'transactions' && <div className="card" style={cardStyle}><h3>{t("Cash Transaction Log")}</h3>{ownTrades.map(item => <div key={item.id} className="flex-between" style={{ padding: 14, borderBottom: '1px solid var(--color-border)' }}><div><strong>{t(item.material)}{' '}{t("·")}{' '}{formatNumber(item.quantity, { maximumFractionDigits: 2 })}{' '}{t("kg")}</strong><div>{t("Company:")}{' '}{item.company_name}{' '}{t("· ₹")}{formatCurrency(item.amount)}</div></div><span className={`badge ${item.payment_status === 'recorded' ? 'badge-success' : 'badge-warning'}`}>{item.payment_status}</span></div>)}{ownTrades.length === 0 && <p>{t("No transactions recorded yet.")}</p>}</div>}

                {activeTab === 'rates' && <MarketRates rates={market.rates} />}
            </main>
        </div>
    );
};

const MunicipalMarketPanel = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [market, setMarket] = useState(emptyMarket);
    const [rate, setRate] = useState({ material: WASTE_TYPES[0], price: '', effectiveDate: '', source: '' });
    const [drive, setDrive] = useState({ title: '', date: '', location: '', details: '' });
    const [company, setCompany] = useState({ name: '', cpcbCode: '', email: '' });

    useEffect(() => {
        let active = true;
        const loadMarket = async () => {
            const location = new URLSearchParams({ city: user.city || '', state: user.state || '' });
            try {
                const [companies, rates, drives] = await Promise.all([
                    axios.get(`${BASE}/api/market/companies?municipality_id=${user.id}`),
                    axios.get(`${BASE}/api/market/rates?${location}`),
                    axios.get(`${BASE}/api/market/drives?${location}`),
                ]);
                if (active) setMarket({ ...emptyMarket, companies: companies.data, rates: rates.data, drives: drives.data });
            } catch (error) {
                if (active) console.error('Failed to load municipality marketplace data', error);
            }
        };
        loadMarket();
        const interval = setInterval(loadMarket, 10000);
        return () => { active = false; clearInterval(interval); };
    }, [user.id, user.city, user.state]);

    const publishRate = async (event) => {
        event.preventDefault();
        try {
            const response = await axios.post(`${BASE}/api/market/rates`, { municipality_id: user.id, material: rate.material, price: Number(rate.price), effective_date: rate.effectiveDate, source: rate.source });
            setMarket(current => ({ ...current, rates: [response.data, ...current.rates.filter(item => item.material !== response.data.material)] }));
            setRate({ material: WASTE_TYPES[0], price: '', effectiveDate: '', source: '' });
            toast.success(t("Local material rate published."));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not publish this rate.');
        }
    };

    const publishDrive = async (event) => {
        event.preventDefault();
        try {
            const response = await axios.post(`${BASE}/api/market/drives`, { municipality_id: user.id, ...drive });
            setMarket(current => ({ ...current, drives: [response.data, ...current.drives] }));
            setDrive({ title: '', date: '', location: '', details: '' });
            toast.success(t("E-waste drive announced to users."));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not publish this drive.');
        }
    };

    const registerCompany = async (event) => {
        event.preventDefault();
        if (!/^\d{10}$/.test(company.cpcbCode)) return toast.error(t("CPCB code must contain exactly 10 digits."));
        try {
            const response = await axios.post(`${BASE}/api/market/companies`, { municipality_id: user.id, name: company.name, cpcb_code: company.cpcbCode, email: company.email });
            setMarket(current => ({ ...current, companies: [response.data, ...current.companies] }));
            setCompany({ name: '', cpcbCode: '', email: '' });
            toast.success(t("Company added for verification."));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not register this company.');
        }
    };

    const updateCompanyStatus = async (companyId) => {
        try {
            const response = await axios.post(`${BASE}/api/market/companies/${companyId}/verify`, { municipality_id: user.id });
            setMarket(current => ({ ...current, companies: current.companies.map(item => item.id === companyId ? response.data : item) }));
            toast.success(t("Company CPCB registration verified."));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not verify this company.');
        }
    };

    return (
        <div className="grid-2">
            <section className="card" style={cardStyle}>
                <h3>{t("Publish Material Rates")}</h3>
                <p>{t("Enter municipality-verified local rates and their source. Do not publish unverified figures as government rates.")}</p>
                <form onSubmit={publishRate}><label className="form-label">{t("Material")}</label><select className="form-input" style={fieldStyle} value={rate.material} onChange={event => setRate({ ...rate, material: event.target.value })}>{WASTE_TYPES.map(type => <option key={type}>{t(type)}</option>)}</select><label className="form-label" style={{ marginTop: 12 }}>{t("Rate (₹/kg)")}</label><input className="form-input" style={fieldStyle} type="number" min="0" step="0.01" required value={rate.price} onChange={event => setRate({ ...rate, price: event.target.value })} /><label className="form-label" style={{ marginTop: 12 }}>{t("Effective date")}</label><input className="form-input" style={fieldStyle} type="date" required value={rate.effectiveDate} onChange={event => setRate({ ...rate, effectiveDate: event.target.value })} /><label className="form-label" style={{ marginTop: 12 }}>{t("Source / circular reference")}</label><input className="form-input" style={fieldStyle} required value={rate.source} onChange={event => setRate({ ...rate, source: event.target.value })} /><button className="btn btn-primary" style={{ marginTop: 18 }} type="submit">{t("Publish rate")}</button></form>
            </section>
            <section className="card" style={cardStyle}>
                <h3>{t("Organize E-waste Drive")}</h3>
                <form onSubmit={publishDrive}><label className="form-label">{t("Drive name")}</label><input className="form-input" style={fieldStyle} required value={drive.title} onChange={event => setDrive({ ...drive, title: event.target.value })} /><label className="form-label" style={{ marginTop: 12 }}>{t("Date")}</label><input className="form-input" style={fieldStyle} type="date" required value={drive.date} onChange={event => setDrive({ ...drive, date: event.target.value })} /><label className="form-label" style={{ marginTop: 12 }}>{t("Location")}</label><input className="form-input" style={fieldStyle} required value={drive.location} onChange={event => setDrive({ ...drive, location: event.target.value })} /><label className="form-label" style={{ marginTop: 12 }}>{t("Details")}</label><textarea className="form-input" style={fieldStyle} rows={2} value={drive.details} onChange={event => setDrive({ ...drive, details: event.target.value })} /><button className="btn btn-primary" style={{ marginTop: 18 }} type="submit">{t("Publish drive")}</button></form>
            </section>
            <section className="card" style={cardStyle}>
                <h3>{t("Register a Recycling Company")}</h3>
                <form onSubmit={registerCompany}><label className="form-label">{t("Company name")}</label><input className="form-input" style={fieldStyle} required value={company.name} onChange={event => setCompany({ ...company, name: event.target.value })} /><label className="form-label" style={{ marginTop: 12 }}>{t("10-digit CPCB code")}</label><input className="form-input" style={fieldStyle} inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required value={company.cpcbCode} onChange={event => setCompany({ ...company, cpcbCode: event.target.value })} /><label className="form-label" style={{ marginTop: 12 }}>{t("Contact email")}</label><input className="form-input" style={fieldStyle} type="email" required value={company.email} onChange={event => setCompany({ ...company, email: event.target.value })} /><button className="btn btn-primary" style={{ marginTop: 18 }} type="submit">{t("Add company")}</button></form>
            </section>
            <section className="card" style={cardStyle}>
                <h3>{t("Company Registry")}</h3>
                {market.companies.map(item => <div key={item.id} style={{ padding: 12, borderBottom: '1px solid var(--color-border)' }}><div className="flex-between" style={{ gap: 12 }}><div><strong>{item.name}</strong><div>{t("CPCB:")}{' '}{item.cpcb_code}{' '}{t("·")}{' '}{item.email}</div><span>{t(item.status)}</span></div>{item.status === 'pending' && <button type="button" className="btn btn-primary" onClick={() => updateCompanyStatus(item.id)}>{t("Verify")}</button>}</div>{item.phone && <div>{t("Phone:")}{' '}{item.phone}</div>}{item.address && <div>{t("Address:")}{' '}{item.address}</div>}{(item.city || item.state) && <div>{[item.city, item.state].filter(Boolean).join(', ')}</div>}</div>)}
                {!market.companies.length && <p>{t("No companies registered yet.")}</p>}
            </section>
        </div>
    );
};

export { MarketRoleDashboard, MunicipalMarketPanel, UserWastePanel };