import json
import math
import os
from datetime import date, datetime

from flask import Blueprint, current_app, g, jsonify, request
from itsdangerous import BadSignature, URLSafeSerializer

from models import (
    CompanyRegistration,
    EWasteDrive,
    LotTraceEvent,
    LotTrade,
    MarketTransaction,
    MarketPickup,
    MaterialRate,
    MaterialRateHistory,
    MaterialRecord,
    PickupLocation,
    PickupMaterialItem,
    PickupLotLink,
    RecyclerRequirement,
    User,
    UserProfile,
    WasteLot,
    db,
)
from auth_tokens import require_roles

market_bp = Blueprint('market_bp', __name__)


def _user_with_role(user_id, role):
    try:
        requested_user_id = int(user_id)
    except (TypeError, ValueError):
        return None
    if not getattr(g, 'current_user', None) or g.current_user.id != requested_user_id:
        return None
    user = db.session.get(User, user_id)
    return user if user and user.role == role else None


def _pickup_json(item, viewer=None):
    material_items = PickupMaterialItem.query.filter_by(pickup_id=item.id).order_by(PickupMaterialItem.id).all()
    pickup_items = [{
        'material': material_item.material,
        'estimated_weight_kg': material_item.estimated_weight_kg,
        'confirmed_weight_kg': material_item.lot.quantity_kg if material_item.lot and LotTraceEvent.query.filter_by(
            lot_id=material_item.lot.id, status='weight_verified'
        ).first() else None,
        'lot_id': _lot_code(material_item.lot) if material_item.lot else None,
    } for material_item in material_items]
    if not pickup_items:
        pickup_items = [{'material': item.material, 'estimated_weight_kg': item.quantity_kg, 'confirmed_weight_kg': None, 'lot_id': None}]
    lots = []
    for material_item in material_items:
        lot = material_item.lot
        if not lot:
            continue
        payment = MarketTransaction.query.filter_by(lot_id=lot.id).first()
        lots.append({
            'lot_id': _lot_code(lot),
            'lot_record_id': lot.id,
            'material': lot.material,
            'quantity': lot.quantity_kg,
            'tracking_url': _tracking_url(lot),
            'payment_status': payment.status if payment else None,
            'payment_amount': payment.amount if payment else None,
            'payment_method': payment.payment_method if payment else None,
            'receipt_id': f'RV-RCPT-{payment.id:06d}' if payment and payment.status == 'confirmed_by_citizen' else None,
        })
    if not lots:
        legacy_link = PickupLotLink.query.filter_by(pickup_id=item.id).first()
        if legacy_link:
            lot = legacy_link.lot
            payment = MarketTransaction.query.filter_by(lot_id=lot.id).first()
            lots.append({
                'lot_id': _lot_code(lot), 'lot_record_id': lot.id, 'material': lot.material,
                'quantity': lot.quantity_kg, 'tracking_url': _tracking_url(lot),
                'payment_status': payment.status if payment else None,
                'payment_amount': payment.amount if payment else None,
                'payment_method': payment.payment_method if payment else None,
                'receipt_id': f'RV-RCPT-{payment.id:06d}' if payment and payment.status == 'confirmed_by_citizen' else None,
            })
    primary_lot = lots[0] if lots else None
    result = {
        'id': item.id,
        'user_id': item.user_id,
        'user_name': item.user.username,
        'collector_id': item.collector_id,
        'collector_name': item.collector.username if item.collector else None,
        'material': item.material,
        'quantity': item.quantity_kg,
        'image_url': item.image_url,
        'address': item.address,
        'city': item.city,
        'state': item.state,
        'status': item.status,
        'latitude': item.location.latitude if item.location else None,
        'longitude': item.location.longitude if item.location else None,
        'created_at': item.created_at.isoformat() if item.created_at else None,
        'lot_id': primary_lot['lot_id'] if primary_lot else None,
        'lot_record_id': primary_lot['lot_record_id'] if primary_lot else None,
        'tracking_url': primary_lot['tracking_url'] if primary_lot else None,
        'payment_status': primary_lot['payment_status'] if primary_lot else None,
        'payment_amount': primary_lot['payment_amount'] if primary_lot else None,
        'payment_method': primary_lot['payment_method'] if primary_lot else None,
        'receipt_id': primary_lot['receipt_id'] if primary_lot else None,
        'lots': lots,
        'items': pickup_items,
    }
    if viewer and item.location and None not in (viewer.latitude, viewer.longitude):
        latitude_delta = math.radians(item.location.latitude - viewer.latitude)
        longitude_delta = math.radians(item.location.longitude - viewer.longitude)
        haversine = (
            math.sin(latitude_delta / 2) ** 2
            + math.cos(math.radians(viewer.latitude))
            * math.cos(math.radians(item.location.latitude))
            * math.sin(longitude_delta / 2) ** 2
        )
        result['distance_km'] = round(6371 * 2 * math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine)), 2)
    return result


def _lot_code(item):
    created_year = item.created_at.year if item.created_at else datetime.utcnow().year
    return f'RV-{created_year}-{item.id:05d}'


def _tracking_serializer():
    return URLSafeSerializer(current_app.config['SECRET_KEY'], salt='revoco-lot-tracking')


def _tracking_url(item):
    token = _tracking_serializer().dumps({'lot_id': item.id})
    app_url = os.environ.get('REVOCO_PUBLIC_APP_URL', 'http://localhost:5173').rstrip('/')
    return f'{app_url}/track/{token}'


