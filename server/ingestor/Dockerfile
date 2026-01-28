# Build stage
FROM rust:1.84-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace and ingestor source
COPY server/ ./server/
COPY Cargo.toml Cargo.lock ./

# Build the ingestor
RUN cd server/ingestor && cargo build --release

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /app/target/release/ingestor /app/ingestor

# Set environment variables (can be overridden at runtime)
ENV RUST_LOG=info

# Run the ingestor
CMD ["/app/ingestor"]
