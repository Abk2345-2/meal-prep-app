'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { RecipeSuggestion } from '@pantrytoplate/shared';
import { api } from '@/lib/api';

const TIME_OPTIONS = [
  { value: 15,   minTime: 0,   maxTime: 15,  label: '≤ 15 min' },
  { value: 30,   minTime: 15,  maxTime: 30,  label: '15 – 30 min' },
  { value: 60,   minTime: 30,  maxTime: 60,  label: '30 – 60 min' },
  { value: 120,  minTime: 60,  maxTime: 120, label: '1 – 2 hrs' },
  { value: 9999, minTime: 120, maxTime: 0,   label: '2 hrs +' },
];

const CUISINE_OPTIONS = [
  { value: '',       label: 'All cuisines' },
  { value: 'indian', label: '🇮🇳 Indian' },
  { value: 'italian',label: '🇮🇹 Italian' },
  { value: 'chinese',label: '🇨🇳 Chinese' },
  { value: 'mexican',label: '🇲🇽 Mexican' },
  { value: 'thai',   label: '🇹🇭 Thai' },
];

const CATEGORY_OPTIONS = [
  { value: '',          label: 'Any course' },
  { value: 'breakfast', label: '🌅 Breakfast' },
  { value: 'lunch',     label: '🥗 Lunch' },
  { value: 'dinner',    label: '🍽️ Dinner' },
  { value: 'side',      label: '🥙 Side dish' },
  { value: 'dessert',   label: '🍮 Dessert' },
  { value: 'snack',     label: '🥨 Snack' },
  { value: 'drink',     label: '🥤 Drink' },
];

const DIETARY_OPTIONS = [
  { value: '',             label: 'All' },
  { value: 'vegetarian',   label: '🥗 Veg' },
  { value: 'vegan',        label: '🌱 Vegan' },
  { value: 'high-protein', label: '💪 High Protein' },
  { value: 'low-carb',     label: '🥬 Low Carb' },
];

function activeFilterCount(area: string, category: string, timeValue: number, dietary: string) {
  let n = 0;
  if (area) n++;
  if (category) n++;
  if (timeValue !== 15) n++; // 15 is the default tab
  if (dietary) n++;
  return n;
}

// ── Filter drawer ─────────────────────────────────────────────────────────────

