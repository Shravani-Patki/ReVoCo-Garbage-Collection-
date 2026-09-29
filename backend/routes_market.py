from datetime import date, datetime

from flask import Blueprint, g, jsonify, request

from models import (
    CompanyRegistration,
    EWasteDrive,
    LotTrade,
    MarketPickup,
    MaterialRate,
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


def _pickup_json(item):
    return {
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
        'created_at': item.created_at.isoformat() if item.created_at else None,
    }


def _lot_json(item):
    return {
        'id': item.id,
        'collector_id': item.collector_id,
        'collector_name': item.collector.username,
        'material': item.material,
        'quantity': item.quantity_kg,
        'price': item.price_per_kg,
        'status': item.status,
        'created_at': item.created_at.isoformat() if item.created_at else None,
    }


def _trade_json(item):
    return {
        'id': item.id,
        'lot_id': item.lot_id,
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


@market_bp.route('/pickups', methods=['GET', 'POST'])
@require_roles('citizen', 'community_helper')
def pickups():
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        user = _user_with_role(data.get('user_id'), 'citizen')
        required = ['material', 'quantity', 'image_url', 'address']
        if not user or any(not data.get(field) for field in required):
            return jsonify({'error': 'A valid user, material, quantity, photo, and address are required.'}), 400
        try:
            quantity = float(data['quantity'])
        except (TypeError, ValueError):
            return jsonify({'error': 'Quantity must be a positive number.'}), 400
        if quantity <= 0:
            return jsonify({'error': 'Quantity must be a positive number.'}), 400

        item = MarketPickup(
            user_id=user.id,
            material=str(data['material']).strip(),
            quantity_kg=quantity,
            image_url=data['image_url'],
            address=str(data['address']).strip(),
            city=user.city,
            state=user.state,
        )
        db.session.add(item)
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
    return jsonify([_pickup_json(item) for item in query.order_by(MarketPickup.created_at.desc()).all()]), 200


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
    db.session.commit()
    return jsonify(_pickup_json(item)), 200


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
    trade.payment_status = 'recorded'
    trade.payment_reference = str(data.get('payment_reference', '')).strip() or None
    trade.paid_at = datetime.utcnow()
    trade.lot.status = 'sold'
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
        item = MaterialRate.query.filter_by(city=municipality.city, state=municipality.state, material=material).first()
        if item:
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