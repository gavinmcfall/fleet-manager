# ============================================
# Stage 1: Build React frontend
# ============================================
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit 2>/dev/null || npm install --no-audit
COPY frontend/ ./
RUN npm run build

# ============================================
# Stage 2: Build Go backend
# ============================================
FROM golang:1.24-alpine AS backend-builder

RUN apk add --no-cache gcc musl-dev

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/ cmd/
COPY internal/ internal/

# Build with CGO for SQLite support
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o /fleet-manager ./cmd/server

# ============================================
# Stage 3: Runtime
# ============================================
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# Copy binary and frontend assets
COPY --from=backend-builder /fleet-manager .
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create data directory
RUN mkdir -p /app/data && chown -R app:app /app

USER app

# Default environment
ENV PORT=8080
ENV DB_DRIVER=sqlite
ENV DB_PATH=/app/data/fleet-manager.db
ENV STATIC_DIR=/app/frontend/dist
ENV SYNC_SCHEDULE="0 3 * * *"
ENV SYNC_ON_STARTUP=true

EXPOSE 8080

VOLUME ["/app/data"]

ENTRYPOINT ["/app/fleet-manager"]
