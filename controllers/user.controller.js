const db = require("../models");
const auditLogger = require("../utils/auditLogger");
const User = db.user;
const Role = db.role;
const bcrypt = require("bcrypt");

exports.allAccess = (req, res) => {
    res.status(200).send("Public Content.");
};

exports.userBoard = (req, res) => {
    res.status(200).send("User Content.");
};

exports.adminBoard = (req, res) => {
    res.status(200).send("Admin Content.");
};

exports.moderatorBoard = (req, res) => {
    res.status(200).send("Moderator Content.");
};

// CRUD for Users
exports.findAll = (req, res) => {
    User.findAll({
        include: [{
            model: Role,
            as: "roles",
            attributes: ["id", "name"],
            through: {
                attributes: []
            }
        }]
    }).then(users => {
        res.send(users);
    }).catch(err => {
        console.error("findAll error:", err);
        res.status(500).send({ message: err.message });
    });
};

exports.createUser = (req, res) => {
    User.create({
        username: req.body.username,
        email: req.body.email || null,
        password: bcrypt.hashSync(req.body.password, 8)
    }).then(user => {
        const rolesList = req.body.roles || ["user"];
        if (req.body.roles) {
            Role.findAll({
                where: {
                    name: { [db.Sequelize.Op.or]: req.body.roles }
                }
            }).then(roles => {
                user.setRoles(roles).then(() => {
                    auditLogger.log({
                        req,
                        action: "USER_CREATE",
                        category: "USER_MGMT",
                        target: `User: ${user.username}`,
                        details: `Created new user '${user.username}' with role(s): ${rolesList.join(", ")}`
                    });
                    res.send({ message: "User registered successfully!" });
                });
            });
        } else {
            user.setRoles([1]).then(() => {
                auditLogger.log({
                    req,
                    action: "USER_CREATE",
                    category: "USER_MGMT",
                    target: `User: ${user.username}`,
                    details: `Created new user '${user.username}' with role: user`
                });
                res.send({ message: "User registered successfully!" });
            });
        }
    }).catch(err => {
        res.status(500).send({ message: err.message });
    });
};

exports.updateUser = (req, res) => {
    const id = req.params.id;
    const updateData = { ...req.body };

    if (updateData.password) {
        updateData.password = bcrypt.hashSync(updateData.password, 8);
    }
    delete updateData.roles;

    User.update(updateData, {
        where: { id: id }
    }).then(num => {
        if (num == 1 || (req.body.roles && req.body.roles.length > 0)) {
            if (req.body.roles) {
                User.findByPk(id).then(user => {
                    if (!user) {
                        return res.status(404).send({ message: "User not found." });
                    }
                    Role.findAll({
                        where: {
                            name: { [db.Sequelize.Op.or]: req.body.roles }
                        }
                    }).then(roles => {
                        user.setRoles(roles).then(() => {
                            auditLogger.log({
                                req,
                                action: "USER_UPDATE",
                                category: "USER_MGMT",
                                target: `User: ${user.username}`,
                                details: `Updated roles for '${user.username}': ${req.body.roles.join(", ")}`
                            });
                            res.send({ message: "User was updated successfully." });
                        });
                    });
                });
            } else {
                User.findByPk(id).then(user => {
                    auditLogger.log({
                        req,
                        action: "USER_UPDATE",
                        category: "USER_MGMT",
                        target: user ? `User: ${user.username}` : `User ID: ${id}`,
                        details: `Updated user profile attributes`
                    });
                });
                res.send({ message: "User was updated successfully." });
            }
        } else {
            res.send({
                message: `Cannot update User with id=${id}. Maybe User was not found or req.body is empty!`
            });
        }
    }).catch(err => {
        res.status(500).send({
            message: "Error updating User with id=" + id
        });
    });
};

exports.deleteUser = (req, res) => {
    const id = req.params.id;
    User.findByPk(id).then(targetUser => {
        const targetName = targetUser ? targetUser.username : `ID ${id}`;
        User.destroy({
            where: { id: id }
        }).then(num => {
            if (num == 1) {
                auditLogger.log({
                    req,
                    action: "USER_DELETE",
                    category: "USER_MGMT",
                    target: `User: ${targetName}`,
                    details: `Deleted user account '${targetName}'`
                });
                res.send({ message: "User was deleted successfully!" });
            } else {
                res.send({ message: `Cannot delete User with id=${id}. Maybe User was not found!` });
            }
        }).catch(err => {
            res.status(500).send({ message: "Could not delete User with id=" + id });
        });
    }).catch(err => {
        res.status(500).send({ message: "Error locating User with id=" + id });
    });
};
