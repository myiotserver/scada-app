const db = require("../models");
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
    console.log("findAll users called");
    User.findAll({
        include: [{
            model: Role,
            as: 'roles',
            attributes: ['id', 'name'],
            through: {
                attributes: [],
            }
        }]
    }).then(users => {
        console.log("findAll retrieved:", users.length, "users");
        res.send(users);
    }).catch(err => {
        console.error("findAll error:", err);
        res.status(500).send({ message: err.message });
    });
};

exports.createUser = (req, res) => {
    User.create({
        username: req.body.username,
        email: req.body.email,
        password: bcrypt.hashSync(req.body.password, 8)
    }).then(user => {
        if (req.body.roles) {
            Role.findAll({
                where: {
                    name: { [db.Sequelize.Op.or]: req.body.roles }
                }
            }).then(roles => {
                user.setRoles(roles).then(() => {
                    res.send({ message: "User registered successfully!" });
                });
            });
        } else {
            user.setRoles([1]).then(() => {
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
    // Remove roles from direct update since it's an association
    delete updateData.roles;

    User.update(updateData, {
        where: { id: id }
    }).then(num => {
        if (num == 1 || (req.body.roles && req.body.roles.length > 0)) {
            // If roles are provided, update them
            if (req.body.roles) {
                User.findByPk(id).then(user => {
                    if (!user) {
                        // Should not happen if update succeeded, but safe check
                        return res.status(404).send({ message: "User not found." });
                    }
                    Role.findAll({
                        where: {
                            name: { [db.Sequelize.Op.or]: req.body.roles }
                        }
                    }).then(roles => {
                        user.setRoles(roles).then(() => {
                            res.send({ message: "User was updated successfully." });
                        });
                    });
                });
            } else {
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
    User.destroy({
        where: { id: id }
    }).then(num => {
        if (num == 1) {
            res.send({ message: "User was deleted successfully!" });
        } else {
            res.send({ message: `Cannot delete User with id=${id}. Maybe User was not found!` });
        }
    }).catch(err => {
        res.status(500).send({ message: "Could not delete User with id=" + id });
    });
};