function FilterDrawer({
  open,
  onClose,
  // draft values inside the drawer (not applied yet)
  draftTime,
  draftArea,
  draftCategory,
  draftDietary,
  onDraftTime,
  onDraftArea,
  onDraftCategory,
  onDraftDietary,
  onApply,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  draftTime: number;
  draftArea: string;
  draftCategory: string;
  draftDietary: string;
  onDraftTime: (v: number) => void;
  onDraftArea: (v: string) => void;
  onDraftCategory: (v: string) => void;
  onDraftDietary: (v: string) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  if (!open) return null;
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-2xl bg-white shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        <div className="px-4 pb-6">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold">Filter recipes</h3>
            <button
              onClick={onReset}
              className="text-xs font-medium text-brand"
            >
              Reset all
            </button>
          </div>

          {/* ── Dietary ───────────────────────────────────────────── */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Dietary
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {DIETARY_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onDraftDietary(value)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  draftDietary === value
                    ? 'border-brand bg-brand text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Cuisine type ──────────────────────────────────────── */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Cuisine
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {CUISINE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onDraftArea(value)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  draftArea === value
                    ? 'border-brand bg-brand text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Course type ───────────────────────────────────────── */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Course
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onDraftCategory(value)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  draftCategory === value
                    ? 'border-orange-500 bg-orange-500 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Cook time ─────────────────────────────────────────── */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Cook time
          </p>
          <div className="mb-6 flex flex-wrap gap-2">
            {TIME_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onDraftTime(value)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  draftTime === value
                    ? 'border-slate-800 bg-slate-800 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Apply button */}
          <button
            onClick={onApply}
            className="w-full rounded-xl bg-brand py-3 text-base font-semibold text-white transition hover:bg-brand-dark"
          >
            Apply filters
          </button>
        </div>
      </div>
    </>
  );
}

// ── RecipeStrip ───────────────────────────────────────────────────────────────

export function RecipeStrip({
  recipes,
  loading,
  selectedTime,
  onSelectTime,
  selectedArea,
  onSelectArea,
  selectedCategory,
  onSelectCategory,
  onCooked,
}: {
  recipes: RecipeSuggestion[];
  loading: boolean;
  selectedTime: number;
  onSelectTime: (value: number, minTime: number, maxTime: number) => void;
  selectedArea: string;
  onSelectArea: (area: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onCooked: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RecipeSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false); // true = showing search results
  const [searchOffset, setSearchOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search — fires 400ms after the user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = searchQuery.trim();
    if (!q) {
      setSearchMode(false);
      setSearchResults([]);
      setSearchOffset(0);
      setCanLoadMore(false);
      return;
    }
    setSearchMode(true);
    setSearching(true);
    setSearchOffset(0);
    setCanLoadMore(false);
    debounceRef.current = setTimeout(async () => {
      try {
        const { recipes } = await api.searchRecipes({ q, limit: 20, dietary: selectedDietary || undefined });
        setSearchResults(recipes);
        setCanLoadMore(recipes.length === 20);
      } catch {
        setSearchResults([]);
        setCanLoadMore(false);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, selectedDietary]);

  function clearSearch() {
    setSearchQuery('');
    setSearchMode(false);
    setSearchResults([]);
    searchRef.current?.focus();
  }

  // Draft state inside the drawer — only committed on Apply
  const [draftTime, setDraftTime] = useState(selectedTime);
  const [draftArea, setDraftArea] = useState(selectedArea);
  const [draftCategory, setDraftCategory] = useState(selectedCategory);
  const [selectedDietary, setSelectedDietary] = useState('');
  const [draftDietary, setDraftDietary] = useState('');

  function openDrawer() {
    // Sync draft with current applied values
    setDraftTime(selectedTime);
    setDraftArea(selectedArea);
    setDraftCategory(selectedCategory);
    setDraftDietary(selectedDietary);
    setDrawerOpen(true);
  }

  function apply() {
    const opt = TIME_OPTIONS.find((t) => t.value === draftTime) ?? TIME_OPTIONS[0];
    onSelectTime(opt.value, opt.minTime, opt.maxTime);
    onSelectArea(draftArea);
    onSelectCategory(draftCategory);
    setSelectedDietary(draftDietary);
    setDrawerOpen(false);
  }

  function reset() {
    setDraftTime(15);
    setDraftArea('');
    setDraftCategory('');
    setDraftDietary('');
  }

  const badgeCount = activeFilterCount(selectedArea, selectedCategory, selectedTime, selectedDietary);

  // Build a compact active-filter summary to show under the header
  const activeLabels: string[] = [];
  if (selectedArea) {
    const c = CUISINE_OPTIONS.find((o) => o.value === selectedArea);
    if (c) activeLabels.push(c.label);
  }
  if (selectedCategory) {
    const c = CATEGORY_OPTIONS.find((o) => o.value === selectedCategory);
    if (c) activeLabels.push(c.label);
  }
  const timeOpt = TIME_OPTIONS.find((t) => t.value === selectedTime);
  if (timeOpt) activeLabels.push(timeOpt.label);

  // Decide which list to render
  const displayRecipes = searchMode ? searchResults : recipes;
  const displayLoading = searchMode ? searching : loading;
  const emptyMessage = searchMode
    ? searchQuery.trim()
      ? `No recipes found for "${searchQuery}"`
      : 'Start typing to search…'
    : 'Add a few groceries and we\'ll suggest meals you can make.';

  return (
    <>
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        {/* Header row */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">
              {searchMode ? '🔍 Search results' : '🍽️ Suggested for you'}
            </h2>
            {/* Active filter summary (only in suggest mode) */}
            {!searchMode && activeLabels.length > 0 && (
              <p className="mt-0.5 text-xs text-slate-400">
                {activeLabels.join(' · ')}
              </p>
            )}
            {/* Search result count */}
            {searchMode && !searching && searchResults.length > 0 && (
              <p className="mt-0.5 text-xs text-slate-400">
                {searchResults.length} recipe{searchResults.length !== 1 ? 's' : ''} found
              </p>
            )}
          </div>

          {/* Filter button — hidden in search mode */}
          {!searchMode && (
            <button
              onClick={openDrawer}
              className="relative flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zM7 15a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              Filter
              {badgeCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                  {badgeCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Search bar */}
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-brand focus-within:bg-white transition">
          <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes… e.g. biryani, pasta"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="shrink-0 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>

        {displayLoading && (
          <p className="py-6 text-center text-sm text-slate-400">
            {searchMode ? 'Searching…' : 'Finding recipes…'}
          </p>
        )}

        {!displayLoading && displayRecipes.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">{emptyMessage}</p>
        )}

        <div className="flex gap-3 overflow-x-auto pb-1">
          {displayRecipes.map((r) => (
            <RecipeCard key={r.id} recipe={r} onCooked={onCooked} />
          ))}
        </div>

        {searchMode && canLoadMore && !searching && !loadingMore && (
          <button
            onClick={async () => {
              setLoadingMore(true);
              try {
                const q = searchQuery.trim();
                const { recipes: more } = await api.searchRecipes({
                  q,
                  limit: 20,
                  offset: searchOffset + 20,
                  dietary: selectedDietary || undefined,
                });
                setSearchResults((prev) => [...prev, ...more]);
                setCanLoadMore(more.length === 20);
                setSearchOffset((prev) => prev + 20);
              } catch {
                // keep existing results
              } finally {
                setLoadingMore(false);
              }
            }}
            className="mt-3 w-full rounded-xl border border-brand bg-green-50 py-2.5 text-sm font-semibold text-brand transition hover:bg-green-100"
          >
            Load more
          </button>
        )}

        {loadingMore && (
          <p className="mt-3 text-center text-sm text-slate-400">Loading more…</p>
        )}
      </section>

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        draftTime={draftTime}
        draftArea={draftArea}
        draftCategory={draftCategory}
        draftDietary={draftDietary}
        onDraftTime={setDraftTime}
        onDraftArea={setDraftArea}
        onDraftCategory={setDraftCategory}
        onDraftDietary={setDraftDietary}
        onApply={apply}
        onReset={reset}
      />
    </>
  );
}

// ── RecipeCard ────────────────────────────────────────────────────────────────

function RecipeCard({ recipe }: { recipe: RecipeSuggestion; onCooked: () => void }) {
  const router = useRouter();

  return (
    <div
      className="w-56 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-slate-100 transition hover:shadow-md active:scale-95"
      onClick={() => router.push(`/recipe/${recipe.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/recipe/${recipe.id}`)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={recipe.image} alt={recipe.title} className="h-32 w-full object-cover" />
      <div className="p-3">
        {recipe.category && (
          <span className="mb-1 inline-block rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-600">
            {recipe.category}
          </span>
        )}
        <p className="line-clamp-2 h-10 text-sm font-semibold">{recipe.title}</p>
        <p className="mt-1 text-xs text-slate-500">
          ⏱️ {recipe.time_minutes} min · {recipe.calories} cal
          {recipe.match_score > 0 && (
            <>
              {' · '}
              <span className="font-medium text-brand-dark">
                {Math.round(recipe.match_score * 100)}% match
              </span>
            </>
          )}
        </p>
        {(recipe.missing_ingredients?.length ?? 0) > 0 && (
          <p className="mt-1 line-clamp-1 text-xs text-slate-400">
            Need: {recipe.missing_ingredients.slice(0, 3).join(', ')}
          </p>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/recipe/${recipe.id}`); }}
          className="mt-2 w-full rounded-lg bg-brand py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          View recipe →
        </button>
      </div>
    </div>
  );
}
