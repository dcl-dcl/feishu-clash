FROM python:3.13-slim

WORKDIR /app

RUN pip install fastapi uvicorn google-cloud-storage google-genai requests retrying pydantic python-multipart

ENV ENV=production

COPY main.py .
COPY *.json .

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]

