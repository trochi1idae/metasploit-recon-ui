FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg2 \
    software-properties-common \
    && rm -rf /var/lib/apt/lists/*

# Install Metasploit Framework
RUN curl https://raw.githubusercontent.com/rapid7/metasploit-omnibus/master/config/templates/metasploit-framework-wrappers/msfupdate.erb | bash

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -r -s /bin/false recon-user && \
    chown -R recon-user:recon-user /app

# Create necessary directories
RUN mkdir -p /app/workspace /app/logs && \
    chown -R recon-user:recon-user /app/workspace /app/logs

# Switch to non-root user
USER recon-user

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

# Run the application
CMD ["python", "app.py"]
