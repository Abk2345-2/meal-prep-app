package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/go-chi/chi/v5"
	"github.com/pantrytoplate/backend/internal/httpx"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// googleUserInfo is the payload returned by the Google userinfo endpoint.
type googleUserInfo struct {
	Sub        string `json:"sub"`
	Email      string `json:"email"`
	Name       string `json:"name"`
	Picture    string `json:"picture"`
	GivenName  string `json:"given_name"`
	FamilyName string `json:"family_name"`
}

// Handler handles /api/auth/* routes.
type Handler struct {
	store       *Store
	secret      []byte
	oauth       *oauth2.Config
	frontendURL string // base URL of the Next.js app, e.g. http://localhost:3000
}

// NewHandler wires up the auth handler.
// callbackURL is the backend redirect URI registered with Google.
// frontendURL is the web app origin used to redirect the browser after login.
func NewHandler(store *Store, jwtSecret []byte, googleClientID, googleClientSecret, callbackURL, frontendURL string) *Handler {
	cfg := &oauth2.Config{
		ClientID:     googleClientID,
		ClientSecret: googleClientSecret,
		RedirectURL:  callbackURL,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}
	return &Handler{store: store, secret: jwtSecret, oauth: cfg, frontendURL: frontendURL}
}

// Routes registers auth endpoints on the given router.
func (h *Handler) Routes(r chi.Router) {
	r.Get("/login", h.login)
	r.Get("/callback", h.callback)
	r.Get("/me", h.me)
}

// login redirects the user to Google's OAuth consent screen.
// An optional `redirect_to` query param overrides the default frontend callback URL
// (used by the mobile app to redirect back via a deep-link scheme).
func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	// Encode the desired callback destination into the state so the callback
	// handler can redirect to the right place without requiring a cookie.
	redirectTo := r.URL.Query().Get("redirect_to")
	if redirectTo == "" {
		redirectTo = h.frontendURL + "/auth/callback"
	}
	state := randomState() + ":" + base64.URLEncoding.EncodeToString([]byte(redirectTo))
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   300,
	})
	http.Redirect(w, r, h.oauth.AuthCodeURL(state, oauth2.AccessTypeOnline), http.StatusTemporaryRedirect)
}

// callback exchanges the Google code for a token, upserts the user, then
// redirects the browser to the frontend /auth/callback page with the JWT and
// user info as query parameters.
func (h *Handler) callback(w http.ResponseWriter, r *http.Request) {
	// Validate CSRF state. State format: "<random>:<base64(redirect_to)>"
	stateCookie, err := r.Cookie("oauth_state")
	returnedState := r.URL.Query().Get("state")
	if err != nil || stateCookie.Value != returnedState {
		httpx.Error(w, http.StatusBadRequest, "invalid oauth state")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "oauth_state", MaxAge: -1, Path: "/"})

	// Decode redirect destination from state.
	dest := h.frontendURL + "/auth/callback"
	if parts := splitStateOnce(returnedState); len(parts) == 2 {
		if decoded, decErr := base64.URLEncoding.DecodeString(parts[1]); decErr == nil && len(decoded) > 0 {
			dest = string(decoded)
		}
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		httpx.Error(w, http.StatusBadRequest, "missing code")
		return
	}

	tok, err := h.oauth.Exchange(r.Context(), code)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, "token exchange failed: "+err.Error())
		return
	}

	info, err := fetchGoogleUserInfo(r.Context(), h.oauth, tok)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, "fetch user info failed: "+err.Error())
		return
	}

	user, err := h.store.UpsertGoogleUser(r.Context(), info.Sub, info.Email, info.Name, info.Picture)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db error: "+err.Error())
		return
	}

	jwtStr, err := IssueToken(h.secret, user)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "jwt error: "+err.Error())
		return
	}

	q := url.Values{}
	q.Set("token", jwtStr)
	q.Set("id", user.ID)
	q.Set("name", user.DisplayName)
	q.Set("email", user.Email)
	q.Set("avatar", user.AvatarURL)
	http.Redirect(w, r, dest+"?"+q.Encode(), http.StatusTemporaryRedirect)
}

func splitStateOnce(s string) []string {
	for i := 0; i < len(s); i++ {
		if s[i] == ':' {
			return []string{s[:i], s[i+1:]}
		}
	}
	return []string{s}
}

// me validates the Bearer JWT and returns the current user's info.
func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	claims, err := bearerClaims(r, h.secret)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{
		"id":     claims.UserID,
		"name":   claims.DisplayName,
		"email":  claims.Email,
		"avatar": claims.AvatarURL,
	})
}

// ── helpers ─────────────────────────────────────────────────────────────────

func fetchGoogleUserInfo(ctx context.Context, cfg *oauth2.Config, tok *oauth2.Token) (googleUserInfo, error) {
	client := cfg.Client(ctx, tok)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v3/userinfo")
	if err != nil {
		return googleUserInfo{}, fmt.Errorf("get userinfo: %w", err)
	}
	defer resp.Body.Close()
	var info googleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return googleUserInfo{}, fmt.Errorf("decode userinfo: %w", err)
	}
	return info, nil
}

func bearerClaims(r *http.Request, secret []byte) (*Claims, error) {
	h := r.Header.Get("Authorization")
	if len(h) < 8 || h[:7] != "Bearer " {
		return nil, fmt.Errorf("missing bearer token")
	}
	return VerifyToken(secret, h[7:])
}

func randomState() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}