def _record_trace(lot, actor_id, status, details=None):
    event = LotTraceEvent(
        lot_id=lot.id,
        actor_id=actor_id,
        status=status,
        details=json.dumps(details, separators=(',', ':')) if details is not None else None,
    )
    db.session.add(event)
    return event


def _record_material(value, creator_id=None):
    material = str(value or '').strip()
    if not material:
        return None
    existing = MaterialRecord.query.filter(db.func.lower(MaterialRecord.material) == material.lower()).first()
    if existing:
        return existing
    record = MaterialRecord(material=material, created_by=creator_id)
    db.session.add(record)
    return record


def _lot_json(item):
    material_item = PickupMaterialItem.query.filter_by(lot_id=item.id).first()
    link = PickupLotLink.query.filter_by(lot_id=item.id).first()
    payment = MarketTransaction.query.filter_by(lot_id=item.id).first()
    return {
        'id': item.id,
        'lot_id': _lot_code(item),
        'tracking_url': _tracking_url(item),
        'collector_id': item.collector_id,
        'collector_name': item.collector.username,
        'material': item.material,
        'quantity': item.quantity_kg,
        'price': item.price_per_kg,
        'status': item.status,
        'pickup_id': material_item.pickup_id if material_item else (link.pickup_id if link else None),
        'customer_payment_status': payment.status if payment else None,
        'created_at': item.created_at.isoformat() if item.created_at else None,
    }


def _tracking_json(item):
    events = LotTraceEvent.query.filter_by(lot_id=item.id).order_by(
        LotTraceEvent.created_at, LotTraceEvent.id
    ).all()
    event_details = {}
    timeline = []
    for event in events:
        try:
            details = json.loads(event.details) if event.details else {}
        except (TypeError, json.JSONDecodeError):
            details = {}
        event_details[event.status] = details
        timeline.append({
            'status': event.status,
            'created_at': event.created_at.isoformat() if event.created_at else None,
            'details': {
                key: details[key]
                for key in ('estimated_weight_kg', 'confirmed_weight_kg', 'payment_status')
                if key in details
            },
        })

    link = PickupLotLink.query.filter_by(lot_id=item.id).first()
    trade = LotTrade.query.filter_by(lot_id=item.id).order_by(LotTrade.created_at.desc()).first()
    latest_status = events[-1].status if events else item.status
    return {
        'lot_id': _lot_code(item),
        'material': item.material,
        'estimated_weight_kg': event_details.get('lot_created', {}).get('estimated_weight_kg'),
        'confirmed_weight_kg': event_details.get('weight_verified', {}).get('confirmed_weight_kg'),
        'current_status': latest_status,
        'pickup_status': link.pickup.status if link else None,
        'collector_status': next((event['status'] for event in reversed(timeline) if event['status'] in {
            'pickup_accepted', 'weight_verified', 'collector_accepted_company_request'
        }), None),
        'recycler_status': next((event['status'] for event in reversed(timeline) if event['status'] in {
            'company_received', 'under_recycling', 'recycling_completed'
        }), None),
        'recycler_name': trade.company.username if trade and trade.status == 'accepted' else None,
        'timeline': timeline,
    }


def _can_view_lot(user, lot):
    if user.role == 'community_helper':
        return lot.collector_id == user.id
    if user.role == 'citizen':
        material_item = PickupMaterialItem.query.filter_by(lot_id=lot.id).first()
        if material_item and material_item.pickup.user_id == user.id:
            return True
        link = PickupLotLink.query.filter_by(lot_id=lot.id).first()
        return bool(link and link.pickup.user_id == user.id)
    if user.role == 'society':
        return LotTrade.query.filter_by(lot_id=lot.id, company_id=user.id).first() is not None
    return False


