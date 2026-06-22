# PantryToPlate backend dev helpers.
# Each service reads config from the environment (see ../.env.example).

ENV_FILE := ../.env
RUN_DIR := .run
SERVICES := pantry recipe nutrition gamification gateway

ifneq ("$(wildcard $(ENV_FILE))","")
include $(ENV_FILE)
export
endif

.PHONY: tidy build test vet check-go run-gateway run-pantry run-recipe run-nutrition run-gamification run-all stop db-up db-down

tidy:
	go mod tidy

build:
	go build ./...

test:
	go test ./...

vet:
	go vet ./...

check-go:
	@command -v go >/dev/null 2>&1 || { \
		echo "Go is not installed or not on PATH. Install Go 1.22+ from https://go.dev/dl/ or run the backend with docker compose."; \
		exit 1; \
	}

# Run individual services (each auto-migrates on boot).
run-gateway: check-go
	go run ./cmd/gateway
run-pantry: check-go
	go run ./cmd/pantry
run-recipe: check-go
	go run ./cmd/recipe
run-nutrition: check-go
	go run ./cmd/nutrition
run-gamification: check-go
	go run ./cmd/gamification

# Run every service in the background (logs to ./.run/*.log). Use `make stop` to kill.
run-all: check-go
	@mkdir -p $(RUN_DIR)
	@rm -f $(RUN_DIR)/*.pid
	@go run ./cmd/pantry       > $(RUN_DIR)/pantry.log 2>&1 & echo $$! > $(RUN_DIR)/pantry.pid
	@go run ./cmd/recipe       > $(RUN_DIR)/recipe.log 2>&1 & echo $$! > $(RUN_DIR)/recipe.pid
	@go run ./cmd/nutrition    > $(RUN_DIR)/nutrition.log 2>&1 & echo $$! > $(RUN_DIR)/nutrition.pid
	@go run ./cmd/gamification > $(RUN_DIR)/gamification.log 2>&1 & echo $$! > $(RUN_DIR)/gamification.pid
	@sleep 2
	@go run ./cmd/gateway      > $(RUN_DIR)/gateway.log 2>&1 & echo $$! > $(RUN_DIR)/gateway.pid
	@sleep 1
	@failed=0; \
	for service in $(SERVICES); do \
		pid_file="$(RUN_DIR)/$$service.pid"; \
		log_file="$(RUN_DIR)/$$service.log"; \
		if [ ! -f "$$pid_file" ] || ! kill -0 "$$(cat "$$pid_file")" 2>/dev/null; then \
			echo "$$service failed to start. Recent log output:"; \
			sed -n '1,80p' "$$log_file" 2>/dev/null || true; \
			failed=1; \
		fi; \
	done; \
	if [ "$$failed" -ne 0 ]; then \
		$(MAKE) stop >/dev/null; \
		exit 1; \
	fi
	@echo "All services running. Gateway on :8080. Logs in backend/.run/"

stop:
	@if [ -d "$(RUN_DIR)" ]; then \
		for f in $(RUN_DIR)/*.pid; do \
			[ -f "$$f" ] && kill "$$(cat "$$f")" 2>/dev/null || true; \
		done; \
		rm -f $(RUN_DIR)/*.pid; \
	fi
	@echo "Stopped."

# Start just the database via docker compose (from repo root).
db-up:
	docker compose -f ../docker-compose.yml up -d postgres

db-down:
	docker compose -f ../docker-compose.yml down
