"""Generate frontend locale JSON files with Bhashini translation inference.

Run from the workspace root after configuring BHASHINI_* in .env:
    python scripts/translate_locales.py
"""

import argparse
import json
import sys
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(WORKSPACE_ROOT))

from backend.bhashini import SUPPORTED_LANGUAGES, translate_many

LOCALE_DIRECTORY = WORKSPACE_ROOT / 'frontend' / 'src' / 'locales'
BATCH_SIZE = 12


def translate_catalog(language, catalog):
    keys = list(catalog)
    translated_catalog = {}
    for start in range(0, len(keys), BATCH_SIZE):
        batch_keys = keys[start:start + BATCH_SIZE]
        batch_values = [catalog[key] for key in batch_keys]
        outputs = translate_many(batch_values, language)
        if len(outputs) != len(batch_keys):
            raise RuntimeError(f'Bhashini returned an incomplete batch for {language}.')
        translated_catalog.update(zip(batch_keys, outputs))
        print(f'{language}: translated {min(start + len(batch_keys), len(keys))}/{len(keys)} strings', flush=True)
    return translated_catalog


def main():
    parser = argparse.ArgumentParser(description='Generate Hindi and regional-language frontend catalogs.')
    parser.add_argument('--languages', nargs='+', choices=sorted(SUPPORTED_LANGUAGES), default=sorted(SUPPORTED_LANGUAGES))
    args = parser.parse_args()

    source_path = LOCALE_DIRECTORY / 'en.json'
    source_catalog = json.loads(source_path.read_text(encoding='utf-8'))
    for language in args.languages:
        result = translate_catalog(language, source_catalog)
        output_path = LOCALE_DIRECTORY / f'{language}.json'
        temporary_path = output_path.with_suffix('.json.tmp')
        temporary_path.write_text(
            json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + '\n',
            encoding='utf-8',
        )
        temporary_path.replace(output_path)
        print(f'Wrote {output_path.relative_to(WORKSPACE_ROOT)}')


if __name__ == '__main__':
    main()
