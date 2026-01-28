#!/bin/bash

# Hetzner VPS Deployment Setup Script
# This script automates the initial setup for deploying to Hetzner VPS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_info() {
    echo -e "${GREEN}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Check if running on VPS
check_vps() {
    if [ ! -f /.dockerenv ] && [ ! -d /sys/hypervisor/properties/uuid ]; then
        print_warning "This script is designed for VPS environments"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Install Docker
install_docker() {
    print_info "Checking Docker installation..."

    if command -v docker &> /dev/null; then
        print_success "Docker is already installed"
        return
    fi

    print_info "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh

    # Add user to docker group
    sudo usermod -aG docker $USER
    print_info "You may need to run 'newgrp docker' or logout/login for group changes to take effect"

    print_success "Docker installed successfully"
}

# Generate secure passwords
generate_password() {
    openssl rand -base64 32 | tr -d '\n'
}

# Setup environment file
setup_env() {
    print_info "Setting up environment configuration..."

    if [ -f ".env" ]; then
        print_warning ".env file already exists, skipping configuration"
        return
    fi

    cp .env.example .env

    # Generate secure passwords
    DB_PASSWORD=$(generate_password)
    ELECTRIC_SECRET=$(generate_password)

    # Get VPS IP or domain
    print_info "What is your VPS IP address or domain?"
    read -p "Enter IP/domain (e.g., 123.45.67.89 or electric.example.com): " VPS_ADDRESS

    if [[ $VPS_ADDRESS == *"."* ]]; then
        ELECTRIC_URL="http://${VPS_ADDRESS}:3000"
    else
        ELECTRIC_URL="https://${VPS_ADDRESS}"
    fi

    # Update .env with generated values
    sed -i.bak "s/changeme/${DB_PASSWORD}/g" .env
    sed -i.bak "s|http://localhost:3000|${ELECTRIC_URL}|g" .env
    rm -f .env.bak

    # Setup web/.env
    cp web/.env.example web/.env
    sed -i.bak "s|http://localhost:3000|${ELECTRIC_URL}|g" web/.env
    sed -i.bak "s/mysecurepassword123456789/${ELECTRIC_SECRET}/g" web/.env
    rm -f web/.env.bak

    print_success "Environment files created"
    print_info "Database password: ${DB_PASSWORD}"
    print_info "ElectricSQL secret: ${ELECTRIC_SECRET}"
    print_info "ElectricSQL URL: ${ELECTRIC_URL}"
    print_warning "Save these values securely!"
}

# Build Docker images
build_images() {
    print_info "Building Docker images (this may take a few minutes)..."
    docker compose -f docker-compose.prod.yml build --pull
    print_success "Docker images built successfully"
}

# Start services
start_services() {
    print_info "Starting services..."
    docker compose -f docker-compose.prod.yml up -d

    print_info "Waiting for services to be healthy..."
    sleep 10

    docker compose -f docker-compose.prod.yml ps

    print_success "Services started successfully"
}

# Show access info
show_info() {
    print_info "Deployment complete!"
    echo ""
    echo "Access your application:"
    echo "  Web App: http://$(hostname -I | awk '{print $1}'):5173"
    echo "  ElectricSQL: http://$(hostname -I | awk '{print $1}'):3000"
    echo ""
    echo "Useful commands:"
    echo "  View logs:     docker compose -f docker-compose.prod.yml logs -f"
    echo "  Stop services: docker compose -f docker-compose.prod.yml down"
    echo "  Restart:       docker compose -f docker-compose.prod.yml restart"
    echo ""
    echo "For more information, see DEPLOYMENT.md"
}

# Main flow
main() {
    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║  Hetzner VPS Deployment Setup Script   ║"
    echo "╚════════════════════════════════════════╝"
    echo ""

    check_vps
    install_docker
    setup_env

    read -p "Ready to build Docker images? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        build_images

        read -p "Ready to start services? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            start_services
            show_info
        fi
    else
        print_info "To build and start manually, run:"
        echo "  docker compose -f docker-compose.prod.yml build"
        echo "  docker compose -f docker-compose.prod.yml up -d"
    fi
}

# Run main function
main
