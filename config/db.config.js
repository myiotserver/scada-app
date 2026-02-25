module.exports = {
    HOST: process.env.PGHOST || process.env.POSTGRES_HOST || "localhost",
    USER: process.env.PGUSER || process.env.POSTGRES_USER || "scada_user",
    PASSWORD: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || "12345678",
    DB: process.env.PGDATABASE || process.env.POSTGRES_DB || "scada_db",
    dialect: "postgres",
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
};
