# Aegis Sentinel - Rust Agent Dockerfile
# Multi-stage build for minimal image size

# Stage 1: Build
FROM rust:1.75-slim as builder

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy source code
COPY Cargo.toml Cargo.lock ./
COPY src ./src

# Build release binary
RUN cargo build --release

# Stage 2: Runtime
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /app/target/release/aegis-sentinel /app/aegis-sentinel

# Environment variables
ENV MQTT_BROKER=mosquitto
ENV RUST_LOG=info

# Run the agent
CMD ["/app/aegis-sentinel"]
