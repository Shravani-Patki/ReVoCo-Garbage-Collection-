import React, { useEffect, useRef, useState } from 'react';
import axios from '../api';
import { toast } from 'react-toastify';
import { Activity, ImagePlus, IndianRupee, MapPin, Package, Truck, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency, formatDate, formatNumber, t } from "../i18n";

const WASTE_TYPES = ['E-waste', 'Paper', 'Cardboard', 'Plastic', 'Metal', 'Glass', 'Other'];

const cardStyle = { boxShadow: 'var(--shadow-md)' };
const fieldStyle = { background: 'var(--color-bg)' };
const emptyMarket = { pickups: [], lots: [], trades: [], transactions: [], requirements: [], rates: [], drives: [], companies: [] };

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

const MarketRates = ({ rates }) => {
    const [history, setHistory] = useState([]);
    useEffect(() => {
        const location = rates[0] ? `?city=${encodeURIComponent(rates[0].city)}&state=${encodeURIComponent(rates[0].state)}` : '';
        axios.get(`/api/market/rates/history${location}`)
            .then(response => setHistory(response.data))
            .catch(error => console.error('Failed to load rate history', error));
    }, [rates]);

    return (
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
            <details style={{ marginTop: 16 }}><summary>{t('Historical municipality rates')}</summary>{history.map(rate => <div key={rate.id} style={{ padding: 10, borderBottom: '1px solid var(--color-border)' }}><strong>{t(rate.material)} · {formatCurrency(rate.price)}{t('/kg')}</strong><div>{formatDate(rate.effectiveDate)} · {rate.source}</div></div>)}{!history.length && <p>{t('No earlier rate records are available.')}</p>}</details>
        </div>
    );
};

