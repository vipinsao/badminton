/**
 * Smasher Badminton Club - WebSocket Server
 * Enables multi-device control over local WiFi network
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const os = require('os');

// Configuration
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, '..');

// MIME types for static file serving
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

// Current game state (authoritative)
let currentState = null;

// Connected clients
const clients = new Set();

// Get local IP addresses
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }
    return ips;
}

// Create HTTP server for static files
const httpServer = http.createServer((req, res) => {
    // Handle CORS for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Parse URL
    let filePath = req.url === '/' ? '/index.html' : req.url;

    // Security: prevent directory traversal
    filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');

    // Get full path
    const fullPath = path.join(ROOT_DIR, filePath);

    // Check if file exists
    fs.stat(fullPath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }

        // Get MIME type
        const ext = path.extname(fullPath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

        // Serve file
        res.writeHead(200, { 'Content-Type': mimeType });
        fs.createReadStream(fullPath).pipe(res);
    });
});

// Create WebSocket server
const wss = new WebSocketServer({ server: httpServer });

// Broadcast message to all clients except sender
function broadcast(message, excludeClient = null) {
    const data = JSON.stringify(message);
    for (const client of clients) {
        if (client !== excludeClient && client.readyState === 1) {
            client.send(data);
        }
    }
}

// Handle new WebSocket connection
wss.on('connection', (ws, req) => {
    const clientIP = req.socket.remoteAddress;
    console.log(`Client connected: ${clientIP}`);
    clients.add(ws);

    // Send current state to new client
    if (currentState) {
        ws.send(JSON.stringify({
            type: 'STATE_SYNC',
            state: currentState,
            timestamp: Date.now()
        }));
    }

    // Send connection info
    ws.send(JSON.stringify({
        type: 'CONNECTION_INFO',
        clientId: Math.random().toString(36).substr(2, 9),
        serverTime: Date.now(),
        clientCount: clients.size
    }));

    // Notify other clients of new connection
    broadcast({
        type: 'CLIENT_CONNECTED',
        clientCount: clients.size
    }, ws);

    // Handle messages from client
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());

            switch (message.type) {
                case 'STATE_UPDATE':
                    // Update authoritative state
                    currentState = message.state;

                    // Broadcast to all other clients
                    broadcast({
                        type: 'STATE_BROADCAST',
                        state: message.state,
                        action: message.action,
                        timestamp: Date.now()
                    }, ws);
                    break;

                case 'SYNC_REQUEST':
                    // Client requesting current state
                    if (currentState) {
                        ws.send(JSON.stringify({
                            type: 'STATE_SYNC',
                            state: currentState,
                            timestamp: Date.now()
                        }));
                    }
                    break;

                case 'PING':
                    // Respond to ping
                    ws.send(JSON.stringify({
                        type: 'PONG',
                        timestamp: Date.now()
                    }));
                    break;

                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (err) {
            console.error('Error parsing message:', err);
        }
    });

    // Handle client disconnect
    ws.on('close', () => {
        console.log(`Client disconnected: ${clientIP}`);
        clients.delete(ws);

        // Notify other clients
        broadcast({
            type: 'CLIENT_DISCONNECTED',
            clientCount: clients.size
        });
    });

    // Handle errors
    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        clients.delete(ws);
    });
});

// Start server
httpServer.listen(PORT, () => {
    const localIPs = getLocalIPs();

    console.log('\n========================================');
    console.log('  Smasher Badminton Club Scoreboard');
    console.log('  WebSocket Server');
    console.log('========================================\n');
    console.log(`Server running on port ${PORT}\n`);
    console.log('Access the scoreboard from:');
    console.log(`  Local:    http://localhost:${PORT}`);

    if (localIPs.length > 0) {
        console.log('\n  Network (for tablets/other devices):');
        localIPs.forEach(ip => {
            console.log(`            http://${ip}:${PORT}`);
        });
        console.log(`\n  WebSocket URL for admin panel:`);
        localIPs.forEach(ip => {
            console.log(`            ws://${ip}:${PORT}`);
        });
    }

    console.log('\nPages:');
    console.log(`  Admin Panel:   http://localhost:${PORT}/admin.html`);
    console.log(`  Live Display:  http://localhost:${PORT}/display.html`);
    console.log('\n----------------------------------------');
    console.log('Press Ctrl+C to stop the server');
    console.log('----------------------------------------\n');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');

    // Close all WebSocket connections
    for (const client of clients) {
        client.close();
    }

    httpServer.close(() => {
        console.log('Server stopped.');
        process.exit(0);
    });
});
