const jwt = require("jsonwebtoken");
const config = require("../config/auth.config.js");
const db = require("../models");
const User = db.user;

const verifyToken = (req, res, next) => {
    let token = req.headers["x-access-token"];

    if (!token) {
        return res.status(403).send({
            message: "No token provided!"
        });
    }

    jwt.verify(token, config.secret, (err, decoded) => {
        if (err) {
            return res.status(401).send({
                message: "Unauthorized!"
            });
        }
        req.userId = decoded.id;

        User.findByPk(req.userId, {
            attributes: ["id", "username", "email"],
            include: [{ model: db.role, as: "roles", attributes: ["name"] }]
        }).then(user => {
            if (user) {
                req.user = user;
                req.username = user.username;
                req.userRoles = user.roles ? user.roles.map(r => r.name) : [];
                req.userRole = req.userRoles.join(", ");
            }
            next();
        }).catch(() => next());
    });
};

const isAdmin = (req, res, next) => {
    if (req.userRoles) {
        if (req.userRoles.includes("admin")) return next();
        return res.status(403).send({ message: "Require Admin Role!" });
    }
    User.findByPk(req.userId).then(user => {
        if (!user) return res.status(404).send({ message: "User not found!" });
        user.getRoles().then(roles => {
            for (let i = 0; i < roles.length; i++) {
                if (roles[i].name === "admin") {
                    return next();
                }
            }
            return res.status(403).send({ message: "Require Admin Role!" });
        });
    }).catch(err => res.status(500).send({ message: err.message }));
};

const isModerator = (req, res, next) => {
    if (req.userRoles) {
        if (req.userRoles.includes("moderator")) return next();
        return res.status(403).send({ message: "Require Moderator Role!" });
    }
    User.findByPk(req.userId).then(user => {
        if (!user) return res.status(404).send({ message: "User not found!" });
        user.getRoles().then(roles => {
            for (let i = 0; i < roles.length; i++) {
                if (roles[i].name === "moderator") {
                    return next();
                }
            }
            return res.status(403).send({ message: "Require Moderator Role!" });
        });
    }).catch(err => res.status(500).send({ message: err.message }));
};

const isUserOrAdmin = (req, res, next) => {
    if (req.userRoles) {
        if (req.userRoles.includes("user") || req.userRoles.includes("admin")) return next();
        return res.status(403).send({ message: "Require User or Admin Role!" });
    }
    User.findByPk(req.userId).then(user => {
        if (!user) return res.status(404).send({ message: "User not found!" });
        user.getRoles().then(roles => {
            for (let i = 0; i < roles.length; i++) {
                if (roles[i].name === "user" || roles[i].name === "admin") {
                    return next();
                }
            }
            return res.status(403).send({ message: "Require User or Admin Role!" });
        });
    }).catch(err => res.status(500).send({ message: err.message }));
};

const authJwt = {
    verifyToken: verifyToken,
    isAdmin: isAdmin,
    isModerator: isModerator,
    isUserOrAdmin: isUserOrAdmin
};
module.exports = authJwt;
