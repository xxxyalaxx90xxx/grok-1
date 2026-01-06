// server.js - Node.js WebSocket Server für INFINITY OS v2025
// Handhabt File System Synchronisation mit Version-History und Konfliktlösung

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// HTTP Server für statische Dateien
const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';
    
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml'
    };
    
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code, 'utf-8');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// WebSocket Server für FS-Sync
const wss = new WebSocket.Server({ server });

// Virtuelles Dateisystem (persistent über Sessions hinweg)
const virtualFS = {
    cwd: '/home/user',
    structure: {
        '/home/user': {
            type: 'directory',
            children: ['test.txt', 'example.js']
        },
        '/home/user/test.txt': {
            type: 'file'
        },
        '/home/user/example.js': {
            type: 'file'
        }
    },
    content: {
        '/home/user/test.txt': 'Hello INFINITY OS v2025!',
        '/home/user/example.js': 'console.log("Hello World");'
    },
    versions: {} // Pro Path: Array von {version, content, timestamp, source}
};

// Aktive Sync-Clients
const syncClients = new Set();

// Diff-Funktion (gleiche wie im Client)
function generateDiff(base, local, remote) {
    const baseLines = base.split('\n');
    const localLines = local.split('\n');
    const remoteLines = remote.split('\n');
    
    function lcs(a, b) {
        const m = a.length, n = b.length;
        const dp = Array.from({length: m+1}, () => Array(n+1).fill(0));
        for (let i=1; i<=m; i++) {
            for (let j=1; j<=n; j++) {
                dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
            }
        }
        return dp;
    }
    
    const localDiff = lcs(baseLines, localLines);
    const remoteDiff = lcs(baseLines, remoteLines);
    
    let merged = [];
    let i=0, j=0, k=0;
    while (i < baseLines.length || j < localLines.length || k < remoteLines.length) {
        if (baseLines[i] === localLines[j] && baseLines[i] === remoteLines[k]) {
            merged.push(baseLines[i]);
            i++; j++; k++;
        } else if (baseLines[i] !== localLines[j] && baseLines[i] !== remoteLines[k]) {
            merged.push('<<<<<<< LOCAL');
            merged.push(localLines[j]);
            merged.push('=======');
            merged.push(remoteLines[k]);
            merged.push('>>>>>>> REMOTE');
            j++; k++;
        } else if (baseLines[i] !== localLines[j]) {
            merged.push(localLines[j]);
            j++;
        } else if (baseLines[i] !== remoteLines[k]) {
            merged.push(remoteLines[k]);
            k++;
        }
        i++;
    }
    return merged.join('\n');
}

// WebSocket Connection Handler
wss.on('connection', (ws) => {
    console.log('[SERVER] New client connected');
    syncClients.add(ws);
    
    // Sende initiales Dateisystem an neuen Client
    ws.send(JSON.stringify({
        type: 'init',
        fs: virtualFS
    }));
    
    ws.on('message', async (data) => {
        const msg = JSON.parse(data);
        
        if (msg.type === 'fs-change') {
            // Erweiterte Logik: Check version in virtualFS
            if (!virtualFS.versions[msg.path]) virtualFS.versions[msg.path] = [];
            const history = virtualFS.versions[msg.path];
            const currentVersion = history.length > 0 ? history[history.length - 1].version : 0;
            const currentContent = history.length > 0 ? history[history.length - 1].content : '';
            
            if (msg.version > currentVersion) {
                // Neue Version - direkt übernehmen
                history.push({ 
                    version: msg.version, 
                    content: msg.content, 
                    timestamp: msg.timestamp, 
                    source: 'client' 
                });
                virtualFS.content[msg.path] = msg.content;
                
                // Broadcast an alle anderen Clients
                syncClients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(data);
                    }
                });
            } else {
                // Erweiterte Server-Konfliktlösung
                const base = history.length > 1 ? history[history.length - 2].content : '';
                const merged = generateDiff(base, currentContent, msg.content);
                const newVersion = currentVersion + 1;
                
                history.push({ 
                    version: newVersion, 
                    content: merged, 
                    timestamp: Date.now(), 
                    source: 'server-merge' 
                });
                virtualFS.content[msg.path] = merged;
                
                const newMsg = { 
                    ...msg, 
                    content: merged, 
                    version: newVersion, 
                    operation: 'merge' 
                };
                
                // Broadcast an alle Clients
                syncClients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(newMsg));
                    }
                });
            }
        }
    });
    
    ws.on('close', () => {
        console.log('[SERVER] Client disconnected');
        syncClients.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('[SERVER] WebSocket error:', error);
    });
});

// Server starten
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`[SERVER] INFINITY OS v2025 Server running on http://localhost:${PORT}`);
    console.log('[SERVER] WebSocket endpoint: ws://localhost:' + PORT);
});
