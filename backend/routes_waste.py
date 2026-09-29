from flask import Blueprint, request, jsonify
from models import db, WasteReport, CollectionRequest
from auth_tokens import require_roles
from waste_estimation import EstimatorUnavailable, estimate_waste_image
import random

waste_bp = Blueprint('waste_bp', __name__)

@waste_bp.route('/report', methods=['POST'])
def report_waste():
    data = request.get_json()
    user_id = data.get('user_id')
    image_url = data.get('image_url')
    lat = data.get('latitude')
    lng = data.get('longitude')
    address_text = data.get('address_text', '')
    city = data.get('city', '')
    state = data.get('state', '')
    
    if not user_id or lat is None or lng is None:
        return jsonify({"error": "Missing required fields"}), 400
        
    # Mock AI Module
    mock_volume = round(random.uniform(1.0, 50.0), 2)
    mock_segregation_score = round(random.uniform(0.1, 1.0), 2)
    mock_reward = round((mock_volume * 0.5) * mock_segregation_score, 2)
    
    report = WasteReport(
        user_id=user_id,
        image_url=image_url,
        latitude=lat,
        longitude=lng,
        address_text=address_text,
        city=city,
        state=state,
        volume_estimated=mock_volume,
        segregation_score=mock_segregation_score,
        reward_earned=mock_reward,
        status='reported'
    )
    db.session.add(report)
    db.session.commit()
    
    return jsonify({
        "message": "Waste reported successfully",
        "report_id": report.id,
        "volume_estimated": mock_volume,
        "segregation_score": mock_segregation_score,
        "reward_earned": mock_reward
    }), 201

@waste_bp.route('/issues', methods=['GET'])
def get_issues():
    user_id = request.args.get('user_id')
    status = request.args.get('status', 'reported') # default to 'reported'
    city = request.args.get('city')
    assigned_to = request.args.get('assigned_to')
    
    query = WasteReport.query
    
    if status != 'all':
        query = query.filter_by(status=status)
        
    if user_id:
        query = query.filter_by(user_id=user_id)
        
    if city:
        query = query.filter_by(city=city)
        
    if assigned_to:
        query = query.filter_by(assigned_to=assigned_to)
        
    reports = query.all()
    results = []
    
    # Needs assigned user info
    from models import User
    
    for r in reports:
        assigned_name = None
        assigned_phone = None
        if r.assigned_to:
            helper = User.query.get(r.assigned_to)
            if helper:
                assigned_name = helper.username
                assigned_phone = helper.phone
                
        results.append({
            "id": r.id,
            "user_id": r.user_id,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "address_text": r.address_text,
            "city": r.city,
            "state": r.state,
            "volume_estimated": r.volume_estimated,
            "status": r.status,
            "assigned_to": r.assigned_to,
            "assigned_name": assigned_name,
            "assigned_phone": assigned_phone,
            "completed_image_url": r.completed_image_url,
            "created_at": r.created_at
        })
    return jsonify(results), 200


@waste_bp.route('/estimate', methods=['POST'])
@require_roles('citizen', 'community_helper', 'society', 'municipality')
def estimate_waste():
    data = request.get_json(silent=True) or {}
    try:
        estimates = estimate_waste_image(data.get('image'))
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    except EstimatorUnavailable as error:
        return jsonify({'error': str(error)}), 503
    return jsonify(estimates), 200

@waste_bp.route('/<int:report_id>/verify', methods=['POST'])
def verify_issue(report_id):
    # Endpoint handles status lifecycle for reported waste: seen, assigned, completed, verified
    from models import User
    report = WasteReport.query.get(report_id)
    if not report:
        return jsonify({"error": "Report not found"}), 404
        
    data = request.get_json()
    new_status = data.get('status')
    
    if new_status:
        report.status = new_status
        
    # Assignment Logic
    helper_id = data.get('helper_id')
    if helper_id:
        report.assigned_to = helper_id
        
    # Completion Logic
    completed_image_url = data.get('completed_image_url')
    if completed_image_url:
        report.completed_image_url = completed_image_url
    
    # If the waste is marked as verified by Citizen, award city_score to the reporting user and assigned helper
    if new_status == 'verified':
        reporting_user = User.query.get(report.user_id)
        if reporting_user:
            reporting_user.city_score += 10 # Reward for citizen
            
        if report.assigned_to:
            helper_user = User.query.get(report.assigned_to)
            if helper_user:
                helper_user.city_score += 20 # Reward for completed work
                
        # Give points to the local municipality managing the city
        muni = User.query.filter_by(role='municipality', city=report.city).first()
        if muni:
            muni.city_score += 15

    db.session.commit()
    return jsonify({"message": f"Report updated to {new_status}"}), 200

@waste_bp.route('/requests', methods=['POST'])
def create_collection_request():
    data = request.get_json()
    user_id = data.get('user_id')
    location_details = data.get('location_details')
    city = data.get('city', '')
    state = data.get('state', '')
    lat = data.get('latitude')
    lng = data.get('longitude')
    
    if not user_id or not location_details:
        return jsonify({"error": "Missing required fields"}), 400
        
    req = CollectionRequest(
        user_id=user_id,
        location_details=location_details,
        city=city,
        state=state,
        latitude=lat,
        longitude=lng
    )
    db.session.add(req)
    db.session.commit()
    
    return jsonify({"message": "Collection requested successfully", "request_id": req.id}), 201

