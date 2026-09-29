from flask import Blueprint, request, jsonify
from models import db, Society, SocietyMember, Announcement, User, WasteReport
import random

society_bp = Blueprint('society_bp', __name__)

@society_bp.route('/create', methods=['POST'])
def create_society():
    data = request.get_json()
    name = data.get('name')
    society_code = data.get('society_code')
    admin_id = data.get('admin_id')
    
    if not name or not society_code or not admin_id:
        return jsonify({"error": "Missing required fields"}), 400
        
    if Society.query.filter_by(society_code=society_code).first():
        return jsonify({"error": "Society code already exists"}), 400
        
    society = Society(
        name=name,
        society_code=society_code,
        admin_id=admin_id
    )
    db.session.add(society)
    db.session.commit()
    
    return jsonify({"message": "Society created successfully", "society_id": society.id}), 201

@society_bp.route('/join', methods=['POST'])
def join_society():
    data = request.get_json()
    user_id = data.get('user_id')
    society_code = data.get('society_code')
    
    if not user_id or not society_code:
        return jsonify({"error": "Missing required fields"}), 400
        
    society = Society.query.filter_by(society_code=society_code).first()
    if not society:
        return jsonify({"error": "Invalid society code"}), 404
        
    existing_membership = SocietyMember.query.filter_by(user_id=user_id, society_id=society.id).first()
    if existing_membership:
        return jsonify({"error": f"You have already requested to join. Status: {existing_membership.status}"}), 400
        
    membership = SocietyMember(
        user_id=user_id,
        society_id=society.id,
        status='pending'
    )
    db.session.add(membership)
    db.session.commit()
    
    return jsonify({"message": "Join request submitted successfully. Pending approval."}), 201

@society_bp.route('/<int:society_id>/members', methods=['GET'])
def get_society_members(society_id):
    memberships = SocietyMember.query.filter_by(society_id=society_id).all()
    results = []
    for m in memberships:
        user = User.query.get(m.user_id)
        if user:
            results.append({
                "membership_id": m.id,
                "user_id": user.id,
                "username": user.username,
                "status": m.status,
                "joined_at": m.joined_at
            })
    return jsonify(results), 200

@society_bp.route('/membership/<int:membership_id>/status', methods=['PUT'])
def update_membership_status(membership_id):
    data = request.get_json()
    status = data.get('status')
    
    if status not in ['accepted', 'rejected']:
        return jsonify({"error": "Invalid status"}), 400
        
    membership = SocietyMember.query.get(membership_id)
    if not membership:
        return jsonify({"error": "Membership request not found"}), 404
        
    membership.status = status
    db.session.commit()
    return jsonify({"message": f"Membership status updated to {status}"}), 200

@society_bp.route('/<int:society_id>/announcements', methods=['POST'])
def post_announcement(society_id):
    data = request.get_json()
    message = data.get('message')
    author_id = data.get('author_id')
    
    if not message or not author_id:
        return jsonify({"error": "Missing required fields"}), 400
        
    announcement = Announcement(
        society_id=society_id,
        message=message,
        author_id=author_id
    )
    db.session.add(announcement)
    db.session.commit()
    
    return jsonify({"message": "Announcement posted successfully", "announcement_id": announcement.id}), 201

@society_bp.route('/<int:society_id>/announcements', methods=['GET'])
def get_announcements(society_id):
    announcements = Announcement.query.filter_by(society_id=society_id).order_by(Announcement.created_at.desc()).all()
    results = []
    for a in announcements:
        author = User.query.get(a.author_id)
        results.append({
            "id": a.id,
            "message": a.message,
            "author": author.username if author else "Unknown",
            "created_at": a.created_at
        })
    return jsonify(results), 200

@society_bp.route('/admin/<int:user_id>', methods=['GET'])
def get_administered_societies(user_id):
    societies = Society.query.filter_by(admin_id=user_id).all()
    results = []
    for s in societies:
        results.append({
            "id": s.id,
            "name": s.name,
            "society_code": s.society_code
        })
    return jsonify(results), 200

@society_bp.route('/member/<int:user_id>', methods=['GET'])
def get_joined_societies(user_id):
    memberships = SocietyMember.query.filter_by(user_id=user_id).all()
    results = []
    for m in memberships:
        society = Society.query.get(m.society_id)
        if society:
            results.append({
                "society_id": society.id,
                "name": society.name,
                "society_code": society.society_code,
                "status": m.status
            })
    return jsonify(results), 200

@society_bp.route('/<int:society_id>/leaderboard', methods=['GET'])
def get_society_leaderboard(society_id):
    # Fetch all accepted members
    memberships = SocietyMember.query.filter_by(society_id=society_id, status='accepted').all()
    user_ids = [m.user_id for m in memberships]
    
    leaderboard = []
    for uid in user_ids:
        user = User.query.get(uid)
        
        # Calculate waste volume reported & verified for this user
        reports = WasteReport.query.filter_by(user_id=uid).filter(WasteReport.status.in_(['verified', 'collected'])).all()
        total_volume = sum([r.volume_estimated for r in reports if r.volume_estimated])
        
        if user:
            leaderboard.append({
                "user_id": user.id,
                "username": user.username,
                "city_score": user.city_score,
                "total_recycled_volume": total_volume
            })
            
    # sort by volume descending
    leaderboard.sort(key=lambda x: x['total_recycled_volume'], reverse=True)
    return jsonify(leaderboard), 200
