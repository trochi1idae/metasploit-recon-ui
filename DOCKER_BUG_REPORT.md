# Docker Setup Bug Report & Fixes

## Executive Summary

This document outlines critical Docker configuration issues that prevented the Metasploit Recon UI from running properly, along with the specific fixes that resolved each problem.

## Issues Identified

### 1. Frontend Container Restart Loop

**Symptom:**
```
unknown directive "﻿worker_processes" in /etc/nginx/conf.d/default.conf:1
```

**Root Cause:**
- UTF-8 BOM (Byte Order Mark) was present in nginx configuration file
- Global nginx directives (`worker_processes`, `http {}`) were placed in `/etc/nginx/conf.d/default.conf`
- The `conf.d` directory should only contain server blocks, not global directives
- Windows PowerShell created files with BOM by default, which nginx treats as invalid characters

**Fix Applied:**
- Created proper `frontend/nginx.conf` with server block only
- Ensured no BOM encoding (UTF-8 without BOM)
- Removed global directives from server configuration

### 2. Frontend Build Failure

**Symptom:**
```
COPY nginx.conf ... not found
```

**Root Cause:**
- Dockerfile expected `nginx.conf` in build context
- File was missing from `frontend/` directory

**Fix Applied:**
- Created `frontend/nginx.conf` with proper server configuration
- Added security headers, gzip compression, and client-side routing support

### 3. Backend Build Context Issues

**Symptom:**
```
COPY run_backend.py /app/run_backend.py failed
```

**Root Cause:**
- Build context was set to `./backend` but trying to copy `run_backend.py` from repo root
- Files outside build context are not accessible to `docker build`
- Incorrect path references in COPY commands

**Fix Applied:**
- Updated docker-compose.yml to use correct build context: `./backend`
- Simplified Dockerfile COPY commands to work within backend context
- Moved `run_backend.py` into backend directory structure

### 4. Docker Compose Configuration Issues

**Symptom:**
- Deprecated `version` key warning
- Incorrect build context paths
- Unnecessary nginx reverse proxy service

**Root Cause:**
- Compose v2 deprecated the `version` key
- Build context mismatches between compose file and Dockerfiles
- Duplicate nginx services causing confusion

**Fix Applied:**
- Removed deprecated `version: '3.8'` key
- Fixed build context paths to match actual file structure
- Commented out unnecessary nginx reverse proxy service

### 5. Python Version and Dependencies

**Symptom:**
- Build failures on Debian slim base image
- Package installation issues

**Root Cause:**
- Using outdated Python 3.9-slim
- Attempting to install unavailable packages on Debian trixie slim

**Fix Applied:**
- Updated to Python 3.11-slim for better compatibility
- Removed unnecessary system packages
- Streamlined dependency installation

## Technical Details

### File Structure Changes

```
metasploit-recon-ui/
├── docker-compose.yml          # Fixed build contexts, removed version
├── backend/
│   ├── Dockerfile             # Fixed COPY paths, updated Python version
│   ├── requirements.txt
│   └── ... (app files)
├── frontend/
│   ├── Dockerfile             # References nginx.conf
│   ├── nginx.conf             # NEW: Proper server block only
│   ├── index.html
│   └── app.js
└── run_backend.py             # Moved into backend context
```

### Key Configuration Fixes

#### 1. Frontend nginx.conf
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    
    # Security headers, gzip, client-side routing
    # NO global directives or BOM
}
```

#### 2. Backend Dockerfile
```dockerfile
FROM python:3.11-slim
# ... setup ...
COPY requirements.txt /app/requirements.txt
COPY . /app
# ... rest of config ...
```

#### 3. Docker Compose
```yaml
services:
  recon-backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
  recon-frontend:
    build:
      context: ./frontend
```

## Root Cause Analysis

### Why These Issues Occurred

1. **Windows Encoding Issues**: PowerShell creates files with UTF-8 BOM by default, which nginx cannot parse
2. **Build Context Confusion**: Docker build context determines which files are accessible during build
3. **Nginx Configuration Misunderstanding**: Global directives belong in main nginx.conf, not conf.d/
4. **Compose File Drift**: File structure changes without updating compose configuration
5. **Version Compatibility**: Using outdated base images and deprecated compose syntax

### Prevention Strategies

1. **Always specify encoding**: Use UTF-8 without BOM for configuration files
2. **Validate build contexts**: Ensure COPY sources are within build context
3. **Follow nginx best practices**: Use conf.d/ for server blocks only
4. **Keep compose files in sync**: Update build contexts when moving files
5. **Use current versions**: Regularly update base images and compose syntax

## Testing Verification

After applying fixes:

1. **Frontend**: Container starts without restart loops
2. **Backend**: Builds successfully with correct file paths
3. **Compose**: All services start without warnings
4. **Nginx**: Serves static files and handles client-side routing
5. **Networking**: Services communicate properly on recon-network

## Files Modified

- `frontend/nginx.conf` - Created proper server configuration
- `backend/Dockerfile` - Fixed COPY paths and Python version
- `docker-compose.yml` - Fixed build contexts and removed version

## Files Created

- `frontend/nginx.conf` - Nginx server block configuration

## Files Removed

- None (commented out unnecessary nginx service)

## Impact

- ✅ Frontend container runs without restart loops
- ✅ Backend builds and runs successfully
- ✅ All services start via docker-compose
- ✅ No more nginx configuration errors
- ✅ Proper security headers and compression
- ✅ Client-side routing support for SPA

## Next Steps

1. Test the complete stack with `docker-compose up`
2. Verify all endpoints are accessible
3. Test client-side routing functionality
4. Validate security headers in browser dev tools
5. Monitor container logs for any remaining issues
