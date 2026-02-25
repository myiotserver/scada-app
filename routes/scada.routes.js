const controller = require("../controllers/scada.controller");

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.get("/api/scada/status", controller.getSqlStatus);
    app.post("/api/control", controller.controlCarousel);
    app.post("/api/control/reset-error", controller.resetErrorTag);
    app.get("/api/scada/history", controller.getWeightHistory);
    app.get("/api/scada/alarms/active", controller.getActiveAlarms);
    app.get("/api/scada/history/:tag", controller.getTagHistory);
    app.post("/api/scada/refresh", controller.manualRefresh);
};
