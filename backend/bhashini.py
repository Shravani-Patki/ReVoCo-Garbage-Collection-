import os
import re
from functools import lru_cache
from pathlib import Path

import requests
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parent
WORKSPACE_ROOT = BACKEND_ROOT.parent
load_dotenv(WORKSPACE_ROOT / '.env')
load_dotenv(BACKEND_ROOT / '.env', override=False)

CONFIG_URL = os.environ.get(
    'BHASHINI_CONFIG_URL',
    'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline',
)
SUPPORTED_LANGUAGES = {'hi', 'mr', 'ta', 'te', 'kn', 'bn', 'gu', 'ur'}


class BhashiniConfigurationError(RuntimeError):
    pass


def _credentials():
    user_id = os.environ.get('BHASHINI_USER_ID')
    api_key = os.environ.get('BHASHINI_API_KEY')
    pipeline_id = os.environ.get('BHASHINI_PIPELINE_ID')
    if not user_id or not api_key or not pipeline_id:
        raise BhashiniConfigurationError(
            'Configure BHASHINI_USER_ID, BHASHINI_API_KEY, and BHASHINI_PIPELINE_ID in the backend .env file.'
        )
    return user_id, api_key, pipeline_id


@lru_cache(maxsize=8)
def _pipeline_config(target_language):
    user_id, api_key, pipeline_id = _credentials()
    payload = {
        'pipelineTasks': [{
            'taskType': 'translation',
            'config': {'language': {'sourceLanguage': 'en', 'targetLanguage': target_language}},
        }],
        'pipelineRequestConfig': {'pipelineId': pipeline_id},
    }
    try:
        response = requests.post(
            CONFIG_URL,
            headers={'userID': user_id, 'ulcaApiKey': api_key, 'Content-Type': 'application/json'},
            json=payload,
            timeout=(5, 30),
        )
        response.raise_for_status()
        data = response.json()
        task = next(item for item in data['pipelineResponseConfig'] if item['taskType'] == 'translation')
        service = next(
            item for item in task['config']
            if item.get('language', {}).get('sourceLanguage') == 'en'
            and item.get('language', {}).get('targetLanguage') == target_language
        )
        endpoint = data['pipelineInferenceAPIEndPoint']
        return service['serviceId'], endpoint['callbackUrl'], endpoint['inferenceApiKey']
    except BhashiniConfigurationError:
        raise
    except Exception as error:
        raise BhashiniConfigurationError(f'Could not configure Bhashini translation for {target_language}.') from error


def translate_many(texts, target_language):
    if target_language not in SUPPORTED_LANGUAGES:
        raise ValueError('Unsupported target language.')
    if not texts:
        return []
    service_id, callback_url, inference_key = _pipeline_config(target_language)
    user_id, api_key, _ = _credentials()
    masked_texts = []
    replacements = []
    for text in texts:
        tokens = []
        masked = re.sub(
            r'\{\{[A-Za-z_][A-Za-z0-9_]*\}\}',
            lambda match: _store_placeholder(match.group(0), tokens),
            text,
        )
        masked_texts.append(masked)
        replacements.append(tokens)

    payload = {
        'pipelineTasks': [{
            'taskType': 'translation',
            'config': {
                'language': {'sourceLanguage': 'en', 'targetLanguage': target_language},
                'serviceId': service_id,
            },
        }],
        'inputData': {
            'input': [{'source': text} for text in masked_texts],
            'audio': [{'audioContent': None} for _ in masked_texts],
        },
    }
    headers = {
        inference_key['name']: inference_key['value'],
        'userID': user_id,
        'ulcaApiKey': api_key,
        'Content-Type': 'application/json',
    }
    try:
        response = requests.post(callback_url, headers=headers, json=payload, timeout=(5, 60))
        response.raise_for_status()
        data = response.json()
        pipeline = data.get('pipelineResponse') or []
        translation = next(item for item in pipeline if item.get('taskType') == 'translation')
        outputs = translation.get('output') or []
        if len(outputs) != len(texts):
            raise ValueError('Bhashini returned an incomplete translation batch.')
        restored = []
        for item, source, tokens in zip(outputs, texts, replacements):
            translated = item.get('target') or source
            for index, placeholder in enumerate(tokens):
                translated = translated.replace(f'ZXQREVOCOPLACEHOLDER{index}QXZ', placeholder)
            restored.append(translated)
        return restored
    except Exception as error:
        raise BhashiniConfigurationError('Bhashini translation inference failed.') from error


def _store_placeholder(placeholder, replacements):
    index = len(replacements)
    replacements.append(placeholder)
    return f'ZXQREVOCOPLACEHOLDER{index}QXZ'