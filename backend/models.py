from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), nullable=False, default='citizen') # citizen, municipality, admin, community_helper, donor
    city_score = db.Column(db.Integer, default=0) # score for city/gamification
    phone = db.Column(db.String(20), nullable=True)
    state = db.Column(db.String(100), nullable=True)
    city = db.Column(db.String(100), nullable=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class WasteReport(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    image_url = db.Column(db.String(200), nullable=True)
    address_text = db.Column(db.Text, nullable=True) # Full typed exact location
    state = db.Column(db.String(100), nullable=True)
    city = db.Column(db.String(100), nullable=True)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    volume_estimated = db.Column(db.Float, nullable=True) # AI derived
    segregation_score = db.Column(db.Float, nullable=True) # AI derived
    reward_earned = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(50), default='reported') # reported -> seen -> assigned -> completed -> verified
    assigned_to = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True) # Helper assigned to this case
    completed_image_url = db.Column(db.String(200), nullable=True) # Proof of cleaning
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('reports', lazy=True))
    assignee = db.relationship('User', foreign_keys=[assigned_to])

class Donation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True) # null if anon
    amount = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('donations', lazy=True))

class CollectionRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    assigned_to = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    scheduled_date = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(50), default='pending') # pending -> seen -> assigned -> completed -> verified
    location_details = db.Column(db.String(255), nullable=False)
    city = db.Column(db.String(100), nullable=True)
    state = db.Column(db.String(100), nullable=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    volume_estimated = db.Column(db.Float, nullable=True)  # AI-derived from completion photo
    completed_image_url = db.Column(db.Text, nullable=True)  # Proof photo from helper
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('collection_requests', lazy=True))
    assignee = db.relationship('User', foreign_keys=[assigned_to])

class Society(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    society_code = db.Column(db.String(50), unique=True, nullable=False)
    admin_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    admin = db.relationship('User', backref=db.backref('administered_societies', lazy=True))

class SocietyMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    society_id = db.Column(db.Integer, db.ForeignKey('society.id'), nullable=False)
    status = db.Column(db.String(50), default='pending') # pending, accepted, rejected
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('society_memberships', lazy=True))
    society = db.relationship('Society', backref=db.backref('members', lazy=True))

class Announcement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    society_id = db.Column(db.Integer, db.ForeignKey('society.id'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    society = db.relationship('Society', backref=db.backref('announcements', lazy=True))
    author = db.relationship('User', backref=db.backref('announcements_authored', lazy=True))


class UserProfile(db.Model):
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    address = db.Column(db.Text, nullable=False)
    user = db.relationship('User', backref=db.backref('profile', uselist=False, cascade='all, delete-orphan'))


class UserPreference(db.Model):
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    language = db.Column(db.String(5), nullable=False, default='en')
    user = db.relationship('User', backref=db.backref('preferences', uselist=False, cascade='all, delete-orphan'))


class CompanyRegistration(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True, nullable=True)
    registered_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    company_name = db.Column(db.String(150), nullable=False)
    cpcb_code = db.Column(db.String(10), unique=True, nullable=False)
    email = db.Column(db.String(120), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    account = db.relationship('User', foreign_keys=[user_id], backref=db.backref('company_registration', uselist=False))
    municipality = db.relationship('User', foreign_keys=[registered_by])


class MarketPickup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    collector_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    material = db.Column(db.String(50), nullable=False)
    quantity_kg = db.Column(db.Float, nullable=False)
    image_url = db.Column(db.Text, nullable=False)
    address = db.Column(db.Text, nullable=False)
    city = db.Column(db.String(100), nullable=True)
    state = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(20), nullable=False, default='requested')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id])
    collector = db.relationship('User', foreign_keys=[collector_id])


class WasteLot(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    collector_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    material = db.Column(db.String(50), nullable=False)
    quantity_kg = db.Column(db.Float, nullable=False)
    price_per_kg = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='available')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    collector = db.relationship('User', backref=db.backref('waste_lots', lazy=True))


