FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV PORT=10000

WORKDIR /app/backend

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt gunicorn flask-cors

COPY backend/ ./
COPY garbage_model/ /app/garbage_model/

CMD gunicorn -w 1 --threads 4 --timeout 120 -b 0.0.0.0:$PORT app:app