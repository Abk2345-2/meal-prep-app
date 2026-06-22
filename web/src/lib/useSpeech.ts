'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal typings for the Web Speech API (not in standard lib.dom yet).
interface SpeechRecognitionEvent extends Event {
  results: { 0: { 0: { transcript: string } }; length: number }[] & {
    [index: number]: { 0: { transcript: string }; isFinal: boolean };
  };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: Event) => void) | null;
  start: () => void;
  stop: () => void;
}

type MicPermission = 'unknown' | 'prompt' | 'granted' | 'denied';

/**
 * useSpeech wraps the browser Web Speech API for hands-free grocery entry.
 * Returns { supported, listening, transcript, start, stop, reset, requestPermission }.
 */
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [permission, setPermission] = useState<MicPermission>('unknown');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setTranscript(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setSupported(true);

    if (!navigator.permissions?.query) {
      setPermission('prompt');
      return;
    }

    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        setPermission(status.state as MicPermission);
        status.onchange = () => setPermission(status.state as MicPermission);
      })
      .catch(() => setPermission('prompt'));
  }, []);

  const requestPermission = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission('denied');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermission('granted');
      return true;
    } catch {
      setPermission('denied');
      return false;
    }
  }, []);

  const start = useCallback(async () => {
    if (!recognitionRef.current) return false;
    if (permission !== 'granted') {
      const allowed = await requestPermission();
      if (!allowed) return false;
    }

    setTranscript('');
    setListening(true);
    try {
      recognitionRef.current.start();
      return true;
    } catch {
      setListening(false);
      return false;
    }
  }, [permission, requestPermission]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const reset = useCallback(() => setTranscript(''), []);

  return { supported, listening, transcript, permission, start, stop, reset, requestPermission };
}
