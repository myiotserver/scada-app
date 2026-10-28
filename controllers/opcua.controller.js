const opcuaManager = require('../utils/opcua.manager');

function requiresMachineId(signalType) {
    return ['GROSS_WEIGHT', 'PRODUCT_SENSOR', 'INTERLOCK_MIN', 'INTERLOCK_MAX', 'GROSS_NORMAL', 'GROSS_UNDER', 'GROSS_OVER', 'MACHINE_RUN', 'ZEROING', 'MD_SWITCH', 'SYSTEM_PAUSED', 'TOLERANCE_MIN', 'TOLERANCE_MAX', 'DEVIATION_TOLERANCE_MIN', 'THRESHOLD_MIN', 'THRESHOLD_MAX', 'DEVIATION_TOLERANCE_MAX'].includes(
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

function normalizeImportedNodes(nodes) {
    if (!Array.isArray(nodes)) return { error: 'nodes must be an array' };

    const seenNodeIds = new Set();
    const normalizedNodes = [];

    for (let index = 0; index < nodes.length; index++) {
        const node = nodes[index];
        if (!node || typeof node !== 'object' || Array.isArray(node)) {
            return { error: `Node at index ${index} must be an object` };
        }

        const nodeId = typeof node.nodeId === 'string' ? node.nodeId.trim() : '';
        if (!nodeId) return { error: `Node ID is required at index ${index}` };
        if (seenNodeIds.has(nodeId)) return { error: `Duplicate Node ID at index ${index}: ${nodeId}` };
        seenNodeIds.add(nodeId);

        if (node.name !== undefined && node.name !== null && typeof node.name !== 'string') {
            return { error: `Node name must be a string at index ${index}` };
        }
        if (node.description !== undefined && node.description !== null && typeof node.description !== 'string') {
            return { error: `Node description must be a string at index ${index}` };
        }
        if (node.signalType !== undefined && node.signalType !== null && typeof node.signalType !== 'string') {
            return { error: `Signal type must be a string at index ${index}` };
        }

        let machineId = node.machineId;
        if (machineId === undefined || machineId === null || machineId === '') {
            machineId = null;
        } else if (/^[1-5]$/.test(String(machineId))) {
            machineId = Number(machineId);
        } else {
            return { error: `Invalid machine ID at index ${index}` };
        }

        const scale = node.scale === undefined || node.scale === null || node.scale === ''
            ? 0.01
            : Number(node.scale);
        if (!Number.isFinite(scale)) return { error: `Invalid scale at index ${index}` };
        if (node.enabled !== undefined && typeof node.enabled !== 'boolean') {
            return { error: `Enabled must be a boolean at index ${index}` };
        }

        const normalizedNode = {
            nodeId,
            name: (node.name || '').trim() || nodeId,
            description: (node.description || '').trim(),
            machineId,
            signalType: typeof node.signalType === 'string'
                ? (node.signalType.trim().toUpperCase() === 'CAROUSEL_INTERLOCK'
                    ? 'INTERLOCK_MIN'
                    : node.signalType.trim().toUpperCase() || null)
                : null,
            scale,
            enabled: node.enabled !== false
        };
        const validationError = validateNodePayload(normalizedNode);
        if (validationError) return { error: `Invalid node at index ${index}: ${validationError}` };
        normalizedNodes.push(normalizedNode);
    }

    return { nodes: normalizedNodes };
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

exports.importNodes = (req, res) => {
    const result = normalizeImportedNodes(req.body && req.body.nodes);
    if (result.error) return res.status(400).json({ error: result.error });

    const imported = opcuaManager.replaceNodes(result.nodes);
    if (imported.error) return res.status(500).json(imported);
    res.json(imported);
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
