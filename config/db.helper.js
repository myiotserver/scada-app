/**
 * Shared helper for building MSSQL connection config.
 * Menangani ekstraksi port dari server string dan default port.
 *
 * Priority port:
 *   1. env MSSQL_PORT  (atau custom env key)
 *   2. settings.sql_port
 *   3. Port embedded di server string (host:port atau host,port)
 *   4. Default MSSQL port 1433
 */
function buildMssqlConfig({ envPortKey = 'MSSQL_PORT', settings, envFallback } = {}) {
    const env = process.env;

    const rawServer = (envFallback && env[envFallback + '_SERVER']) || env.MSSQL_SERVER || (settings && settings.sql_server) || 'localhost';
    const user      = (envFallback && env[envFallback + '_USER']) || env.MSSQL_USER || (settings && settings.sql_uid) || 'sa';
    const password  = (envFallback && env[envFallback + '_PASSWORD']) || env.MSSQL_PASSWORD || (settings && settings.sql_pass) || '';
    const database  = (envFallback && env[envFallback + '_DATABASE']) || env.MSSQL_DATABASE || (settings && settings.sql_db) || 'WEIGHER';

    let server = rawServer;
    let port   = 0;

    // 1. Explicit port from env or settings
    const envPort = (envFallback && env[envFallback + '_PORT']) || env[envPortKey];
    port = Number(envPort || (settings && settings.sql_port) || 0);

    // 2. Extract port from server string if present (host:port or host,port)
    if (!port && server) {
        // Check for colon-separated port (host:port)
        const colonMatch = server.match(/:(\d+)$/);
        // Check for comma-separated port (host,port) — mssql package format
        const commaMatch = server.match(/,(\d+)$/);
        if (colonMatch) {
            port = Number(colonMatch[1]);
            server = server.replace(/:(\d+)$/, '');
        } else if (commaMatch) {
            port = Number(commaMatch[1]);
            server = server.replace(/,(\d+)$/, '');
        }
    }

    // 3. Default port
    if (!port) port = 1433;

    return {
        user,
        password,
        server,
        database,
        port,
        options: {
            encrypt: env.MSSQL_ENCRYPT === 'true',
            trustServerCertificate: env.MSSQL_TRUST_CERT !== 'false',
            enableArithAbort: true
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    };
}

module.exports = { buildMssqlConfig };