def ensure_market_history():
    """Backfill current rows once without inventing past lifecycle events."""
    for material in ('E-waste', 'Paper', 'Cardboard', 'Plastic', 'Metal', 'Glass', 'Other', 'Wet Waste', 'Dry Waste', 'Mixed / Residual'):
        _record_material(material)
    for pickup in MarketPickup.query.filter_by(status='accepted').all():
        existing_items = PickupMaterialItem.query.filter_by(pickup_id=pickup.id).all()
        legacy_link = PickupLotLink.query.filter_by(pickup_id=pickup.id).first()
        if legacy_link and not any(entry.lot_id == legacy_link.lot_id for entry in existing_items):
            db.session.add(PickupMaterialItem(
                pickup_id=pickup.id,
                lot_id=legacy_link.lot_id,
                material=legacy_link.lot.material,
                estimated_weight_kg=pickup.quantity_kg,
            ))
        elif pickup.collector_id and not legacy_link and not existing_items:
            rate = MaterialRate.query.filter_by(city=pickup.city, state=pickup.state, material=pickup.material).first()
            lot = WasteLot(
                collector_id=pickup.collector_id,
                material=pickup.material,
                quantity_kg=pickup.quantity_kg,
                price_per_kg=rate.price_per_kg if rate else 0,
                status='pending_verification',
                created_at=pickup.created_at or datetime.utcnow(),
            )
            db.session.add(lot)
            db.session.flush()
            db.session.add(PickupLotLink(pickup_id=pickup.id, lot_id=lot.id))
            _record_trace(lot, pickup.collector_id, 'lot_created', {
                'estimated_weight_kg': pickup.quantity_kg,
                'source': 'legacy_pickup_backfill',
            })
            _record_trace(lot, pickup.collector_id, 'pickup_accepted', {'source': 'legacy_pickup_backfill'})
    for lot in WasteLot.query.all():
        _record_material(lot.material)
        if not LotTraceEvent.query.filter_by(lot_id=lot.id).first():
            db.session.add(LotTraceEvent(
                lot_id=lot.id,
                actor_id=lot.collector_id,
                status='lot_created',
                details=json.dumps({'source': 'existing_lot_backfill', 'marketplace_status': lot.status}),
                created_at=lot.created_at or datetime.utcnow(),
            ))
        for trade in LotTrade.query.filter_by(lot_id=lot.id).order_by(LotTrade.created_at).all():
            prior_events = {event.status for event in LotTraceEvent.query.filter_by(lot_id=lot.id).all()}
            if 'company_requested' not in prior_events:
                db.session.add(LotTraceEvent(
                    lot_id=lot.id, actor_id=trade.company_id, status='company_requested',
                    details=json.dumps({'source': 'existing_trade_backfill'}),
                    created_at=trade.created_at or lot.created_at or datetime.utcnow(),
                ))
            if trade.status == 'accepted' and 'collector_accepted_company_request' not in prior_events:
                db.session.add(LotTraceEvent(
                    lot_id=lot.id, actor_id=trade.collector_id, status='collector_accepted_company_request',
                    details=json.dumps({'source': 'existing_trade_backfill'}),
                    created_at=trade.created_at or lot.created_at or datetime.utcnow(),
                ))
            if trade.payment_status == 'recorded' and 'company_payment_recorded' not in prior_events:
                db.session.add(LotTraceEvent(
                    lot_id=lot.id, actor_id=trade.company_id, status='company_payment_recorded',
                    details=json.dumps({'source': 'existing_payment_backfill', 'payment_status': 'recorded'}),
                    created_at=trade.paid_at or trade.created_at or datetime.utcnow(),
                ))
    for rate in MaterialRate.query.all():
        _record_material(rate.material)
        if not MaterialRateHistory.query.filter_by(original_rate_id=rate.id).first():
            db.session.add(MaterialRateHistory(
                original_rate_id=rate.id,
                municipality_id=rate.municipality_id,
                city=rate.city,
                state=rate.state,
                material=rate.material,
                price_per_kg=rate.price_per_kg,
                source=rate.source,
                effective_date=rate.effective_date,
                recorded_at=rate.updated_at or datetime.utcnow(),
            ))
    for pickup in MarketPickup.query.all():
        _record_material(pickup.material)
    db.session.commit()


def _trade_json(item):
    latest_event = LotTraceEvent.query.filter_by(lot_id=item.lot_id).order_by(
        LotTraceEvent.created_at.desc(), LotTraceEvent.id.desc()
    ).first()
    return {
        'id': item.id,
        'lot_id': item.lot_id,
        'lot_code': _lot_code(item.lot),
        'tracking_url': _tracking_url(item.lot),
        'lot_status': latest_event.status if latest_event else item.lot.status,
        'company_id': item.company_id,
        'company_name': item.company.username,
        'collector_id': item.collector_id,
        'collector_name': item.collector.username,
        'material': item.lot.material,
        'quantity': item.lot.quantity_kg,
        'amount': item.amount,
        'status': item.status,
        'payment_status': item.payment_status,
        'payment_reference': item.payment_reference,
        'created_at': item.created_at.isoformat() if item.created_at else None,
        'paid_at': item.paid_at.isoformat() if item.paid_at else None,
    }


def _company_json(item):
    account = db.session.get(User, item.user_id) if item.user_id else None
    profile = UserProfile.query.filter_by(user_id=item.user_id).first() if item.user_id else None
    return {
        'id': item.id,
        'user_id': item.user_id,
        'name': item.company_name,
        'cpcb_code': item.cpcb_code,
        'email': item.email,
        'phone': account.phone if account else None,
        'address': profile.address if profile else None,
        'city': account.city if account else None,
        'state': account.state if account else None,
        'status': item.status,
        'created_at': item.created_at.isoformat() if item.created_at else None,
    }


def _rate_json(item):
    return {
        'id': item.id,
        'material': item.material,
        'price': item.price_per_kg,
        'source': item.source,
        'effectiveDate': item.effective_date.isoformat(),
        'city': item.city,
        'state': item.state,
    }


def _drive_json(item):
    return {
        'id': item.id,
        'title': item.title,
        'date': item.drive_date.isoformat(),
        'location': item.location,
        'details': item.details,
        'city': item.city,
        'state': item.state,
        'status': item.status,
    }


@market_bp.route('/materials', methods=['GET', 'POST'])
@require_roles('citizen', 'community_helper', 'society', 'municipality')
def materials():
    if request.method == 'POST':
        if g.current_user.role != 'municipality':
            return jsonify({'error': 'Only a municipality can manage material categories.'}), 403
        data = request.get_json(silent=True) or {}
        name = str(data.get('material', '')).strip()
        if not name or len(name) > 80:
            return jsonify({'error': 'Material name must be between 1 and 80 characters.'}), 400
        record = _record_material(name, g.current_user.id)
        record.active = True
        db.session.commit()
        return jsonify({'id': record.id, 'material': record.material, 'active': record.active}), 201
    records = MaterialRecord.query.filter_by(active=True).order_by(MaterialRecord.material).all()
    return jsonify([{'id': record.id, 'material': record.material} for record in records]), 200


