.PHONY: all build run dev frontend backend clean docker

all: build

# Build everything
build: frontend backend

# Build frontend
frontend:
	cd frontend && npm install && npm run build

# Build backend
backend:
	CGO_ENABLED=1 go build -ldflags="-s -w" -o fleet-manager ./cmd/server

# Run backend (assumes frontend is built)
run: build
	./fleet-manager

# Development: run backend + frontend dev server
dev:
	@echo "Starting backend on :8080 and frontend dev on :5173"
	@(go run ./cmd/server &) && cd frontend && npm run dev

# Docker build
docker:
	docker build -t fleet-manager:latest .

# Docker run
docker-run: docker
	docker run -p 8080:8080 -v fleet-data:/app/data \
		-e FLEETYARDS_USER=NZVengeance \
		fleet-manager:latest

# Clean build artifacts
clean:
	rm -f fleet-manager
	rm -rf frontend/dist frontend/node_modules
	rm -rf data/

# Tidy Go modules
tidy:
	go mod tidy
