const db = require("../models");
const config = require("../config/auth.config");
const auditLogger = require("../utils/auditLogger");
const User = db.user;
const Role = db.role;

const Op = db.Sequelize.Op;

var jwt = require("jsonwebtoken");
var bcrypt = require("bcrypt");

exports.signup = (req, res) => {
    // Save User to Database — email is optional
    User.create({
        username: req.body.username,
        email: req.body.email || null,
        password: bcrypt.hashSync(req.body.password, 8)
    })
        .then(user => {
            const rolesList = req.body.roles || ["user"];
            if (req.body.roles) {
                Role.findAll({
                    where: {
                        name: {
                            [Op.or]: req.body.roles
                        }
                    }
                }).then(roles => {
                    user.setRoles(roles).then(() => {
                        auditLogger.log({
                            req,
                            action: "USER_REGISTER",
                            category: "USER_MGMT",
                            target: `User: ${user.username}`,
                            details: `Registered new user account (${rolesList.join(", ")})`
                        });
                        res.send({ message: "User was registered successfully!" });
                    });
                });
            } else {
                user.setRoles([1]).then(() => {
                    auditLogger.log({
                        req,
                        action: "USER_REGISTER",
                        category: "USER_MGMT",
                        target: `User: ${user.username}`,
                        details: `Registered new user account (user)`
                    });
                    res.send({ message: "User was registered successfully!" });
                });
            }
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};

exports.signin = (req, res) => {
    User.findOne({
        where: {
            username: req.body.username
        }
    })
        .then(user => {
            if (!user) {
                auditLogger.log({
                    req,
                    username: req.body.username || "Unknown",
                    action: "LOGIN_FAILED",
                    category: "AUTH",
                    target: "SCADA System",
                    details: "Login failed: User not found"
                });
                return res.status(404).send({ message: "User Not found." });
            }

            var passwordIsValid = bcrypt.compareSync(
                req.body.password,
                user.password
            );

            if (!passwordIsValid) {
                auditLogger.log({
                    req,
                    userId: user.id,
                    username: user.username,
                    action: "LOGIN_FAILED",
                    category: "AUTH",
                    target: "SCADA System",
                    details: "Login failed: Invalid password"
                });
                return res.status(401).send({
                    accessToken: null,
                    message: "Invalid Password!"
                });
            }

            var token = jwt.sign({ id: user.id }, config.secret, {
                expiresIn: 86400 // 24 hours
            });

            var authorities = [];
            user.getRoles().then(roles => {
                for (let i = 0; i < roles.length; i++) {
                    authorities.push("ROLE_" + roles[i].name.toUpperCase());
                }

                auditLogger.log({
                    req,
                    userId: user.id,
                    username: user.username,
                    role: authorities.join(", "),
                    action: "LOGIN",
                    category: "AUTH",
                    target: "SCADA System",
                    details: "User logged in successfully"
                });

                res.status(200).send({
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    roles: authorities,
                    accessToken: token,
                    mustChangePassword: user.mustChangePassword || false
                });
            });
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};

exports.logout = (req, res) => {
    const token = req.headers["x-access-token"];
    let username = (req.body && req.body.username) || "User";

    if (token) {
        try {
            const decoded = jwt.verify(token, config.secret);
            if (decoded && decoded.id) {
                User.findByPk(decoded.id, {
                    include: [{ model: db.role, as: "roles", attributes: ["name"] }]
                }).then(u => {
                    const uName = u ? u.username : username;
                    const uRoles = u && u.roles ? u.roles.map(r => r.name).join(", ") : null;
                    auditLogger.log({
                        req,
                        userId: decoded.id,
                        username: uName,
                        role: uRoles,
                        action: "LOGOUT",
                        category: "AUTH",
                        target: "SCADA System",
                        details: "User logged out"
                    });
                }).catch(() => {
                    auditLogger.log({
                        req,
                        username: username,
                        action: "LOGOUT",
                        category: "AUTH",
                        target: "SCADA System",
                        details: "User logged out"
                    });
                });
                return res.status(200).send({ message: "Logged out successfully" });
            }
        } catch (e) {
            // Token error
        }
    }

    auditLogger.log({
        req,
        username: username,
        action: "LOGOUT",
        category: "AUTH",
        target: "SCADA System",
        details: "User logged out"
    });
    res.status(200).send({ message: "Logged out successfully" });
};

exports.changePassword = (req, res) => {
    if (!req.body.oldPassword || !req.body.newPassword) {
        return res.status(400).send({ message: "Old password and new password are required." });
    }

    User.findByPk(req.userId)
        .then(user => {
            if (!user) {
                return res.status(404).send({ message: "User not found." });
            }

            var passwordIsValid = bcrypt.compareSync(
                req.body.oldPassword,
                user.password
            );

            if (!passwordIsValid) {
                auditLogger.log({
                    req,
                    userId: user.id,
                    username: user.username,
                    action: "PASSWORD_CHANGE_FAILED",
                    category: "AUTH",
                    target: `User: ${user.username}`,
                    details: "Password change failed: Current password incorrect"
                });
                return res.status(401).send({ message: "Current password is incorrect." });
            }

            // Update password and clear mustChangePassword flag
            user.password = bcrypt.hashSync(req.body.newPassword, 8);
            user.mustChangePassword = false;

            user.save()
                .then(() => {
                    auditLogger.log({
                        req,
                        userId: user.id,
                        username: user.username,
                        action: "PASSWORD_CHANGED",
                        category: "AUTH",
                        target: `User: ${user.username}`,
                        details: "Password updated successfully"
                    });
                    res.status(200).send({ message: "Password changed successfully." });
                })
                .catch(err => {
                    res.status(500).send({ message: err.message });
                });
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};