class LotTrade(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    lot_id = db.Column(db.Integer, db.ForeignKey('waste_lot.id'), nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    collector_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='requested')
    payment_status = db.Column(db.String(20), nullable=False, default='not_due')
    amount = db.Column(db.Float, nullable=False)
    payment_reference = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    paid_at = db.Column(db.DateTime, nullable=True)

    lot = db.relationship('WasteLot', backref=db.backref('trades', lazy=True))
    company = db.relationship('User', foreign_keys=[company_id])
    collector = db.relationship('User', foreign_keys=[collector_id])


class MaterialRate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    municipality_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    city = db.Column(db.String(100), nullable=False)
    state = db.Column(db.String(100), nullable=False)
    material = db.Column(db.String(50), nullable=False)
    price_per_kg = db.Column(db.Float, nullable=False)
    source = db.Column(db.String(255), nullable=False)
    effective_date = db.Column(db.Date, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    municipality = db.relationship('User', backref=db.backref('published_material_rates', lazy=True))

    __table_args__ = (db.UniqueConstraint('city', 'state', 'material', name='uq_material_rate_location'),)


class EWasteDrive(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    municipality_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    city = db.Column(db.String(100), nullable=False)
    state = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(150), nullable=False)
    drive_date = db.Column(db.Date, nullable=False)
    location = db.Column(db.Text, nullable=False)
    details = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='published')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    municipality = db.relationship('User', backref=db.backref('e_waste_drives', lazy=True))


class PickupLotLink(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    pickup_id = db.Column(db.Integer, db.ForeignKey('market_pickup.id'), nullable=False, unique=True)
    lot_id = db.Column(db.Integer, db.ForeignKey('waste_lot.id'), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    pickup = db.relationship('MarketPickup', backref=db.backref('lot_link', uselist=False))
    lot = db.relationship('WasteLot', backref=db.backref('pickup_link', uselist=False))


class PickupLocation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    pickup_id = db.Column(db.Integer, db.ForeignKey('market_pickup.id'), nullable=False, unique=True)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)

    pickup = db.relationship('MarketPickup', backref=db.backref('location', uselist=False))


class PickupMaterialItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    pickup_id = db.Column(db.Integer, db.ForeignKey('market_pickup.id'), nullable=False, index=True)
    lot_id = db.Column(db.Integer, db.ForeignKey('waste_lot.id'), nullable=True, unique=True)
    material = db.Column(db.String(50), nullable=False)
    estimated_weight_kg = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    pickup = db.relationship('MarketPickup', backref=db.backref('material_items', lazy=True, order_by='PickupMaterialItem.id'))
    lot = db.relationship('WasteLot', backref=db.backref('pickup_material_item', uselist=False))


class LotTraceEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    lot_id = db.Column(db.Integer, db.ForeignKey('waste_lot.id'), nullable=False, index=True)
    actor_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    status = db.Column(db.String(50), nullable=False)
    details = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    lot = db.relationship('WasteLot', backref=db.backref('trace_events', lazy=True, order_by='LotTraceEvent.created_at'))
    actor = db.relationship('User')


class MarketTransaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    lot_id = db.Column(db.Integer, db.ForeignKey('waste_lot.id'), nullable=True, index=True)
    trade_id = db.Column(db.Integer, db.ForeignKey('lot_trade.id'), nullable=True, unique=True)
    pickup_id = db.Column(db.Integer, db.ForeignKey('market_pickup.id'), nullable=True, unique=True)
    payer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    payee_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    payment_method = db.Column(db.String(30), nullable=False)
    payment_reference = db.Column(db.String(120), nullable=True)
    status = db.Column(db.String(30), nullable=False, default='recorded')
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    lot = db.relationship('WasteLot')
    trade = db.relationship('LotTrade')
    pickup = db.relationship('MarketPickup')
    payer = db.relationship('User', foreign_keys=[payer_id])
    payee = db.relationship('User', foreign_keys=[payee_id])


class MaterialRateHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    original_rate_id = db.Column(db.Integer, nullable=False, index=True)
    municipality_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    city = db.Column(db.String(100), nullable=False)
    state = db.Column(db.String(100), nullable=False)
    material = db.Column(db.String(50), nullable=False)
    price_per_kg = db.Column(db.Float, nullable=False)
    source = db.Column(db.String(255), nullable=False)
    effective_date = db.Column(db.Date, nullable=False)
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    municipality = db.relationship('User')


class MaterialRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    material = db.Column(db.String(80), nullable=False, unique=True)
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    creator = db.relationship('User')


class RecyclerRequirement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    material = db.Column(db.String(50), nullable=False)
    quantity_kg = db.Column(db.Float, nullable=False)
    details = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='open')
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    company = db.relationship('User', backref=db.backref('recycler_requirements', lazy=True))

