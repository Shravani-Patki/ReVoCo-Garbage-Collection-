from collections import defaultdict
from time import monotonic

from flask import Blueprint, jsonify, request

from bhashini import BhashiniConfigurationError, SUPPORTED_LANGUAGES, translate_many

i18n_bp = Blueprint('i18n_bp', __name__)
_rate_windows = defaultdict(list)


@i18n_bp.route('/translate', methods=['POST'])
def translate_runtime_text():
    data = request.get_json(silent=True) or {}
    texts = data.get('texts')
    language = data.get('target_language')
    if language not in SUPPORTED_LANGUAGES:
        return jsonify({'error': 'Unsupported target language.'}), 400
    if not isinstance(texts, list) or not 1 <= len(texts) <= 20:
        return jsonify({'error': 'Provide between 1 and 20 text strings.'}), 400
    if any(not isinstance(text, str) or len(text) > 2000 for text in texts):
        return jsonify({'error': 'Each translation string must be text no longer than 2,000 characters.'}), 400
    if sum(map(len, texts)) > 12000:
        return jsonify({'error': 'Translation batch is too large.'}), 413

    now = monotonic()
    address = request.remote_addr or 'unknown'
    recent = [timestamp for timestamp in _rate_windows[address] if now - timestamp < 60]
    if len(recent) >= 30:
        return jsonify({'error': 'Translation request limit reached. Try again shortly.'}), 429
    recent.append(now)
    _rate_windows[address] = recent

    try:
        unique_texts = list(dict.fromkeys(texts))
        translated = translate_many(unique_texts, language)
    except BhashiniConfigurationError as error:
        return jsonify({'error': str(error)}), 503
    mapping = dict(zip(unique_texts, translated))
    return jsonify({'translations': mapping}), 200