package speech

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"time"
)

// GroqClient handles speech-to-text using Groq's Whisper API
type GroqClient struct {
	apiKey string
	client *http.Client
}

// TranscriptionResponse matches Groq's API response
type TranscriptionResponse struct {
	Text string `json:"text"`
}

// NewGroqClient creates a new Groq client
func NewGroqClient(apiKey string) *GroqClient {
	return &GroqClient{
		apiKey: apiKey,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

// TranscribeAudio sends audio data to Groq's Whisper API and returns the transcription
func (c *GroqClient) TranscribeAudio(audioData []byte, filename string) (string, error) {
	if c.apiKey == "" {
		return "", fmt.Errorf("Groq API key not configured")
	}

	// Create multipart form
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add the file
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return "", fmt.Errorf("creating form file: %w", err)
	}

	if _, err := part.Write(audioData); err != nil {
		return "", fmt.Errorf("writing file data: %w", err)
	}

	// Add model field
	if err := writer.WriteField("model", "whisper-large-v3"); err != nil {
		return "", fmt.Errorf("writing model field: %w", err)
	}

	// Add response_format field
	if err := writer.WriteField("response_format", "json"); err != nil {
		return "", fmt.Errorf("writing response_format field: %w", err)
	}

	if err := writer.Close(); err != nil {
		return "", fmt.Errorf("closing writer: %w", err)
	}

	// Create request
	req, err := http.NewRequestWithContext(
		context.Background(),
		"POST",
		"https://api.groq.com/openai/v1/audio/transcriptions",
		body,
	)
	if err != nil {
		return "", fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Send request
	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	// Parse response
	var result TranscriptionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decoding response: %w", err)
	}

	return result.Text, nil
}

// GetAPIKeyFromEnv retrieves the Groq API key from environment variable
func GetAPIKeyFromEnv() string {
	return os.Getenv("GROQ_API_KEY")
}
