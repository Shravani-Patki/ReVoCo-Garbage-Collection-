from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, User, WasteReport, Donation, CollectionRequest
import os

from routes_auth import auth_bp
from routes_waste import waste_bp
from routes_gamification import gamification_bp
from routes_society import society_bp
from routes_admin import admin_bp
from routes_classify import classify_bp
from routes_routing import routing_bp
from routes_market import ensure_market_history, market_bp
from routes_i18n import i18n_bp


def create_app(test_config=None):
    app = Flask(__name__)
    CORS(app)

    basedir = os.path.abspath(os.path.dirname(__file__))
    app.config['SECRET_KEY'] = os.environ.get('REVOCO_SECRET_KEY', 'development-only-change-this-secret')
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'revoco.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    if test_config:
        app.config.update(test_config)

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
        return jsonify({"status": "healthy", "message": "ReVoCo API is running!"}), 200

    with app.app_context():
        db.create_all()
        ensure_market_history()

    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
