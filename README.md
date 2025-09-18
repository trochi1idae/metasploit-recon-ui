# Metasploit Recon Interface

A secure, web-based interface for managing Metasploit reconnaissance operations. This tool provides a user-friendly frontend for running various reconnaissance tools against authorized targets.

## ⚠️ Legal Notice

**ONLY USE THIS TOOL AGAINST SYSTEMS YOU OWN OR HAVE EXPLICIT WRITTEN AUTHORIZATION TO TEST.**

Unauthorized scanning is illegal and unethical. Always ensure you have proper authorization before conducting any reconnaissance activities.

## Features

### Reconnaissance Tools

#### Discovery
- **Ping Sweep**: Discover live hosts in a network range
- **ARP Scan**: ARP-based host discovery
- **Host Discovery**: Comprehensive host discovery techniques

#### Port/Service Scanning
- **TCP SYN Scan**: Fast TCP port scanning
- **UDP Scan**: UDP port scanning
- **Service/Version Scan**: Service and version detection

#### OS & Fingerprinting
- **OS Fingerprint**: Operating system detection

#### Network Services
- **SMB Enumeration**: SMB shares, users, and domain information
- **SNMP Enumeration**: SNMP system information gathering
- **DNS Enumeration**: DNS records and zone transfers
- **SMTP Enumeration**: SMTP banner and configuration checks

#### Web Reconnaissance
- **HTTP(S) Crawl**: Web crawling and spidering
- **Web App Scanner**: Automated web vulnerability scanning
- **Directory Bruteforce**: Directory and file enumeration

#### Vulnerability Assessment
- **CVE Lookup**: Vulnerability database queries
- **Auxiliary Modules**: Custom Metasploit auxiliary modules

#### Passive Reconnaissance
- **Shodan Lookup**: Public information gathering
- **crt.sh Lookup**: Certificate transparency logs

### Interface Features

- **Real-time Results**: Live console output and progress tracking
- **Job Management**: Queue, monitor, and manage scanning jobs
- **Profile System**: Save and reuse tool configurations
- **History Tracking**: View and replay previous scans
- **Export Results**: Download results in various formats
- **Security Controls**: Built-in authorization and rate limiting

## Architecture

### Frontend (React/Vanilla JS)
- Modern, responsive web interface
- Real-time updates via WebSocket/SSE
- Tool configuration panels
- Results visualization and export

### Backend (FastAPI)
- RESTful API for job management
- Metasploit integration layer
- Security and authorization controls
- Rate limiting and input validation

### Security Layer
- Target authorization whitelist
- Rate limiting and DoS protection
- Input validation and sanitization
- Comprehensive logging and monitoring
- Data encryption at rest and in transit

## Installation

### Prerequisites

- Python 3.8+
- Metasploit Framework
- Node.js 16+ (for development)
- Linux/macOS (Windows with WSL recommended)

### System Dependencies

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install python3-pip python3-venv nmap masscan
```

**CentOS/RHEL:**
```bash
sudo yum install python3-pip nmap masscan
```

**macOS:**
```bash
brew install python3 nmap masscan
```

### Quick Start

1. **Clone the repository**
```bash
git clone https://github.com/your-org/metasploit-recon-ui.git
cd metasploit-recon-ui
```

2. **Install Python dependencies**
```bash
cd backend
pip install -r requirements.txt
```

3. **Install Metasploit Framework**
```bash
# Ubuntu/Debian
curl https://raw.githubusercontent.com/rapid7/metasploit-omnibus/master/config/templates/metasploit-framework-wrappers/msfupdate.erb | sudo bash

# Or download from: https://www.metasploit.com/download
```

4. **Configure Metasploit**
```bash
# Initialize Metasploit database
msfdb init

# Start Metasploit services (in background)
msfconsole -q &
```

5. **Configure the application**
```bash
# Copy configuration template
cp backend/config.py.example backend/config.py

# Edit configuration - IMPORTANT: Update MSF_PATH
nano backend/config.py
```

6. **Initialize directories**
```bash
cd backend
python -c "from config import Config; Config.init_directories()"
```

7. **Start the backend**
```bash
cd backend
python run_backend.py
```

8. **Open the frontend**
```bash
# Open frontend/index.html in a web browser
open frontend/index.html
```

### Docker Deployment

1. **Build the Docker image**
```bash
docker build -t metasploit-recon-ui .
```

2. **Run with Docker Compose**
```bash
docker-compose up -d
```

### Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed production deployment instructions.

## Configuration

### Backend Configuration

Edit `backend/config.py`:

```python
class Config:
    # Security settings
    SECRET_KEY = "your-secret-key"
    ALLOWED_ORIGINS = ["http://localhost:3000"]
    
    # Metasploit configuration
    MSF_PATH = "/opt/metasploit-framework"
    
    # Target authorization (CRITICAL)
    ALLOWED_TARGET_PATTERNS = [
        "127.0.0.1",
        "192.168.",
        "10.",
        # Add your authorized networks
    ]
