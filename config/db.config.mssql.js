module.exports = {
    user: 'sa',
    password: 'VPS@thinkcentre',
    server: 'columba.s-net.id',
    database: 'WEIGHER',
    port: 1433,
    options: {
        encrypt: false, // for Azure, set to true
        trustServerCertificate: true, // change to true for local dev / self-signed certs
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};
