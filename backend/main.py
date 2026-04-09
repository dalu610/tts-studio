from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
import csv
import zipfile
from pathlib import Path
from datetime import datetime
from typing import List, Optional
import aiofiles
from pydantic import BaseModel
from dotenv import load_dotenv
import logging
import numpy as np
import io

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Configuration
DATA_DIR = Path("data")
WAVS_DIR = DATA_DIR / "wavs"
METADATA_FILE = DATA_DIR / "metadata.csv"
ZIP_FILE = DATA_DIR / "dataset.zip"

# Ensure directories exist
WAVS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="TTS Data Collection Service")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExportRequest(BaseModel):
    files: Optional[List[str]] = None


class QualityCheckRequest(BaseModel):
    audio_data: str  # base64 encoded audio data
    text: str


class QualityCheckResult(BaseModel):
    passed: bool
    issues: List[str]


def check_audio_quality(audio_data: bytes, text: str) -> QualityCheckResult:
    """
    Check audio quality based on:
    1. Duration check - estimate reasonable duration based on text length
    2. Volume check - detect silence or too quiet audio
    """
    issues = []

    try:
        # Load audio using numpy (assuming WAV format)
        audio_io = io.BytesIO(audio_data)

        # Simple WAV header parsing (44 bytes header + data)
        # Assuming standard WAV: 16-bit, mono, 44.1kHz
        # Skip 44 byte header
        audio_bytes = np.frombuffer(audio_data, dtype=np.int16, offset=44)

        if len(audio_bytes) == 0:
            issues.append("音频文件为空")
            return QualityCheckResult(passed=False, issues=issues)

        # 1. Duration check
        # 44.1kHz, 16-bit = 88200 bytes per second
        sample_rate = 44100
        duration = len(audio_bytes) / (sample_rate * 2)  # 2 bytes per sample (16-bit)

        # Duration check: just require audio > 1 second
        if duration < 1.0:
            issues.append(f"录音时长过短（实际: {duration:.2f}s），至少需要 1 秒")

        # 2. Volume / Silence check
        # Calculate RMS (Root Mean Square) to check volume
        rms = np.sqrt(np.mean(audio_bytes.astype(np.float32) ** 2))
        max_amplitude = np.abs(audio_bytes).max()

        # Normalize to 0-1 range for RMS calculation
        if max_amplitude > 0:
            normalized_rms = rms / max_amplitude
        else:
            normalized_rms = 0

        # Check if volume is too low (likely silence)
        # Increased threshold from 0.01 to 0.05 to avoid false positives from ambient noise
        if normalized_rms < 0.05:  # Higher threshold for TTS training quality
            issues.append(f"音量过低（RMS: {normalized_rms:.4f}），请确保麦克风正常工作并大声朗读")

        logger.info(f"Quality check: duration={duration:.2f}s, text_len={len(text)}, rms={normalized_rms:.6f}, max_amp={max_amplitude}, issues={issues}")
        if issues:
            logger.warning(f"Quality check FAILED with issues: {issues}")
        else:
            logger.info("Quality check PASSED")

        return QualityCheckResult(passed=len(issues) == 0, issues=issues)

    except Exception as e:
        logger.error(f"Quality check error: {str(e)}")
        issues.append(f"质量检查失败: {str(e)}")
        return QualityCheckResult(passed=False, issues=issues)


