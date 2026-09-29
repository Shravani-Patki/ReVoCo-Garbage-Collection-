from flask import Blueprint, jsonify
from models import db, WasteReport, CollectionRequest, User
import math

routing_bp = Blueprint('routing_bp', __name__)

def haversine(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance in kilometers between two points 
    on the earth (specified in decimal degrees)
    """
    if None in (lat1, lon1, lat2, lon2):
        return float('inf')
        
    # convert decimal degrees to radians 
    lon1, lat1, lon2, lat2 = map(math.radians, [lon1, lat1, lon2, lat2])

    # haversine formula 
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371 # Radius of earth in kilometers
    return c * r

@routing_bp.route('/helper/<int:helper_id>', methods=['GET'])
def get_optimized_route(helper_id):
    """
    Computes an optimal sequence of tasks for a helper starting from their assigned municipality.
    Uses a greedy Dijkstra-inspired nearest-neighbor approach.
    """
    helper = User.query.get(helper_id)
    if not helper:
        return jsonify({"error": "Helper not found"}), 404

    # Fetch active assignments for this helper
    # 1. Citizen 'WasteReport' assigned to this helper
    reports = WasteReport.query.filter(
        WasteReport.assigned_to == helper_id,
        WasteReport.status.in_(['assigned', 'seen'])
    ).all()
    
    # 2. Society 'CollectionRequest' assigned to this helper
    requests = CollectionRequest.query.filter(
        CollectionRequest.assigned_to == helper_id,
        CollectionRequest.status.in_(['assigned', 'seen'])
    ).all()

    # Compile all pending nodes (tasks)
    nodes = []
    for r in reports:
        if r.latitude and r.longitude:
            nodes.append({
                "id": f"Report_{r.id}",
                "type": "citizen_report",
                "lat": r.latitude,
                "lng": r.longitude,
                "title": f"Report #{r.id}",
                "address": r.address_text or "Citizen Waste Location"
            })
            
    for req in requests:
        if req.latitude and req.longitude:
            nodes.append({
                "id": f"Request_{req.id}",
                "type": "society_request",
                "lat": req.latitude,
                "lng": req.longitude,
                "title": f"Society #{req.id}",
                "address": req.location_details
            })

    if not nodes:
        return jsonify({"sequence": [], "total_distance_km": 0}), 200

    # Start node is the helper's Municipality office based on their city
    # If no municipality found, start from the helper's default location
    start_node = None
    muni = User.query.filter_by(role='municipality', city=helper.city).first()
    
    if muni and muni.latitude and muni.longitude:
        start_node = {
            "id": f"Muni_{muni.id}",
            "type": "municipality",
            "lat": muni.latitude,
            "lng": muni.longitude,
            "title": f"{muni.city} Hub",
            "address": "Municipality Dispatch Center"
        }
    elif helper.latitude and helper.longitude:
        start_node = {
            "id": f"Helper_{helper.id}",
            "type": "helper_home",
            "lat": helper.latitude,
            "lng": helper.longitude,
            "title": "Helper Location",
            "address": "Dispatch Start"
        }
    else:
        # Fallback: Just pick the first task as start and route from there
        start_node = nodes.pop(0)

    # Greedy Nearest-Neighbor Algorithm (Dijkstra-inspired logic for TSP)
    sequence = [start_node]
    unvisited = list(nodes)
    current = start_node
    total_distance = 0.0
    
    while unvisited:
        # Find the node closest to the current location in the loop
        next_idx = 0
        min_dist = float('inf')
        
        for i, candidate in enumerate(unvisited):
            dist = haversine(current['lat'], current['lng'], candidate['lat'], candidate['lng'])
            if dist < min_dist:
                min_dist = dist
                next_idx = i
                
        # Move to nearest node
        next_node = unvisited.pop(next_idx)
        next_node['distance_from_previous_km'] = round(min_dist, 2)
        sequence.append(next_node)
        total_distance += min_dist
        current = next_node
        
    # Return the full scheduled flight path
    return jsonify({
        "sequence": sequence,
        "total_distance_km": round(total_distance, 2)
    }), 200
