const { authJwt } = require("../middleware");
const controller = require("../controllers/scada.controller");

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.get(
        "/api/scada/status",
        [authJwt.verifyToken],
        controller.getSqlStatus
    );

    app.post(
        "/api/control",
        [authJwt.verifyToken, authJwt.isUserOrAdmin],
        controller.controlCarousel
    );

    app.post(
        "/api/control/reset-error",
        [authJwt.verifyToken, authJwt.isUserOrAdmin],
        controller.resetErrorTag
    );

    app.get(
        "/api/scada/history",
        [authJwt.verifyToken],
        controller.getWeightHistory
    );

    app.get(
        "/api/scada/alarms/active",
        [authJwt.verifyToken],
        controller.getActiveAlarms
    );

    app.get(
        "/api/scada/history/:tag",
        [authJwt.verifyToken],
        controller.getTagHistory
    );

    app.post(
        "/api/scada/refresh",
        [authJwt.verifyToken, authJwt.isUserOrAdmin],
        controller.manualRefresh
    );
};

