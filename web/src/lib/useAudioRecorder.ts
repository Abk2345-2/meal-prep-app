'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type RecorderStatus = 'idle' | 'recording' | 'ready' | 'blocked' | 'unsupported';

function preferredMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

export function useAudioRecorder() {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const urlRef = useRef<string | null>(null);

  const revokeAudioUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setAudioUrl(null);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    const canRecord =
      typeof window !== 'undefined' &&
      typeof MediaRecorder !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia);

    setSupported(canRecord);
    setStatus(canRecord ? 'idle' : 'unsupported');

    return () => {
      stopTimer();
      stopStream();
      revokeAudioUrl();
    };
  }, [revokeAudioUrl, stopStream, stopTimer]);

  const startRecording = useCallback(async () => {
    if (!supported) {
      setStatus('unsupported');
      return false;
    }

    try {
      setError(null);
      revokeAudioUrl();
      setDuration(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopTimer();
        stopStream();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const nextUrl = URL.createObjectURL(blob);
        urlRef.current = nextUrl;
        setAudioUrl(nextUrl);
        setStatus('ready');
      };

      recorder.start();
      setStatus('recording');
      timerRef.current = window.setInterval(() => {
        setDuration((seconds) => seconds + 1);
      }, 1000);
      return true;
    } catch {
      stopTimer();
      stopStream();
      setStatus('blocked');
      setError('Microphone access is blocked. Allow Microphone in the browser site settings, then try again.');
      return false;
    }
  }, [revokeAudioUrl, stopStream, stopTimer, supported]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  const resetRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    stopTimer();
    stopStream();
    revokeAudioUrl();
    chunksRef.current = [];
    setDuration(0);
    setError(null);
    setStatus(supported ? 'idle' : 'unsupported');
  }, [revokeAudioUrl, stopStream, stopTimer, supported]);

  return {
    supported,
    status,
    recording: status === 'recording',
    audioUrl,
    duration,
    error,
    startRecording,
    stopRecording,
    resetRecording,
  };
}
