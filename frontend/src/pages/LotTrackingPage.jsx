import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { AlertCircle, Recycle } from 'lucide-react';
import { formatDate, formatNumber, t } from '../i18n';

const BASE = 'http://127.0.0.1:5000';

const LotTrackingPage = () => {
    const { token } = useParams();
    const [tracking, setTracking] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        axios.get(`${BASE}/api/market/track/${encodeURIComponent(token)}`)
            .then(response => { if (active) setTracking(response.data); })
            .catch(() => { if (active) setError(t('This lot tracking link is invalid.')); });
        return () => { active = false; };
    }, [token]);

    if (error) return <section className="card" style={{ maxWidth: 760, margin: '48px auto' }}><AlertCircle size={24} /><h1>{t('Lot tracking unavailable')}</h1><p>{error}</p></section>;
    if (!tracking) return <section className="card" style={{ maxWidth: 760, margin: '48px auto' }}><p>{t('Loading lot tracking...')}</p></section>;

    const weight = (value) => value == null ? t('Not recorded') : `${formatNumber(value, { maximumFractionDigits: 2 })} ${t('kg')}`;

    return (
        <section className="card" style={{ maxWidth: 900, margin: '40px auto', padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Recycle size={24} color="var(--color-primary)" /><div><h1 style={{ margin: 0 }}>{t('Lot tracking')}</h1><strong>{tracking.lot_id}</strong></div></div>
            <div className="grid-2" style={{ marginTop: 24 }}>
                <div><strong>{t('Waste type')}</strong><div>{t(tracking.material)}</div></div>
                <div><strong>{t('Current status')}</strong><div className="badge badge-primary">{t(tracking.current_status)}</div></div>
                <div><strong>{t('Estimated weight')}</strong><div>{weight(tracking.estimated_weight_kg)}</div></div>
                <div><strong>{t('Collector-confirmed weight')}</strong><div>{weight(tracking.confirmed_weight_kg)}</div></div>
                <div><strong>{t('Pickup status')}</strong><div>{tracking.pickup_status ? t(tracking.pickup_status) : t('Not recorded')}</div></div>
                <div><strong>{t('Recycler status')}</strong><div>{tracking.recycler_status ? t(tracking.recycler_status) : t('Not recorded')}</div></div>
                {tracking.recycler_name && <div><strong>{t('Recycler')}</strong><div>{tracking.recycler_name}</div></div>}
            </div>
            <h2 style={{ fontSize: '1.15rem', marginTop: 28 }}>{t('Lot history')}</h2>
            {tracking.timeline.length ? tracking.timeline.map((event, index) => (
                <div key={`${event.status}-${index}`} style={{ padding: '12px 0', borderTop: '1px solid var(--color-border)' }}>
                    <strong>{t(event.status)}</strong>
                    {event.created_at && <div>{formatDate(event.created_at)}</div>}
                    {event.details?.estimated_weight_kg != null && <div>{t('Estimated weight')}: {weight(event.details.estimated_weight_kg)}</div>}
                    {event.details?.confirmed_weight_kg != null && <div>{t('Collector-confirmed weight')}: {weight(event.details.confirmed_weight_kg)}</div>}
                </div>
            )) : <p>{t('No lot events have been recorded yet.')}</p>}
        </section>
    );
};

export default LotTrackingPage;