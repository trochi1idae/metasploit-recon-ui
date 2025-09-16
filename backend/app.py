#!/usr/bin/env python3
"""
Metasploit Recon Interface - Backend API
Secure backend for managing Metasploit reconnaissance operations
"""

import os
import json
import uuid
import asyncio
import subprocess
import threading
import time
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, validator
import uvicorn

# Security and validation
security = HTTPBearer(auto_error=False)

@dataclass
class Job:
    id: str
    target: str
    profile_name: str
    tools: List[Dict[str, Any]]
    status: str  # pending, running, completed, failed
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    results: List[Dict[str, Any]] = None
    error: Optional[str] = None
    user: str = "default"

class ToolConfig(BaseModel):
    name: str
    config: Dict[str, Any] = {}

class ReconRequest(BaseModel):
    target: str
    profile_name: str = "Unnamed Scan"
    tools: List[ToolConfig]
    
    @validator('target')
    def validate_target(cls, v):
        # Basic target validation
        if not v or not v.strip():
            raise ValueError('Target cannot be empty')
        
        # Additional validation could be added here
        # (IP format, hostname format, etc.)
        return v.strip()

class JobResponse(BaseModel):
    job_id: str
    status: str
    message: str

class JobStatus(BaseModel):
    id: str
    target: str
    profile_name: str
    status: str
    created_at: str
    started_at: Optional[str]
    completed_at: Optional[str]
    error: Optional[str]
    results_count: int

