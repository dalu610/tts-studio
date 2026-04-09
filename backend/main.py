from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
import csv
import shutil
import zipfile
from pathlib import Path
from datetime import datetime
from typing import List, Optional
import aiofiles
from pydantic import BaseModel
from dotenv import load_dotenv
import openai
import logging
import numpy as np
import io
import httpx
import asyncio
from zai import ZhipuAiClient

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
MOONSHOT_API_KEY = os.getenv("MOONSHOT_API_KEY")

# Ensure directories exist
WAVS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Initialize Kimi client
client = openai.Client(
    base_url="https://api.moonshot.cn/v1",
    api_key=MOONSHOT_API_KEY,
) if MOONSHOT_API_KEY else None

# Simple cache for text variants
variants_cache = {}

# GLM-4.7-Flash configuration
GLM_API_KEY = os.getenv("GLM_API_KEY")
GLM_MODEL = os.getenv("GLM_MODEL", "glm-4.7-flash")

# Initialize GLM client (using official Zhipu AI SDK)
glm_client = ZhipuAiClient(api_key=GLM_API_KEY) if GLM_API_KEY else None

async def call_glm(prompt: str) -> str:
    """Call GLM-4.7-Flash API for text generation"""
    if not glm_client:
        raise ValueError("GLM_API_KEY not configured. Please set GLM_API_KEY environment variable.")

    try:
        # Use asyncio.to_thread to avoid blocking the event loop
        response = await asyncio.to_thread(
            glm_client.chat.completions.create,
            model=GLM_MODEL,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2048,
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        logger.error(f"GLM API error: {e}")
        raise

def generate_simple_variants(seed_text, count=5):
    """Generate simple local variants as fallback for TTS training"""
    variants = []
    # TTS-friendly variations - keep similar length and meaning
    replacements = [
        ("您好", "你好"),
        ("你好", "您好"),
        ("请问", ""),
        ("打扰一下", "不好意思"),
        ("对吧", "是吗"),
        ("对吗", "是吧"),
        ("吗", "嘛"),
    ]

    # Generate variants by applying single replacements
    for i, (old, new) in enumerate(replacements):
        if i >= count:
            break
        variant = seed_text.replace(old, new, 1)
        if variant != seed_text:
            variants.append(variant)

    # If still need more, try combinations
    while len(variants) < count:
        i = len(variants)
        variant = seed_text
        # Add/remove 请问
        if i % 2 == 0 and "请问" not in variant:
            variant = variant.replace("，", "，请问", 1) if "，" in variant else "请问" + variant
        # Change 吗 to 嘛
        if i % 3 == 0 and "吗" in variant:
            variant = variant.replace("吗", "嘛")
        if variant not in variants and variant != seed_text:
            variants.append(variant)
        else:
            # Last resort - just append the original
            variants.append(seed_text)
            break

    return variants[:count]

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


class TextExpansionRequest(BaseModel):
    seed_text: str
    count: int = 15


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


@app.post("/api/expand-text")
async def expand_text(request: TextExpansionRequest):
    """
    Generate text variants using GLM-4.7-Flash model with caching.
    First variant is the seed text itself, followed by AI-generated variants.
    """
    cache_key = request.seed_text.strip()

    # Check cache first
    if cache_key in variants_cache:
        logger.info(f"✅ Cache hit for: {request.seed_text[:50]}...")
        cached_variants = variants_cache[cache_key][:request.count]
        logger.info(f"Returning {len(cached_variants)} cached variants")
        return {"variants": cached_variants}

    # Start with seed text as first variant
    variants = [request.seed_text]
    logger.info(f"Generating {request.count - 1} additional variants using GLM ({GLM_MODEL}) for: {request.seed_text[:50]}...")

    # Calculate how many more variants we need to generate
    additional_count = max(0, request.count - 1)

    prompt = f"""为TTS语音合成训练生成话术变体。必须保持语义完全相同，只进行微小的词汇替换。

【任务说明】
TTS训练需要同一句话的多种自然说法，但意思必须完全一致。例如：
原句："您好，请问是郭先生吗？"
✓ 您好，是郭先生吗？（省略"请问"，意思不变）
✓ 你好，请问是郭先生吗？（"您好"→"你好"）
✓ 您好，请问是郭先生嘛？（"吗"→"嘛"）
✗ 你好，我是郭先生（意思改变，错误）
✗ 哈喽，是郭先生吗？（"哈喽"太随意，语气改变）

【允许的微调】
- 问候词替换：您好/你好
- 语气词替换：吗/嘛/吧
- 省略礼貌词：请问/打扰一下
- 同义词替换：先生/老师（仅当原句明确时）

【禁止】
- 改变句子意思
- 添加新内容
- 改变句式结构（疑问→陈述）
- 使用网络用语或随意表达

【输出要求】
生成{additional_count}个变体，每行一个，不要编号，不要解释。

原句：{request.seed_text}

变体："""

    try:
        # Call GLM API
        content = await call_glm(prompt)

        logger.info(f"GLM response received, length: {len(content)}")

        # Extract actual variants from the response
        for line in content.split("\n"):
            line = line.strip()
            # Skip empty lines, thinking markers
            if not line:
                continue
            # Skip explanation lines
            if line.startswith(('(', '（', '[', '【')):
                continue
            if '：：' in line or '->' in line or '>>' in line:
                continue

            # Try to extract variant from markdown bold format: **variant** or numbered list: 1. **variant**
            import re
            # Match patterns like: 1. **您好，是郭先生吗？**  or **您好，是郭先生吗？**
            match = re.search(r'\*\*(.+?)\*\*', line)
            if match:
                variant = match.group(1).strip()
                if 5 <= len(variant) <= 30 and variant not in variants:
                    variants.append(variant)
                    continue

            # Also try plain lines that look like variants (for other formats)
            if line.startswith(('*', '-', '•')):
                variant = line[1:].strip()
                if 5 <= len(variant) <= 30 and variant not in variants:
                    variants.append(variant)
                    continue

            # Try numbered list format: "1. 变体内容" or "1. **变体内容**"
            numbered_match = re.match(r'^\d+\.\s*\*?\*?(.+?)\*?\*?$', line)
            if numbered_match:
                variant = numbered_match.group(1).strip()
                if 5 <= len(variant) <= 30 and variant not in variants:
                    variants.append(variant)
                    continue

            # For plain lines without markdown (fallback)
            if 5 <= len(line) <= 30 and line not in variants:
                # Skip lines that are clearly not variants
                if any(skip in line for skip in ['变体', '选项', '草稿', '优化', '备选', '以下是', '要求：']):
                    continue
                variants.append(line)

        logger.info(f"Parsed {len(variants) - 1} additional variants, total: {len(variants)}")

    except Exception as e:
        logger.error(f"Error calling GLM: {e}")
        # Keep seed text even if GLM fails

    # If we got good variants (seed + at least 2 more), cache them
    if len(variants) >= 3:
        variants_cache[cache_key] = variants
        logger.info(f"Cached variants for: {request.seed_text[:50]}...")

    # If we got fewer variants than requested, pad with simple variations
    if len(variants) < request.count:
        logger.info(f"Got {len(variants)} variants total, padding with simple variants")
        # Generate enough simple variants to reach the requested count
        needed_count = request.count - len(variants) + 1  # +1 because simple_variants doesn't include seed
        simple_variants = generate_simple_variants(request.seed_text, needed_count)
        for v in simple_variants:
            if v not in variants:
                variants.append(v)
            if len(variants) >= request.count:
                break

    # Limit to requested count
    variants = variants[:request.count]

    # Cache the result
    if len(variants) > 0 and cache_key not in variants_cache:
        variants_cache[cache_key] = variants
        logger.info(f"Cached {len(variants)} variants for: {request.seed_text[:50]}...")

    return {"variants": variants}


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
