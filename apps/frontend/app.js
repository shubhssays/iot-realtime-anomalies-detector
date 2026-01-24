/**
 * IoT Anomaly Alerts - Frontend Application
 * Real-time WebSocket client for anomaly notifications
 */

class AnomalyDashboard {
    constructor() {
        // Configuration
        this.wsUrl = 'ws://localhost:3001';
        this.maxAlerts = 100;
        this.reconnectDelay = 3000;
        this.soundEnabled = true;

        // State
        this.ws = null;
        this.alerts = [];
        this.stats = {
            total: 0,
            critical: 0,
            high: 0,
            medium: 0
        };

        // DOM Elements
        this.elements = {
            connectionStatus: document.getElementById('connectionStatus'),
            soundToggle: document.getElementById('soundToggle'),
            clearAlerts: document.getElementById('clearAlerts'),
            alertsList: document.getElementById('alertsList'),
            emptyState: document.getElementById('emptyState'),
            totalCount: document.getElementById('totalCount'),
            criticalCount: document.getElementById('criticalCount'),
            highCount: document.getElementById('highCount'),
            mediumCount: document.getElementById('mediumCount'),
            alertBadge: document.getElementById('alertBadge')
        };

        this.init();
    }

    init() {
        this.bindEvents();
        this.connect();
        this.loadSoundPreference();
    }

    bindEvents() {
        // Sound toggle
        this.elements.soundToggle.addEventListener('click', () => {
            this.soundEnabled = !this.soundEnabled;
            this.elements.soundToggle.classList.toggle('muted', !this.soundEnabled);
            this.elements.soundToggle.textContent = this.soundEnabled ? '🔔' : '🔕';
            localStorage.setItem('soundEnabled', this.soundEnabled);
        });

        // Clear alerts
        this.elements.clearAlerts.addEventListener('click', () => {
            this.clearAllAlerts();
        });
    }

    loadSoundPreference() {
        const saved = localStorage.getItem('soundEnabled');
        if (saved !== null) {
            this.soundEnabled = saved === 'true';
            this.elements.soundToggle.classList.toggle('muted', !this.soundEnabled);
            this.elements.soundToggle.textContent = this.soundEnabled ? '🔔' : '🔕';
        }
    }

    // ===== WebSocket Connection =====

