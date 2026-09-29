from flask import Blueprint, request, jsonify
from models import db, Donation, WasteReport, User
from sqlalchemy import func

gamification_bp = Blueprint('gamification_bp', __name__)

@gamification_bp.route('/donate', methods=['POST'])
def donate():
    data = request.get_json()
    amount = data.get('amount')
    user_id = data.get('user_id') # Can be None for anonymous
    
    if not amount or amount <= 0:
        return jsonify({"error": "Invalid donation amount"}), 400
        
    donation = Donation(amount=amount, user_id=user_id)
    db.session.add(donation)
    db.session.commit()
    
    total = db.session.query(func.sum(Donation.amount)).scalar() or 0.0
    return jsonify({"message": "Donation successful", "total_pool": total}), 201

@gamification_bp.route('/leaderboard/contributors', methods=['GET'])
def get_contributors_leaderboard():
    top_users = db.session.query(
        User.username,
        func.sum(WasteReport.reward_earned).label('total_rewards'),
        func.sum(WasteReport.volume_estimated).label('total_volume')
    ).join(WasteReport, User.id == WasteReport.user_id).group_by(User.id).order_by(func.sum(WasteReport.reward_earned).desc()).limit(10).all()
    
    leaderboard = [{"username": u.username, "total_rewards": round(u.total_rewards, 2), "total_volume": round(u.total_volume, 2)} for u in top_users]
    return jsonify(leaderboard), 200

@gamification_bp.route('/leaderboard/donors', methods=['GET'])
def get_donors_leaderboard():
    top_donors = db.session.query(
        User.username,
        func.sum(Donation.amount).label('total_donated')
    ).join(Donation, Donation.user_id == User.id).group_by(User.id).order_by(func.sum(Donation.amount).desc()).limit(10).all()
    
    leaderboard = [{"username": u.username, "total_donated": round(u.total_donated, 2)} for u in top_donors]
    return jsonify(leaderboard), 200

@gamification_bp.route('/stats', methods=['GET'])
def get_system_stats():
    total_donations = db.session.query(func.sum(Donation.amount)).scalar() or 0.0
    total_rewards_given = db.session.query(func.sum(WasteReport.reward_earned)).scalar() or 0.0
    total_volume_reduced = db.session.query(func.sum(WasteReport.volume_estimated)).scalar() or 0.0
    total_reports = db.session.query(func.count(WasteReport.id)).scalar() or 0
    total_citizens = db.session.query(func.count(User.id)).scalar() or 0
    
    pool_balance = total_donations - total_rewards_given
    
    return jsonify({
        "total_donations": round(total_donations, 2),
        "total_rewards_given": round(total_rewards_given, 2),
        "pool_balance": round(pool_balance, 2),
        "total_volume_reduced": round(total_volume_reduced, 2),
        "total_reports": total_reports,
        "total_citizens": total_citizens
    }), 200
