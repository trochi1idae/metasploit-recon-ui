# Security and Hardening Guide

## Overview

This document outlines security considerations and hardening measures for the Metasploit Recon Interface. **This tool should only be used against systems you own or have explicit written authorization to test.**

## Critical Security Requirements

### 1. Authorization and Legal Compliance

- **Written Authorization Required**: Only scan systems you own or have explicit written permission to test
- **Legal Review**: Have legal counsel review your scanning activities
- **Documentation**: Maintain records of all authorized scanning activities
- **Scope Definition**: Clearly define what systems and networks are in scope

### 2. Network Security

#### Firewall Configuration
```bash
# Example iptables rules for the recon server
# Allow only necessary ports
iptables -A INPUT -p tcp --dport 8000 -j ACCEPT  # API port
iptables -A INPUT -p tcp --dport 3000 -j ACCEPT  # Frontend port
iptables -A INPUT -j DROP  # Deny all other traffic
```

#### Network Isolation
- Run the recon interface on a dedicated, isolated network segment
- Use VPN access for remote users
- Implement network segmentation to prevent lateral movement
- Monitor all network traffic to/from the recon server

### 3. Application Security

#### Authentication and Authorization
```python
# Implement proper authentication
from fastapi_users import FastAPIUsers
from fastapi_users.authentication import JWTAuthentication

# JWT token configuration
SECRET_KEY = "your-very-secure-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# User roles and permissions
class UserRole(Enum):
    ADMIN = "admin"
    ANALYST = "analyst"
    READONLY = "readonly"

# Permission-based access control
def require_permission(permission: str):
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Check user permissions
            if not current_user.has_permission(permission):
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            return await func(*args, **kwargs)
        return wrapper
    return decorator
```

#### Input Validation and Sanitization
```python
# Strict input validation
from pydantic import BaseModel, validator, Field
import re

class TargetInput(BaseModel):
    target: str = Field(..., min_length=1, max_length=255)
    
    @validator('target')
    def validate_target_format(cls, v):
        # Only allow specific target formats
        ipv4_pattern = r'^(\d{1,3}\.){3}\d{1,3}(/\d{1,2})?$'
        hostname_pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$'
        
        if not (re.match(ipv4_pattern, v) or re.match(hostname_pattern, v)):
            raise ValueError('Invalid target format')
        return v
```

#### Rate Limiting and DoS Protection
```python
# Implement rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post("/api/jobs")
@limiter.limit("5/minute")  # 5 requests per minute per IP
async def create_job(request: Request, ...):
    # Job creation logic
```

### 4. Data Protection

#### Encryption at Rest
```python
# Encrypt sensitive data
from cryptography.fernet import Fernet
import base64

class DataEncryption:
    def __init__(self, key: bytes):
        self.cipher = Fernet(key)
    
    def encrypt(self, data: str) -> str:
        return self.cipher.encrypt(data.encode()).decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        return self.cipher.decrypt(encrypted_data.encode()).decode()

# Use for storing sensitive job data
encryption = DataEncryption(os.getenv('ENCRYPTION_KEY').encode())
```

#### Secure Data Handling
- Encrypt all job results and logs
- Implement data retention policies
- Secure deletion of sensitive data
- Audit data access and modifications

### 5. System Hardening

#### Operating System Security
```bash
# Disable unnecessary services
systemctl disable bluetooth
systemctl disable cups
systemctl disable avahi-daemon

# Configure automatic security updates
apt install unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Set up log monitoring
apt install fail2ban
systemctl enable fail2ban
```

#### File System Security
```bash
# Set proper permissions
chmod 700 /opt/metasploit-recon-ui/
chmod 600 /opt/metasploit-recon-ui/backend/config.py
chmod 600 /opt/metasploit-recon-ui/backend/.env

# Use separate user for the application
useradd -r -s /bin/false recon-user
chown -R recon-user:recon-user /opt/metasploit-recon-ui/
```