const UserWastePanel = ({ user, activeTab }) => {
    const [market, setMarket] = useState(emptyMarket);
    const [materials, setMaterials] = useState(WASTE_TYPES);
    const [pickup, setPickup] = useState({ material: WASTE_TYPES[0], quantity: '', address: user.address || '' });
    const [additionalItems, setAdditionalItems] = useState([]);
    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState('');
    const pickupFileRef = useRef(null);
    const [estimateImage, setEstimateImage] = useState(null);
    const [estimate, setEstimate] = useState(null);
    const [estimating, setEstimating] = useState(false);
    const [pickupCoordinates, setPickupCoordinates] = useState(null);
    const [pickupAnalysis, setPickupAnalysis] = useState(null);
    const [analyzingPickup, setAnalyzingPickup] = useState(false);

    useEffect(() => () => {
        if (photoPreview) URL.revokeObjectURL(photoPreview);
    }, [photoPreview]);

    useEffect(() => {
        let active = true;
        const loadMarket = async () => {
            const location = new URLSearchParams({ city: user.city || '', state: user.state || '' });
            try {
                const [pickups, rates, drives, materialCatalog, transactions] = await Promise.all([
                    axios.get(`/api/market/pickups?user_id=${user.id}`),
                    axios.get(`/api/market/rates?${location}`),
                    axios.get(`/api/market/drives?${location}`),
                    axios.get(`/api/market/materials`),
                    axios.get(`/api/market/transactions/mine`),
                ]);
                if (active) {
                    setMarket({ ...emptyMarket, pickups: pickups.data, rates: rates.data, drives: drives.data, transactions: transactions.data });
                    if (materialCatalog.data.length) setMaterials(materialCatalog.data.map(record => record.material));
                }
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
            const response = await axios.post(`/api/market/pickups`, {
                user_id: user.id,
                material: pickup.material,
                quantity: Number(pickup.quantity),
                items: [pickup, ...additionalItems].map(item => ({ material: item.material, quantity: Number(item.quantity) })),
                address: pickup.address,
                image_url: await compressImage(photo),
                ...(pickupCoordinates || {}),
            });
            setMarket(current => ({ ...current, pickups: [response.data, ...current.pickups] }));
            setPhoto(null);
            setPhotoPreview('');
            setPickupAnalysis(null);
            setPickupCoordinates(null);
            setAdditionalItems([]);
            if (pickupFileRef.current) pickupFileRef.current.value = '';
            form.reset();
            setPickup({ material: WASTE_TYPES[0], quantity: '', address: user.address || '' });
            toast.success(t("Pickup request shared with collectors."));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not submit the pickup request.');
        }
    };

    const analyzePickupPhoto = async () => {
        if (!photo) return toast.error(t('Upload a photo of the waste lot.'));
        setAnalyzingPickup(true);
        setPickupAnalysis(null);
        try {
            const image = await compressImage(photo);
            const [classificationResult, estimateResult] = await Promise.allSettled([
                axios.post(`/api/classify`, { image }),
                axios.post(`/api/waste/estimate`, { image }),
            ]);
            const classification = classificationResult.status === 'fulfilled' ? classificationResult.value.data : null;
            const estimate = estimateResult.status === 'fulfilled' ? estimateResult.value.data : null;
            if (classification) {
                const materialByClass = {
                    battery: 'E-waste', paper: 'Paper', cardboard: 'Cardboard', plastic: 'Plastic', metal: 'Metal', glass: 'Glass',
                };
                setPickup(current => ({
                    ...current,
                    material: materialByClass[classification.raw_class] || current.material,
                    quantity: estimate?.weight_kg != null ? String(estimate.weight_kg) : current.quantity,
                }));
            } else if (estimate?.weight_kg != null) {
                setPickup(current => ({ ...current, quantity: String(estimate.weight_kg) }));
            }
            setPickupAnalysis({ classification, estimate, classificationError: classificationResult.status === 'rejected', estimateError: estimateResult.status === 'rejected' });
        } finally {
            setAnalyzingPickup(false);
        }
    };

    const capturePickupCoordinates = () => {
        if (!navigator.geolocation) return toast.error(t('Geolocation is not supported by this browser.'));
        navigator.geolocation.getCurrentPosition(
            position => {
                setPickupCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
                toast.success(t('Pickup location captured.'));
            },
            () => toast.error(t('Could not get location. Please allow GPS access.')),
            { enableHighAccuracy: true, timeout: 10000 },
        );
    };

    const confirmReceipt = async (pickupItem) => {
        try {
            const response = await axios.post(`/api/market/lots/${pickupItem.lot_record_id}/customer-payment/confirm`);
            setMarket(current => ({
                ...current,
                pickups: current.pickups.map(item => item.id === pickupItem.id
                    ? { ...item, lots: item.lots.map(lot => lot.lot_record_id === pickupItem.lot_record_id
                        ? { ...lot, payment_status: response.data.status, receipt_id: response.data.receipt_id }
                        : lot) }
                    : item),
            }));
            toast.success(t('Payment receipt confirmed.'));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not confirm this receipt.');
        }
    };

    const selectPickupPhoto = (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) return toast.error(t("Choose an image file."));
        if (file.size > 20 * 1024 * 1024) return toast.error(t("Choose an image smaller than 20 MB."));
        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(file));
        setPickupAnalysis(null);
    };

    const handleEstimate = async (event) => {
        event.preventDefault();
        if (!estimateImage) return toast.error(t("Choose a waste photo first."));
        setEstimating(true);
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const response = await axios.post(`/api/waste/estimate`, { image: reader.result });
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
                        <select className="form-input" style={fieldStyle} value={pickup.material} onChange={event => setPickup({ ...pickup, material: event.target.value })}>{materials.map(type => <option key={type}>{t(type)}</option>)}</select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">{t("Approximate quantity (kg)")}</label>
                        <input className="form-input" style={fieldStyle} type="number" min="0.1" step="0.1" required value={pickup.quantity} onChange={event => setPickup({ ...pickup, quantity: event.target.value })} />
                    </div>
                    {additionalItems.map((item, index) => <div key={`pickup-item-${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: 8, marginBottom: 12, alignItems: 'end' }}>
                        <div><label className="form-label">{t('Additional waste type')}</label><select className="form-input" value={item.material} onChange={event => setAdditionalItems(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, material: event.target.value } : entry))}>{materials.map(type => <option key={type}>{t(type)}</option>)}</select></div>
                        <div><label className="form-label">{t('Approximate quantity (kg)')}</label><input className="form-input" type="number" min="0.1" step="0.1" required value={item.quantity} onChange={event => setAdditionalItems(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantity: event.target.value } : entry))} /></div>
                        <button type="button" className="btn" aria-label={t('Remove material')} title={t('Remove material')} onClick={() => setAdditionalItems(current => current.filter((_, entryIndex) => entryIndex !== index))}><X size={16} /></button>
                    </div>)}
                    <button type="button" className="btn btn-outline" onClick={() => setAdditionalItems(current => [...current, { material: materials[0] || WASTE_TYPES[0], quantity: '' }])} style={{ marginBottom: 16 }}>{t('Add another waste type')}</button>
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">{t("Pickup address")}</label>
                        <textarea className="form-input" style={fieldStyle} rows={2} required value={pickup.address} onChange={event => { setPickup({ ...pickup, address: event.target.value }); setPickupCoordinates(null); }} />
                        <button type="button" className="btn btn-outline" onClick={capturePickupCoordinates} style={{ marginTop: 8 }}>{pickupCoordinates ? t('Pickup location captured') : t('Capture pickup location')}</button>
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
                    <button type="button" className="btn btn-outline" disabled={!photo || analyzingPickup} onClick={analyzePickupPhoto}>{analyzingPickup ? t('Analyzing photo...') : t('Classify and estimate from photo')}</button>
                    {pickupAnalysis && <div style={{ margin: '12px 0', padding: 12, background: 'var(--pastel-green)', borderRadius: 8 }}><strong>{t('Photo analysis suggestion. Review and edit before posting.')}</strong>{pickupAnalysis.classification && <div>{t('Suggested material')}: {t(pickup.material)} ({formatNumber(pickupAnalysis.classification.confidence, { maximumFractionDigits: 1 })}%)</div>}{pickupAnalysis.estimate?.weight_kg != null && <div>{t('Estimated weight')}: {formatNumber(pickupAnalysis.estimate.weight_kg, { maximumFractionDigits: 2 })} {t('kg')}</div>}{pickupAnalysis.estimateError && <div>{t('Weight estimate unavailable. Enter the approximate weight manually.')}</div>}{pickupAnalysis.classificationError && <div>{t('Classification unavailable. Select the material manually.')}</div>}</div>}
                    <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>{t("Post Pickup Request")}</button>
                </form>
            </div>
            <div className="card" style={cardStyle}>
                <h3>{t("My Pickup Requests")}</h3>
                {market.pickups.map(item => (
                    <div key={item.id} style={{ display: 'flex', gap: 14, padding: 14, background: 'var(--color-bg)', borderRadius: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                        {item.image_url && <img src={item.image_url} alt={t("Waste lot")} style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 8 }} />}
                        <div style={{ minWidth: 0, flex: 1 }}>
                            {item.items?.map((entry, index) => <div key={`${entry.material}-${index}`}><strong>{t(entry.material)}</strong> · {formatNumber(entry.confirmed_weight_kg ?? entry.estimated_weight_kg, { maximumFractionDigits: 2 })} {t('kg')} {entry.confirmed_weight_kg == null && <span>({t('Estimated')})</span>}</div>)}
                            <div>{item.address}</div>
                            <span className="badge badge-primary" style={{ marginTop: 6 }}>{t(item.status)}</span>
                            {item.collector_name && <div>{t("Collector:")}{' '}{item.collector_name}</div>}
                            {(item.lots || (item.lot_id ? [item] : [])).map(lot => <div key={lot.lot_record_id} style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                                <QRCodeSVG value={lot.tracking_url} size={88} title={`${t('Track lot')} ${lot.lot_id}`} />
                                <div><strong>{lot.lot_id} · {t(lot.material)}</strong><div><a href={lot.tracking_url} target="_blank" rel="noreferrer">{t('Open lot tracking')}</a></div>
                                    {lot.payment_status === 'awaiting_user_confirmation' && <><div>{t('Payment reported')}: {formatCurrency(lot.payment_amount)} · {t(lot.payment_method)}</div><button type="button" className="btn btn-primary" onClick={() => confirmReceipt({ ...item, ...lot })} style={{ marginTop: 8 }}>{t('Confirm payment and receipt')}</button></>}
                                    {lot.receipt_id && <div>{t('Receipt')}: {lot.receipt_id}</div>}
                                </div>
                            </div>)}
                        </div>
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
    if (activeTab === 'khata') return (
        <div className="card" style={cardStyle}>
            <h3>{t('Customer Kamai Khata')}</h3>
            {market.transactions.map(item => <div key={item.id} style={{ padding: 14, borderBottom: '1px solid var(--color-border)' }}>
                <strong>{item.lot_id || t('Pickup transaction')} · {formatCurrency(item.amount)}</strong>
                <div>{t('Collector')}: {item.payer_name} · {t(item.payment_method)}</div>
                <span className="badge badge-primary">{t(item.status)}</span>
                {item.receipt_id && <div>{t('Receipt')}: {item.receipt_id}</div>}
            </div>)}
            {!market.transactions.length && <p>{t('No customer transactions yet.')}</p>}
        </div>
    );
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
    const [materials, setMaterials] = useState(WASTE_TYPES);
    const [activeTab, setActiveTab] = useState(role === 'collector' ? 'pickups' : 'lots');
    const [lot, setLot] = useState({ material: WASTE_TYPES[0], quantity: '', price: '' });
    const [weightInputs, setWeightInputs] = useState({});
    const [paymentMethods, setPaymentMethods] = useState({});
    const [paymentReferences, setPaymentReferences] = useState({});
    const [requirement, setRequirement] = useState({ material: WASTE_TYPES[0], quantity_kg: '', details: '' });
    const isCollector = role === 'collector';

    useEffect(() => {
        let active = true;
        const loadMarket = async () => {
            const location = new URLSearchParams({ city: user.city || '', state: user.state || '' });
            try {
                const [pickups, lots, trades, rates, materialCatalog, transactions, requirements, drives] = await Promise.all([
                    isCollector ? axios.get(`/api/market/pickups?collector_id=${user.id}`) : Promise.resolve({ data: [] }),
                    axios.get(isCollector ? `/api/market/lots?collector_id=${user.id}` : `/api/market/lots`),
                    axios.get(`/api/market/trades?user_id=${user.id}`),
                    axios.get(`/api/market/rates?${location}`),
                    axios.get(`/api/market/materials`),
                    axios.get(`/api/market/transactions/mine`),
                    axios.get(`/api/market/requirements`),
                    axios.get(`/api/market/drives?${location}`),
                ]);
                if (active) {
                    setMarket({ ...emptyMarket, pickups: pickups.data, lots: lots.data, trades: trades.data, rates: rates.data, transactions: transactions.data, requirements: requirements.data, drives: drives.data });
                    if (materialCatalog.data.length) setMaterials(materialCatalog.data.map(record => record.material));
                }
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
            const response = await axios.post(`/api/market/pickups/${pickupId}/accept`, { collector_id: user.id });
            setMarket(current => ({ ...current, pickups: current.pickups.map(item => item.id === pickupId ? response.data : item) }));
            toast.success(t("Pickup accepted."));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not accept this pickup.');
        }
    };

    const updateCollectorLocation = () => {
        if (!navigator.geolocation) return toast.error(t('Geolocation is not supported by this browser.'));
        navigator.geolocation.getCurrentPosition(async position => {
            try {
                await axios.post(`/api/market/collector/location`, {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
                toast.success(t('Collector location updated.'));
            } catch (error) {
                toast.error(error.response?.data?.error || 'Could not update collector location.');
            }
        }, () => toast.error(t('Could not get location. Please allow GPS access.')), { enableHighAccuracy: true, timeout: 10000 });
    };

    const acceptTrade = async (tradeId) => {
        try {
            const response = await axios.post(`/api/market/trades/${tradeId}/accept`, { collector_id: user.id });
            setMarket(current => ({ ...current, trades: current.trades.map(item => item.id === tradeId ? response.data : item) }));
            toast.success(t("Lot request accepted. Payment is pending."));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not accept this lot request.');
        }
    };

    const verifyWeight = async (item) => {
        try {
            const response = await axios.post(`/api/market/lots/${item.id}/weight`, {
                confirmed_weight_kg: Number(weightInputs[item.id]),
            });
            setMarket(current => ({
                ...current,
                lots: current.lots.map(lotItem => lotItem.id === item.id
                    ? { ...lotItem, quantity: response.data.confirmed_weight_kg, status: 'available' }
                    : lotItem),
            }));
            setWeightInputs(current => ({ ...current, [item.id]: '' }));
            toast.success(t('Collector-confirmed weight saved.'));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not verify this lot weight.');
        }
    };

    const reportCustomerPayment = async (item) => {
        try {
            const response = await axios.post(`/api/market/lots/${item.id}/customer-payment`, {
                payment_method: paymentMethods[item.id] || 'cash',
            });
            setMarket(current => ({
                ...current,
                lots: current.lots.map(lotItem => lotItem.id === item.id
                    ? { ...lotItem, customer_payment_status: response.data.status }
                    : lotItem),
            }));
            toast.success(t('Payment recorded for citizen confirmation.'));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not record this payment.');
        }
    };

    const updateRecycling = async (item, status) => {
        try {
            const response = await axios.post(`/api/market/lots/${item.lot_id}/recycling`, { status });
            setMarket(current => ({
                ...current,
                trades: current.trades.map(trade => trade.lot_id === item.lot_id
                    ? { ...trade, lot_status: response.data.current_status }
                    : trade),
            }));
            toast.success(t('Lot recycling status updated.'));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not update recycling status.');
        }
    };

    const publishLot = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
            const response = await axios.post(`/api/market/lots`, { collector_id: user.id, ...lot });
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
            const response = await axios.post(`/api/market/lots/${selectedLot.id}/request`, { company_id: user.id });
            setMarket(current => ({ ...current, trades: [response.data, ...current.trades], lots: current.lots.filter(item => item.id !== selectedLot.id) }));
            toast.success(t("Lot request sent to the collector."));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not request this lot.');
        }
    };

    const markPaid = async (trade) => {
        try {
            const response = await axios.post(`/api/market/trades/${trade.id}/payments`, {
                company_id: user.id,
                payment_method: paymentMethods[trade.lot_id] || 'manual_record',
                payment_reference: paymentReferences[trade.id] || '',
            });
            setMarket(current => ({ ...current, trades: current.trades.map(item => item.id === trade.id ? response.data : item) }));
            toast.success(t("Payment recorded."));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not record payment.');
        }
    };

    const publishRequirement = async (event) => {
        event.preventDefault();
        try {
            const response = await axios.post(`/api/market/requirements`, {
                ...requirement,
                quantity_kg: Number(requirement.quantity_kg),
            });
            setMarket(current => ({ ...current, requirements: [response.data, ...current.requirements] }));
            setRequirement({ material: materials[0] || WASTE_TYPES[0], quantity_kg: '', details: '' });
            toast.success(t('Waste requirement published.'));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not publish this waste requirement.');
        }
    };

    const navItems = isCollector
        ? [{ id: 'pickups', label: 'Pickup Requests' }, { id: 'demand', label: 'Company Requests' }, { id: 'requirements', label: 'Company Requirements' }, { id: 'lots', label: 'My Waste Lots' }, { id: 'transactions', label: 'Cash Transactions' }, { id: 'rates', label: 'Local Rates' }, { id: 'drives', label: 'Municipality Drives' }]
        : [{ id: 'lots', label: 'Collector Lots' }, { id: 'requirements', label: 'Waste Requirements' }, { id: 'payments', label: 'Payment Tracking' }, { id: 'rates', label: 'Local Rates' }, { id: 'drives', label: 'Municipality Drives' }];

    const ownTrades = market.trades;

    return (
        <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
            <aside className="dashboard-sidebar" style={{ width: 280, background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)', minHeight: 'calc(100vh - 80px)', position: 'sticky', top: 80, padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>{isCollector ? 'Collector Portal' : 'Company Portal'}</div>
                {navItems.map(item => <button type="button" key={item.id} className={`btn ${activeTab === item.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab(item.id)} style={{ justifyContent: 'flex-start', padding: '12px 14px', fontSize: '0.92rem' }}>{t(item.label)}</button>)}
            </aside>
            <main className="dashboard-main" style={{ flex: 1, padding: '40px 48px', maxWidth: 1280 }}>
                <div className="flex-between" style={{ marginBottom: 32 }}><div><div style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{isCollector ? 'Informal Collector' : 'Recycling Company'}</div><h1 style={{ margin: 0 }}>{navItems.find(item => item.id === activeTab)?.label}</h1></div><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{isCollector && <button type="button" className="btn btn-outline" onClick={updateCollectorLocation}><MapPin size={16} /> {t('Update my location')}</button>}{user.username}</div></div>

                {isCollector && activeTab === 'pickups' && <div className="grid-2">{market.pickups.filter(item => item.status === 'requested').map(item => <div className="card" key={item.id} style={cardStyle}>{item.image_url && <img src={item.image_url} alt={t("Waste lot")} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, marginBottom: 16 }} />}<h3>{t(item.material)}{' '}{t("·")}{' '}{formatNumber(item.quantity, { maximumFractionDigits: 2 })}{' '}{t("kg")}</h3><p>{t("Requested by")}{' '}{item.user_name}</p><p style={{ display: 'flex', gap: 8, alignItems: 'center' }}><MapPin size={16} />{item.address}</p>{item.distance_km != null && <p>{t('Distance')}: {formatNumber(item.distance_km, { maximumFractionDigits: 1 })} {t('km')}</p>}<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ marginRight: 8 }}>{t("View location")}</a><button type="button" className="btn btn-primary" onClick={() => acceptPickup(item.id)}>{t("Accept")}</button></div>)}{!market.pickups.some(item => item.status === 'requested') && <div className="card">{t("No pickup requests are available.")}</div>}</div>}

                {isCollector && activeTab === 'demand' && <div className="grid-2">{market.trades.filter(item => item.status === 'requested').map(item => <div className="card" key={item.id} style={cardStyle}><h3>{t(item.material)}{' '}{t("lot request")}</h3><p>{item.company_name}{' '}{t("requested")}{' '}{formatNumber(item.quantity, { maximumFractionDigits: 2 })}{' '}{t("kg.")}</p><p>{t("Proposed total:")}{' '}{formatCurrency(item.amount)}</p><button type="button" className="btn btn-primary" onClick={() => acceptTrade(item.id)}>{t("Accept company request")}</button></div>)}{!market.trades.some(item => item.status === 'requested') && <div className="card">{t("No company requests for your lots.")}</div>}</div>}

                {activeTab === 'requirements' && <div className="grid-2">{!isCollector && <div className="card" style={cardStyle}><h3>{t('Post material requirements')}</h3><form onSubmit={publishRequirement}><label className="form-label">{t('Material')}</label><select className="form-input" value={requirement.material} onChange={event => setRequirement(current => ({ ...current, material: event.target.value }))}>{materials.map(material => <option key={material}>{t(material)}</option>)}</select><label className="form-label" style={{ marginTop: 12 }}>{t('Required quantity (kg)')}</label><input className="form-input" type="number" min="0.1" step="0.1" required value={requirement.quantity_kg} onChange={event => setRequirement(current => ({ ...current, quantity_kg: event.target.value }))} /><label className="form-label" style={{ marginTop: 12 }}>{t('Details')}</label><textarea className="form-input" rows={3} value={requirement.details} onChange={event => setRequirement(current => ({ ...current, details: event.target.value }))} /><button className="btn btn-primary" type="submit" style={{ marginTop: 12 }}>{t('Publish requirement')}</button></form></div>}<div className="card" style={cardStyle}><h3>{t(isCollector ? 'Company material requirements' : 'My material requirements')}</h3>{market.requirements.map(item => <div key={item.id} style={{ padding: 12, borderBottom: '1px solid var(--color-border)' }}><strong>{t(item.material)} · {formatNumber(item.quantity_kg, { maximumFractionDigits: 2 })} {t('kg')}</strong><div>{item.company_name}</div>{item.details && <p>{item.details}</p>}</div>)}{!market.requirements.length && <p>{t('No material requirements have been posted.')}</p>}</div></div>}

                {isCollector && activeTab === 'lots' && <div className="grid-2"><div className="card" style={cardStyle}><h3>{t("List a Waste Lot")}</h3><form onSubmit={publishLot}><label className="form-label">{t("Material")}</label><select className="form-input" style={fieldStyle} value={lot.material} onChange={event => setLot({ ...lot, material: event.target.value })}>{materials.map(type => <option key={type}>{t(type)}</option>)}</select><label className="form-label" style={{ marginTop: 14 }}>{t("Quantity (kg)")}</label><input className="form-input" style={fieldStyle} type="number" min="0.1" step="0.1" required value={lot.quantity} onChange={event => setLot({ ...lot, quantity: event.target.value })} /><label className="form-label" style={{ marginTop: 14 }}>{t("Asking price (₹/kg)")}</label><input className="form-input" style={fieldStyle} type="number" min="0" step="0.01" required value={lot.price} onChange={event => setLot({ ...lot, price: event.target.value })} /><button className="btn btn-primary" style={{ marginTop: 20 }} type="submit">{t("Publish lot")}</button></form></div><div className="card" style={cardStyle}><h3>{t("My Lots")}</h3>{market.lots.map(item => <div key={item.id} style={{ display: 'flex', gap: 14, padding: 12, borderBottom: '1px solid var(--color-border)', alignItems: 'flex-start' }}><div><QRCodeSVG value={item.tracking_url} size={88} title={`${t('Track lot')} ${item.lot_id}`} /></div><div style={{ minWidth: 0, flex: 1 }}><strong>{item.lot_id} · {t(item.material)}</strong><div>{formatNumber(item.quantity, { maximumFractionDigits: 2 })} {t('kg ·')}{' '}{formatCurrency(item.price)}{t('/kg')}</div><span className="badge badge-primary">{t(item.status)}</span><div><a href={item.tracking_url} target="_blank" rel="noreferrer">{t('Open lot tracking')}</a></div>{item.status === 'pending_verification' && <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><input className="form-input" type="number" min="0.01" step="0.01" aria-label={t('Confirmed weight in kg')} value={weightInputs[item.id] || ''} onChange={event => setWeightInputs(current => ({ ...current, [item.id]: event.target.value }))} /><button type="button" className="btn btn-primary" onClick={() => verifyWeight(item)}>{t('Confirm weight')}</button></div>}{item.status !== 'pending_verification' && item.pickup_id && !item.customer_payment_status && <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}><select className="form-input" aria-label={t('Payment method')} value={paymentMethods[item.id] || 'cash'} onChange={event => setPaymentMethods(current => ({ ...current, [item.id]: event.target.value }))}><option value="cash">{t('Cash')}</option><option value="digital">{t('Digital')}</option></select><button type="button" className="btn btn-outline" onClick={() => reportCustomerPayment(item)}>{t('Record customer payment')}</button></div>}{item.customer_payment_status && <div>{t('Payment')}: {t(item.customer_payment_status)}</div>}</div></div>)}{!market.lots.length && <p>{t("No lots listed.")}</p>}</div></div>}

                {!isCollector && activeTab === 'lots' && <div className="grid-2">{market.lots.filter(item => item.status === 'available').map(item => <div className="card" key={item.id} style={cardStyle}><h3>{t(item.material)}{' '}{t("·")}{' '}{formatNumber(item.quantity, { maximumFractionDigits: 2 })}{' '}{t("kg")}</h3><p>{t("Collector:")}{' '}{item.collector_name}</p><p>{t("Asking price:")}{' '}{formatCurrency(item.price)}{t("/kg")}</p><button type="button" className="btn btn-primary" onClick={() => requestLot(item)}>{t("Request this lot")}</button></div>)}{!market.lots.some(item => item.status === 'available') && <div className="card">{t("No collector lots have been listed yet.")}</div>}</div>}

                {!isCollector && activeTab === 'payments' && <div className="card" style={cardStyle}><h3>{t("Payment Tracking")}</h3>{ownTrades.map(item => <div key={item.id} className="flex-between" style={{ padding: 14, borderBottom: '1px solid var(--color-border)', gap: 16 }}><div><strong>{item.lot_code} · {t(item.material)}{' '}{t("·")}{' '}{formatNumber(item.quantity, { maximumFractionDigits: 2 })}{' '}{t("kg")}</strong><div>{t("Collector:")}{' '}{item.collector_name}{' '}{t("·")}{' '}{formatCurrency(item.amount)}</div><div><a href={item.tracking_url} target="_blank" rel="noreferrer">{t('Open lot tracking')}</a></div><span className="badge badge-warning">{t(item.status)}{' '}{t("/ payment")}{' '}{t(item.payment_status)}</span>{item.payment_status === 'recorded' && item.lot_status === 'company_payment_recorded' && <button className="btn btn-outline" type="button" onClick={() => updateRecycling(item, 'company_received')}>{t('Confirm recycler receipt')}</button>}{item.lot_status === 'company_received' && <button className="btn btn-outline" type="button" onClick={() => updateRecycling(item, 'under_recycling')}>{t('Start recycling')}</button>}{item.lot_status === 'under_recycling' && <button className="btn btn-primary" type="button" onClick={() => updateRecycling(item, 'recycling_completed')}>{t('Confirm recycling completed')}</button>}</div>{item.status === 'accepted' && item.payment_status !== 'recorded' && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><select className="form-input" aria-label={t('Payment method')} value={paymentMethods[item.lot_id] || 'manual_record'} onChange={event => setPaymentMethods(current => ({ ...current, [item.lot_id]: event.target.value }))}><option value="manual_record">{t('Manually recorded')}</option><option value="cash">{t('Cash')}</option><option value="digital">{t('Digital')}</option><option value="bank_transfer">{t('Bank transfer')}</option></select><input className="form-input" aria-label={t('Payment reference')} placeholder={t('Payment reference')} value={paymentReferences[item.id] || ''} onChange={event => setPaymentReferences(current => ({ ...current, [item.id]: event.target.value }))} /><button className="btn btn-primary" type="button" onClick={() => markPaid(item)}>{t("Record payment")}</button></div>}</div>)}{ownTrades.length === 0 && <p>{t("No lot requests or payments yet.")}</p>}</div>}

                {isCollector && activeTab === 'transactions' && <div className="card" style={cardStyle}><h3>{t("Cash Transaction Log")}</h3>{market.transactions.map(item => <div key={item.id} className="flex-between" style={{ padding: 14, borderBottom: '1px solid var(--color-border)' }}><div><strong>{item.lot_id || t('Pickup transaction')} · {formatCurrency(item.amount)}</strong><div>{item.payer_name} → {item.payee_name} · {t(item.payment_method)}</div>{item.payment_reference && <div>{t('Reference')}: {item.payment_reference}</div>}</div><span className={`badge ${item.status === 'recorded' || item.status === 'confirmed_by_citizen' ? 'badge-success' : 'badge-warning'}`}>{t(item.status)}</span></div>)}{market.transactions.length === 0 && <p>{t("No transactions recorded yet.")}</p>}</div>}

                {activeTab === 'rates' && <MarketRates rates={market.rates} />}
                {activeTab === 'drives' && <div className="card" style={cardStyle}><h3>{t('Upcoming Municipality Drives')}</h3>{market.drives.map(drive => <div key={drive.id} style={{ padding: 14, borderBottom: '1px solid var(--color-border)' }}><strong>{t(drive.title)}</strong><div>{formatDate(drive.date)} · {drive.location}</div>{drive.details && <p>{drive.details}</p>}</div>)}{!market.drives.length && <p>{t('No upcoming drives have been announced.')}</p>}</div>}
            </main>
        </div>
    );
};

