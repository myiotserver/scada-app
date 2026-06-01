module.exports = (sequelize, Sequelize) => {
    const User = sequelize.define("users", {
        username: {
            type: Sequelize.STRING
        },
        email: {
            type: Sequelize.STRING
        },
        password: {
            type: Sequelize.STRING
        },
        mustChangePassword: {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        }
    });

    return User;
};
