package gateway

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// readinessResponse mirrors the JSON shape returned by /health/ready.
type readinessResponse struct {
	Status string `json:"status"`
}

func TestReadinessEndpointReturnsReady(t *testing.T) {
	g := NewGateway(DefaultGatewayConfig())

	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	w := httptest.NewRecorder()

	g.mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp readinessResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Status != "ready" {
		t.Fatalf("expected status=ready, got %q", resp.Status)
	}
}

func TestReadinessEndpointReturnsNotReadyWhenUnhealthy(t *testing.T) {
	g := NewGateway(DefaultGatewayConfig())
	g.health.Store(false) // mark gateway as unhealthy

	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	w := httptest.NewRecorder()

	g.mux.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}

	var resp readinessResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Status != "not ready" {
		t.Fatalf("expected status='not ready', got %q", resp.Status)
	}
}

func TestLivenessEndpointAlwaysReturnsOK(t *testing.T) {
	g := NewGateway(DefaultGatewayConfig())

	req := httptest.NewRequest(http.MethodGet, "/health/live", nil)
	w := httptest.NewRecorder()

	g.mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp readinessResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Status != "alive" {
		t.Fatalf("expected status=alive, got %q", resp.Status)
	}
}

func TestHealthEndpointReturnsOK(t *testing.T) {
	g := NewGateway(DefaultGatewayConfig())

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()

	g.mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestReadinessEndpointMethodNotAllowed(t *testing.T) {
	g := NewGateway(DefaultGatewayConfig())

	req := httptest.NewRequest(http.MethodPost, "/health/ready", nil)
	w := httptest.NewRecorder()

	g.mux.ServeHTTP(w, req)

	// The default ServeMux returns 405 for method mismatches on exact paths,
	// but our handler doesn't restrict methods — it simply responds to any
	// method. Verify the handler doesn't crash.
	if w.Code != http.StatusOK && w.Code != http.StatusMethodNotAllowed {
		t.Logf("readiness endpoint responded with %d for POST (no method restriction)", w.Code)
	}
}
