# Build stage - use slim image for faster builds
FROM rust:1.83-slim AS builder

WORKDIR /app

# Install only essential build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests first for better layer caching
COPY Cargo.toml Cargo.lock ./
COPY server/ingestor/Cargo.toml ./server/ingestor/

# Create complete dummy source structure to cache dependencies
RUN mkdir -p server/ingestor/src/sources && \
    echo "fn main() {}" > server/ingestor/src/main.rs && \
    echo "// dummy" > server/ingestor/src/config.rs && \
    echo "// dummy" > server/ingestor/src/db.rs && \
    echo "// dummy" > server/ingestor/src/models.rs && \
    echo "// dummy" > server/ingestor/src/topics.rs && \
    echo "// dummy" > server/ingestor/src/sources/mod.rs

# Build dependencies only (this layer will be cached unless Cargo.toml changes)
RUN cd server/ingestor && \
    cargo build --release 2>&1 || true && \
    rm -rf target/release/.fingerprint/ingestor-* target/release/deps/ingestor-*

# Now copy actual source code
COPY server/ingestor/src ./server/ingestor/src/

# Build the actual ingestor (fast because deps are cached)
RUN cd server/ingestor && cargo build --release

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies (rustls doesn't need libssl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /app/target/release/ingestor /app/ingestor

# Set environment variables (can be overridden at runtime)
ENV RUST_LOG=info

# Run the ingestor
CMD ["/app/ingestor"]
