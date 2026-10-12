FROM python:3.12-slim
WORKDIR /srv
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt
COPY shared shared
COPY api api
WORKDIR /srv/api
RUN useradd -m app && chown -R app /srv
USER app
EXPOSE 8000
CMD ["sh", "-c", "python -m app.jobs migrate && python -m app.jobs seed-reference && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]