@waste_bp.route('/requests', methods=['GET'])
def get_all_requests():
    status_filter = request.args.get('status', 'pending')
    city = request.args.get('city')
    user_id = request.args.get('user_id')
    assigned_to = request.args.get('assigned_to')
    
    query = CollectionRequest.query
    if status_filter != 'all':
        query = query.filter_by(status=status_filter)
    if city:
        query = query.filter_by(city=city)
    if user_id:
        query = query.filter_by(user_id=user_id)
    if assigned_to:
        query = query.filter_by(assigned_to=assigned_to)
        
    reqs = query.all()
    results = []
    
    from models import User
    
    for r in reqs:
        assigned_name = None
        assigned_phone = None
        if r.assigned_to:
            helper = User.query.get(r.assigned_to)
            if helper:
                assigned_name = helper.username
                assigned_phone = helper.phone
            
        results.append({
            "id": r.id,
            "user_id": r.user_id,
            "location_details": r.location_details,
            "city": r.city,
            "state": r.state,
            "status": r.status,
            "assigned_to": r.assigned_to,
            "assigned_to_name": assigned_name,
            "assigned_to_phone": assigned_phone,
            "volume_estimated": r.volume_estimated,
            "completed_image_url": r.completed_image_url,
            "created_at": r.created_at
        })
    return jsonify(results), 200

@waste_bp.route('/requests/society/<int:user_id>', methods=['GET'])
def get_society_requests(user_id):
    reqs = CollectionRequest.query.filter_by(user_id=user_id).order_by(CollectionRequest.created_at.desc()).all()
    results = []
    from models import User
    
    for r in reqs:
        assigned_name = None
        assigned_phone = None
        if r.assigned_to:
            helper = User.query.get(r.assigned_to)
            if helper:
                assigned_name = helper.username
                assigned_phone = helper.phone
            
        results.append({
            "id": r.id,
            "location_details": r.location_details,
            "city": r.city,
            "status": r.status,
            "assigned_to_name": assigned_name,
            "assigned_to_phone": assigned_phone,
            "volume_estimated": r.volume_estimated,
            "completed_image_url": r.completed_image_url,
            "created_at": r.created_at
        })
    return jsonify(results), 200

@waste_bp.route('/requests/<int:req_id>/acknowledge', methods=['POST'])
def acknowledge_request(req_id):
    """Municipality marks a collection request as 'seen'"""
    req = CollectionRequest.query.get(req_id)
    if not req:
        return jsonify({"error": "Request not found"}), 404
    req.status = 'seen'
    db.session.commit()
    return jsonify({"message": "Request acknowledged"}), 200

@waste_bp.route('/requests/<int:req_id>/assign', methods=['POST'])
def assign_request(req_id):
    data = request.get_json()
    helper_id = data.get('helper_id')
    
    if not helper_id:
        return jsonify({"error": "helper_id required"}), 400
        
    req = CollectionRequest.query.get(req_id)
    if not req:
        return jsonify({"error": "Request not found"}), 404
        
    req.assigned_to = helper_id
    req.status = 'assigned'
    db.session.commit()
    
    return jsonify({"message": "Community Helper assigned successfully"}), 200

@waste_bp.route('/requests/<int:req_id>/complete', methods=['POST'])
def complete_request(req_id):
    """Helper uploads completion photo — AI estimates volume from image"""
    req = CollectionRequest.query.get(req_id)
    if not req:
        return jsonify({"error": "Request not found"}), 404
    
    data = request.get_json()
    completed_image_url = data.get('completed_image_url')
    if not completed_image_url:
        return jsonify({"error": "completed_image_url required"}), 400
    
    req.completed_image_url = completed_image_url
    
    volume_estimated = None
    estimation_error = None
    try:
        estimates = estimate_waste_image(completed_image_url)
        volume_estimated = estimates['weight_kg']
    except (ValueError, EstimatorUnavailable) as error:
        estimation_error = str(error)
    
    req.volume_estimated = volume_estimated
    req.status = 'completed'
    db.session.commit()
    
    response = {"message": "Task marked complete", "volume_estimated": volume_estimated}
    if estimation_error:
        response['estimation_error'] = estimation_error
    return jsonify(response), 200

@waste_bp.route('/requests/<int:req_id>/verify', methods=['POST'])
def verify_request(req_id):
    """Society admin/user verifies that the cleanup was done — triggers points distribution"""
    req = CollectionRequest.query.get(req_id)
    if not req:
        return jsonify({"error": "Request not found"}), 404
    
    req.status = 'verified'
    
    from models import User
    volume = req.volume_estimated or 5.0
    
    # Points: based on volume — 1 point per kg, min 5
    points_citizen = max(5, int(volume * 1))
    points_helper = max(10, int(volume * 2))
    points_muni = max(5, int(volume * 0.5))
    
    # Award requesting society user
    society_user = User.query.get(req.user_id)
    if society_user:
        society_user.city_score += points_citizen
    
    # Award helper
    if req.assigned_to:
        helper = User.query.get(req.assigned_to)
        if helper:
            helper.city_score += points_helper
    
    # Award municipality responsible for city
    if req.city:
        muni = User.query.filter_by(role='municipality', city=req.city).first()
        if muni:
            muni.city_score += points_muni
    
    db.session.commit()
    return jsonify({"message": "Request verified!", "points_awarded": {"society": points_citizen, "helper": points_helper, "municipality": points_muni}}), 200