const MunicipalMarketPanel = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [market, setMarket] = useState(emptyMarket);
    const [materials, setMaterials] = useState(WASTE_TYPES);
    const [rate, setRate] = useState({ material: WASTE_TYPES[0], price: '', effectiveDate: '', source: '' });
    const [drive, setDrive] = useState({ title: '', date: '', location: '', details: '' });
    const [company, setCompany] = useState({ name: '', cpcbCode: '', email: '' });

    useEffect(() => {
        let active = true;
        const loadMarket = async () => {
            const location = new URLSearchParams({ city: user.city || '', state: user.state || '' });
            try {
                const [companies, rates, drives, materialCatalog] = await Promise.all([
                    axios.get(`/api/market/companies?municipality_id=${user.id}`),
                    axios.get(`/api/market/rates?${location}`),
                    axios.get(`/api/market/drives?${location}`),
                    axios.get(`/api/market/materials`),
                ]);
                if (active) {
                    setMarket({ ...emptyMarket, companies: companies.data, rates: rates.data, drives: drives.data });
                    if (materialCatalog.data.length) setMaterials(materialCatalog.data.map(record => record.material));
                }
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
            const response = await axios.post(`/api/market/rates`, { municipality_id: user.id, material: rate.material, price: Number(rate.price), effective_date: rate.effectiveDate, source: rate.source });
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
            const response = await axios.post(`/api/market/drives`, { municipality_id: user.id, ...drive });
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
            const response = await axios.post(`/api/market/companies`, { municipality_id: user.id, name: company.name, cpcb_code: company.cpcbCode, email: company.email });
            setMarket(current => ({ ...current, companies: [response.data, ...current.companies] }));
            setCompany({ name: '', cpcbCode: '', email: '' });
            toast.success(t("Company added for verification."));
        } catch (error) {
            toast.error(error.response?.data?.error || 'Could not register this company.');
        }
    };

    const updateCompanyStatus = async (companyId) => {
        try {
            const response = await axios.post(`/api/market/companies/${companyId}/verify`, { municipality_id: user.id });
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
                <form onSubmit={publishRate}><label className="form-label">{t("Material")}</label><select className="form-input" style={fieldStyle} value={rate.material} onChange={event => setRate({ ...rate, material: event.target.value })}>{materials.map(type => <option key={type}>{t(type)}</option>)}</select><label className="form-label" style={{ marginTop: 12 }}>{t("Rate (₹/kg)")}</label><input className="form-input" style={fieldStyle} type="number" min="0" step="0.01" required value={rate.price} onChange={event => setRate({ ...rate, price: event.target.value })} /><label className="form-label" style={{ marginTop: 12 }}>{t("Effective date")}</label><input className="form-input" style={fieldStyle} type="date" required value={rate.effectiveDate} onChange={event => setRate({ ...rate, effectiveDate: event.target.value })} /><label className="form-label" style={{ marginTop: 12 }}>{t("Source / circular reference")}</label><input className="form-input" style={fieldStyle} required value={rate.source} onChange={event => setRate({ ...rate, source: event.target.value })} /><button className="btn btn-primary" style={{ marginTop: 18 }} type="submit">{t("Publish rate")}</button></form>
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