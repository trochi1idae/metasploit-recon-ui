// Metasploit Recon Interface - Frontend JavaScript
class ReconInterface {
    constructor() {
        this.currentJob = null;
        this.jobHistory = JSON.parse(localStorage.getItem('reconJobHistory') || '[]');
        this.profiles = JSON.parse(localStorage.getItem('reconProfiles') || '{}');
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadHistory();
        this.setupToolConfigs();
    }

    bindEvents() {
        // Target validation
        document.getElementById('targetInput').addEventListener('input', (e) => {
            this.validateTarget(e.target.value);
        });

        // Tool selection with config panels
        document.querySelectorAll('input[type="checkbox"][data-tool]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.toggleToolConfig(e.target);
            });
        });

        // Action buttons
        document.getElementById('runSelectedBtn').addEventListener('click', () => {
            this.runSelectedTools();
        });

        document.getElementById('saveProfileBtn').addEventListener('click', () => {
            this.saveProfile();
        });

        document.getElementById('scheduleBtn').addEventListener('click', () => {
            this.scheduleJob();
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearAll();
        });

        document.getElementById('clearResultsBtn').addEventListener('click', () => {
            this.clearResults();
        });

        document.getElementById('downloadResultsBtn').addEventListener('click', () => {
            this.downloadResults();
        });
    }

    validateTarget(target) {
        const validationDiv = document.getElementById('targetValidation');
        
        if (!target.trim()) {
            validationDiv.innerHTML = '';
            return;
        }

        // Basic validation patterns
        const patterns = {
            ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
            ipv4Cidr: /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/,
            ipv6: /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
            hostname: /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/,
            fqdn: /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/
        };

        let isValid = false;
        let resolvedInfo = '';

        if (patterns.ipv4.test(target) || patterns.ipv4Cidr.test(target)) {
            isValid = true;
            resolvedInfo = `IPv4 target: ${target}`;
        } else if (patterns.ipv6.test(target)) {
            isValid = true;
            resolvedInfo = `IPv6 target: ${target}`;
        } else if (patterns.hostname.test(target) || patterns.fqdn.test(target)) {
            isValid = true;
            resolvedInfo = `Hostname: ${target}`;
            // In a real implementation, you'd do DNS resolution here
        }

        if (isValid) {
            validationDiv.innerHTML = `<span class="validation-success"><i class="fas fa-check"></i> ${resolvedInfo}</span>`;
        } else {
            validationDiv.innerHTML = `<span class="validation-error"><i class="fas fa-times"></i> Invalid target format</span>`;
        }
    }

    toggleToolConfig(checkbox) {
        const toolId = checkbox.id;
        const configDiv = document.getElementById(`${toolId}-config`);
        
        if (configDiv) {
            configDiv.style.display = checkbox.checked ? 'block' : 'none';
        }
    }

    setupToolConfigs() {
        // Initialize tool configurations
        document.querySelectorAll('input[type="checkbox"][data-tool]').forEach(checkbox => {
            if (checkbox.checked) {
                this.toggleToolConfig(checkbox);
            }
        });
    }

    async runSelectedTools() {
        const target = document.getElementById('targetInput').value.trim();
        const profileName = document.getElementById('profileName').value.trim();
        
        if (!target) {
            alert('Please enter a target');
            return;
        }

        const selectedTools = this.getSelectedTools();
        if (selectedTools.length === 0) {
            alert('Please select at least one tool');
            return;
        }

        // Create job
        const job = {
            id: Date.now().toString(),
            target: target,
            profileName: profileName || 'Unnamed Scan',
            tools: selectedTools,
            status: 'running',
            startTime: new Date().toISOString(),
            results: []
        };

        this.currentJob = job;
        this.updateResultsPane('Starting reconnaissance job...\n');
        this.updateJobStatus('running');

        try {
            // Simulate running tools (in real implementation, this would call the backend API)
            await this.simulateToolExecution(selectedTools, target);
            
            job.status = 'completed';
            job.endTime = new Date().toISOString();
            this.updateJobStatus('completed');
            this.updateResultsPane('\n\n=== Job Completed ===\n');
            
        } catch (error) {
            job.status = 'failed';
            job.endTime = new Date().toISOString();
            job.error = error.message;
            this.updateJobStatus('failed');
            this.updateResultsPane(`\n\n=== Job Failed: ${error.message} ===\n`);
        }

        // Save to history
        this.jobHistory.unshift(job);
        this.saveHistory();
        this.loadHistory();
    }

    getSelectedTools() {
        const selectedTools = [];
        document.querySelectorAll('input[type="checkbox"][data-tool]:checked').forEach(checkbox => {
            const tool = {
                name: checkbox.dataset.tool,
                config: this.getToolConfig(checkbox.id)
            };
            selectedTools.push(tool);
        });
        return selectedTools;
    }

    getToolConfig(toolId) {
        const configDiv = document.getElementById(`${toolId}-config`);
        if (!configDiv || configDiv.style.display === 'none') {
            return {};
        }

        const config = {};
        configDiv.querySelectorAll('input, select').forEach(input => {
            if (input.type === 'number') {
                config[input.previousElementSibling.textContent.toLowerCase().replace(/[^a-z0-9]/g, '')] = parseInt(input.value);
            } else if (input.type === 'password') {
                config[input.previousElementSibling.textContent.toLowerCase().replace(/[^a-z0-9]/g, '')] = input.value;
            } else {
                config[input.previousElementSibling.textContent.toLowerCase().replace(/[^a-z0-9]/g, '')] = input.value;
            }
        });
        return config;
    }

    async simulateToolExecution(tools, target) {
        for (const tool of tools) {
            this.updateResultsPane(`\n[${new Date().toLocaleTimeString()}] Running ${tool.name} against ${target}...\n`);
            
            // Simulate tool execution time
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
            
            // Simulate results based on tool type
            const results = this.generateMockResults(tool.name, target);
            this.updateResultsPane(results);
            
            // Update summary cards
            this.updateSummaryCards(tool.name, results);
        }
    }

    generateMockResults(toolName, target) {
        const mockResults = {
            'ping-sweep': `PING ${target}: 56 data bytes
64 bytes from ${target}: icmp_seq=0 ttl=64 time=0.123 ms
64 bytes from ${target}: icmp_seq=1 ttl=64 time=0.098 ms
--- ${target} ping statistics ---
2 packets transmitted, 2 received, 0% packet loss
round-trip min/avg/max/stddev = 0.098/0.111/0.123/0.013 ms\n`,
            'tcp-syn-scan': `Starting Nmap 7.92 ( https://nmap.org ) at 2024-01-15 10:30:00 EST
Nmap scan report for ${target}
Host is up (0.001s latency).
Not shown: 997 closed ports
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
443/tcp  open  https
8080/tcp open  http-proxy

Nmap done: 1 IP address (1 host up) scanned in 2.34 seconds\n`,
            'service-version-scan': `PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.5 (Ubuntu Linux; protocol 2.0)
80/tcp   open  http    Apache httpd 2.4.41 ((Ubuntu))
443/tcp  open  ssl/http Apache httpd 2.4.41 ((Ubuntu))
8080/tcp open  http    Apache httpd 2.4.41 ((Ubuntu))\n`,
            'web-crawl': `Crawling http://${target}/
Found: /index.html (200 OK)
Found: /admin/ (403 Forbidden)
Found: /login.php (200 OK)
Found: /robots.txt (200 OK)
Found: /sitemap.xml (200 OK)
Crawled 5 pages in 1.2 seconds\n`,
            'smb-enum': `SMB Enumeration Results for ${target}:
[+] ${target}:445 - SMB version: SMB 2.1
[+] ${target}:445 - Domain: WORKGROUP
[+] ${target}:445 - OS: Windows 10 Pro 19042
[+] ${target}:445 - Shares: ADMIN$, C$, IPC$, Users\n`,
            'dns-enum': `DNS Enumeration for ${target}:
[+] A record: ${target} -> 192.168.1.100
[+] MX record: mail.${target} -> 192.168.1.101
[+] TXT record: v=spf1 include:_spf.google.com ~all
[+] NS record: ns1.${target} -> 192.168.1.102\n`
        };

        return mockResults[toolName] || `Tool ${toolName} completed successfully\n`;
    }

    updateResultsPane(text) {
        const resultsPane = document.getElementById('resultsPane');
        resultsPane.innerHTML += `<div>${text}</div>`;
        resultsPane.scrollTop = resultsPane.scrollHeight;
    }

    updateJobStatus(status) {
        const runBtn = document.getElementById('runSelectedBtn');
        const statusText = {
            'running': '<i class="fas fa-spinner fa-spin"></i> Running...',
            'completed': '<i class="fas fa-check"></i> Run Selected Tools',
            'failed': '<i class="fas fa-times"></i> Run Selected Tools'
        };
        runBtn.innerHTML = statusText[status] || statusText['completed'];
        runBtn.disabled = status === 'running';
    }

    updateSummaryCards(toolName, results) {
        const summaryCards = document.getElementById('summaryCards');
        
        // Parse results for summary cards (simplified)
        if (results.includes('open') && results.includes('tcp')) {
            const openPorts = results.match(/(\d+\/tcp\s+open)/g) || [];
            if (openPorts.length > 0) {
                this.addSummaryCard('Open Ports', openPorts.length, 'fas fa-network-wired', 'primary');
            }
        }
        
        if (results.includes('Found:') && results.includes('200 OK')) {
            const foundPages = results.match(/Found: [^(]+ \(200 OK\)/g) || [];
            if (foundPages.length > 0) {
                this.addSummaryCard('Web Pages', foundPages.length, 'fas fa-globe', 'success');
            }
        }
    }

    addSummaryCard(title, count, icon, color) {
        const summaryCards = document.getElementById('summaryCards');
        const cardId = `card-${title.toLowerCase().replace(/\s+/g, '-')}`;
        
        // Check if card already exists
        if (document.getElementById(cardId)) {
            const countElement = document.querySelector(`#${cardId} .card-text`);
            countElement.textContent = count;
            return;
        }

        const card = document.createElement('div');
        card.className = 'col-md-3 mb-3';
        card.id = cardId;
        card.innerHTML = `
            <div class="card border-${color}">
                <div class="card-body text-center">
                    <i class="${icon} fa-2x text-${color} mb-2"></i>
                    <h6 class="card-title">${title}</h6>
                    <p class="card-text">${count}</p>
                </div>
            </div>
        `;
        summaryCards.appendChild(card);
    }

    saveProfile() {
        const profileName = document.getElementById('profileName').value.trim();
        if (!profileName) {
            alert('Please enter a profile name');
            return;
        }

        const selectedTools = this.getSelectedTools();
        this.profiles[profileName] = {
            tools: selectedTools,
            createdAt: new Date().toISOString()
        };

        localStorage.setItem('reconProfiles', JSON.stringify(this.profiles));
        alert(`Profile "${profileName}" saved successfully`);
    }

    scheduleJob() {
        alert('Scheduling feature not implemented in this demo');
    }

    clearAll() {
        if (confirm('Are you sure you want to clear all selections?')) {
            document.getElementById('targetInput').value = '';
            document.getElementById('profileName').value = '';
            document.getElementById('targetValidation').innerHTML = '';
            
            document.querySelectorAll('input[type="checkbox"][data-tool]').forEach(checkbox => {
                checkbox.checked = false;
                this.toggleToolConfig(checkbox);
            });
            
            this.clearResults();
        }
    }

    clearResults() {
        document.getElementById('resultsPane').innerHTML = '<div class="text-muted">Ready to run reconnaissance tools...</div>';
        document.getElementById('summaryCards').innerHTML = '';
    }

    downloadResults() {
        if (!this.currentJob) {
            alert('No results to download');
            return;
        }

        const results = document.getElementById('resultsPane').textContent;
        const blob = new Blob([results], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recon-results-${this.currentJob.id}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    loadHistory() {
        const historyPanel = document.getElementById('historyPanel');
        
        if (this.jobHistory.length === 0) {
            historyPanel.innerHTML = '<div class="text-muted p-3 text-center">No previous jobs</div>';
            return;
        }

        historyPanel.innerHTML = this.jobHistory.map(job => `
            <div class="history-item" onclick="reconInterface.viewJob('${job.id}')">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${job.profileName}</strong><br>
                        <small class="text-muted">${job.target} • ${new Date(job.startTime).toLocaleString()}</small>
                    </div>
                    <div>
                        <span class="badge bg-${job.status === 'completed' ? 'success' : job.status === 'failed' ? 'danger' : 'warning'}">
                            ${job.status}
                        </span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    viewJob(jobId) {
        const job = this.jobHistory.find(j => j.id === jobId);
        if (job) {
            // Load job details into the interface
            document.getElementById('targetInput').value = job.target;
            document.getElementById('profileName').value = job.profileName;
            
            // Clear current selections
            document.querySelectorAll('input[type="checkbox"][data-tool]').forEach(checkbox => {
                checkbox.checked = false;
                this.toggleToolConfig(checkbox);
            });
            
            // Select tools from job
            job.tools.forEach(tool => {
                const checkbox = document.querySelector(`input[data-tool="${tool.name}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                    this.toggleToolConfig(checkbox);
                }
            });
            
            alert(`Loaded job: ${job.profileName}`);
        }
    }

    saveHistory() {
        localStorage.setItem('reconJobHistory', JSON.stringify(this.jobHistory));
    }
}

// Initialize the application
const reconInterface = new ReconInterface();
