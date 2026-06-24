package pantry

import (
	"encoding/base64"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/pantrytoplate/backend/internal/httpx"
	"github.com/pantrytoplate/backend/internal/middleware"
	"github.com/pantrytoplate/backend/internal/speech"
)

// Handler exposes pantry HTTP endpoints.
type Handler struct {
	store *Store
	now   func() time.Time
}

func NewHandler(store *Store) *Handler {
	return &Handler{store: store, now: time.Now}
}

// Routes mounts pantry routes onto a chi router.
func (h *Handler) Routes(r chi.Router) {
	r.Post("/parse", h.parse)
	r.Get("/items", h.list)
	r.Post("/items", h.create)
	r.Patch("/items/{id}", h.update)
	r.Delete("/items/{id}", h.delete)
	r.Post("/transcribe", h.transcribe)
	r.Post("/recategorize", h.recategorize)
}

type parseRequest struct {
	Text string `json:"text"`
}

// parse turns free text into structured items WITHOUT saving (preview step).
func (h *Handler) parse(w http.ResponseWriter, r *http.Request) {
	var req parseRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	items := ParseText(h.now(), req.Text)
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
}

type createRequest struct {
	// Either provide raw Text (parsed server-side) or a list of pre-parsed Items.
	Text  string       `json:"text"`
	Items []ParsedItem `json:"items"`
}

// create saves one or more items. Accepts raw text or confirmed parsed items.
func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	var req createRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	toSave := req.Items
	if len(toSave) == 0 && req.Text != "" {
		toSave = ParseText(h.now(), req.Text)
	}
	if len(toSave) == 0 {
		httpx.Error(w, http.StatusBadRequest, "provide 'text' or 'items'")
		return
	}

	saved := make([]Item, 0, len(toSave))
	for _, p := range toSave {
		it, err := h.store.Create(r.Context(), userID, p)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, err.Error())
			return
		}
		saved = append(saved, it)
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{"items": saved})
}

// list returns the user's items, optionally filtered to expiring-soon.
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())

	expiringWithin := 0
	if r.URL.Query().Get("status") == "expiring" {
		expiringWithin = 3 // default "expiring soon" window in days
	}
	if d := r.URL.Query().Get("expiring_within"); d != "" {
		if n, err := strconv.Atoi(d); err == nil {
			expiringWithin = n
		}
	}

	items, err := h.store.List(r.Context(), userID, expiringWithin)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
}

type updateRequest struct {
	Quantity float64 `json:"quantity"`
	Unit     string  `json:"unit"`
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	id := chi.URLParam(r, "id")
	var req updateRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	if req.Unit == "" {
		req.Unit = "unit"
	}
	it, err := h.store.UpdateQuantity(r.Context(), userID, id, req.Quantity, req.Unit)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, it)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	id := chi.URLParam(r, "id")
	if err := h.store.Delete(r.Context(), userID, id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusNoContent, nil)
}

type transcribeRequest struct {
	AudioBase64 string `json:"audioBase64"`
	Filename    string `json:"filename"`
}

type transcribeResponse struct {
	Text string `json:"text"`
}

// recategorize re-applies the current categoryFor logic to all existing items
// for the user, fixing stale categories like "produce" and "other".
func (h *Handler) recategorize(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	updated, err := h.store.Recategorize(r.Context(), userID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"updated": updated})
}

// decodeBase64 decodes a base64 string to bytes
func decodeBase64(data string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(data)
}

// transcribe converts audio to text using Groq's Whisper API
func (h *Handler) transcribe(w http.ResponseWriter, r *http.Request) {
	var req transcribeRequest
	if !httpx.Decode(w, r, &req) {
		return
	}

	if req.AudioBase64 == "" {
		httpx.Error(w, http.StatusBadRequest, "audioBase64 is required")
		return
	}

	// Decode base64 audio data
	audioData, err := decodeBase64(req.AudioBase64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid audio data: "+err.Error())
		return
	}

	filename := req.Filename
	if filename == "" {
		filename = "audio.webm"
	}

	// Get Groq API key from environment
	apiKey := speech.GetAPIKeyFromEnv()
	if apiKey == "" {
		httpx.Error(w, http.StatusInternalServerError, "Groq API key not configured. Set GROQ_API_KEY environment variable.")
		return
	}

	client := speech.NewGroqClient(apiKey)
	text, err := client.TranscribeAudio(audioData, filename)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "transcription failed: "+err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, transcribeResponse{Text: text})
}