@market_bp.route('/requirements', methods=['GET', 'POST'])
@require_roles('community_helper', 'society')
def requirements():
    if request.method == 'POST':
        if g.current_user.role != 'society':
            return jsonify({'error': 'Only verified recycling companies can post material requirements.'}), 403
        data = request.get_json(silent=True) or {}
        material = str(data.get('material', '')).strip()
        details = str(data.get('details', '')).strip()
        try:
            quantity = float(data.get('quantity_kg'))
        except (TypeError, ValueError):
            return jsonify({'error': 'Provide a valid required quantity in kilograms.'}), 400
        if not material or not math.isfinite(quantity) or quantity <= 0:
            return jsonify({'error': 'Material and a positive quantity are required.'}), 400
        requirement = RecyclerRequirement(
            company_id=g.current_user.id,
            material=material,
            quantity_kg=quantity,
            details=details or None,
        )
        db.session.add(requirement)
        _record_material(material, g.current_user.id)
        db.session.commit()
        return jsonify(_requirement_json(requirement)), 201

    query = RecyclerRequirement.query
    if g.current_user.role == 'society':
        query = query.filter_by(company_id=g.current_user.id)
    else:
        query = query.filter_by(status='open')
    return jsonify([_requirement_json(item) for item in query.order_by(RecyclerRequirement.created_at.desc()).all()]), 200


def _requirement_json(item):
    return {
        'id': item.id,
        'company_id': item.company_id,
        'company_name': item.company.username,
        'material': item.material,
        'quantity_kg': item.quantity_kg,
        'details': item.details,
        'status': item.status,
        'created_at': item.created_at.isoformat() if item.created_at else None,
    }


@market_bp.route('/pickups', methods=['GET', 'POST'])
@require_roles('citizen', 'community_helper')
def pickups():
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        user = _user_with_role(data.get('user_id'), 'citizen')
        if not user or not data.get('image_url') or not data.get('address'):
            return jsonify({'error': 'A valid user, photo, and address are required.'}), 400
        submitted_items = data.get('items')
        if submitted_items is None:
            submitted_items = [{'material': data.get('material'), 'quantity': data.get('quantity')}]
        if not isinstance(submitted_items, list) or not submitted_items or len(submitted_items) > 10:
            return jsonify({'error': 'Provide between 1 and 10 waste items.'}), 400
        parsed_items = []
        for submitted_item in submitted_items:
            if not isinstance(submitted_item, dict):
                return jsonify({'error': 'Each waste item must include a material and quantity.'}), 400
            material_name = str(submitted_item.get('material', '')).strip()
            try:
                quantity = float(submitted_item.get('quantity'))
            except (TypeError, ValueError):
                return jsonify({'error': 'Each waste item must have a positive quantity.'}), 400
            if not material_name or not math.isfinite(quantity) or quantity <= 0:
                return jsonify({'error': 'Each waste item must have a material and positive quantity.'}), 400
            parsed_items.append({'material': material_name, 'quantity': quantity})
        quantity = sum(entry['quantity'] for entry in parsed_items)
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        if (latitude is None) != (longitude is None):
            return jsonify({'error': 'Provide both pickup coordinates or neither.'}), 400
        if latitude is not None:
            try:
                latitude = float(latitude)
                longitude = float(longitude)
            except (TypeError, ValueError):
                return jsonify({'error': 'Pickup coordinates must be valid numbers.'}), 400
            if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                return jsonify({'error': 'Pickup coordinates are outside valid ranges.'}), 400

        item = MarketPickup(
            user_id=user.id,
            material=parsed_items[0]['material'],
            quantity_kg=quantity,
            image_url=data['image_url'],
            address=str(data['address']).strip(),
            city=user.city,
            state=user.state,
        )
        db.session.add(item)
        _record_material(item.material, user.id)
        db.session.flush()
        for entry in parsed_items:
            db.session.add(PickupMaterialItem(
                pickup_id=item.id,
                material=entry['material'],
                estimated_weight_kg=entry['quantity'],
            ))
            _record_material(entry['material'], user.id)
        if latitude is not None:
            db.session.add(PickupLocation(pickup_id=item.id, latitude=latitude, longitude=longitude))
        db.session.commit()
        return jsonify(_pickup_json(item)), 201

    user_id = request.args.get('user_id', type=int)
    collector_id = request.args.get('collector_id', type=int)
    if user_id:
        if not _user_with_role(user_id, 'citizen'):
            return jsonify({'error': 'User account not found.'}), 404
        query = MarketPickup.query.filter_by(user_id=user_id)
    elif collector_id:
        if not _user_with_role(collector_id, 'community_helper'):
            return jsonify({'error': 'Collector account not found.'}), 404
        query = MarketPickup.query.filter(
            db.or_(MarketPickup.status == 'requested', MarketPickup.collector_id == collector_id)
        )
    else:
        return jsonify({'error': 'user_id or collector_id is required.'}), 400
    return jsonify([_pickup_json(item, g.current_user if collector_id else None) for item in query.order_by(MarketPickup.created_at.desc()).all()]), 200