#### Process Isolation
```python
# Run Metasploit in isolated environment
import subprocess
import os
import pwd

def run_metasploit_isolated(command, target, config):
    # Create isolated environment
    env = os.environ.copy()
    env['MSF_DATABASE_CONFIG'] = '/opt/metasploit-recon-ui/isolated/database.yml'
    
    # Run as unprivileged user
    try:
        # Switch to unprivileged user
        recon_uid = pwd.getpwnam('recon-user').pw_uid
        recon_gid = pwd.getpwnam('recon-user').pw_gid
        
        # Use subprocess with user switching
        result = subprocess.run(
            command,
            user=recon_uid,
            group=recon_gid,
            env=env,
            capture_output=True,
            timeout=300
        )
        return result
    except Exception as e:
        return {"error": str(e)}
```

### 6. Monitoring and Logging

#### Comprehensive Logging
```python
import logging
from logging.handlers import RotatingFileHandler
import json
from datetime import datetime

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler('logs/recon_api.log', maxBytes=10*1024*1024, backupCount=5),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Log all security-relevant events
def log_security_event(event_type: str, details: dict):
    logger.warning(json.dumps({
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": event_type,
        "details": details
    }))
```

#### Security Monitoring
```python
# Monitor for suspicious activities
class SecurityMonitor:
    def __init__(self):
        self.failed_attempts = {}
        self.suspicious_patterns = []
    
    def check_suspicious_activity(self, ip: str, request_data: dict):
        # Check for rapid-fire requests
        if self.is_rapid_fire(ip):
            self.log_security_event("rapid_fire_requests", {"ip": ip})
            return True
        
        # Check for unusual target patterns
        if self.is_suspicious_target(request_data.get('target', '')):
            self.log_security_event("suspicious_target", {"ip": ip, "target": request_data['target']})
            return True
        
        return False
```

### 7. Backup and Recovery

#### Secure Backup Strategy
```bash
#!/bin/bash
# backup_recon_data.sh

# Create encrypted backup
BACKUP_DIR="/opt/backups/recon-$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# Backup job data
tar -czf "$BACKUP_DIR/jobs.tar.gz" /opt/metasploit-recon-ui/workspace/jobs/

# Encrypt backup
gpg --symmetric --cipher-algo AES256 "$BACKUP_DIR/jobs.tar.gz"

# Remove unencrypted backup
rm "$BACKUP_DIR/jobs.tar.gz"

# Upload to secure storage (example with S3)
aws s3 cp "$BACKUP_DIR/jobs.tar.gz.gpg" s3://your-secure-backup-bucket/
```

### 8. Incident Response

#### Security Incident Response Plan
1. **Detection**: Automated monitoring alerts
2. **Assessment**: Determine scope and impact
3. **Containment**: Isolate affected systems
4. **Eradication**: Remove threats and vulnerabilities
5. **Recovery**: Restore normal operations
6. **Lessons Learned**: Update security measures

#### Emergency Procedures
```python
# Emergency shutdown function
def emergency_shutdown():
    """Immediately stop all scanning activities"""
    # Cancel all running jobs
    for job_id, job in active_jobs.items():
        if job.status == "running":
            cancel_job(job_id)
    
    # Log emergency shutdown
    log_security_event("emergency_shutdown", {
        "timestamp": datetime.utcnow().isoformat(),
        "reason": "Security incident detected"
    })
    
    # Notify administrators
    send_alert("EMERGENCY: Recon interface shutdown due to security incident")
```

## Deployment Security Checklist

- [ ] All systems have written authorization for scanning
- [ ] Network isolation implemented
- [ ] Strong authentication and authorization in place
- [ ] Input validation and sanitization configured
- [ ] Rate limiting and DoS protection enabled
- [ ] Data encryption at rest and in transit
- [ ] Comprehensive logging and monitoring
- [ ] Regular security updates applied
- [ ] Backup and recovery procedures tested
- [ ] Incident response plan documented
- [ ] Security training completed for all users
- [ ] Regular security assessments scheduled

## Legal and Compliance Notes

- Ensure compliance with local laws regarding network scanning
- Maintain audit trails for all scanning activities
- Implement data retention policies per legal requirements
- Regular legal review of scanning procedures
- Clear documentation of authorized scanning scope

## Contact Information

For security concerns or incidents:
- Security Team: security@yourcompany.com
- Emergency: +1-XXX-XXX-XXXX
- Incident Response: incident@yourcompany.com

---

**Remember: This tool is for authorized security testing only. Unauthorized scanning is illegal and unethical.**
