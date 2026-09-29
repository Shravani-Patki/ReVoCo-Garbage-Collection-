from flask import Blueprint, request, jsonify
from models import db, User, Society, WasteReport

admin_bp = Blueprint('admin_bp', __name__)

@admin_bp.route('/users', methods=['GET'])
def get_all_users():
    users = User.query.all()
    results = []
    for u in users:
        results.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "city_score": u.city_score,
            "created_at": u.created_at
        })
    return jsonify(results), 200

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    # Prevent deleting the last admin (basic safeguard, but you might want logic to ensure at least one admin exists)
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": f"User {user_id} deleted successfully"}), 200

@admin_bp.route('/societies', methods=['GET'])
def get_all_societies():
    societies = Society.query.all()
    results = []
    for s in societies:
        results.append({
            "id": s.id,
            "name": s.name,
            "society_code": s.society_code,
            "admin_id": s.admin_id,
            "created_at": s.created_at
        })
    return jsonify(results), 200

@admin_bp.route('/societies/<int:society_id>', methods=['DELETE'])
def delete_society(society_id):
    society = Society.query.get(society_id)
    if not society:
        return jsonify({"error": "Society not found"}), 404
        
    db.session.delete(society)
    db.session.commit()
    return jsonify({"message": f"Society {society_id} deleted successfully"}), 200

@admin_bp.route('/waste/<int:report_id>', methods=['DELETE'])
def delete_waste_report(report_id):
    report = WasteReport.query.get(report_id)
    if not report:
        return jsonify({"error": "Waste report not found"}), 404
        
    db.session.delete(report)
    db.session.commit()
    return jsonify({"message": f"Waste report {report_id} deleted successfully"}), 200
