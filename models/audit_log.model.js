module.exports = (sequelize, Sequelize) => {
    const AuditLog = sequelize.define("audit_logs", {
        id: {
            type: Sequelize.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: Sequelize.INTEGER,
            allowNull: true
        },
        username: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: "Anonymous"
        },
        role: {
            type: Sequelize.STRING,
            allowNull: true
        },
        action: {
            type: Sequelize.STRING,
            allowNull: false
        },
        category: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: "GENERAL"
        },
        target: {
            type: Sequelize.STRING,
            allowNull: true
        },
        details: {
            type: Sequelize.TEXT,
            allowNull: true
        },
        ipAddress: {
            type: Sequelize.STRING,
            allowNull: true
        },
        userAgent: {
            type: Sequelize.STRING,
            allowNull: true
        }
    }, {
        tableName: "audit_logs",
        timestamps: true,
        indexes: [
            { fields: ["createdAt"] },
            { fields: ["action"] },
            { fields: ["category"] },
            { fields: ["username"] },
            { fields: ["target"] }
        ]
    });

    return AuditLog;
};
