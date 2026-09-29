from flask import Blueprint, g, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from models import CompanyRegistration, db, User, UserPreference, UserProfile
from auth_tokens import company_verification_error, create_access_token, require_roles

auth_bp = Blueprint('auth_bp', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'citizen')
    phone = data.get('phone')
    state = data.get('state')
    city = data.get('city')
    address = str(data.get('address', '')).strip()
    cpcb_code = str(data.get('cpcb_code', '')).strip()
    allowed_roles = {'citizen', 'community_helper', 'society', 'municipality'}
    
    if not username or not email or not password or not address or role not in allowed_roles:
        return jsonify({"error": "Name, email, password, address, and a valid portal role are required."}), 400

    if role == 'society' and (not cpcb_code.isdigit() or len(cpcb_code) != 10):
        return jsonify({"error": "A valid 10-digit CPCB code is required for company accounts."}), 400

    if role == 'society' and not phone:
        return jsonify({"error": "A contact phone number is required for company registration."}), 400
        
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 400
        
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already taken"}), 400

    if role == 'society' and CompanyRegistration.query.filter_by(cpcb_code=cpcb_code).first():
        return jsonify({"error": "CPCB code is already registered."}), 409
        
    new_user = User(
        username=username,
        email=email,
        password_hash=generate_password_hash(password),
        role=role,
        phone=phone,
        state=state,
        city=city
    )
    db.session.add(new_user)
    db.session.flush()
    db.session.add(UserProfile(user_id=new_user.id, address=address))
    db.session.add(UserPreference(user_id=new_user.id, language='en'))
    if role == 'society':
        db.session.add(CompanyRegistration(
            user_id=new_user.id,
            company_name=username,
            cpcb_code=cpcb_code,
            email=email,
        ))
    db.session.commit()

    company = CompanyRegistration.query.filter_by(user_id=new_user.id).first()

    if role == 'society':
        return jsonify({
            "message": "Company registration submitted. Verification is pending municipality approval.",
            "company_status": company.status if company else 'pending',
        }), 202
    
    return jsonify({
        "message": "User registered successfully", 
        "token": create_access_token(new_user),
        "user": {
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
            "role": new_user.role,
            "phone": new_user.phone,
            "address": address,
            "city": new_user.city,
            "state": new_user.state,
            "cpcb_code": company.cpcb_code if company else None,
            "company_status": company.status if company else None,
            "language": 'en',
        }
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400
        
    user = User.query.filter_by(email=email).first()
    if user and check_password_hash(user.password_hash, password):
        verification_error = company_verification_error(user)
        if verification_error:
            return jsonify({"error": verification_error}), 403
        profile = UserProfile.query.filter_by(user_id=user.id).first()
        company = CompanyRegistration.query.filter_by(user_id=user.id).first()
        preference = UserPreference.query.filter_by(user_id=user.id).first()
        return jsonify({
            "message": "Login successful",
            "token": create_access_token(user),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "city": user.city,
                "state": user.state,
                "phone": user.phone,
                "address": profile.address if profile else '',
                "cpcb_code": company.cpcb_code if company else None,
                "company_status": company.status if company else None,
                "language": preference.language if preference else 'en',
            }
        }), 200
    return jsonify({"error": "Invalid email or password"}), 401


@auth_bp.route('/language', methods=['POST'])
@require_roles('citizen', 'community_helper', 'society', 'municipality', 'admin')
def update_language():
    data = request.get_json(silent=True) or {}
    language = data.get('language')
    if language not in {'en', 'hi', 'mr', 'ta', 'te', 'kn', 'bn', 'gu', 'ur'}:
        return jsonify({'error': 'Unsupported language.'}), 400
    preference = UserPreference.query.filter_by(user_id=g.current_user.id).first()
    if preference is None:
        preference = UserPreference(user_id=g.current_user.id, language=language)
        db.session.add(preference)
    else:
        preference.language = language
    db.session.commit()
    return jsonify({'language': preference.language}), 200


@auth_bp.route('/users', methods=['GET'])
def get_users_by_role():
    role = request.args.get('role')
    if not role:
        return jsonify({"error": "Role parameter required"}), 400
        
    users = User.query.filter_by(role=role).all()
    results = [{"id": u.id, "username": u.username, "email": u.email} for u in users]
    return jsonify(results), 200
