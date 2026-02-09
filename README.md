# TTS Data Collection Service

A web service for collecting TTS (Text-to-Speech) training data.

## Project Structure

```
.
├── backend/          # FastAPI backend
│   ├── main.py       # Main application
│   ├── requirements.txt
│   └── .env.example
├── frontend/         # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── data/             # Data storage
│   ├── wavs/         # Audio files
│   └── metadata.csv  # Metadata
└── task.md           # Requirements
```

## Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Edit with your API keys if using LLM
python main.py
```

The backend will run on `http://localhost:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:3000`

## Features

1. **Text Expansion**: Generate 15 variants of seed text using LLM
2. **Audio Recording**: Record WAV audio (mono, 44.1kHz) for each variant
3. **Export**: Download all recordings as a ZIP file with metadata

## API Endpoints

- `POST /api/expand-text` - Generate text variants
- `POST /api/upload-audio` - Upload recorded audio
- `POST /api/delete-audio` - Delete an audio file
- `GET /api/recordings` - Get all recordings
- `POST /api/export-dataset` - Export dataset as ZIP

## Customization

To use actual LLM API instead of mock data, edit `backend/main.py` and uncomment the OpenAI/Anthropic code in the `/api/expand-text` endpoint.
