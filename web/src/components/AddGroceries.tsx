'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseText, type ParsedItem } from '@pantrytoplate/shared';
import { api } from '@/lib/api';
import { useGroqSpeech } from '@/lib/useGroqSpeech';
import { formatGroceryTranscript } from '@/lib/groceryTranscript';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://backend-pantry-pilot.fly.dev';

// AddGroceries is the single low-click entry point: type OR speak a sentence
// like "2 lbs chicken, dozen eggs", see parsed chips instantly, tap once to save.
export function AddGroceries({ onSaved }: { onSaved: () => void }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const {
    supported,
    recording,
    transcribing,
    transcript,
    permission,
    error: speechError,
    start,
    stop,
    reset,
    requestPermission,
  } = useGroqSpeech(API_BASE);

  // When transcription completes, format as comma-separated items and append.
  useEffect(() => {
    if (transcript) {
      const formatted = formatGroceryTranscript(transcript);
      setText((prev) => (prev ? `${prev}, ${formatted}` : formatted));
      reset();
    }
  }, [transcript, reset]);

  const effectiveText = text;

  const preview = useMemo<ParsedItem[]>(
    () => (effectiveText.trim() ? parseText(effectiveText) : []),
    [effectiveText],
  );

  async function save() {
    if (preview.length === 0) return;
    setSaving(true);
    try {
      await api.addGroceries({ text: effectiveText });
      await api.sendEvent('log_pantry');
      setText('');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function onMicClick() {
    if (recording) {
      stop();
      return;
    }
    if (permission === 'denied') {
      await requestPermission();
      return;
    }
    await start();
  }

  const micLabel = recording
    ? 'Stop recording'
    : transcribing
      ? 'Transcribing…'
      : permission === 'granted'
        ? 'Start voice input'
        : 'Enable microphone';

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <input
          value={effectiveText}
          onChange={(e) => setText(e.target.value)}
          placeholder='Add groceries — e.g. "2 lbs chicken, dozen eggs, 500g rice"'
          className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-brand"
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
        />
        {supported ? (
          <button
            onClick={onMicClick}
            disabled={transcribing}
            aria-label={micLabel}
            title={micLabel}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl transition disabled:opacity-60 ${
              recording
                ? 'animate-pulse bg-red-500 text-white'
                : transcribing
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-brand-light text-brand-dark'
            }`}
          >
            {recording ? '⏹' : transcribing ? '⏳' : '🎤'}
          </button>
        ) : (
          <span title="Microphone not supported in this browser" className="select-none text-xl text-slate-300">
            🎤
          </span>
        )}
      </div>

      {transcribing && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Transcribing your voice with Groq Whisper…
        </p>
      )}

      {supported && permission === 'denied' && !transcribing && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Microphone is blocked. In Brave/Chrome, click the site settings icon in the address bar,
          set Microphone to Allow, then reload.
        </p>
      )}

      {speechError && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{speechError}</p>
      )}

      {preview.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {preview.map((item, i) => (
            <span
              key={i}
              className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
            >
              {item.quantity} {item.unit !== 'unit' ? item.unit : ''} {item.name}
            </span>
          ))}
        </div>
      )}

      {preview.length > 0 && (
        <button
          onClick={save}
          disabled={saving}
          className="mt-3 w-full rounded-xl bg-brand py-3 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {saving ? 'Adding…' : `Add ${preview.length} item${preview.length > 1 ? 's' : ''} to pantry`}
        </button>
      )}
    </section>
  );
}
