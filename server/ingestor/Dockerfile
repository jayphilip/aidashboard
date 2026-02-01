# Build stage
FROM rust:latest AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests first for better layer caching
COPY Cargo.toml Cargo.lock ./
COPY server/ingestor/Cargo.toml ./server/ingestor/

# Create dummy source files to build dependencies
RUN mkdir -p server/ingestor/src && \
    echo "fn main() {}" > server/ingestor/src/main.rs

# Build dependencies (this layer will be cached)
RUN cd server/ingestor && cargo build --release && \
    rm -rf target/release/.fingerprint/ingestor-*

# Now copy actual source code
COPY server/ingestor/src ./server/ingestor/src/

# Build the actual ingestor (only rebuilds if source changed)
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
