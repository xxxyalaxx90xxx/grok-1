# INFINITY OS v2025 - Conflict Resolution System

This directory contains a web-based file system with advanced conflict resolution capabilities, built on top of the Grok-1 repository.

## Features

### 🔄 3-Way Merge
- Automatic conflict detection and resolution
- Line-based diff algorithm (LCS)
- Support for base, local, and remote versions
- Git-style conflict markers (<<<<<<< / ======= / >>>>>>>)

### 📚 Version History
- Tracks up to 10 versions per file
- Stores version metadata (timestamp, source, content)
- Available both client-side (IndexedDB) and server-side

### 🌐 Real-Time Synchronization
- WebSocket-based file system sync
- Multi-client/multi-device support
- Automatic reconnection on disconnect
- Message queue for offline changes

### 🎨 Web Dashboard
- Modern, dark-themed UI
- File browser and terminal emulator
- Live system statistics
- Version history viewer
- Manual conflict resolution interface

## Installation

1. Install Node.js dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:8080
```

## Architecture

### Components

#### `conflict-resolver.js`
- Core conflict resolution logic
- Diff generation using LCS algorithm
- Version history management
- Conflict callbacks for UI integration

#### `fs-sync.js`
- WebSocket client for real-time sync
- Queue management for offline operations
- Integration with INFINITY_FS
- Automatic conflict resolution triggers

#### `server.js`
- Node.js WebSocket server
- Virtual file system with version tracking
- Server-side conflict resolution
- Static file serving

#### `index.html`
- Main dashboard interface
- File system browser
- Terminal emulator
- Conflict resolution modal
- System statistics display

## Usage

### Automatic Conflict Resolution

When two clients modify the same file simultaneously, the system:

1. Detects the version conflict
2. Attempts automatic 3-way merge
3. If successful, applies changes and syncs
4. If conflicts exist, opens manual resolution UI

### Manual Conflict Resolution

When automatic merge fails:

1. A modal appears with conflict markers
2. User manually resolves conflicts
3. Saves and syncs the merged version
4. Updates version history

### Testing Conflict Resolution

Click the "🔧 Test Conflict Resolution" button to simulate a conflict and see the resolution UI in action.

## API

### CONFLICT_RESOLVER

```javascript
// Generate diff between versions
CONFLICT_RESOLVER.generateDiff(base, local, remote)

// Add version to history
await CONFLICT_RESOLVER.addVersion(path, content, version, source)

// Resolve conflict automatically or trigger manual resolution
await CONFLICT_RESOLVER.resolveConflict(path, localContent, remoteContent, baseContent)

// Register callback for conflict notifications
CONFLICT_RESOLVER.registerConflictCallback(path, callback)
```

### FS_SYNC

```javascript
// Initialize sync connection
FS_SYNC.initSync(serverUrl)

// Sync a change to server
FS_SYNC.syncChange(path, content, operation)

// Check connection status
FS_SYNC.isConnected()
```

## Configuration

Default server configuration:
- Port: 8080
- WebSocket endpoint: ws://localhost:8080
- Max version history: 10 versions per file

To change the port:
```bash
PORT=3000 npm start
```

## Compatibility

This system is designed to work alongside the existing Grok-1 model code without interfering with it. The web-based file system is completely separate from the JAX model implementation.

## License

Same as the parent Grok-1 repository (Apache 2.0).