@market_bp.route('/pickups/<int:pickup_id>/accept', methods=['POST'])
@require_roles('community_helper')
def accept_pickup(pickup_id):
    data = request.get_json(silent=True) or {}
    collector = _user_with_role(data.get('collector_id'), 'community_helper')
    item = db.session.get(MarketPickup, pickup_id)
    if not collector or not item:
        return jsonify({'error': 'Collector or pickup request not found.'}), 404
    if item.status != 'requested':
        return jsonify({'error': 'This pickup is no longer available.'}), 409
    item.collector_id = collector.id
    item.status = 'accepted'
    material_items = PickupMaterialItem.query.filter_by(pickup_id=item.id).order_by(PickupMaterialItem.id).all()
    if not material_items:
        legacy_link = PickupLotLink.query.filter_by(pickup_id=item.id).first()
        material_items = [PickupMaterialItem(
            pickup_id=item.id,
            lot_id=legacy_link.lot_id if legacy_link else None,
            material=legacy_link.lot.material if legacy_link else item.material,
            estimated_weight_kg=legacy_link.lot.quantity_kg if legacy_link else item.quantity_kg,
        )]
        db.session.add(material_items[0])
        db.session.flush()
    for material_item in material_items:
        if material_item.lot_id:
            continue
        rate = MaterialRate.query.filter_by(city=item.city, state=item.state, material=material_item.material).first()
        lot = WasteLot(
            collector_id=collector.id,
            material=material_item.material,
            quantity_kg=material_item.estimated_weight_kg,
            price_per_kg=rate.price_per_kg if rate else 0,
            status='pending_verification',
        )
        db.session.add(lot)
        _record_material(material_item.material, collector.id)
        db.session.flush()
        material_item.lot_id = lot.id
        if not PickupLotLink.query.filter_by(pickup_id=item.id).first():
            db.session.add(PickupLotLink(pickup_id=item.id, lot_id=lot.id))
        _record_trace(lot, collector.id, 'lot_created', {
            'estimated_weight_kg': material_item.estimated_weight_kg,
            'source': 'pickup_request',
        })
        _record_trace(lot, collector.id, 'pickup_accepted')
    db.session.commit()
    return jsonify(_pickup_json(item)), 200


