#!/bin/bash

# Metasploit Recon Interface Startup Script
# This script starts the backend API and serves the frontend

set -e

echo "Starting Metasploit Recon Interface..."

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "Warning: Running as root. Consider running as a non-privileged user."
fi

# Check if Metasploit is installed
if ! command -v msfconsole &> /dev/null; then
    echo "Error: Metasploit Framework not found. Please install Metasploit first."
    echo "Visit: https://www.metasploit.com/download"
    exit 1
fi

# Check if Python dependencies are installed
if [ ! -f "backend/requirements.txt" ]; then
    echo "Error: requirements.txt not found in backend directory"
    exit 1
fi

# Install Python dependencies if needed
if [ ! -d "backend/venv" ]; then
    echo "Creating Python virtual environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
fi

# Start backend API
echo "Starting backend API..."
cd backend
source venv/bin/activate
python app.py &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "Waiting for backend to start..."
sleep 5

# Check if backend is running
if ! curl -s http://localhost:8000/ > /dev/null; then
    echo "Error: Backend failed to start"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo "Backend API started successfully (PID: $BACKEND_PID)"

# Start simple HTTP server for frontend
echo "Starting frontend server..."
cd frontend
python3 -m http.server 3000 &
FRONTEND_PID=$!
cd ..

echo "Frontend server started successfully (PID: $FRONTEND_PID)"

# Display access information
echo ""
echo "=========================================="
echo "Metasploit Recon Interface is running!"
echo "=========================================="
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo "All services stopped."
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait
