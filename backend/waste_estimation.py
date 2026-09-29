import base64
import json
import os
import re


class EstimatorUnavailable(RuntimeError):
    pass


def estimate_waste_image(image_data):
    if not isinstance(image_data, str) or not image_data:
        raise ValueError('A base64 image is required.')

    mime_type = 'image/jpeg'
    encoded_image = image_data
    if image_data.startswith('data:'):
        header, separator, encoded_image = image_data.partition(',')
        if not separator or ';base64' not in header:
            raise ValueError('Image must use a base64 data URL.')
        mime_type = header[5:].split(';', 1)[0]
    if mime_type not in {'image/jpeg', 'image/png', 'image/webp'}:
        raise ValueError('Only JPEG, PNG, and WEBP images are supported.')

    try:
        image_bytes = base64.b64decode(encoded_image, validate=True)
    except (ValueError, base64.binascii.Error) as error:
        raise ValueError('Image data is not valid base64.') from error
    if not image_bytes or len(image_bytes) > 10 * 1024 * 1024:
        raise ValueError('Image must be smaller than 10 MB.')

    api_key = os.environ.get('GOOGLE_API_KEY')
    if not api_key:
        raise EstimatorUnavailable('Set GOOGLE_API_KEY to enable visual weight and volume estimates.')

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(os.environ.get('WASTE_ESTIMATION_MODEL', 'gemini-2.5-flash'))
        prompt = (
            'Visually estimate the waste shown. Return only JSON with numeric fields '
            '"weight_kg" and "volume_liters". These are rough image-based estimates, '
            'not measured values. If either cannot be reasonably estimated, use null.'
        )
        response = model.generate_content([
            prompt,
            {'mime_type': mime_type, 'data': image_bytes},
        ])
        match = re.search(r'\{.*?\}', response.text or '', re.DOTALL)
        if not match:
            raise ValueError('Estimator returned no JSON result.')
        result = json.loads(match.group())
        estimates = {}
        for key in ('weight_kg', 'volume_liters'):
            value = result.get(key)
            if value is not None:
                value = float(value)
                if value < 0:
                    raise ValueError('Estimator returned a negative value.')
                value = round(value, 2)
            estimates[key] = value
        return estimates
    except EstimatorUnavailable:
        raise
    except Exception as error:
        raise EstimatorUnavailable('The visual estimation provider could not produce an estimate.') from error