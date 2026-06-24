import { useCallback, useRef, useState } from 'react';
import {
  AudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import Constants from 'expo-constants';

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  'http://localhost:8080';

type Status = 'idle' | 'requesting' | 'recording' | 'transcribing' | 'error';

/**
 * useGroqSpeech records audio with expo-audio and transcribes it via the
 * backend Groq Whisper endpoint (/api/pantry/transcribe).
 */
export function useGroqSpeech() {
  const [status, setStatus] = useState<Status>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<AudioRecorder | null>(null);

  const start = useCallback(async () => {
    setError(null);
    setTranscript('');
    setStatus('requesting');

    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setError('Microphone permission denied. Enable it in Settings.');
        setStatus('error');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      const recorder = new AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await recorder.prepareToRecordAsync();
      recorder.record();
      recorderRef.current = recorder;
      setStatus('recording');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }, []);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setStatus('transcribing');
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      recorderRef.current = null;

      if (!uri) {
        setError('No audio recorded.');
        setStatus('error');
        return;
      }

      // Read the file as base64 via fetch + FileReader
      const response = await fetch(uri);
      const blob = await response.blob();
      const audioBase64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Strip "data:<mime>;base64," prefix
          resolve(result.split(',')[1] ?? '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const res = await fetch(`${API_BASE}/api/pantry/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, filename: 'audio.m4a' }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Server error ${res.status}`);
      }

      const data = (await res.json()) as { text: string };
      setTranscript(data.text.trim());
      setStatus('idle');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
    if (status !== 'recording') setStatus('idle');
  }, [status]);

  return {
    recording: status === 'recording',
    transcribing: status === 'transcribing',
    transcript,
    error,
    start,
    stop,
    reset,
  };
}
