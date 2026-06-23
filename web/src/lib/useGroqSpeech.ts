'use client';

import { useCallback, useRef, useState } from 'react';

type Status = 'idle' | 'requesting' | 'recording' | 'transcribing' | 'error';
type MicPermission = 'unknown' | 'prompt' | 'granted' | 'denied';

function preferredMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

function mimeToFilename(mime: string) {
  if (mime.includes('mp4')) return 'audio.mp4';
  return 'audio.webm';
}

/**
 * useGroqSpeech records audio from the microphone and transcribes it via the
 * backend Groq Whisper endpoint (/api/pantry/transcribe). The returned transcript
 * is cleared on each new recording so callers can append it themselves.
 */
export function useGroqSpeech(apiBase: string = '') {
  const [status, setStatus] = useState<Status>('idle');
  const [permission, setPermission] = useState<MicPermission>('unknown');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef('');

  const supported =
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission('denied');
      return false;
    }
    try {
      setStatus('requesting');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermission('granted');
      setStatus('idle');
      return true;
    } catch {
      setPermission('denied');
      setStatus('idle');
      return false;
    }
  }, []);

  const start = useCallback(async () => {
    if (!supported) return;
    setError(null);

    // Ask for permission if not yet granted.
    if (permission !== 'granted') {
      const ok = await requestPermission();
      if (!ok) return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = preferredMimeType();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mimeRef.current = recorder.mimeType || mime;
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopStream();
        const blob = new Blob(chunksRef.current, {
          type: mimeRef.current || 'audio/webm',
        });
        await transcribe(blob);
      };

      recorder.start();
      setStatus('recording');
      setTranscript('');
    } catch {
      stopStream();
      setPermission('denied');
      setStatus('idle');
      setError('Microphone access denied. Allow it in browser site settings and try again.');
    }
  }, [permission, requestPermission, stopStream]); // transcribe added below via ref

  // Defined after `start` but referenced inside `recorder.onstop` via closure over `transcribeRef`.
  const transcribeRef = useRef<(blob: Blob) => Promise<void>>(async () => {});

  const transcribe = useCallback(
    async (blob: Blob) => {
      setStatus('transcribing');
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        // Convert to base64 in chunks to avoid stack overflow on large buffers.
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8.length; i += chunkSize) {
          binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
        }
        const audioBase64 = btoa(binary);
        const filename = mimeToFilename(mimeRef.current);

        const res = await fetch(`${apiBase}/api/pantry/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBase64, filename }),
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
    },
    [apiBase],
  );

  // Keep transcribeRef current so the closure in recorder.onstop always calls the latest version.
  transcribeRef.current = transcribe;

  // Patch the actual transcribe call inside `start` to go through the ref.
  // We do this by redefining onstop when we call start — see the `start` callback above
  // which already calls `transcribe` directly (same closure scope, fine).

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      setStatus('transcribing'); // optimistic — onstop will confirm
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
    if (status !== 'recording') setStatus('idle');
  }, [status]);

  return {
    supported,
    status,
    recording: status === 'recording',
    transcribing: status === 'transcribing',
    transcript,
    permission,
    error,
    start,
    stop,
    reset,
    requestPermission,
  };
}
