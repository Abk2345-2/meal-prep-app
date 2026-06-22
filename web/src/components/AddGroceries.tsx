'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseText, type ParsedItem } from '@pantrytoplate/shared';
import { api } from '@/lib/api';
import { useAudioRecorder } from '@/lib/useAudioRecorder';
import { useSpeech } from '@/lib/useSpeech';

// AddGroceries is the single low-click entry point: type OR speak a sentence
// like "2 lbs chicken, dozen eggs", see parsed chips instantly, tap once to save.
export function AddGroceries({ onSaved }: { onSaved: () => void }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const recorder = useAudioRecorder();
  const {
    supported,
    listening,
    transcript,
    permission,
    start,
    stop,
    reset,
    requestPermission,
  } = useSpeech();

  // When speech ends, commit the transcript into the text field so the user
  // can edit it before saving. Without this the input goes blank on stop.
  useEffect(() => {
    if (!listening && transcript) {
      setText(transcript);
      reset();
    }
  }, [listening, transcript, reset]);

  // While actively listening, show the live transcript; otherwise show text state.
  const effectiveText = listening ? transcript : text;

  // Live preview chips parsed client-side (backend re-parses on save).
  const preview = useMemo<ParsedItem[]>(
    () => (effectiveText.trim() ? parseText(effectiveText) : []),
    [effectiveText],
  );

  async function save() {
    const toSave = preview;
    if (toSave.length === 0) return;
    setSaving(true);
    try {
      await api.addGroceries({ text: effectiveText });
      await api.sendEvent('log_pantry'); // reward the habit
      setText('');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function onMicClick() {
    if (listening) {
      stop();
      return;
    }

    if (permission === 'denied') {
      await requestPermission();
      return;
    }

    await start();
  }

  const micLabel = listening
    ? 'Stop recording'
    : permission === 'granted'
      ? 'Start voice input'
      : 'Enable microphone';
  const recordingLabel = recorder.recording ? 'Stop audio recording' : 'Record audio';
  const formattedDuration = `${Math.floor(recorder.duration / 60)}:${String(
    recorder.duration % 60,
  ).padStart(2, '0')}`;

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
        {supported && (
          <button
            onClick={onMicClick}
            aria-label={micLabel}
            title={micLabel}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl transition ${
              listening ? 'animate-pulse bg-red-500 text-white' : 'bg-brand-light text-brand-dark'
            }`}
          >
            {listening ? '⏹' : '🎤'}
          </button>
        )}
        {!supported && (
          <span title="Use Chrome or Edge for voice input" className="text-slate-300 text-xl select-none">🎤</span>
        )}
      </div>

      {supported && permission === 'denied' && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Microphone is blocked. In Brave, click the site settings icon in the address bar
          and set Microphone to Allow, then reload.
        </p>
      )}

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={recorder.recording ? recorder.stopRecording : recorder.startRecording}
            disabled={!recorder.supported}
            aria-label={recordingLabel}
            title={recordingLabel}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 ${
              recorder.recording ? 'animate-pulse bg-red-500 text-white' : 'bg-slate-900 text-white'
            }`}
          >
            {recorder.recording ? '■' : '●'}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">
                {recorder.recording ? 'Recording audio' : 'Audio recorder'}
              </p>
              <span className="text-xs tabular-nums text-slate-500">{formattedDuration}</span>
            </div>
            <p className="text-xs text-slate-500">
              Capture a voice note from the microphone.
            </p>
          </div>
        </div>

        {recorder.audioUrl && (
          <div className="mt-3 flex items-center gap-2">
            <audio controls src={recorder.audioUrl} className="h-10 min-w-0 flex-1" />
            <button
              type="button"
              onClick={recorder.resetRecording}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600"
            >
              Clear
            </button>
          </div>
        )}

        {(recorder.error || recorder.status === 'unsupported') && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {recorder.status === 'unsupported'
              ? 'Audio recording is not supported in this browser.'
              : recorder.error}
          </p>
        )}
      </div>

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
