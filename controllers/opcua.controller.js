const opcuaManager = require('../utils/opcua.manager');

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
    const { nodeId, name, description } = req.body;
    if (!nodeId) return res.status(400).json({ error: 'nodeId is required' });
    const result = opcuaManager.addNode(nodeId, name, description);
    res.json(result);
};

exports.removeNode = (req, res) => {
    const index = parseInt(req.params.index);
    const result = opcuaManager.removeNode(index);
    res.json(result);
};

// For use in index.js Socket.IO setup
exports.opcuaManager = opcuaManager;
