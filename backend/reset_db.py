from app import app, db
from models import (
    CompanyRegistration,
    CollectionRequest,
    Society,
    SocietyMember,
    User,
    UserProfile,
    WasteLot,
    WasteReport,
)
from werkzeug.security import generate_password_hash
import random

def get_random_pune_coord():
    lat = 18.5204 + random.uniform(-0.04, 0.04)
    lng = 73.8567 + random.uniform(-0.04, 0.04)
    return lat, lng

with app.app_context():
    db.drop_all()
    db.create_all()

    users = [
        User(username='Platform Admin', email='admin@gmail.com', password_hash=generate_password_hash('password'), role='admin', city='Pune', state='Maharashtra'),
        User(username='Pune User', email='citizen@gmail.com', password_hash=generate_password_hash('password'), role='citizen', phone='9876543210', city='Pune', state='Maharashtra', latitude=18.5204, longitude=73.8567),
        User(username='Pune Municipality', email='mun@gmail.com', password_hash=generate_password_hash('password'), role='municipality', city='Pune', state='Maharashtra', latitude=18.5204, longitude=73.8567),
        User(username='Pune Collector', email='helper@gmail.com', password_hash=generate_password_hash('password'), role='community_helper', phone='9876543211', city='Pune', state='Maharashtra', latitude=18.5304, longitude=73.8467),
        User(username='Pune Recycling Company', email='company@gmail.com', password_hash=generate_password_hash('password'), role='society', phone='9876543212', city='Pune', state='Maharashtra'),
    ]

    db.session.add_all(users)
    db.session.flush()

    db.session.add_all([
        UserProfile(user_id=users[1].id, address='Shivajinagar, Pune, Maharashtra'),
        UserProfile(user_id=users[2].id, address='Pune Municipal Office, Maharashtra'),
        UserProfile(user_id=users[3].id, address='Pune, Maharashtra'),
        UserProfile(user_id=users[4].id, address='Pune, Maharashtra'),
        CompanyRegistration(
            user_id=users[4].id,
            company_name=users[4].username,
            cpcb_code='1234567890',
            email=users[4].email,
            status='pending',
        ),
    ])
    db.session.commit()

    # Keep legacy community-management screens usable with the seeded accounts.
    soc = Society(name='Pune Recycling Network', society_code='PUNE01', admin_id=users[4].id)
    db.session.add(soc)
    db.session.commit()

    db.session.add(SocietyMember(user_id=users[4].id, society_id=soc.id, status='accepted'))
    db.session.add(SocietyMember(user_id=users[1].id, society_id=soc.id, status='accepted'))

    db.session.add(WasteLot(
        collector_id=users[3].id,
        material='Paper',
        quantity_kg=12,
        price_per_kg=18,
    ))

    for i in range(3):
        lat, lng = get_random_pune_coord()
        wr = WasteReport(
            user_id=users[1].id,
            latitude=lat,
            longitude=lng,
            address_text=f"Pune collection point {i + 1}",
            city='Pune',
            state='Maharashtra',
            volume_estimated=random.uniform(5.0, 25.0),
            status='assigned',
            assigned_to=users[3].id,
        )
        db.session.add(wr)

    for i in range(2):
        lat, lng = get_random_pune_coord()
        cr = CollectionRequest(
            user_id=users[4].id,
            location_details=f"Pune recycling request {i + 1}",
            city='Pune',
            state='Maharashtra',
            latitude=lat,
            longitude=lng,
            status='assigned',
            assigned_to=users[3].id,
        )
        db.session.add(cr)

    db.session.commit()
    print("Database reset with demo portal accounts and Pune collection data.")
    print("Demo password for all accounts: password")
    print("User: citizen@gmail.com | Collector: helper@gmail.com")
    print("Company: company@gmail.com (CPCB verification pending)")
    print("Municipality: mun@gmail.com | Admin: admin@gmail.com")
