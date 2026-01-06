// fs-sync.js - File System Synchronization mit WebSocket für INFINITY OS v2025
// Handhabt Echtzeit-Synchronisation zwischen mehreren Clients und dem Server

// WebSocket-Verbindung für Sync
let syncWs = null;
let syncQueue = [];
let isConnected = false;

// Initialisiere WebSocket-Verbindung
function initSync(serverUrl = 'ws://localhost:8080') {
    syncWs = new WebSocket(serverUrl);
    
    syncWs.onopen = () => {
        console.log('[FS-SYNC] Connected to server');
        isConnected = true;
        processQueue();
        
        // Lade Conflict Resolver
        if (!window.CONFLICT_RESOLVER) {
            const script = document.createElement('script');
            script.src = 'conflict-resolver.js';
            document.head.appendChild(script);
        }
    };
    
    syncWs.onclose = () => {
        console.log('[FS-SYNC] Disconnected from server');
        isConnected = false;
        // Reconnect nach 5 Sekunden
        setTimeout(() => initSync(serverUrl), 5000);
    };
    
    syncWs.onerror = (error) => {
        console.error('[FS-SYNC] WebSocket error:', error);
    };
    
    syncWs.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'fs-change') {
            const { path, content, version, operation, timestamp } = msg;
            const localEntry = await INFINITY_FS.getEntry(path);
            
            if (localEntry) {
                if (version > localEntry.version) {
                    // Direkte Update
                    localEntry.content = content;
                    localEntry.version = version;
                    localEntry.modified = timestamp;
                    await addVersion(path, content, version, 'remote');
                    await INFINITY_FS.createEntry(localEntry);
                } else if (version === localEntry.version) {
                    // Erweiterte Konfliktlösung
                    const base = localEntry.history && localEntry.history.length > 1 
                        ? localEntry.history[localEntry.history.length - 2].content 
                        : '';
                    const result = await CONFLICT_RESOLVER.resolveConflict(path, localEntry.content, content, base);
                    if (result.status === 'auto-merged') {
                        syncChange(path, result.content, 'merge');
                    } else {
                        // UI-Notification (siehe index.html)
                        showConflictNotification(path, result.diff);
                    }
                    localEntry.version++;
                    await INFINITY_FS.createEntry(localEntry);
                }
            } else if (operation === 'create') {
                // Neue Datei vom Server
                await INFINITY_FS.createEntry({
                    path,
                    content,
                    version: version || 1,
                    modified: timestamp,
                    created: timestamp,
                    type: 'file'
                });
                await addVersion(path, content, 1, 'remote');
            }
        }
    };
}

// Sende Änderung an Server
function syncChange(path, content, operation = 'update') {
    const msg = {
        type: 'fs-change',
        path,
        content,
        version: getLocalVersion(path) || 1,
        operation,
        timestamp: Date.now()
    };
    
    if (isConnected) {
        syncWs.send(JSON.stringify(msg));
    } else {
        // Queue für später
        syncQueue.push(msg);
    }
}

// Verarbeite Queue nach Reconnect
function processQueue() {
    while (syncQueue.length > 0 && isConnected) {
        const msg = syncQueue.shift();
        syncWs.send(JSON.stringify(msg));
    }
}

// Hilfsfunktion: Hole lokale Version
async function getLocalVersion(path) {
    const entry = await INFINITY_FS.getEntry(path);
    return entry.version || 0;
}

// Export
window.FS_SYNC = {
    initSync,
    syncChange,
    isConnected: () => isConnected
};

// Make syncChange available globally for conflict-resolver
window.syncChange = syncChange;
