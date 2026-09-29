import base64
import io

import pytest
from PIL import Image

from auth_tokens import create_access_token
from app import create_app
from models import User, db


@pytest.fixture
def client():
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite://',
    })
    with app.app_context():
        db.drop_all()
        db.create_all()
    yield app.test_client()
    with app.app_context():
        db.session.remove()
        db.drop_all()


def register(client, username, role, **extra):
    response = client.post('/api/auth/register', json={
        'username': username,
        'email': f'{username}@example.test',
        'password': 'test-password',
        'phone': '9876543210' if role == 'society' else None,
        'address': f'{username} address',
        'city': 'Pune',
        'state': 'Maharashtra',
        'role': role,
        **extra,
    })
    expected_status = 202 if role == 'society' else 201
    assert response.status_code == expected_status, response.get_json()
    response_data = response.get_json()
    return {
        **response_data.get('user', {}),
        'token': response_data.get('token'),
        'company_status': response_data.get('company_status'),
    }


def headers(user):
    return {'Authorization': f"Bearer {user['token']}"}


def test_registration_persists_address_and_requires_company_cpcb(client):
    invalid_company = client.post('/api/auth/register', json={
        'username': 'bad-company',
        'email': 'bad-company@example.test',
        'password': 'test-password',
        'address': 'Company address',
        'role': 'society',
        'cpcb_code': '123',
    })
    assert invalid_company.status_code == 400

    user = register(client, 'registered-user', 'citizen')
    assert user['address'] == 'registered-user address'

    company = register(client, 'registered-company', 'society', cpcb_code='1234567890')
    assert company['company_status'] == 'pending'

    with client.application.app_context():
        company_user = User.query.filter_by(email='registered-company@example.test').first()
        pending_token = create_access_token(company_user)
    pending_session = client.get(
        '/api/market/rates?city=Pune&state=Maharashtra',
        headers={'Authorization': f'Bearer {pending_token}'},
    )
    assert pending_session.status_code == 403

    login = client.post('/api/auth/login', json={
        'email': 'registered-company@example.test',
        'password': 'test-password',
    })
    assert login.status_code == 403
    assert 'verification pending' in login.get_json()['error'].lower()

    municipality = register(client, 'approval-municipality', 'municipality')
    registrations = client.get(
        f"/api/market/companies?municipality_id={municipality['id']}",
        headers=headers(municipality),
    ).get_json()
    company_record = next(item for item in registrations if item['email'] == 'registered-company@example.test')
    assert company_record['address'] == 'registered-company address'
    assert company_record['phone'] == '9876543210'
    verified = client.post(
        f"/api/market/companies/{company_record['id']}/verify",
        headers=headers(municipality),
        json={'municipality_id': municipality['id']},
    )
    assert verified.status_code == 200

    login = client.post('/api/auth/login', json={
        'email': 'registered-company@example.test',
        'password': 'test-password',
    })
    assert login.status_code == 200
    assert login.get_json()['user']['address'] == 'registered-company address'


def test_language_preference_persists_for_account(client):
    user = register(client, 'language-user', 'citizen')
    update = client.post(
        '/api/auth/language',
        headers=headers(user),
        json={'language': 'ta'},
    )
    assert update.status_code == 200
    assert update.get_json()['language'] == 'ta'

    login = client.post('/api/auth/login', json={
        'email': 'language-user@example.test',
        'password': 'test-password',
    })
    assert login.get_json()['user']['language'] == 'ta'


