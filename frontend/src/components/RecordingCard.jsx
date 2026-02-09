import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Trash2, CheckCircle, Edit2, X, AlertTriangle, Check } from 'lucide-react';
import { convertToWav } from '../utils/audioUtils';

export default function RecordingCard({ text, index, onRecordingComplete, onTextChange, onDelete, canEdit = true }) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(text);
  const [qualityCheck, setQualityCheck] = useState(null); // { passed: bool, issues: [] }

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const streamRef = useRef(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    setEditedText(text);
  }, [text]);

  const handleStartRecording = async () => {
    try {
      // Stop any existing recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Clear silence detection timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        console.log('Recording stopped, processing...');

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        // Convert to WAV format
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const wavBlob = await convertToWav(audioBlob);

        console.log('Audio converted to WAV, size:', wavBlob.size);

        // First save the audio
        const formData = new FormData();
        formData.append('file', wavBlob, `recording_${index}.wav`);
        formData.append('text', editedText);
        formData.append('index', index);

        try {
          // Upload audio
          console.log('Uploading audio...');
          const uploadResponse = await fetch('/api/upload-audio', {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error('Upload failed');
          }

          const uploadResponseData = await uploadResponse.json();

          console.log('Upload response data:', uploadResponseData);

          // Store the filename for later use
          const savedFilename = uploadResponseData.filename;

          if (!savedFilename) {
            console.error('No filename in upload response');
            alert('上传失败，请重试');
            return;
          }

          // Then check quality
          const audioArrayBuffer = await wavBlob.arrayBuffer();
          const audioBase64 = btoa(
            new Uint8Array(audioArrayBuffer).reduce((data, byte) => {
              return data + String.fromCharCode(byte);
            }, '')
          );

          console.log('Checking quality...');
          const qualityResponse = await fetch('/api/check-quality', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              audio_data: audioBase64,
              text: editedText,
            }),
          });

          if (qualityResponse.ok) {
            const qualityData = await qualityResponse.json();
            console.log('Quality check data:', qualityData);
            setQualityCheck(qualityData);

            // Only set as recorded if quality check passed
            if (qualityData.passed) {
              const url = URL.createObjectURL(wavBlob);
              setAudioUrl(url);
              setHasRecording(true);
              onRecordingComplete?.(index, true);
            } else {
              // Delete the uploaded file if quality check failed
              console.log('Deleting file due to failed quality check:', savedFilename);
              await fetch('/api/delete-audio', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `filename=${encodeURIComponent(savedFilename)}`,
              });
              // Reset states so user can re-record
              setHasRecording(false);
              setAudioUrl(null);
              // Keep qualityCheck to show error message
            }
          } else {
            console.error('Quality check request failed');
            setQualityCheck({
              passed: false,
              issues: ['质量检查请求失败，请检查网络连接后重试']
            });
          }
        } catch (error) {
          console.error('Upload or quality check failed:', error);
          setQualityCheck({
            passed: false,
            issues: [`上传或质量检查失败: ${error.message}`]
          });
        }

        audioChunksRef.current = [];
      };

      mediaRecorderRef.current.start();
      isRecordingRef.current = true;
      setIsRecording(true);
      setHasRecording(false);
      setQualityCheck(null);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Setup real-time silence detection using Web Audio API
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;

        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        let silenceStartTime = null;
        const SILENCE_THRESHOLD = 5; // Volume threshold (0-255), lower = more sensitive
        const SILENCE_DURATION = 1500; // Silence duration in ms before auto-stop
        const MIN_RECORDING_TIME = 2000; // Minimum recording time before allowing auto-stop
        let recordingStartTime = Date.now();

        const detectSilence = () => {
          if (!isRecordingRef.current || !analyserRef.current) return;

          analyserRef.current.getByteFrequencyData(dataArray);

          // Calculate average volume
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;

          const now = Date.now();
          const recordingDuration = now - recordingStartTime;

          // Debug logging
          if (recordingDuration > MIN_RECORDING_TIME && recordingDuration % 500 < 50) {
            console.log(`[Recording ${index}] Volume: ${average.toFixed(1)}, threshold: ${SILENCE_THRESHOLD}`);
          }

          // Only check for silence after minimum recording time
          if (recordingDuration > MIN_RECORDING_TIME) {
            if (average < SILENCE_THRESHOLD) {
              if (!silenceStartTime) {
                silenceStartTime = now;
                console.log(`[Recording ${index}] Silence started, volume: ${average.toFixed(1)}`);
              } else if (now - silenceStartTime > SILENCE_DURATION) {
                // Silence detected for long enough, auto-stop recording
                console.log(`[Recording ${index}] Silence detected for ${SILENCE_DURATION}ms, auto-stopping`);
                handleStopRecording();
                return;
              }
            } else {
              if (silenceStartTime) {
                console.log(`[Recording ${index}] Silence ended, volume: ${average.toFixed(1)}`);
              }
              silenceStartTime = null;
            }
          }

          // Continue detection
          requestAnimationFrame(detectSilence);
        };

        // Start silence detection after a short delay
        setTimeout(() => {
          if (isRecordingRef.current) {
            detectSilence();
          }
        }, 100);

      } catch (audioError) {
        console.error('Error setting up audio analysis:', audioError);
        // Continue without silence detection
      }

    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('无法访问麦克风，请确保已授予权限');
    }
  };

  const handleStopRecording = () => {
    console.log('Stop recording clicked, mediaRecorder state:', mediaRecorderRef.current?.state);

    // Clear silence detection timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Clean up audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      isRecordingRef.current = false;
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingTime(0);
      console.log('Recording stopped');
    }
  };

  const handlePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleDeleteRecording = async () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setHasRecording(false);
      setQualityCheck(null);
      onRecordingComplete?.(index, false);
    }
  };

  const handleDeleteCard = () => {
    onDelete?.(index);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onTextChange?.(index, editedText);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedText(text);
    setIsEditing(false);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [audioUrl]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`border rounded-lg p-4 transition-all ${
      hasRecording ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-gray-200 dark:border-gray-700'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        {isEditing ? (
          <input
            type="text"
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="flex-1 mr-2 px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
            autoFocus
          />
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-300 flex-1 pr-2">{editedText}</p>
        )}
        <div className="flex items-center gap-1">
          {/* Quality Check Result */}
          {qualityCheck && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded ${
              qualityCheck.passed ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
            }`}>
              {qualityCheck.passed ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-300">质量合格</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-medium text-red-700 dark:text-red-300">质量不合格</span>
                </>
              )}
            </div>
          )}
          {hasRecording && !qualityCheck && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />}
          {canEdit && !isEditing && onDelete && (
            <button
              onClick={handleDeleteCard}
              className="text-gray-400 hover:text-red-500 transition-colors"
              title="删除话术"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Quality Issues */}
      {qualityCheck && !qualityCheck.passed && (
        <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-md">
          <p className="text-xs font-bold text-red-800 dark:text-red-200 mb-1">检测到以下问题，请重新录音：</p>
          <ul className="text-xs text-red-700 dark:text-red-300 list-disc list-inside ml-2 space-y-1">
            {qualityCheck.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Quality Success */}
      {qualityCheck && qualityCheck.passed && (
        <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-md">
          <p className="text-xs font-bold text-green-800 dark:text-green-200">录音质量检查通过，已保存</p>
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex items-center gap-2">
        {!hasRecording ? (
          <>
            {isRecording ? (
              <>
                <button
                  onClick={handleStopRecording}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm transition-colors"
                >
                  <Square className="w-4 h-4" />
                  <span>停止</span>
                  <span className="ml-1 font-mono">{formatTime(recordingTime)}</span>
                </button>
                <span className="text-xs text-red-500 animate-pulse">录音中...</span>
              </>
            ) : (
              <button
                onClick={handleStartRecording}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm transition-colors"
              >
                <Mic className="w-4 h-4" />
                <span>录音</span>
              </button>
            )}
          </>
        ) : (
          <>
            <button
              onClick={handlePlay}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>{isPlaying ? '暂停' : '播放'}</span>
            </button>
            <button
              onClick={handleDeleteRecording}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>重录</span>
            </button>
          </>
        )}
        {canEdit && (
          <>
            {isEditing ? (
              <>
                <button
                  onClick={handleSaveEdit}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>保存</span>
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>取消</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleEdit}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm transition-colors"
                title="编辑话术"
              >
                <Edit2 className="w-4 h-4" />
                <span>编辑</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Hidden audio element for playback */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={handleAudioEnded}
          className="hidden"
        />
      )}
    </div>
  );
}
