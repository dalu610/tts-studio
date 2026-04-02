import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Play, Pause, Trash2, CheckCircle, Edit2, X, AlertTriangle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { convertToWav } from '../utils/audioUtils';

// Real-time waveform visualizer during recording
function WaveformVisualizer({ analyser, isRecording }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!analyser || !isRecording) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) return;
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = 'rgba(9, 11, 17, 0.8)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#F59E0B';
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#F59E0B';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    draw();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, isRecording]);

  if (!isRecording) return null;

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={40}
      className="rounded-lg opacity-80"
    />
  );
}

export default function RecordingCard({
  text,
  index,
  isRecorded,
  onRecordingComplete,
  onTextChange,
  onDelete,
  canEdit = true,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(isRecorded || false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(text);
  const [qualityCheck, setQualityCheck] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    setEditedText(text);
  }, [text]);

  const formatTime = (secs) => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

  const handleStartRecording = async () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch {}
        audioContextRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup audio analysis
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsUploading(true);

        try {
          const webmBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const wavBlob = await convertToWav(webmBlob);

          const formData = new FormData();
          formData.append('file', wavBlob, `recording_${index}.wav`);
          formData.append('text', editedText);
          formData.append('index', index);

          const uploadRes = await fetch('/api/upload-audio', { method: 'POST', body: formData });

          if (!uploadRes.ok) throw new Error('Upload failed');
          const uploadData = await uploadRes.json();

          const url = URL.createObjectURL(wavBlob);
          setAudioUrl(url);
          setHasRecording(true);
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
          onRecordingComplete?.(index, true);

          // Quality check
          const ab = await wavBlob.arrayBuffer();
          const b64 = btoa(new Uint8Array(ab).reduce((d, b) => d + String.fromCharCode(b), ''));
          try {
            const qRes = await fetch('/api/check-quality', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio_data: b64, text: editedText }),
            });
            if (qRes.ok) setQualityCheck(await qRes.json());
          } catch {}
        } catch (err) {
          alert(`录音失败: ${err.message}`);
        } finally {
          setIsUploading(false);
          audioChunksRef.current = [];
        }
      };

      // Silence auto-stop
      let silenceStart = null;
      let recordingStart = Date.now();
      const silenceDetect = () => {
        if (!isRecordingRef.current || !analyserRef.current) return;
        const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteTimeDomainData(buf);
        const avg = buf.reduce((a, b) => a + Math.abs(b - 128), 0) / buf.length;
        const now = Date.now();
        if (now - recordingStart > 2000) {
          if (avg < 3) {
            if (!silenceStart) silenceStart = now;
            else if (now - silenceStart > 1500) { handleStopRecording(); return; }
          } else silenceStart = null;
        }
        if (isRecordingRef.current) requestAnimationFrame(silenceDetect);
      };
      setTimeout(() => { if (isRecordingRef.current) requestAnimationFrame(silenceDetect); }, 200);

      mediaRecorder.start();
      isRecordingRef.current = true;
      setIsRecording(true);
      setHasRecording(false);
      setQualityCheck(null);
      setRecordingTime(0);

      timerRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);
    } catch (err) {
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  const handleStopRecording = useCallback(() => {
    if (silenceTimerRef) {}
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      isRecordingRef.current = false;
      setIsRecording(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setRecordingTime(0);
    }
  }, []);

  const silenceTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioContextRef.current) try { audioContextRef.current.close(); } catch {}
    };
  }, []);

  const handlePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play(); setIsPlaying(true); }
  };

  const handleDeleteRecording = async () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setHasRecording(false);
    setQualityCheck(null);
    onRecordingComplete?.(index, false);
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.04, duration: 0.35, ease: 'easeOut' },
    }),
  };

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={`group relative rounded-xl border transition-all duration-300 overflow-hidden ${
        hasRecording
          ? 'border-emerald-500/30 bg-emerald-500/[0.03]'
          : 'border-studio-border bg-studio-card hover:border-studio-border-light hover:bg-studio-card-hover'
      }`}
    >
      {/* Top accent line */}
      <div
        className={`absolute top-0 left-0 right-0 h-px transition-all duration-500 ${
          isRecording
            ? 'bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse'
            : hasRecording
            ? 'bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent'
            : 'bg-transparent'
        }`}
      />

      <div className="p-4">
        {/* Card header row */}
        <div className="flex items-start gap-3 mb-3">
          {/* Index badge */}
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono font-medium transition-colors ${
              hasRecording
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : isRecording
                ? 'bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse'
                : 'bg-studio-bg text-slate-500 border border-studio-border'
            }`}
          >
            {String(index + 1).padStart(2, '0')}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full bg-studio-bg border border-cyan-500/50 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 font-sans"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { onTextChange?.(index, editedText); setIsEditing(false); }
                  if (e.key === 'Escape') { setEditedText(text); setIsEditing(false); }
                }}
              />
            ) : (
              <p className={`text-sm leading-relaxed ${hasRecording ? 'text-slate-300' : 'text-slate-300'}`}>
                {editedText}
              </p>
            )}
          </div>

          {/* Status badges */}
          <div className="flex-shrink-0 flex items-center gap-2">
            {isUploading && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <svg className="w-3 h-3 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
                </svg>
                <span className="text-xs text-amber-400 font-medium">上传中</span>
              </div>
            )}
            {showSuccess && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40"
              >
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">已保存</span>
              </motion.div>
            )}
            {hasRecording && !isUploading && !showSuccess && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400/80 font-medium">已录制</span>
              </div>
            )}
          </div>
        </div>

        {/* Quality issues */}
        <AnimatePresence>
          {qualityCheck && !qualityCheck.passed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 p-2.5 rounded-lg bg-red-500/8 border border-red-500/25"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-red-300">质量检查未通过，请重新录音</span>
              </div>
              <ul className="space-y-0.5 pl-5">
                {(qualityCheck.issues || []).slice(0, 3).map((issue, i) => (
                  <li key={i} className="text-[11px] text-red-300/70 list-disc">{issue}</li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Waveform visualizer during recording */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 48 }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 overflow-hidden rounded-lg"
            >
              <WaveformVisualizer analyser={analyserRef.current} isRecording={isRecording} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls row */}
        <div className="flex items-center gap-2">
          {/* Main action button */}
          {!hasRecording && (
            <>
              {isRecording ? (
                <button
                  onClick={handleStopRecording}
                  className="group/btn flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 hover:border-red-500/60 transition-all duration-200 active:scale-95"
                >
                  <div className="w-2 h-2 rounded-sm bg-red-500 group-hover/btn:scale-110 transition-transform" />
                  <span className="text-xs font-semibold">停止</span>
                  <span className="font-mono text-xs text-red-400/70 ml-1">{formatTime(recordingTime)}</span>
                </button>
              ) : (
                <button
                  onClick={handleStartRecording}
                  disabled={isUploading}
                  className="group/btn flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/60 hover:shadow-amber-500/20 hover:shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Mic className="w-4 h-4" />
                  <span className="text-xs font-semibold">录音</span>
                </button>
              )}
            </>
          )}

          {/* Post-recording controls */}
          {hasRecording && !isUploading && (
            <>
              <button
                onClick={handlePlay}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all duration-200 active:scale-95"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span className="text-xs font-semibold">{isPlaying ? '暂停' : '播放'}</span>
              </button>
              <button
                onClick={handleDeleteRecording}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-studio-bg border border-studio-border text-slate-500 hover:border-red-500/40 hover:text-red-400 transition-all duration-200 active:scale-95"
                title="重新录音"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* Edit controls */}
          {canEdit && (
            <>
              {isEditing ? (
                <>
                  <button
                    onClick={() => { onTextChange?.(index, editedText); setIsEditing(false); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/25 transition-all active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold">保存</span>
                  </button>
                  <button
                    onClick={() => { setEditedText(text); setIsEditing(false); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-studio-bg border border-studio-border text-slate-500 hover:text-slate-300 transition-all active:scale-95"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-studio-bg border border-studio-border text-slate-600 hover:border-studio-border-light hover:text-slate-400 transition-all opacity-0 group-hover:opacity-100 active:scale-95"
                  title="编辑话术"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}

          {/* Delete card */}
          {canEdit && onDelete && (
            <button
              onClick={() => onDelete(index)}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-slate-600 hover:text-red-400 hover:bg-red-500/5 transition-all opacity-0 group-hover:opacity-100 active:scale-95"
              title="删除话术"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Hidden audio */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}
    </motion.div>
  );
}
