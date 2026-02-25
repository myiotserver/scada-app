/**
 * Centralized Logger Utility — SCADA System
 * Captures logs in a ring buffer and broadcasts via Socket.IO subscribers.
 */

const MAX_BUFFER = 500;

class Logger {
    constructor() {
        this.buffer = [];
        this.subscribers = {};
    }

    _log(level, source, message) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            source: (source || 'SYSTEM').toUpperCase(),
            message
        };

        // Ring buffer: drop oldest when full
        this.buffer.push(entry);
        if (this.buffer.length > MAX_BUFFER) {
            this.buffer.shift();
        }

        // Console output
        const prefix = `[${entry.source}]`;
        if (level === 'ERROR') {
            console.error(prefix, message);
        } else if (level === 'WARN') {
            console.warn(prefix, message);
        } else {
            console.log(prefix, message);
        }

        // Broadcast to subscribers
        for (const cb of Object.values(this.subscribers)) {
            try {
                cb(entry);
            } catch (err) {
                // Avoid infinite loop
            }
        }
    }

    info(source, message) { this._log('INFO', source, message); }
    warn(source, message) { this._log('WARN', source, message); }
    error(source, message) { this._log('ERROR', source, message); }

    getHistory(filters = {}) {
        let logs = [...this.buffer];
        if (filters.level) {
            logs = logs.filter(l => l.level === filters.level.toUpperCase());
        }
        if (filters.source) {
            logs = logs.filter(l => l.source === filters.source.toUpperCase());
        }
        return logs;
    }

    subscribe(id, callback) {
        this.subscribers[id] = callback;
    }

    unsubscribe(id) {
        delete this.subscribers[id];
    }
}

// Singleton
module.exports = new Logger();
