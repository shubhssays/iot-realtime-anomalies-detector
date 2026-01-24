import { WebSocketServer } from "ws";

/**
 * WebSocket Server for Real-time Anomaly Broadcasting
 * 
 * Manages WebSocket connections and broadcasts anomaly events to all connected clients.
 */
class AnomalyWebSocketServer {
    static instance = null;

    constructor(port = 3001) {
        this.port = port;
        this.wss = null;
        this.clients = new Set();
    }

    static getInstance(port = 3001) {
        if (!AnomalyWebSocketServer.instance) {
            AnomalyWebSocketServer.instance = new AnomalyWebSocketServer(port);
        }
        return AnomalyWebSocketServer.instance;
    }

    /**
     * Start the WebSocket server
     */
    start() {
        if (this.wss) {
            console.log("⚠️ WebSocket server already running");
            return;
        }

        this.wss = new WebSocketServer({ port: this.port });

        this.wss.on("connection", (ws, req) => {
            const clientIp = req.socket.remoteAddress;
            console.log(`🔌 New WebSocket client connected: ${clientIp}`);
            this.clients.add(ws);

            // Send welcome message with connection info
            ws.send(JSON.stringify({
                type: "CONNECTION",
                message: "Connected to IoT Anomaly Alert System",
                timestamp: new Date().toISOString(),
                clientCount: this.clients.size
            }));

            // Handle incoming messages from clients
            ws.on("message", (message) => {
                try {
                    const data = JSON.parse(message);
                    if (data.type === "PING") {
                        ws.send(JSON.stringify({ type: "PONG", timestamp: new Date().toISOString() }));
                    }
                } catch (err) {
                    // Ignore invalid messages
                }
            });

            // Handle client disconnect
            ws.on("close", () => {
                console.log(`🔌 WebSocket client disconnected: ${clientIp}`);
                this.clients.delete(ws);
            });

            // Handle errors
            ws.on("error", (error) => {
                console.error(`❌ WebSocket error for client ${clientIp}:`, error.message);
                this.clients.delete(ws);
            });
        });

        // Setup heartbeat interval to keep connections alive
        this.heartbeatInterval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    this.clients.delete(ws);
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);

        this.wss.on("close", () => {
            clearInterval(this.heartbeatInterval);
        });

        console.log(`🌐 WebSocket server started on ws://localhost:${this.port}`);
    }

    /**
     * Broadcast an anomaly event to all connected clients
     * @param {Object} anomalyEvent - The anomaly event to broadcast
     */
    broadcastAnomaly(anomalyEvent) {
        const message = JSON.stringify({
            type: "ANOMALY",
            data: anomalyEvent,
            timestamp: new Date().toISOString()
        });

        let sentCount = 0;
        this.clients.forEach((client) => {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(message);
                sentCount++;
            }
        });

        if (sentCount > 0) {
            console.log(`📡 Broadcasted anomaly to ${sentCount} client(s)`);
        }
    }

    /**
     * Broadcast multiple anomalies at once
     * @param {Array} anomalyEvents - Array of anomaly events
     */
    broadcastAnomalies(anomalyEvents) {
        anomalyEvents.forEach((event) => this.broadcastAnomaly(event));
    }

    /**
     * Get the count of connected clients
     */
    getClientCount() {
        return this.clients.size;
    }

    /**
     * Stop the WebSocket server
     */
    stop() {
        if (this.wss) {
            clearInterval(this.heartbeatInterval);
            this.wss.close();
            this.wss = null;
            this.clients.clear();
            console.log("🛑 WebSocket server stopped");
        }
    }
}

// Export singleton instance getter
export const getWebSocketServer = AnomalyWebSocketServer.getInstance;
export default AnomalyWebSocketServer;
