import os
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from sqlalchemy import event

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BACKEND_DIR, '.env'))
load_dotenv(os.path.join(BACKEND_DIR, '..', '.env'), override=False)

from models import db

from routes_auth import auth_bp
from routes_waste import waste_bp
from routes_gamification import gamification_bp
from routes_society import society_bp
from routes_admin import admin_bp
from routes_classify import classify_bp, initialize_classifier
from routes_routing import routing_bp
from routes_market import ensure_market_history, market_bp
from routes_i18n import i18n_bp


def create_app(test_config=None):
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.environ['SECRET_KEY']
    if not app.config['SECRET_KEY']:
        raise RuntimeError('SECRET_KEY must not be empty.')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///app.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024
    if test_config:
        app.config.update(test_config)

    frontend_origin = os.getenv('FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    CORS(app, origins=[frontend_origin])
    db.init_app(app)
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(waste_bp, url_prefix='/api/waste')
    app.register_blueprint(gamification_bp, url_prefix='/api/gamification')
    app.register_blueprint(society_bp, url_prefix='/api/society')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(classify_bp, url_prefix='/api')
    app.register_blueprint(routing_bp, url_prefix='/api/routing')
    app.register_blueprint(market_bp, url_prefix='/api/market')
    app.register_blueprint(i18n_bp, url_prefix='/api/i18n')

    @app.route('/api/health')
    def health_check():
        return jsonify({'ok': True}), 200

    with app.app_context():
        if app.config['SQLALCHEMY_DATABASE_URI'].startswith('sqlite:'):
            def enable_sqlite_wal(connection, _record):
                cursor = connection.cursor()
                cursor.execute('PRAGMA journal_mode=WAL')
                cursor.close()

            event.listen(db.engine, 'connect', enable_sqlite_wal)
        db.create_all()
        ensure_market_history()
        initialize_classifier()

    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=os.getenv('FLASK_DEBUG') == '1', port=int(os.getenv('PORT') or '5000'))
