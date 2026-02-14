module.exports = {
    HOST: "localhost",
    USER: "scada_user",
    PASSWORD: "secure_password",
    DB: "scada_db",
    dialect: "postgres",
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
};
