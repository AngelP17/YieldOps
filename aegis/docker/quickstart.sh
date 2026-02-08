#!/bin/bash
#
# Aegis Industrial Defense Platform - Quick Start Script
# One-command deployment of the complete stack
#
# Usage: ./quickstart.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║          AEGIS INDUSTRIAL DEFENSE PLATFORM                     ║"
echo "║          CrowdStrike for Physical Infrastructure               ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose are installed${NC}"

# Check if ports are available
echo -e "${BLUE}Checking port availability...${NC}"

PORTS=("1883" "3000" "5432" "9001")
for PORT in "${PORTS[@]}"; do
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}Warning: Port $PORT is already in use${NC}"
        echo "You may need to stop existing services or change ports in docker-compose.yml"
    fi
done

echo -e "${GREEN}✓ Ports checked${NC}"

# Build and start services
echo -e "${BLUE}Building and starting services...${NC}"
echo "This may take a few minutes on first run..."

docker-compose build --parallel
docker-compose up -d

# Wait for services to be ready
echo -e "${BLUE}Waiting for services to be ready...${NC}"
sleep 10

# Check service health
echo -e "${BLUE}Checking service health...${NC}"

SERVICES=("aegis-mqtt" "ghost-cnc-001" "ghost-cnc-002" "ghost-cnc-003" "ghost-cnc-004" "ghost-cnc-005" "aegis-sentinel" "aegis-dashboard")
HEALTHY=0

for SERVICE in "${SERVICES[@]}"; do
    if docker ps --format "{{.Names}}" | grep -q "^${SERVICE}$"; then
        echo -e "${GREEN}✓ $SERVICE is running${NC}"
        ((HEALTHY++))
    else
        echo -e "${RED}✗ $SERVICE is not running${NC}"
    fi
done

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ $HEALTHY -eq ${#SERVICES[@]} ]; then
    echo -e "${GREEN}All services are running!${NC}"
    echo ""
    echo -e "${CYAN}Aegis Command Center:${NC} http://localhost:3000"
    echo -e "${CYAN}MQTT Broker:${NC} localhost:1883"
    echo -e "${CYAN}TimescaleDB:${NC} localhost:5432"
    echo ""
    echo -e "${YELLOW}Default Database Credentials:${NC}"
    echo "  User: aegis"
    echo "  Password: aegis_secure_password_change_me"
    echo "  Database: aegis"
    echo ""
    echo -e "${BLUE}Useful commands:${NC}"
    echo "  View logs:        docker-compose logs -f"
    echo "  Stop services:    docker-compose down"
    echo "  Restart:          docker-compose restart"
    echo "  View simulator:   docker logs -f ghost-cnc-001"
    echo "  View sentinel:    docker logs -f aegis-sentinel"
    echo ""
    echo -e "${GREEN}The Aegis platform is ready!${NC}"
    echo -e "Open ${CYAN}http://localhost:3000${NC} in your browser to access the Command Center."
else
    echo -e "${YELLOW}Some services may still be starting up.${NC}"
    echo "Run 'docker-compose logs -f' to monitor progress."
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
