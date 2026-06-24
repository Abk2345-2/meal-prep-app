import { useCallback, useState } from 'react';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  'http://localhost:8080';

type Status = 'idle' | 'requesting' | 'recording' | 'transcribing' | 'error';

export function useGroqSpeech() {
  const [status, setStatus] = useState<Status>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // SDK 54: useAudioRecorder hook manages the recorder instance lifecycle
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

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

      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatus('recording');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }, [recorder]);

  const stop = useCallback(async () => {
    if (status !== 'recording') return;
    setStatus('transcribing');

    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;

      if (!uri) {
        setError('No audio recorded.');
        setStatus('error');
        return;
      }

      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
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
  }, [recorder, status]);

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