@app.post("/api/check-quality")
async def check_quality(request: QualityCheckRequest):
    """
    Check audio quality for recorded audio.
    """
    try:
        logger.info(f"Received quality check request: text_length={len(request.text)}, audio_data_length={len(request.audio_data)}")
        # Decode base64 audio data
        import base64
        audio_bytes = base64.b64decode(request.audio_data)

        result = check_audio_quality(audio_bytes, request.text)
        logger.info(f"Quality check result: passed={result.passed}, issues={result.issues}")
        return result
    except Exception as e:
        logger.error(f"Quality check API error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    return {"status": "ok", "message": "TTS Data Collection Service is running"}


@app.post("/api/upload-audio")
async def upload_audio(
    file: UploadFile = File(...),
    text: str = Form(...),
    index: int = Form(0)
):
    """
    Upload recorded audio file and save metadata.
    """
    # Generate filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"recording_{timestamp}_{index}.wav"
    filepath = WAVS_DIR / filename

    # Save audio file
    try:
        async with aiofiles.open(filepath, "wb") as f:
            content = await file.read()
            await f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save audio: {str(e)}")

    # Save metadata to CSV
    try:
        # Check if file exists and has a header
        has_header = False
        if METADATA_FILE.exists():
            async with aiofiles.open(METADATA_FILE, mode="r", encoding="utf-8", newline="") as f:
                first_line = await f.readline()
                has_header = first_line.strip().startswith("filename")

        async with aiofiles.open(METADATA_FILE, mode="a", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            if not has_header:
                # Write header if file doesn't have one
                await f.write("filename,text,timestamp,index\n")
            await f.write(f"{filename},{text},{timestamp},{index}\n")

        logger.info(f"Successfully saved: {filename} for text: {text[:20]}...")
    except Exception as e:
        # Clean up audio file if metadata save fails
        if filepath.exists():
            filepath.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to save metadata: {str(e)}")

    logger.info(f"Returning response: {filename}")
    return {"success": True, "filename": filename}


@app.post("/api/delete-audio")
async def delete_audio(filename: str = Form(...)):
    """
    Delete an audio file and its metadata entry.
    """
    filepath = WAVS_DIR / filename

    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Delete audio file
    try:
        filepath.unlink()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete audio: {str(e)}")

    # Remove from metadata (read, filter, rewrite)
    try:
        records = []
        if METADATA_FILE.exists():
            async with aiofiles.open(METADATA_FILE, mode="r", encoding="utf-8", newline="") as f:
                content = await f.read()
                reader = csv.DictReader(content.splitlines())
                for row in reader:
                    if row["filename"] != filename:
                        records.append(row)

        # Rewrite CSV
        async with aiofiles.open(METADATA_FILE, mode="w", encoding="utf-8", newline="") as f:
            if records:
                writer = csv.DictWriter(f, fieldnames=["filename", "text", "timestamp", "index"])
                await f.write("filename,text,timestamp,index\n")
                for record in records:
                    await f.write(f"{record['filename']},{record['text']},{record['timestamp']},{record['index']}\n")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update metadata: {str(e)}")

    return {"success": True}


@app.get("/api/recordings")
async def get_recordings():
    """
    Get list of all recordings with metadata.
    """
    recordings = []
    if METADATA_FILE.exists():
        async with aiofiles.open(METADATA_FILE, mode="r", encoding="utf-8", newline="") as f:
            content = await f.read()
            reader = csv.DictReader(content.splitlines())
            for row in reader:
                recordings.append(row)

    return {"recordings": recordings}


@app.get("/api/audio/{filename}")
async def get_audio(filename: str):
    """
    Serve audio file for playback.
    """
    filepath = WAVS_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=filepath, media_type="audio/wav")


@app.post("/api/export-dataset")
async def export_dataset(request: ExportRequest = None):
    """
    Export all recordings and metadata as a ZIP file.
    If files are specified in request, only export those files.
    """
    # Determine which files to export
    files_to_export = []
    if request and request.files:
        files_to_export = [WAVS_DIR / f for f in request.files]
    else:
        files_to_export = list(WAVS_DIR.glob("*.wav"))

    if not files_to_export:
        raise HTTPException(status_code=404, detail="No recordings found")

    # Create ZIP file
    try:
        # Read metadata
        metadata_records = []
        if METADATA_FILE.exists():
            async with aiofiles.open(METADATA_FILE, mode="r", encoding="utf-8", newline="") as f:
                content = await f.read()
                reader = csv.DictReader(content.splitlines())
                for row in reader:
                    if not request or not request.files or row["filename"] in request.files:
                        metadata_records.append(row)

        with zipfile.ZipFile(ZIP_FILE, "w", zipfile.ZIP_DEFLATED) as zipf:
            # Add selected WAV files
            for wav_file in files_to_export:
                if wav_file.exists():
                    zipf.write(wav_file, wav_file.name)

            # Add filtered metadata CSV
            if metadata_records:
                metadata_content = "filename,text,timestamp,index\n"
                for record in metadata_records:
                    metadata_content += f"{record['filename']},{record['text']},{record['timestamp']},{record['index']}\n"
                zipf.writestr(METADATA_FILE.name, metadata_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create ZIP: {str(e)}")

    filename_suffix = "_selected" if request and request.files else ""
    return FileResponse(
        path=ZIP_FILE,
        filename=f"tts_dataset{filename_suffix}.zip",
        media_type="application/zip"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, timeout_keep_alive=120)
