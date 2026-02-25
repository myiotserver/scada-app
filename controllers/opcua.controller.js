const opcuaManager = require('../utils/opcua.manager');

function requiresMachineId(signalType) {
    return ['GROSS_WEIGHT', 'PRODUCT_SENSOR', 'CAROUSEL_INTERLOCK', 'GROSS_NORMAL', 'GROSS_UNDER', 'GROSS_OVER', 'MACHINE_RUN', 'ZEROING'].includes(
        (signalType || '').toString().trim().toUpperCase()
    );
}

function validateNodePayload(body) {
    const signalType = (body.signalType || '').toString().trim().toUpperCase();
    if (signalType && requiresMachineId(signalType)) {
        const machineId = parseInt(body.machineId, 10);
        if (!Number.isInteger(machineId) || machineId < 1 || machineId > 5) {
            return `machineId wajib diisi 1..5 untuk signalType ${signalType}`;
        }
    }
    return null;
}

exports.getConfig = (req, res) => {
    res.json(opcuaManager.getConfig());
};

exports.updateConfig = (req, res) => {
    const updated = opcuaManager.updateConfig(req.body);
    res.json({ success: true, config: updated });
};

exports.connect = async (req, res) => {
    const result = await opcuaManager.connect();
    res.json(result);
};

exports.disconnect = async (req, res) => {
    const result = await opcuaManager.disconnect();
    res.json(result);
};

exports.getStatus = (req, res) => {
    res.json(opcuaManager.getStatus());
};

exports.browse = async (req, res) => {
    const nodeId = req.body.nodeId || null;
    const result = await opcuaManager.browseNodes(nodeId);
    res.json(result);
};

exports.addNode = (req, res) => {
    const { nodeId, name, description, machineId, signalType, scale, enabled } = req.body;
    if (!nodeId) return res.status(400).json({ error: 'nodeId is required' });
    const validationError = validateNodePayload(req.body || {});
    if (validationError) return res.status(400).json({ error: validationError });
    const result = opcuaManager.addNode(nodeId, name, description, machineId, signalType, scale, enabled);
    if (result.error) return res.status(400).json(result);
    res.json(result);
};

exports.removeNode = (req, res) => {
    const index = parseInt(req.params.index);
    const result = opcuaManager.removeNode(index);
    if (result.error) return res.status(400).json(result);
    res.json(result);
};

exports.updateNode = (req, res) => {
    const index = parseInt(req.params.index, 10);
    if (!Number.isInteger(index)) return res.status(400).json({ error: 'Invalid index' });

    const validationError = validateNodePayload(req.body || {});
    if (validationError) return res.status(400).json({ error: validationError });

    const result = opcuaManager.updateNode(index, req.body || {});
    if (result.error) return res.status(400).json(result);
    res.json(result);
};

// For use in index.js Socket.IO setup
exports.opcuaManager = opcuaManager;