def test_market_pickup_lot_trade_rate_and_drive_workflows(client):
    user = register(client, 'market-user', 'citizen')
    collector = register(client, 'market-collector', 'community_helper')
    register(client, 'market-company', 'society', cpcb_code='2345678901')
    municipality = register(client, 'market-municipality', 'municipality')

    company_records = client.get(
        f"/api/market/companies?municipality_id={municipality['id']}",
        headers=headers(municipality),
    ).get_json()
    company_record = next(item for item in company_records if item['email'] == 'market-company@example.test')
    client.post(
        f"/api/market/companies/{company_record['id']}/verify",
        headers=headers(municipality),
        json={'municipality_id': municipality['id']},
    )
    company_login = client.post('/api/auth/login', json={
        'email': 'market-company@example.test',
        'password': 'test-password',
    })
    assert company_login.status_code == 200
    company = {**company_login.get_json()['user'], 'token': company_login.get_json()['token']}

    pickup = client.post('/api/market/pickups', headers=headers(user), json={
        'user_id': user['id'],
        'material': 'Paper',
        'quantity': 4.5,
        'address': 'Pickup street, Pune',
        'image_url': 'data:image/jpeg;base64,aGVsbG8=',
    })
    assert pickup.status_code == 201
    pickup_id = pickup.get_json()['id']

    unauthenticated = client.get(f"/api/market/pickups?user_id={user['id']}")
    assert unauthenticated.status_code == 401

    collector_feed = client.get(f"/api/market/pickups?collector_id={collector['id']}", headers=headers(collector))
    assert collector_feed.get_json()[0]['id'] == pickup_id
    accepted = client.post(f'/api/market/pickups/{pickup_id}/accept', headers=headers(collector), json={'collector_id': collector['id']})
    assert accepted.status_code == 200
    assert accepted.get_json()['status'] == 'accepted'

    lot = client.post('/api/market/lots', headers=headers(collector), json={
        'collector_id': collector['id'],
        'material': 'E-waste',
        'quantity': 8,
        'price': 120,
    })
    assert lot.status_code == 201
    lot_id = lot.get_json()['id']

    companies = client.get(f"/api/market/companies?municipality_id={municipality['id']}", headers=headers(municipality)).get_json()
    company_record = next(item for item in companies if item['user_id'] == company['id'])
    verified = client.post(
        f"/api/market/companies/{company_record['id']}/verify",
        headers=headers(municipality),
        json={'municipality_id': municipality['id']},
    )
    assert verified.get_json()['status'] == 'verified'

    trade = client.post(f'/api/market/lots/{lot_id}/request', headers=headers(company), json={'company_id': company['id']})
    assert trade.status_code == 201
    trade_id = trade.get_json()['id']
    accepted_trade = client.post(f'/api/market/trades/{trade_id}/accept', headers=headers(collector), json={'collector_id': collector['id']})
    assert accepted_trade.get_json()['status'] == 'accepted'
    payment = client.post(f'/api/market/trades/{trade_id}/payments', headers=headers(company), json={'company_id': company['id']})
    assert payment.get_json()['payment_status'] == 'recorded'

    rate = client.post('/api/market/rates', headers=headers(municipality), json={
        'municipality_id': municipality['id'],
        'material': 'Paper',
        'price': 18.5,
        'source': 'Municipal circular 12/2026',
        'effective_date': '2026-09-01',
    })
    assert rate.status_code == 201
    assert client.get('/api/market/rates?city=Pune&state=Maharashtra', headers=headers(user)).get_json()[0]['price'] == 18.5

    drive = client.post('/api/market/drives', headers=headers(municipality), json={
        'municipality_id': municipality['id'],
        'title': 'City E-waste Day',
        'date': '2026-10-10',
        'location': 'Pune Ward Office',
        'details': 'Small electronics accepted.',
    })
    assert drive.status_code == 201
    assert client.get('/api/market/drives?city=Pune', headers=headers(user)).get_json()[0]['title'] == 'City E-waste Day'


def test_ml_endpoints_fail_clearly_without_configured_services(client, monkeypatch, tmp_path):
    monkeypatch.delenv('GOOGLE_API_KEY', raising=False)
    image = io.BytesIO()
    Image.new('RGB', (32, 32), (20, 100, 30)).save(image, format='JPEG')
    encoded = base64.b64encode(image.getvalue()).decode()
    data_url = f'data:image/jpeg;base64,{encoded}'

    citizen = register(client, 'ml-user', 'citizen')
    auth_headers = headers(citizen)
    estimate = client.post('/api/waste/estimate', headers=auth_headers, json={'image': data_url})
    assert estimate.status_code == 503
    assert 'GOOGLE_API_KEY' in estimate.get_json()['error']

    monkeypatch.setenv('WASTE_CLASSIFIER_WEIGHTS', str(tmp_path / 'missing-weights.pth'))
    classify = client.post('/api/classify', headers=auth_headers, json={'image': data_url})
    assert classify.status_code == 503
    assert 'weights not found' in classify.get_json()['error']


def test_runtime_translation_reports_missing_bhashini_configuration(client, monkeypatch):
    for name in ('BHASHINI_USER_ID', 'BHASHINI_API_KEY', 'BHASHINI_PIPELINE_ID'):
        monkeypatch.delenv(name, raising=False)
    response = client.post('/api/i18n/translate', json={
        'texts': ['Pickup requested for {{quantity}} kg'],
        'target_language': 'hi',
    })
    assert response.status_code == 503
    assert 'BHASHINI_USER_ID' in response.get_json()['error']


def test_extracted_garbage_model_classifies_image(client, monkeypatch):
    monkeypatch.delenv('WASTE_CLASSIFIER_WEIGHTS', raising=False)
    image = io.BytesIO()
    Image.new('RGB', (224, 224), (220, 60, 60)).save(image, format='JPEG')
    data_url = f"data:image/jpeg;base64,{base64.b64encode(image.getvalue()).decode()}"
    user = register(client, 'trained-model-user', 'citizen')

    response = client.post('/api/classify', headers=headers(user), json={'image': data_url})

    assert response.status_code == 200, response.get_json()
    result = response.get_json()
    assert result['raw_class'] in {'battery', 'biological', 'cardboard', 'clothes', 'glass', 'metal', 'paper', 'plastic', 'shoes', 'trash'}
    assert 0 <= result['confidence'] <= 100
    assert result['disposal_tips']