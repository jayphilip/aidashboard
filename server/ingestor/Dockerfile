# Build stage
FROM rust:1.84-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    musl-dev \
    openssl-dev \
    openssl-static \
    pkg-config \
    sqlx-cli

# Copy workspace and ingestor source
COPY server/ ./server/
COPY Cargo.toml Cargo.lock ./

# Build the ingestor
RUN cd server/ingestor && cargo build --release

# Runtime stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    libssl3 \
    ca-certificates

# Copy binary from builder
COPY --from=builder /app/target/release/ingestor /app/ingestor

# Set environment variables (can be overridden at runtime)
ENV RUST_LOG=info

# Run the ingestor
CMD ["/app/ingestor"]
