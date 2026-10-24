const { authJwt } = require("../middleware");
const controller = require("../controllers/opcua.controller");

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.get(
        "/api/opcua/config",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.getConfig
    );

    app.put(
        "/api/opcua/config",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.updateConfig
    );

    app.post(
        "/api/opcua/connect",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.connect
    );

    app.post(
        "/api/opcua/disconnect",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.disconnect
    );

    app.get(
        "/api/opcua/status",
        [authJwt.verifyToken],
        controller.getStatus
    );

    app.post(
        "/api/opcua/browse",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.browse
    );

    app.post(
        "/api/opcua/config/nodes",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.addNode
    );

    app.post(
        "/api/opcua/config/nodes/import",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.importNodes
    );

    app.delete(
        "/api/opcua/config/nodes/:index",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.removeNode
    );

    app.put(
        "/api/opcua/config/nodes/:index",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.updateNode
    );

    // Fallback route for environments where PUT is blocked by proxy/web server
    app.post(
        "/api/opcua/config/nodes/:index/update",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.updateNode
    );
};