@market_bp.route('/collector/location', methods=['POST'])
@require_roles('community_helper')
def update_collector_location():
    data = request.get_json(silent=True) or {}
    try:
        latitude = float(data.get('latitude'))
        longitude = float(data.get('longitude'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Provide valid latitude and longitude.'}), 400
    if not math.isfinite(latitude) or not math.isfinite(longitude) or not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return jsonify({'error': 'Coordinates are outside valid ranges.'}), 400
    g.current_user.latitude = latitude
    g.current_user.longitude = longitude
    db.session.commit()
    return jsonify({'latitude': latitude, 'longitude': longitude}), 200


@market_bp.route('/lots', methods=['GET', 'POST'])
@require_roles('society', 'community_helper')
def lots():
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        collector = _user_with_role(data.get('collector_id'), 'community_helper')
        if not collector:
            return jsonify({'error': 'Collector account not found.'}), 404
        try:
            quantity = float(data.get('quantity'))
            price = float(data.get('price'))
        except (TypeError, ValueError):
            return jsonify({'error': 'Quantity and asking price must be valid numbers.'}), 400
        material = str(data.get('material', '')).strip()
        if not material or quantity <= 0 or price < 0:
            return jsonify({'error': 'Provide a material, positive quantity, and non-negative price.'}), 400
        item = WasteLot(
            collector_id=collector.id,
            material=material,
            quantity_kg=quantity,
            price_per_kg=price,
        )
        db.session.add(item)
        _record_material(material, collector.id)
        db.session.flush()
        _record_trace(item, collector.id, 'lot_created')
        _record_trace(item, collector.id, 'weight_verified', {
            'confirmed_weight_kg': quantity,
            'source': 'collector_listing',
        })
        db.session.commit()
        return jsonify(_lot_json(item)), 201

    collector_id = request.args.get('collector_id', type=int)
    if collector_id and not _user_with_role(collector_id, 'community_helper'):
        return jsonify({'error': 'Collector account not found.'}), 404
    query = WasteLot.query
    if collector_id:
        query = query.filter_by(collector_id=collector_id)
    else:
        query = query.filter_by(status='available')
    return jsonify([_lot_json(item) for item in query.order_by(WasteLot.created_at.desc()).all()]), 200


@market_bp.route('/lots/mine', methods=['GET'])
@require_roles('citizen', 'community_helper', 'society')
def my_lots():
    user = g.current_user
    if user.role == 'community_helper':
        lots_query = WasteLot.query.filter_by(collector_id=user.id)
    elif user.role == 'citizen':
        lots_query = WasteLot.query.join(PickupMaterialItem).join(MarketPickup).filter(MarketPickup.user_id == user.id)
    else:
        lots_query = WasteLot.query.join(LotTrade).filter(LotTrade.company_id == user.id)
    items = lots_query.order_by(WasteLot.created_at.desc()).all()
    return jsonify([_lot_json(item) for item in items]), 200


@market_bp.route('/lots/<int:lot_id>/tracking', methods=['GET'])
@require_roles('citizen', 'community_helper', 'society')
def lot_tracking(lot_id):
    lot = db.session.get(WasteLot, lot_id)
    if not lot:
        return jsonify({'error': 'Waste lot not found.'}), 404
    if not _can_view_lot(g.current_user, lot):
        return jsonify({'error': 'You are not allowed to view this lot.'}), 403
    return jsonify(_tracking_json(lot)), 200


@market_bp.route('/track/<token>', methods=['GET'])
def public_lot_tracking(token):
    try:
        claims = _tracking_serializer().loads(token)
        lot_id = claims.get('lot_id')
        lot = db.session.get(WasteLot, lot_id) if isinstance(lot_id, int) else None
    except (BadSignature, AttributeError, TypeError):
        lot = None
    if not lot:
        return jsonify({'error': 'Lot tracking link is invalid.'}), 404
    return jsonify(_tracking_json(lot)), 200


@market_bp.route('/lots/<int:lot_id>/weight', methods=['POST'])
@require_roles('community_helper')
def verify_lot_weight(lot_id):
    data = request.get_json(silent=True) or {}
    lot = db.session.get(WasteLot, lot_id)
    if not lot or lot.collector_id != g.current_user.id:
        return jsonify({'error': 'Collector-owned waste lot not found.'}), 404
    if LotTraceEvent.query.filter_by(lot_id=lot.id, status='weight_verified').first():
        return jsonify({'error': 'The collector-confirmed weight is already recorded.'}), 409
    try:
        weight = float(data.get('confirmed_weight_kg'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Provide a valid confirmed weight in kilograms.'}), 400
    if not math.isfinite(weight) or weight <= 0:
        return jsonify({'error': 'Confirmed weight must be a positive number.'}), 400
    lot.quantity_kg = weight
    if lot.status == 'pending_verification':
        lot.status = 'available'
    _record_trace(lot, g.current_user.id, 'weight_verified', {'confirmed_weight_kg': weight})
    db.session.commit()
    return jsonify(_tracking_json(lot)), 200


@market_bp.route('/lots/<int:lot_id>/recycling', methods=['POST'])
@require_roles('society')
def update_recycling_status(lot_id):
    data = request.get_json(silent=True) or {}
    status = str(data.get('status', '')).strip()
    allowed = {'company_received', 'under_recycling', 'recycling_completed'}
    if status not in allowed:
        return jsonify({'error': 'Unsupported recycling status.'}), 400
    lot = db.session.get(WasteLot, lot_id)
    trade = LotTrade.query.filter_by(lot_id=lot_id, company_id=g.current_user.id).order_by(LotTrade.created_at.desc()).first()
    if not lot or not trade or trade.status != 'accepted' or trade.payment_status != 'recorded':
        return jsonify({'error': 'A paid and accepted lot assigned to your company is required.'}), 403
    events = LotTraceEvent.query.filter_by(lot_id=lot_id).order_by(
        LotTraceEvent.created_at.desc(), LotTraceEvent.id.desc()
    ).all()
    current_status = events[0].status if events else None
    expected_previous = {
        'company_received': 'company_payment_recorded',
        'under_recycling': 'company_received',
        'recycling_completed': 'under_recycling',
    }
    if current_status != expected_previous[status]:
        return jsonify({'error': 'This recycling status cannot follow the lot\'s current status.'}), 409
    _record_trace(lot, g.current_user.id, status)
    db.session.commit()
    return jsonify(_tracking_json(lot)), 200


@market_bp.route('/lots/<int:lot_id>/customer-payment', methods=['POST'])
@require_roles('community_helper')
def report_customer_payment(lot_id):
    data = request.get_json(silent=True) or {}
    lot = db.session.get(WasteLot, lot_id)
    material_item = PickupMaterialItem.query.filter_by(lot_id=lot_id).first()
    if not lot or lot.collector_id != g.current_user.id or not material_item:
        return jsonify({'error': 'Collector-owned pickup lot not found.'}), 404
    if not LotTraceEvent.query.filter_by(lot_id=lot_id, status='weight_verified').first():
        return jsonify({'error': 'Verify the collected weight before recording payment.'}), 409
    if MarketTransaction.query.filter_by(lot_id=lot.id).first():
        return jsonify({'error': 'A payment record already exists for this pickup.'}), 409
    method = str(data.get('payment_method', '')).strip().lower()
    if method not in {'cash', 'digital'}:
        return jsonify({'error': 'Choose cash or digital as the reported payment method.'}), 400
    amount = round(lot.quantity_kg * lot.price_per_kg, 2)
    if amount <= 0:
        return jsonify({'error': 'A published municipality rate is required before recording payment.'}), 409
    transaction = MarketTransaction(
        lot_id=lot.id,
        payer_id=g.current_user.id,
        payee_id=material_item.pickup.user_id,
        amount=amount,
        payment_method=method,
        payment_reference=str(data.get('payment_reference', '')).strip() or None,
        status='awaiting_user_confirmation',
    )
    db.session.add(transaction)
    db.session.flush()
    _record_trace(lot, g.current_user.id, 'customer_payment_reported', {'payment_status': transaction.status})
    db.session.commit()
    return jsonify({
        'id': transaction.id,
        'lot_id': _lot_code(lot),
        'amount': transaction.amount,
        'payment_method': transaction.payment_method,
        'status': transaction.status,
    }), 201


@market_bp.route('/lots/<int:lot_id>/customer-payment/confirm', methods=['POST'])
@require_roles('citizen')
def confirm_customer_payment(lot_id):
    lot = db.session.get(WasteLot, lot_id)
    material_item = PickupMaterialItem.query.filter_by(lot_id=lot_id).first()
    transaction = MarketTransaction.query.filter_by(lot_id=lot_id).first()
    if not lot or not material_item or material_item.pickup.user_id != g.current_user.id or not transaction:
        return jsonify({'error': 'Payment receipt not found for your account.'}), 404
    if transaction.status != 'awaiting_user_confirmation':
        return jsonify({'error': 'This payment receipt is no longer awaiting confirmation.'}), 409
    transaction.status = 'confirmed_by_citizen'
    _record_trace(lot, g.current_user.id, 'customer_payment_confirmed', {'payment_status': transaction.status})
    db.session.commit()
    return jsonify({
        'id': transaction.id,
        'receipt_id': f'RV-RCPT-{transaction.id:06d}',
        'lot_id': _lot_code(lot),
        'amount': transaction.amount,
        'payment_method': transaction.payment_method,
        'status': transaction.status,
        'created_at': transaction.created_at.isoformat() if transaction.created_at else None,
    }), 200


@market_bp.route('/transactions/mine', methods=['GET'])
@require_roles('citizen', 'community_helper', 'society')
def my_transactions():
    user = g.current_user
    transactions = MarketTransaction.query.filter(
        db.or_(MarketTransaction.payer_id == user.id, MarketTransaction.payee_id == user.id)
    ).order_by(MarketTransaction.created_at.desc()).all()
    return jsonify([{
        'id': item.id,
        'receipt_id': f'RV-RCPT-{item.id:06d}' if item.status == 'confirmed_by_citizen' else None,
        'lot_id': _lot_code(item.lot) if item.lot else None,
        'amount': item.amount,
        'payment_method': item.payment_method,
        'payment_reference': item.payment_reference,
        'status': item.status,
        'payer_id': item.payer_id,
        'payer_name': item.payer.username,
        'payee_id': item.payee_id,
        'payee_name': item.payee.username,
        'created_at': item.created_at.isoformat() if item.created_at else None,
    } for item in transactions]), 200


@market_bp.route('/lots/<int:lot_id>/request', methods=['POST'])
@require_roles('society')
def request_lot(lot_id):
    data = request.get_json(silent=True) or {}
    company = _user_with_role(data.get('company_id'), 'society')
    lot = db.session.get(WasteLot, lot_id)
    if not company or not lot:
        return jsonify({'error': 'Company account or waste lot not found.'}), 404
    registration = CompanyRegistration.query.filter_by(user_id=company.id).first()
    if not registration or registration.status != 'verified':
        return jsonify({'error': 'Your CPCB registration must be verified by the municipality before requesting lots.'}), 403
    if lot.status != 'available':
        return jsonify({'error': 'This waste lot is no longer available.'}), 409
    trade = LotTrade(
        lot_id=lot.id,
        company_id=company.id,
        collector_id=lot.collector_id,
        amount=round(lot.quantity_kg * lot.price_per_kg, 2),
    )
    lot.status = 'reserved'
    db.session.add(trade)
    db.session.flush()
    _record_trace(lot, company.id, 'company_requested')
    db.session.commit()
    return jsonify(_trade_json(trade)), 201


@market_bp.route('/trades', methods=['GET'])
@require_roles('society', 'community_helper')
def trades():
    user_id = request.args.get('user_id', type=int)
    user = db.session.get(User, user_id) if user_id else None
    if not user or user.id != g.current_user.id or user.role not in ('society', 'community_helper'):
        return jsonify({'error': 'A valid company or collector account is required.'}), 404
    query = LotTrade.query.filter(
        LotTrade.company_id == user.id if user.role == 'society' else LotTrade.collector_id == user.id
    )
    return jsonify([_trade_json(item) for item in query.order_by(LotTrade.created_at.desc()).all()]), 200


@market_bp.route('/trades/<int:trade_id>/accept', methods=['POST'])
@require_roles('community_helper')
def accept_trade(trade_id):
    data = request.get_json(silent=True) or {}
    collector = _user_with_role(data.get('collector_id'), 'community_helper')
    trade = db.session.get(LotTrade, trade_id)
    if not collector or not trade or trade.collector_id != collector.id:
        return jsonify({'error': 'Collector or trade not found.'}), 404
    if trade.status != 'requested':
        return jsonify({'error': 'This request is no longer pending.'}), 409
    trade.status = 'accepted'
    trade.payment_status = 'pending'
    _record_trace(trade.lot, collector.id, 'collector_accepted_company_request')
    db.session.commit()
    return jsonify(_trade_json(trade)), 200


@market_bp.route('/trades/<int:trade_id>/payments', methods=['POST'])
@require_roles('society')
def record_payment(trade_id):
    data = request.get_json(silent=True) or {}
    company = _user_with_role(data.get('company_id'), 'society')
    trade = db.session.get(LotTrade, trade_id)
    if not company or not trade or trade.company_id != company.id:
        return jsonify({'error': 'Company or trade not found.'}), 404
    if trade.status != 'accepted' or trade.payment_status == 'recorded':
        return jsonify({'error': 'Payment can only be recorded once for an accepted trade.'}), 409
    method = str(data.get('payment_method', 'manual_record')).strip().lower()
    if method not in {'cash', 'digital', 'bank_transfer', 'manual_record'}:
        return jsonify({'error': 'Choose cash, digital, bank_transfer, or manual_record.'}), 400
    trade.payment_status = 'recorded'
    trade.payment_reference = str(data.get('payment_reference', '')).strip() or None
    trade.paid_at = datetime.utcnow()
    trade.lot.status = 'sold'
    db.session.add(MarketTransaction(
        lot_id=trade.lot_id,
        trade_id=trade.id,
        payer_id=company.id,
        payee_id=trade.collector_id,
        amount=trade.amount,
        payment_method=method,
        payment_reference=trade.payment_reference,
        status='recorded',
    ))
    _record_trace(trade.lot, company.id, 'company_payment_recorded', {'payment_status': 'recorded'})
    db.session.commit()
    return jsonify(_trade_json(trade)), 200


@market_bp.route('/companies', methods=['GET', 'POST'])
@require_roles('municipality')
def companies():
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        municipality = _user_with_role(data.get('municipality_id'), 'municipality')
        company_name = str(data.get('name', '')).strip()
        code = str(data.get('cpcb_code', '')).strip()
        email = str(data.get('email', '')).strip()
        if not municipality or not company_name or not email or not code.isdigit() or len(code) != 10:
            return jsonify({'error': 'Municipality, company name, email, and a 10-digit CPCB code are required.'}), 400
        if CompanyRegistration.query.filter_by(cpcb_code=code).first():
            return jsonify({'error': 'CPCB code is already registered.'}), 409
        registration = CompanyRegistration(
            registered_by=municipality.id,
            company_name=company_name,
            cpcb_code=code,
            email=email,
        )
        db.session.add(registration)
        db.session.commit()
        return jsonify(_company_json(registration)), 201

    municipality_id = request.args.get('municipality_id', type=int)
    if not _user_with_role(municipality_id, 'municipality'):
        return jsonify({'error': 'Municipality account not found.'}), 404
    registrations = CompanyRegistration.query.order_by(CompanyRegistration.created_at.desc()).all()
    return jsonify([_company_json(item) for item in registrations]), 200


@market_bp.route('/companies/<int:company_id>/verify', methods=['POST'])
@require_roles('municipality')
def verify_company(company_id):
    data = request.get_json(silent=True) or {}
    municipality = _user_with_role(data.get('municipality_id'), 'municipality')
    registration = db.session.get(CompanyRegistration, company_id)
    if not municipality or not registration:
        return jsonify({'error': 'Municipality or company registration not found.'}), 404
    registration.status = 'verified'
    registration.registered_by = municipality.id
    db.session.commit()
    return jsonify(_company_json(registration)), 200


@market_bp.route('/rates', methods=['GET', 'POST'])
@require_roles('citizen', 'community_helper', 'society', 'municipality')
def rates():
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        municipality = _user_with_role(data.get('municipality_id'), 'municipality')
        try:
            price = float(data.get('price'))
            effective_date = date.fromisoformat(data.get('effective_date', ''))
        except (TypeError, ValueError):
            return jsonify({'error': 'Provide a valid rate and effective date.'}), 400
        material = str(data.get('material', '')).strip()
        source = str(data.get('source', '')).strip()
        if not municipality or not material or not source or price < 0 or not municipality.city or not municipality.state:
            return jsonify({'error': 'Municipality location, material, non-negative rate, source, and effective date are required.'}), 400
        _record_material(material, municipality.id)
        item = MaterialRate.query.filter_by(city=municipality.city, state=municipality.state, material=material).first()
        if item:
            db.session.add(MaterialRateHistory(
                original_rate_id=item.id,
                municipality_id=item.municipality_id,
                city=item.city,
                state=item.state,
                material=item.material,
                price_per_kg=item.price_per_kg,
                source=item.source,
                effective_date=item.effective_date,
            ))
            item.municipality_id = municipality.id
            item.price_per_kg = price
            item.source = source
            item.effective_date = effective_date
        else:
            item = MaterialRate(
                municipality_id=municipality.id,
                city=municipality.city,
                state=municipality.state,
                material=material,
                price_per_kg=price,
                source=source,
                effective_date=effective_date,
            )
            db.session.add(item)
        db.session.flush()
        unpriced_lots = WasteLot.query.join(User, WasteLot.collector_id == User.id).filter(
            WasteLot.material == material,
            WasteLot.price_per_kg == 0,
            User.city == municipality.city,
            User.state == municipality.state,
            WasteLot.status.in_(('pending_verification', 'available')),
        ).all()
        for lot in unpriced_lots:
            lot.price_per_kg = price
        db.session.commit()
        return jsonify(_rate_json(item)), 201

    query = MaterialRate.query
    city = request.args.get('city')
    state = request.args.get('state')
    if city:
        query = query.filter_by(city=city)
    if state:
        query = query.filter_by(state=state)
    return jsonify([_rate_json(item) for item in query.order_by(MaterialRate.material).all()]), 200


@market_bp.route('/rates/history', methods=['GET'])
@require_roles('citizen', 'community_helper', 'society', 'municipality')
def rate_history():
    query = MaterialRateHistory.query
    city = request.args.get('city')
    state = request.args.get('state')
    material = request.args.get('material')
    if city:
        query = query.filter_by(city=city)
    if state:
        query = query.filter_by(state=state)
    if material:
        query = query.filter_by(material=material)
    records = query.order_by(MaterialRateHistory.effective_date.desc(), MaterialRateHistory.id.desc()).all()
    return jsonify([{
        'id': record.id,
        'material': record.material,
        'price': record.price_per_kg,
        'source': record.source,
        'effectiveDate': record.effective_date.isoformat(),
        'recordedAt': record.recorded_at.isoformat() if record.recorded_at else None,
        'city': record.city,
        'state': record.state,
    } for record in records]), 200


@market_bp.route('/drives', methods=['GET', 'POST'])
@require_roles('citizen', 'community_helper', 'society', 'municipality')
def drives():
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        municipality = _user_with_role(data.get('municipality_id'), 'municipality')
        title = str(data.get('title', '')).strip()
        location = str(data.get('location', '')).strip()
        try:
            drive_date = date.fromisoformat(data.get('date', ''))
        except (TypeError, ValueError):
            return jsonify({'error': 'A valid drive date is required.'}), 400
        if not municipality or not municipality.city or not municipality.state or not title or not location:
            return jsonify({'error': 'Municipality location, drive name, date, and address are required.'}), 400
        item = EWasteDrive(
            municipality_id=municipality.id,
            city=municipality.city,
            state=municipality.state,
            title=title,
            drive_date=drive_date,
            location=location,
            details=str(data.get('details', '')).strip(),
        )
        db.session.add(item)
        db.session.commit()
        return jsonify(_drive_json(item)), 201

    query = EWasteDrive.query.filter_by(status='published')
    city = request.args.get('city')
    state = request.args.get('state')
    if city:
        query = query.filter_by(city=city)
    if state:
        query = query.filter_by(state=state)
    return jsonify([_drive_json(item) for item in query.order_by(EWasteDrive.drive_date).all()]), 200