import os
from functools import wraps

from flask import current_app, g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from models import CompanyRegistration, User, db


def _serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt='revoco-access-token')


def create_access_token(user):
    return _serializer().dumps({'user_id': user.id, 'role': user.role})


def company_verification_error(user):
    if user.role != 'society':
        return None
    registration = CompanyRegistration.query.filter_by(user_id=user.id).first()
    if registration and registration.status == 'verified':
        return None
    return 'Company verification pending. You can sign in after the municipality verifies your registration.'


def require_roles(*roles):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            authorization = request.headers.get('Authorization', '')
            scheme, _, token = authorization.partition(' ')
            if scheme.lower() != 'bearer' or not token:
                return jsonify({'error': 'Authentication required.'}), 401
            try:
                claims = _serializer().loads(
                    token,
                    max_age=int(os.environ.get('REVOCO_TOKEN_TTL_SECONDS', 43200)),
                )
            except SignatureExpired:
                return jsonify({'error': 'Session expired. Please sign in again.'}), 401
            except BadSignature:
                return jsonify({'error': 'Invalid access token.'}), 401

            user = db.session.get(User, claims.get('user_id'))
            if not user or user.role != claims.get('role'):
                return jsonify({'error': 'Invalid account session.'}), 401
            verification_error = company_verification_error(user)
            if verification_error:
                return jsonify({'error': verification_error}), 403
            if roles and user.role not in roles:
                return jsonify({'error': 'This portal is not permitted to perform that action.'}), 403
            g.current_user = user
            return view(*args, **kwargs)

        return wrapped
    return decorator