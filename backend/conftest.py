import os


os.environ.setdefault('SECRET_KEY', 'pytest-only-secret-key')
os.environ.pop('WASTE_CLASSIFIER_WEIGHTS', None)

collect_ignore = ['test_classify.py']