from flask import Blueprint, request, jsonify
import base64
import io
import os
import zipfile
import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image
from auth_tokens import require_roles

classify_bp = Blueprint('classify_bp', __name__)

# ── Category mappings ──────────────────────────────────────────────────────────

CLASS_NAMES = [
    "battery", "biological", "cardboard", "clothes",
    "glass", "metal", "paper", "plastic", "shoes", "trash"
]

CATEGORY_MAP = {
    "battery":    {"name": "E-Waste",        "emoji": "⚡", "color": "#EF4444", "bin": "Red"},
    "biological": {"name": "Wet Waste",      "emoji": "🌿", "color": "#10B981", "bin": "Green"},
    "cardboard":  {"name": "Dry Waste",      "emoji": "📦", "color": "#3B82F6", "bin": "Blue"},
    "clothes":    {"name": "Dry Waste",      "emoji": "📦", "color": "#3B82F6", "bin": "Blue"},
    "glass":      {"name": "Dry Waste",      "emoji": "📦", "color": "#3B82F6", "bin": "Blue"},
    "metal":      {"name": "Dry Waste",      "emoji": "📦", "color": "#3B82F6", "bin": "Blue"},
    "paper":      {"name": "Dry Waste",      "emoji": "📦", "color": "#3B82F6", "bin": "Blue"},
    "plastic":    {"name": "Dry Waste",      "emoji": "📦", "color": "#3B82F6", "bin": "Blue"},
    "shoes":      {"name": "Dry Waste",      "emoji": "📦", "color": "#3B82F6", "bin": "Blue"},
    "trash":      {"name": "Mixed / Residual","emoji": "🗑️", "color": "#6B7280", "bin": "Black"},
}

DISPOSAL_TIPS = {
    "battery": [
        "Never dispose of batteries in regular trash — they contain toxic heavy metals.",
        "Drop off at certified e-waste collection centres or electronics retailers.",
        "Look for 'Battery Bank' kiosks in malls and municipal offices."
    ],
    "biological": [
        "Place in the Green (Wet Waste) bin for composting.",
        "Use a home compost bin or biogas unit if available.",
        "Avoid mixing with dry waste — keeps composting efficient."
    ],
    "cardboard": [
        "Flatten boxes before placing in the Blue (Dry Waste) bin.",
        "Keep dry — wet cardboard cannot be recycled.",
        "Avoid mixing with food-contaminated paper."
    ],
    "clothes": [
        "Donate wearable clothes to charity or NGOs.",
        "For worn-out fabric, drop at textile recycling bins.",
        "Never burn — synthetic fibres release toxic fumes."
    ],
    "glass": [
        "Rinse glass containers before recycling.",
        "Place in the Blue (Dry Waste) bin.",
        "Broken glass: wrap in newspaper and label 'Sharp' before disposal."
    ],
    "metal": [
        "Rinse metal cans and containers before placing in the Blue bin.",
        "Scrap metal can be sold to authorised kabadis (scrap dealers).",
        "Do not compact aerosol cans — they may be pressurised."
    ],
    "paper": [
        "Shred or flatten paper and place in the Blue (Dry Waste) bin.",
        "Keep away from moisture — wet paper cannot be recycled.",
        "Avoid disposing of thermal/coated paper (receipts) with regular paper."
    ],
    "plastic": [
        "Check the resin code (1–7) at the bottom of the item.",
        "Rinse and place in the Blue (Dry Waste) bin.",
        "Single-use plastics: minimise use; dispose responsibly, never litter."
    ],
    "shoes": [
        "Donate usable shoes to donation centres or NGOs.",
        "For worn-out footwear, take to textile/rubber recycling drop-off points.",
        "Avoid landfilling — shoes take decades to decompose."
    ],
    "trash": [
        "Place in the Black (Mixed / Residual) waste bin.",
        "Reduce contamination by separating dry and wet waste before disposal.",
        "Contact your municipality for special waste collection schedules."
    ],
}

# ── Model loading ──────────────────────────────────────────────────────────────

_model = None
_model_error = None
_model_initialized = False
_device = torch.device('cpu')


class ClassifierModelUnavailable(RuntimeError):
    pass


