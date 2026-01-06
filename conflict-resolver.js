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

// Automatisierter Merge mit Fallback zu manuell
async function resolveConflict(path, localContent, remoteContent, baseContent = '') {
    const merged = generateDiff(baseContent, localContent, remoteContent);
    if (!merged.includes('<<<<<<<')) {
        // Kein Konflikt - auto-merge erfolgreich
        await INFINITY_FS.updateFileContent(path, merged);
        await addVersion(path, merged, await getLocalVersion(path) + 1, 'merged');
        syncChange(path, merged, 'update');
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
    registerConflictCallback
};
