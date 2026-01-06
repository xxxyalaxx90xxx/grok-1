// conflict-resolver.js – Erweiterte Konfliktlösung für INFINITY OS v2025
// Implementiert automatisierte und manuelle Merge-Strategien, Diff-Generierung und UI-Integration
// Unterstützt 3-Way-Merge, Version-History und Konflikt-Notifications

// Diff-Funktion (einfacher Line-Diff)
function generateDiff(base, local, remote) {
    const baseLines = base.split('\n');
    const localLines = local.split('\n');
    const remoteLines = remote.split('\n');
    
    // Einfacher Diff-Algorithmus (LCS-basiert für Demo-Zwecke)
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
    
    // Merge mit Konflikt-Markern
    let merged = [];
    let i=0, j=0, k=0;
    const maxLen = Math.max(baseLines.length, localLines.length, remoteLines.length);
    
    while (i < baseLines.length || j < localLines.length || k < remoteLines.length) {
        const baseLine = i < baseLines.length ? baseLines[i] : undefined;
        const localLine = j < localLines.length ? localLines[j] : undefined;
        const remoteLine = k < remoteLines.length ? remoteLines[k] : undefined;
        
        if (baseLine !== undefined && baseLine === localLine && baseLine === remoteLine) {
            merged.push(baseLine);
            i++; j++; k++;
        } else if (baseLine !== undefined && baseLine !== localLine && baseLine !== remoteLine && localLine !== undefined && remoteLine !== undefined) {
            merged.push('<<<<<<< LOCAL');
            merged.push(localLine);
            merged.push('=======');
            merged.push(remoteLine);
            merged.push('>>>>>>> REMOTE');
            j++; k++; i++;
        } else if (baseLine !== undefined && baseLine !== localLine && localLine !== undefined) {
            merged.push(localLine);
            j++; i++;
        } else if (baseLine !== undefined && baseLine !== remoteLine && remoteLine !== undefined) {
            merged.push(remoteLine);
            k++; i++;
        } else if (localLine !== undefined && remoteLine === undefined) {
            merged.push(localLine);
            j++;
        } else if (remoteLine !== undefined && localLine === undefined) {
            merged.push(remoteLine);
            k++;
        } else {
            i++; j++; k++;
        }
        
        // Safety check to prevent infinite loops
        if (merged.length > maxLen * 3) break;
    }
    return merged.join('\n');
}

// Version-History speichern (pro Datei in IndexedDB)
async function addVersion(path, content, version, source = 'local') {
    const entry = await INFINITY_FS.getEntry(path);
    if (!entry.history) entry.history = [];
    entry.history.push({ version, content, timestamp: Date.now(), source });
    if (entry.history.length > 10) entry.history.shift(); // Max 10 Versionen
    await INFINITY_FS.createEntry(entry);
}

// Manuelle Konfliktlösung via Callback (z.B. für UI)
let conflictCallbacks = {};
function registerConflictCallback(path, callback) {
    conflictCallbacks[path] = callback;
}

// Hilfsfunktion: Hole lokale Version
async function getLocalVersion(path) {
    const entry = await INFINITY_FS.getEntry(path);
    return entry.version || 0;
}

// Automatisierter Merge mit Fallback zu manuell
async function resolveConflict(path, localContent, remoteContent, baseContent = '') {
    const merged = generateDiff(baseContent, localContent, remoteContent);
    if (!merged.includes('<<<<<<<')) {
        // Kein Konflikt - auto-merge erfolgreich
        await INFINITY_FS.updateFileContent(path, merged);
        const currentVersion = await getLocalVersion(path);
        await addVersion(path, merged, currentVersion + 1, 'merged');
        // syncChange wird von fs-sync.js bereitgestellt
        if (typeof window.syncChange === 'function') {
            await window.syncChange(path, merged, 'update');
        }
        return { status: 'auto-merged', content: merged };
    } else {
        // Konflikt: Speichere temporär und benachrichtige UI
        await INFINITY_FS.updateFileContent(path + '.conflict', merged);
        if (conflictCallbacks[path]) {
            conflictCallbacks[path](merged);
        }
        return { status: 'manual-required', diff: merged };
    }
}

// Export
window.CONFLICT_RESOLVER = {
    generateDiff,
    addVersion,
    resolveConflict,
    registerConflictCallback,
    getLocalVersion
};