def _load_model():
    global _model
    if _model is not None:
        return _model

    classifier_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.environ.get('WASTE_CLASSIFIER_WEIGHTS') or os.path.join(classifier_dir, '..', 'garbage_model')
    if not os.path.isabs(model_path):
        model_path = os.path.join(classifier_dir, model_path)
    model_path = os.path.abspath(model_path)
    if not os.path.exists(model_path):
        raise ClassifierModelUnavailable(
            f"Classifier weights not found at {model_path}. Set WASTE_CLASSIFIER_WEIGHTS to the trained checkpoint or extracted archive directory."
        )

    # Architecture: EfficientNet-B0 with 10-class head
    # Confirmed from state dict: classifier.1.weight shape [10, 1280]
    net = models.efficientnet_b0(weights=None)
    num_features = net.classifier[1].in_features
    net.classifier[1] = nn.Linear(num_features, len(CLASS_NAMES))

    try:
        if os.path.isdir(model_path):
            archive = io.BytesIO()
            archive_root = os.path.basename(os.path.normpath(model_path))
            with zipfile.ZipFile(archive, mode='w', compression=zipfile.ZIP_STORED) as checkpoint:
                for directory, _, filenames in os.walk(model_path):
                    for filename in filenames:
                        full_path = os.path.join(directory, filename)
                        relative_path = os.path.relpath(full_path, model_path)
                        checkpoint.write(full_path, os.path.join(archive_root, relative_path).replace(os.sep, '/'))
            archive.seek(0)
            state = torch.load(archive, map_location='cpu', weights_only=False)
        else:
            state = torch.load(model_path, map_location='cpu', weights_only=False)
        if isinstance(state, dict) and 'classifier.1.weight' in state:
            net.load_state_dict(state, strict=True)
        elif isinstance(state, dict) and 'model_state_dict' in state:
            net.load_state_dict(state['model_state_dict'], strict=True)
        else:
            raise ValueError('Checkpoint does not contain an EfficientNet-B0 state dict.')
    except Exception as e:
        raise ClassifierModelUnavailable(f"Could not load classifier weights: {e}") from e

    net.eval()
    net.to(_device)
    _model = net
    return _model


def initialize_classifier():
    global _model_error, _model_initialized
    if _model_initialized:
        return
    _model_initialized = True
    try:
        _load_model()
    except Exception as error:
        _model_error = error if isinstance(error, ClassifierModelUnavailable) else ClassifierModelUnavailable(str(error))


# Standard ImageNet normalisation used for ResNet training
_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])


# ── Endpoint ───────────────────────────────────────────────────────────────────

@classify_bp.route('/classify', methods=['POST'])
@require_roles('citizen', 'community_helper', 'society', 'municipality')
def classify_waste():
    data = request.get_json(force=True)
    image_data = data.get('image', '')

    if not image_data:
        return jsonify({"error": "No image provided"}), 400

    # Strip data-URL prefix if present
    if ',' in image_data:
        image_data = image_data.split(',', 1)[1]

    try:
        img_bytes = base64.b64decode(image_data)
        img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    except Exception as e:
        return jsonify({"error": f"Invalid image: {e}"}), 400

    try:
        if _model is None:
            raise _model_error or ClassifierModelUnavailable('The waste classifier is not initialized.')
        tensor = _transform(img).unsqueeze(0).to(_device)

        with torch.no_grad():
            logits = _model(tensor)
            probs = torch.softmax(logits, dim=1)[0]

        confidence, idx = probs.max(0)
        raw_class = CLASS_NAMES[idx.item()]
        confidence_pct = round(confidence.item() * 100, 1)

        category_info = CATEGORY_MAP[raw_class]
        tips = DISPOSAL_TIPS[raw_class]

        # Top-3 alternatives for transparency
        top3_vals, top3_idx = probs.topk(3)
        alternatives = [
            {"label": CLASS_NAMES[i.item()], "confidence": round(v.item() * 100, 1)}
            for v, i in zip(top3_vals, top3_idx)
        ]

        return jsonify({
            "raw_class": raw_class,
            "category": category_info["name"],
            "category_emoji": category_info["emoji"],
            "category_color": category_info["color"],
            "bin_color": category_info["bin"],
            "confidence": confidence_pct,
            "disposal_tips": tips,
            "top3": alternatives,
        }), 200

    except ClassifierModelUnavailable as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        print(f"[Classify] Inference error: {e}")
        return jsonify({"error": f"Classification failed: {str(e)}"}), 500