```

### Security Configuration

1. **Set up target authorization**
   - Edit `ALLOWED_TARGET_PATTERNS` in `config.py`
   - Only include networks you're authorized to scan

2. **Configure authentication**
   - Implement proper user authentication
   - Set up role-based access control

3. **Enable monitoring**
   - Configure logging and monitoring
   - Set up alerting for security events

## Usage

### Basic Workflow

1. **Enter Target**: Specify the target IP, range, or hostname
2. **Select Tools**: Choose reconnaissance tools to run
3. **Configure Options**: Set tool-specific parameters
4. **Run Scan**: Execute the reconnaissance job
5. **Monitor Progress**: Watch real-time results
6. **Review Results**: Analyze findings and export data

### Tool Configuration

Each tool has specific configuration options:

- **Port Scans**: Port ranges, thread counts, timeouts
- **Web Tools**: User agents, crawl depth, wordlists
- **Network Services**: Community strings, credentials
- **Vulnerability Scans**: CVE databases, severity filters

### Job Management

- **Queue Jobs**: Multiple jobs can be queued
- **Monitor Status**: Real-time job status updates
- **View History**: Access previous scan results
- **Export Data**: Download results in various formats

## Security Considerations

### Critical Security Requirements

1. **Authorization**: Only scan authorized targets
2. **Network Isolation**: Run on isolated network segments
3. **Access Control**: Implement strong authentication
4. **Monitoring**: Comprehensive logging and alerting
5. **Data Protection**: Encrypt sensitive data

### Security Features

- Target authorization whitelist
- Rate limiting and DoS protection
- Input validation and sanitization
- Secure data handling and encryption
- Comprehensive audit logging

See [SECURITY.md](SECURITY.md) for detailed security guidelines.

## API Reference

### Endpoints

- `POST /api/jobs` - Create a new reconnaissance job
- `GET /api/jobs/{job_id}` - Get job status
- `GET /api/jobs/{job_id}/results` - Get job results
- `GET /api/jobs` - List all jobs
- `DELETE /api/jobs/{job_id}` - Cancel a job
- `GET /api/tools` - List available tools

### Example API Usage

```python
import requests

# Create a job
response = requests.post('http://localhost:8000/api/jobs', json={
    "target": "192.168.1.0/24",
    "profile_name": "Internal Network Scan",
    "tools": [
        {"name": "ping-sweep", "config": {"timeout": 1000}},
        {"name": "tcp-syn-scan", "config": {"port_range": "1-1000"}}
    ]
})

job_id = response.json()['job_id']

# Check job status
status = requests.get(f'http://localhost:8000/api/jobs/{job_id}')
print(status.json())

# Get results
results = requests.get(f'http://localhost:8000/api/jobs/{job_id}/results')
print(results.json())
```

## Development

### Project Structure

```
metasploit-recon-ui/
├── frontend/
│   ├── index.html          # Main interface
│   ├── app.js             # Frontend logic
│   └── styles/            # CSS styles
├── backend/
│   ├── app.py             # FastAPI application
│   ├── config.py          # Configuration
│   ├── requirements.txt   # Python dependencies
│   └── modules/           # Metasploit integration
├── docs/                  # Documentation
├── tests/                 # Test suite
└── docker/               # Docker configuration
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Testing

```bash
# Run backend tests
cd backend
python -m pytest tests/

# Run frontend tests
cd frontend
npm test
```

## Troubleshooting

### Common Issues

1. **Metasploit not found**
   - Ensure Metasploit is installed and in PATH
   - Check MSF_PATH configuration in config.py
   - Try: `which msfconsole` to find installation path
   - Common paths: `/opt/metasploit-framework`, `/usr/share/metasploit-framework`

2. **Permission denied**
   - Run with appropriate user permissions
   - Check file system permissions
   - Ensure workspace and logs directories are writable

3. **Target not authorized**
   - Verify target is in ALLOWED_TARGET_PATTERNS
   - Check authorization configuration in config.py

4. **Job fails to start**
   - Check Metasploit database connection: `msfdb status`
   - Verify module availability
   - Review error logs

5. **Import errors on startup**
   - Ensure you're running from the backend directory
   - Use `python run_backend.py` not `python app.py`
   - Check that all dependencies are installed

6. **Directory not found errors**
   - Run the directory initialization command:
   - `python -c "from config import Config; Config.init_directories()"`

7. **System dependencies missing**
   - Install nmap, masscan, and other required tools
   - Check that tools are in PATH: `which nmap`

### Logs

- Backend logs: `logs/api/`
- Job logs: `logs/jobs/`
- Metasploit logs: `workspace/jobs/{job_id}/`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/your-org/metasploit-recon-ui/issues)
- Security: security@yourcompany.com

## Disclaimer

This tool is for authorized security testing only. Users are responsible for ensuring they have proper authorization before conducting any reconnaissance activities. The authors are not responsible for any misuse of this tool.

---

**Remember: Only scan systems you own or have explicit written authorization to test.**