    connect() {
        this.updateConnectionStatus('connecting');

        try {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                this.updateConnectionStatus('connected');
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.ws.onclose = () => {
                console.log('❌ WebSocket disconnected');
                this.updateConnectionStatus('disconnected');
                this.scheduleReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('disconnected');
            };
        } catch (error) {
            console.error('Failed to connect:', error);
            this.updateConnectionStatus('disconnected');
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        console.log(`🔄 Reconnecting in ${this.reconnectDelay / 1000}s...`);
        setTimeout(() => this.connect(), this.reconnectDelay);
    }

    updateConnectionStatus(status) {
        const statusEl = this.elements.connectionStatus;
        const textEl = statusEl.querySelector('.status-text');

        statusEl.className = 'connection-status';

        switch (status) {
            case 'connected':
                statusEl.classList.add('connected');
                textEl.textContent = 'Connected';
                break;
            case 'disconnected':
                statusEl.classList.add('disconnected');
                textEl.textContent = 'Disconnected';
                break;
            default:
                textEl.textContent = 'Connecting...';
        }
    }

    // ===== Message Handling =====

    handleMessage(data) {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'CONNECTION':
                    console.log('📡 Server message:', message.message);
                    break;
                case 'ANOMALY':
                    this.addAlert(message.data, message.timestamp);
                    break;
                case 'PONG':
                    // Heartbeat response
                    break;
                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    }

    // ===== Alert Management =====

    addAlert(alertData, timestamp) {
        const alert = {
            id: Date.now() + Math.random(),
            ...alertData,
            receivedAt: timestamp || new Date().toISOString()
        };

        // Add to beginning of array
        this.alerts.unshift(alert);

        // Limit alerts
        if (this.alerts.length > this.maxAlerts) {
            this.alerts.pop();
        }

        // Update stats
        this.updateStats(alert.severity, 1);

        // Render alert
        this.renderAlert(alert);

        // Hide empty state
        this.elements.emptyState.classList.add('hidden');

        // Play sound
        if (this.soundEnabled) {
            this.playAlertSound(alert.severity);
        }
    }

    renderAlert(alert) {
        const alertEl = document.createElement('div');
        alertEl.className = 'alert-item new';
        alertEl.dataset.id = alert.id;

        const icon = this.getAlertIcon(alert.type);
        const severityLower = (alert.severity || 'medium').toLowerCase();

        const details = this.buildAlertDetails(alert);
        const timeStr = this.formatTime(alert.receivedAt);

        alertEl.innerHTML = `
      <div class="severity-indicator ${severityLower}">
        ${icon}
      </div>
      <div class="alert-content">
        <div class="alert-header">
          <span class="alert-type">${this.formatType(alert.type)}</span>
          <span class="alert-severity ${severityLower}">${alert.severity}</span>
        </div>
        <div class="alert-asset">Asset: ${alert.asset_id || 'Unknown'}</div>
        <div class="alert-details">
          ${details}
        </div>
      </div>
      <div class="alert-timestamp">
        ${timeStr}
      </div>
    `;

        // Insert at top
        this.elements.alertsList.prepend(alertEl);

        // Remove animation class after animation completes
        setTimeout(() => {
            alertEl.classList.remove('new');
        }, 2000);
    }

    buildAlertDetails(alert) {
        const details = [];

        if (alert.current_temperature !== null && alert.current_temperature !== undefined) {
            details.push(`
        <span class="alert-detail">
          <span class="alert-detail-icon">🌡️</span>
          ${alert.current_temperature.toFixed(1)}°C
        </span>
      `);
        }

        if (alert.baseline_temperature !== null && alert.baseline_temperature !== undefined) {
            details.push(`
        <span class="alert-detail">
          <span class="alert-detail-icon">📊</span>
          Baseline: ${alert.baseline_temperature.toFixed(1)}°C
        </span>
      `);
        }

        if (alert.distance_from_route_km !== null && alert.distance_from_route_km !== undefined) {
            details.push(`
        <span class="alert-detail">
          <span class="alert-detail-icon">📍</span>
          ${alert.distance_from_route_km.toFixed(2)} km off route
        </span>
      `);
        }

        if (alert.lat !== null && alert.lon !== null && alert.lat !== undefined) {
            details.push(`
        <span class="alert-detail">
          <span class="alert-detail-icon">🗺️</span>
          ${alert.lat.toFixed(4)}, ${alert.lon.toFixed(4)}
        </span>
      `);
        }

        return details.join('');
    }

    getAlertIcon(type) {
        const icons = {
            'TEMPERATURE': '🌡️',
            'ROUTE_DEVIATION': '🚨',
            'SPEED': '⚡',
            'BATTERY': '🔋',
            'SIGNAL': '📶'
        };
        return icons[type] || '⚠️';
    }

    formatType(type) {
        if (!type) return 'Unknown';
        return type.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    }

    formatTime(isoString) {
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    updateStats(severity, delta) {
        this.stats.total += delta;

        const severityLower = (severity || 'medium').toLowerCase();
        if (this.stats[severityLower] !== undefined) {
            this.stats[severityLower] += delta;
        }

        // Update DOM
        this.elements.totalCount.textContent = this.stats.total;
        this.elements.criticalCount.textContent = this.stats.critical;
        this.elements.highCount.textContent = this.stats.high;
        this.elements.mediumCount.textContent = this.stats.medium;
    }

    clearAllAlerts() {
        this.alerts = [];
        this.stats = { total: 0, critical: 0, high: 0, medium: 0 };

        this.elements.alertsList.innerHTML = '';
        this.elements.emptyState.classList.remove('hidden');

        this.elements.totalCount.textContent = '0';
        this.elements.criticalCount.textContent = '0';
        this.elements.highCount.textContent = '0';
        this.elements.mediumCount.textContent = '0';
    }

    playAlertSound(severity) {
        // Create a simple beep using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Different frequencies for different severities
            const frequencies = {
                'CRITICAL': 880,
                'HIGH': 660,
                'MEDIUM': 440
            };

            oscillator.frequency.value = frequencies[severity] || 440;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            // Audio not supported or blocked
        }
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AnomalyDashboard();
});