class MetasploitReconBackend:
    def __init__(self):
        self.app = FastAPI(
            title="Metasploit Recon API",
            description="Secure backend for Metasploit reconnaissance operations",
            version="1.0.0"
        )
        
        # Security settings
        self.allowed_origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8080",
            "http://127.0.0.1:8080"
        ]
        
        # Job management
        self.jobs: Dict[str, Job] = {}
        self.job_lock = threading.Lock()
        
        # Metasploit configuration
        self.msf_path = os.getenv('MSF_PATH', '/opt/metasploit-framework')
        self.msf_console_path = os.path.join(self.msf_path, 'msfconsole')
        self.workspace_dir = Path('./workspace')
        self.workspace_dir.mkdir(exist_ok=True)
        
        # Security: Rate limiting and access control
        self.rate_limits = {}
        self.max_requests_per_minute = 10
        
        self.setup_middleware()
        self.setup_routes()
    
    def setup_middleware(self):
        """Configure CORS and security middleware"""
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=self.allowed_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE"],
            allow_headers=["*"],
        )
    
    def setup_routes(self):
        """Define API routes"""
        
        @self.app.get("/")
        async def root():
            return {"message": "Metasploit Recon API", "version": "1.0.0"}
        
        @self.app.post("/api/jobs", response_model=JobResponse)
        async def create_job(
            request: ReconRequest,
            background_tasks: BackgroundTasks,
            credentials: HTTPAuthorizationCredentials = Depends(security)
        ):
            """Create a new reconnaissance job"""
            
            # Security: Rate limiting
            client_ip = "127.0.0.1"  # In production, get from request
            if not self.check_rate_limit(client_ip):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded"
                )
            
            # Security: Target validation and authorization
            if not self.validate_target_authorization(request.target):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Target not authorized for scanning"
                )
            
            # Create job
            job_id = str(uuid.uuid4())
            job = Job(
                id=job_id,
                target=request.target,
                profile_name=request.profile_name,
                tools=[asdict(tool) for tool in request.tools],
                status="pending",
                created_at=datetime.utcnow().isoformat(),
                results=[]
            )
            
            with self.job_lock:
                self.jobs[job_id] = job
            
            # Start job execution in background
            background_tasks.add_task(self.execute_job, job_id)
            
            return JobResponse(
                job_id=job_id,
                status="pending",
                message="Job created successfully"
            )
        
        @self.app.get("/api/jobs/{job_id}", response_model=JobStatus)
        async def get_job_status(job_id: str):
            """Get job status and basic information"""
            with self.job_lock:
                if job_id not in self.jobs:
                    raise HTTPException(status_code=404, detail="Job not found")
                
                job = self.jobs[job_id]
                return JobStatus(
                    id=job.id,
                    target=job.target,
                    profile_name=job.profile_name,
                    status=job.status,
                    created_at=job.created_at,
                    started_at=job.started_at,
                    completed_at=job.completed_at,
                    error=job.error,
                    results_count=len(job.results) if job.results else 0
                )
        
        @self.app.get("/api/jobs/{job_id}/results")
        async def get_job_results(job_id: str):
            """Get detailed job results"""
            with self.job_lock:
                if job_id not in self.jobs:
                    raise HTTPException(status_code=404, detail="Job not found")
                
                job = self.jobs[job_id]
                return {
                    "job_id": job_id,
                    "status": job.status,
                    "results": job.results or [],
                    "error": job.error
                }
        
        @self.app.get("/api/jobs")
        async def list_jobs(limit: int = 50, offset: int = 0):
            """List all jobs with pagination"""
            with self.job_lock:
                job_list = list(self.jobs.values())
                job_list.sort(key=lambda x: x.created_at, reverse=True)
                
                start = offset
                end = offset + limit
                jobs_page = job_list[start:end]
                
                return {
                    "jobs": [
                        JobStatus(
                            id=job.id,
                            target=job.target,
                            profile_name=job.profile_name,
                            status=job.status,
                            created_at=job.created_at,
                            started_at=job.started_at,
                            completed_at=job.completed_at,
                            error=job.error,
                            results_count=len(job.results) if job.results else 0
                        ) for job in jobs_page
                    ],
                    "total": len(job_list),
                    "offset": offset,
                    "limit": limit
                }
        
        @self.app.delete("/api/jobs/{job_id}")
        async def cancel_job(job_id: str):
            """Cancel a running job"""
            with self.job_lock:
                if job_id not in self.jobs:
                    raise HTTPException(status_code=404, detail="Job not found")
                
                job = self.jobs[job_id]
                if job.status == "running":
                    job.status = "cancelled"
                    job.completed_at = datetime.utcnow().isoformat()
                    return {"message": "Job cancelled successfully"}
                else:
                    raise HTTPException(
                        status_code=400, 
                        detail="Job cannot be cancelled in current status"
                    )
        
        @self.app.get("/api/tools")
        async def list_available_tools():
            """List available reconnaissance tools"""
            return {
                "tools": [
                    {
                        "name": "ping-sweep",
                        "description": "Ping sweep to discover live hosts",
                        "category": "discovery",
                        "config_options": ["timeout", "threads"]
                    },
                    {
                        "name": "tcp-syn-scan",
                        "description": "TCP SYN port scan",
                        "category": "port_scan",
                        "config_options": ["port_range", "threads", "timeout"]
                    },
                    {
                        "name": "udp-scan",
                        "description": "UDP port scan",
                        "category": "port_scan",
                        "config_options": ["port_range", "timeout"]
                    },
                    {
                        "name": "service-version-scan",
                        "description": "Service and version detection",
                        "category": "service_scan",
                        "config_options": ["intensity", "timeout"]
                    },
                    {
                        "name": "os-fingerprint",
                        "description": "Operating system fingerprinting",
                        "category": "fingerprint",
                        "config_options": ["timeout"]
                    },
                    {
                        "name": "smb-enum",
                        "description": "SMB enumeration",
                        "category": "network_service",
                        "config_options": ["timeout", "username", "password"]
                    },
                    {
                        "name": "snmp-enum",
                        "description": "SNMP enumeration",
                        "category": "network_service",
                        "config_options": ["community_strings", "timeout"]
                    },
                    {
                        "name": "dns-enum",
                        "description": "DNS enumeration",
                        "category": "network_service",
                        "config_options": ["timeout", "threads"]
                    },
                    {
                        "name": "web-crawl",
                        "description": "Web crawling and spidering",
                        "category": "web",
                        "config_options": ["user_agent", "max_depth", "timeout"]
                    },
                    {
                        "name": "web-app-scan",
                        "description": "Web application vulnerability scanning",
                        "category": "web",
                        "config_options": ["timeout", "threads"]
                    },
                    {
                        "name": "cve-lookup",
                        "description": "CVE vulnerability lookup",
                        "category": "vulnerability",
                        "config_options": ["timeout"]
                    }
                ]
            }
    
    def check_rate_limit(self, client_ip: str) -> bool:
        """Check if client has exceeded rate limit"""
        now = time.time()
        minute_ago = now - 60
        
        if client_ip not in self.rate_limits:
            self.rate_limits[client_ip] = []
        
        # Remove old requests
        self.rate_limits[client_ip] = [
            req_time for req_time in self.rate_limits[client_ip] 
            if req_time > minute_ago
        ]
        
        # Check if limit exceeded
        if len(self.rate_limits[client_ip]) >= self.max_requests_per_minute:
            return False
        
        # Add current request
        self.rate_limits[client_ip].append(now)
        return True
    
    def validate_target_authorization(self, target: str) -> bool:
        """Validate that target is authorized for scanning"""
        # Security: Implement target whitelist/authorization
        # This is a critical security function
        
        # For demo purposes, allow localhost and private networks
        # In production, implement proper authorization logic
        allowed_patterns = [
            "127.0.0.1",
            "localhost",
            "192.168.",
            "10.",
            "172.16.",
            "172.17.",
            "172.18.",
            "172.19.",
            "172.20.",
            "172.21.",
            "172.22.",
            "172.23.",
            "172.24.",
            "172.25.",
            "172.26.",
            "172.27.",
            "172.28.",
            "172.29.",
            "172.30.",
            "172.31."
        ]
        
        return any(target.startswith(pattern) for pattern in allowed_patterns)
    
    async def execute_job(self, job_id: str):
        """Execute a reconnaissance job"""
        with self.job_lock:
            if job_id not in self.jobs:
                return
            job = self.jobs[job_id]
            job.status = "running"
            job.started_at = datetime.utcnow().isoformat()
        
        try:
            # Create job workspace
            job_dir = self.workspace_dir / job_id
            job_dir.mkdir(exist_ok=True)
            
            # Execute each tool
            for tool_config in job.tools:
                tool_name = tool_config['name']
                tool_config_dict = tool_config['config']
                
                # Execute tool (this would integrate with actual Metasploit modules)
                result = await self.execute_metasploit_tool(
                    tool_name, 
                    job.target, 
                    tool_config_dict,
                    job_dir
                )
                
                # Store result
                with self.job_lock:
                    if job.results is None:
                        job.results = []
                    job.results.append({
                        "tool": tool_name,
                        "timestamp": datetime.utcnow().isoformat(),
                        "result": result
                    })
            
            # Mark job as completed
            with self.job_lock:
                job.status = "completed"
                job.completed_at = datetime.utcnow().isoformat()
                
        except Exception as e:
            # Mark job as failed
            with self.job_lock:
                job.status = "failed"
                job.completed_at = datetime.utcnow().isoformat()
                job.error = str(e)
    
    async def execute_metasploit_tool(self, tool_name: str, target: str, config: Dict, job_dir: Path) -> Dict:
        """Execute a Metasploit auxiliary module"""
        
        # Map tool names to Metasploit modules
        module_mapping = {
            "ping-sweep": "auxiliary/scanner/discovery/udp_sweep",
            "tcp-syn-scan": "auxiliary/scanner/portscan/syn",
            "udp-scan": "auxiliary/scanner/discovery/udp_sweep",
            "service-version-scan": "auxiliary/scanner/portscan/tcp",
            "os-fingerprint": "auxiliary/scanner/portscan/tcp",
            "smb-enum": "auxiliary/scanner/smb/smb_enumshares",
            "snmp-enum": "auxiliary/scanner/snmp/snmp_enum",
            "dns-enum": "auxiliary/gather/dns_enum",
            "web-crawl": "auxiliary/scanner/http/crawl",
            "web-app-scan": "auxiliary/scanner/http/http_version",
            "cve-lookup": "auxiliary/scanner/portscan/tcp"
        }
        
        module = module_mapping.get(tool_name)
        if not module:
            return {"error": f"Unknown tool: {tool_name}"}
        
        # Create Metasploit resource file
        resource_file = job_dir / f"{tool_name}.rc"
        output_file = job_dir / f"{tool_name}_output.txt"
        
        # Generate Metasploit commands
        commands = [
            f"use {module}",
            f"set RHOSTS {target}",
            f"set THREADS {config.get('threads', 10)}",
            f"set TIMEOUT {config.get('timeout', 5)}",
            "run",
            "exit"
        ]
        
        # Write resource file
        with open(resource_file, 'w') as f:
            f.write('\n'.join(commands))
        
        # Execute Metasploit
        try:
            cmd = [
                self.msf_console_path,
                "-r", str(resource_file),
                "-o", str(output_file)
            ]
            
            # Run in subprocess (in production, use proper async subprocess)
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            # Read output
            output = ""
            if output_file.exists():
                with open(output_file, 'r') as f:
                    output = f.read()
            
            return {
                "success": result.returncode == 0,
                "output": output,
                "stderr": result.stderr,
                "return_code": result.returncode
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Tool execution timed out",
                "output": ""
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "output": ""
            }

def main():
    """Main entry point"""
    backend = MetasploitReconBackend()
    
    # Run the FastAPI application
    uvicorn.run(
        backend.app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
        access_log=True
    )

if __name__ == "__main__":
    main()
