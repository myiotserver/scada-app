/**
 * OPC-UA Manager - Weighing App (SRIBOGA)
 * Manages OPC-UA client connections, subscriptions, and node monitoring.
 * Config persisted in config/opcua.config.json
 */

const fs = require('fs');
const path = require('path');
const { OPCUAClient, AttributeIds, ClientSubscription, ClientMonitoredItem, TimestampsToReturn, SecurityPolicy, MessageSecurityMode, NodeClass, UserTokenType } = require("node-opcua");
const logger = require('./logger');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'opcua.config.json');

const HEALTH_CHECK_INTERVAL = 15000; // 15 seconds
const RECONNECT_DELAYS = [5000, 10000, 20000, 30000]; // Exponential backoff steps

class OpcUaManager {
    constructor() {
        this.client = null;
        this.session = null;
        this.subscription = null;
        this.monitoredItems = [];
        this.connected = false;
        this.connecting = false;
        this.reconnecting = false;
        this.config = this._loadConfig();
        this.liveValues = {};

        // Socket.IO subscribers
        this.subscribers = {};

        // Health check & reconnect
        this._healthCheckTimer = null;
        this._reconnectTimer = null;
        this._reconnectAttempt = 0;
        this._manualDisconnect = false;
    }

    _isAutoConnectEnabled() {
        if (process.env.OPCUA_AUTO_CONNECT !== undefined) {
            return process.env.OPCUA_AUTO_CONNECT === 'true';
        }
        return !!this.config.autoConnect;
    }

    // --- Config ---

    _inferMachineId(node) {
        const name = (node && node.name ? String(node.name) : '').trim().toUpperCase();
        const nodeId = (node && node.nodeId ? String(node.nodeId) : '').trim().toUpperCase();

        const fromName = name.match(/^(?:CR|S)([1-5])$/);
        if (fromName) return parseInt(fromName[1], 10);

        const fromNodeId = nodeId.match(/(?:CR0?([1-5])|SENSOR0?([1-5]))/);
        if (fromNodeId) return parseInt(fromNodeId[1] || fromNodeId[2], 10);

        return null;
    }

    _inferSignalType(node) {
        const name = (node && node.name ? String(node.name) : '').trim().toUpperCase();
        const nodeId = (node && node.nodeId ? String(node.nodeId) : '').trim().toUpperCase();

        if (/^CR[1-5]$/.test(name) || /GR_CR0?[1-5]/.test(nodeId) || /GROSS/.test(nodeId)) {
            return 'GROSS_WEIGHT';
        }
        if (/^S[1-5]$/.test(name) || /SENSOR0?[1-5]/.test(nodeId)) {
            return 'PRODUCT_SENSOR';
        }
        if (/^RST$|^RESET$/.test(name) || /RESET/.test(nodeId)) {
            return 'RESET';
        }
        if (/MD[_\s-]?SWITCH/.test(name) || /MD[_\s-]?SWITCH/.test(nodeId)) {
            return 'MD_SWITCH';
        }
        if (/SYSTEM[_\s-]?PAUSED/.test(name) || /SYSTEM[_\s-]?PAUSED/.test(nodeId)) {
            return 'SYSTEM_PAUSED';
        }
        if (/COUNT/.test(name) || /COUNT/.test(nodeId)) {
            return 'COUNTER';
        }
        if (/TOLERANCE[_\s-]?MIN/.test(name) || /TOLERANCE[_\s-]?MIN/.test(nodeId)) {
            return 'TOLERANCE_MIN';
        }
        if (/TOLERANCE[_\s-]?MAX/.test(name) || /TOLERANCE[_\s-]?MAX/.test(nodeId)) {
            return 'TOLERANCE_MAX';
        }
        if (/DEVIATION[_\s-]?TOLERANCE[_\s-]?MIN/.test(name) || /DEVIATION[_\s-]?TOLERANCE[_\s-]?MIN/.test(nodeId)) {
            return 'DEVIATION_TOLERANCE_MIN';
        }
        return null;
    }

    _normalizeConfig(config) {
        let changed = false;
        const normalized = { ...config };
        const nodes = Array.isArray(normalized.nodes) ? normalized.nodes : [];
        if (!Array.isArray(normalized.nodes)) changed = true;

        normalized.nodes = nodes.map((node) => {
            if (!node || typeof node !== 'object') {
                changed = true;
                return {
                    nodeId: '',
                    name: '',
                    description: '',
                    machineId: null,
                    signalType: null,
                    scale: 0.01,
                    enabled: true
                };
            }

            const next = { ...node };

            const parsedMachineId = parseInt(next.machineId, 10);
            if (!Number.isInteger(parsedMachineId) || parsedMachineId < 1 || parsedMachineId > 5) {
                const inferredMachineId = this._inferMachineId(next);
                if (inferredMachineId !== null) {
                    if (next.machineId !== inferredMachineId) changed = true;
                    next.machineId = inferredMachineId;
                } else if (next.machineId !== null && next.machineId !== undefined && next.machineId !== '') {
                    changed = true;
                    next.machineId = null;
                }
            } else if (next.machineId !== parsedMachineId) {
                changed = true;
                next.machineId = parsedMachineId;
            }

            const signalType = (next.signalType || '').toString().trim().toUpperCase();
            if (signalType) {
                if (next.signalType !== signalType) changed = true;
                next.signalType = signalType;
            } else {
                const inferredSignalType = this._inferSignalType(next);
                if (inferredSignalType) {
                    changed = true;
                    next.signalType = inferredSignalType;
                }
            }

            const parsedScale = parseFloat(next.scale);
            if (!Number.isFinite(parsedScale)) {
                changed = true;
                next.scale = 0.01;
            } else if (next.scale !== parsedScale) {
                changed = true;
                next.scale = parsedScale;
            }

            if (next.enabled === undefined) {
                changed = true;
                next.enabled = true;
            } else {
                const enabled = !!next.enabled;
                if (next.enabled !== enabled) changed = true;
                next.enabled = enabled;
            }

            return next;
        });

        return { normalized, changed };
    }

    _loadConfig() {
        try {
            const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
            const parsed = JSON.parse(raw);
            const { normalized, changed } = this._normalizeConfig(parsed);

            if (changed) {
                fs.writeFileSync(CONFIG_PATH, JSON.stringify(normalized, null, 4), 'utf-8');
                logger.info('OPC', 'Legacy OPC-UA nodes normalized and saved to config.');
            }

            return normalized;
        } catch (err) {
            logger.error('OPC', `Failed to load config: ${err.message}`);
            return {
                endpointUrl: '',
                securityMode: 'None',
                publishInterval: 1000,
                samplingInterval: 500,
                autoConnect: false,
                nodes: []
            };
        }
    }

    _saveConfig() {
        try {
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 4), 'utf-8');
            return true;
        } catch (err) {
            logger.error('OPC', `Failed to save config: ${err.message}`);
            return false;
        }
    }

    getConfig() {
        return { ...this.config };
    }

    updateConfig(newConfig) {
        if (newConfig.endpointUrl !== undefined) this.config.endpointUrl = newConfig.endpointUrl;
        if (newConfig.securityMode !== undefined) this.config.securityMode = newConfig.securityMode;
        if (newConfig.securityPolicy !== undefined) this.config.securityPolicy = newConfig.securityPolicy;
        if (newConfig.username !== undefined) this.config.username = newConfig.username;
        if (newConfig.password !== undefined) this.config.password = newConfig.password;
        if (newConfig.publishInterval !== undefined) this.config.publishInterval = parseInt(newConfig.publishInterval) || 1000;
        if (newConfig.samplingInterval !== undefined) this.config.samplingInterval = parseInt(newConfig.samplingInterval) || 500;
        if (newConfig.autoConnect !== undefined) this.config.autoConnect = newConfig.autoConnect;
        if (newConfig.nodes !== undefined) this.config.nodes = newConfig.nodes;
        this._saveConfig();
        logger.info('OPC', 'Configuration updated');
        return this.config;
    }

    addNode(nodeId, name, description, machineId, signalType, scale, enabled) {
        const exists = this.config.nodes.find(n => n.nodeId === nodeId);
        if (exists) return { error: 'Node already exists' };

        const newNode = {
            nodeId,
            name: name || nodeId,
            description: description || '',
            machineId: machineId ? parseInt(machineId, 10) : null,
            signalType: signalType || null,
            scale: scale !== undefined ? parseFloat(scale) : 0.01,
            enabled: enabled !== undefined ? !!enabled : true
        };

        this.config.nodes.push(newNode);
        this._saveConfig();
        logger.info('OPC', `Node added: ${newNode.name} (${nodeId})`);

        // Dynamically start monitoring the new node if already connected
        if (this.connected && this.subscription) {
            this._monitorSingleNode(newNode);
        } else {
            logger.info('OPC', `Node saved to config but not monitored (not connected). Will be monitored on next connection.`);
        }

        return { success: true, nodes: this.config.nodes };
    }

    replaceNodes(nodes) {
        const previousNodes = this.config.nodes;
        this.config.nodes = nodes;
        if (!this._saveConfig()) {
            this.config.nodes = previousNodes;
            return { error: 'Failed to save imported nodes' };
        }

        this.liveValues = {};
        if (this.connected && this.subscription) {
            for (const item of this.monitoredItems) {
                try {
                    item.monitoredItem?.terminate();
                } catch (err) {
                    logger.warn('OPC', `Failed to terminate monitored node during import: ${err.message}`);
                }
            }
            this.monitoredItems = [];
            for (const node of nodes) {
                if (node.enabled !== false) this._monitorSingleNode(node);
            }
        }
        this._emitStatus();

        logger.info('OPC', `Node configuration replaced with ${nodes.length} imported nodes`);
        return { success: true, nodes: this.config.nodes };
    }

    _removeMonitoredItemByIndex(configIndex) {
        const itemIdx = this.monitoredItems.findIndex((_, i) => {
            // Match by config index indirectly — use the nodeId reference
            const mi = this.monitoredItems[i];
            const cfgNode = this.config.nodes[configIndex];
            return cfgNode && mi.node && mi.node.nodeId === cfgNode.nodeId;
        });
        if (itemIdx !== -1) {
            const [removed] = this.monitoredItems.splice(itemIdx, 1);
            try {
                if (removed.monitoredItem) {
                    removed.monitoredItem.terminate();
                }
            } catch (err) {
                logger.warn('OPC', `Error terminating monitored item: ${err.message}`);
            }
            logger.info('OPC', `Monitored item removed for config index ${configIndex}`);
        }
    }

    updateNode(index, data) {
        if (index < 0 || index >= this.config.nodes.length) return { error: 'Invalid index' };

        const node = this.config.nodes[index];
        const oldNodeId = node.nodeId;
        const wasEnabled = node.enabled;

        if (data.nodeId !== undefined) node.nodeId = data.nodeId;
        if (data.name !== undefined) node.name = data.name;
        if (data.description !== undefined) node.description = data.description;
        if (data.machineId !== undefined) node.machineId = data.machineId ? parseInt(data.machineId, 10) : null;
        if (data.signalType !== undefined) node.signalType = data.signalType;
        if (data.scale !== undefined) node.scale = parseFloat(data.scale);
        if (data.enabled !== undefined) node.enabled = !!data.enabled;

        this._saveConfig();
        logger.info('OPC', `Node updated: ${node.name}`);

        // Sync monitoring with the active subscription if connected
        if (this.connected && this.subscription) {
            const nodeIdChanged = data.nodeId !== undefined && data.nodeId !== oldNodeId;
            const enableChanged = data.enabled !== undefined && data.enabled !== wasEnabled;
            const nameChanged = data.name !== undefined && data.name !== node.name;

            if (nodeIdChanged || (enableChanged && node.enabled) || (enableChanged && !node.enabled)) {
                // Remove old monitored item
                this._removeMonitoredItemByIndex(index);
                // Add new one if now enabled
                if (node.enabled) {
                    this._monitorSingleNode(node);
                } else {
                    // Clean up live value if monitoring was removed
                    delete this.liveValues[node.name];
                    this._emitStatus();
                }
            }
        }

        return { success: true, nodes: this.config.nodes };
    }

    removeNode(index) {
        if (index < 0 || index >= this.config.nodes.length) return { error: 'Invalid index' };
        const removed = this.config.nodes.splice(index, 1);
        this._saveConfig();

        // Remove from active subscription if connected
        if (this.connected && this.subscription) {
            this._removeMonitoredItemByIndex(index);
            // Also clean up live value
            if (removed[0] && removed[0].name) {
                delete this.liveValues[removed[0].name];
                this._emitStatus();
            }
        }

        logger.info('OPC', `Node removed: ${removed[0]?.name || 'unknown'}`);
        return { success: true, nodes: this.config.nodes };
    }

    // --- Status ---

    getStatus() {
        return {
            connected: this.connected,
            connecting: this.connecting,
            reconnecting: this.reconnecting,
            endpointUrl: this.config.endpointUrl,
            monitoredNodes: this.monitoredItems.length,
            totalConfiguredNodes: this.config.nodes.length,
            liveValues: this.liveValues
        };
    }

    // --- Health Check ---

    _startHealthCheck() {
        this._stopHealthCheck();
        this._healthCheckTimer = setInterval(async () => {
            if (!this.connected || !this.session) return;
            try {
                // Read ServerStatus node (i=2256) as heartbeat
                const dataValue = await this.session.read({
                    nodeId: 'i=2256',
                    attributeId: AttributeIds.Value
                });
                if (dataValue.statusCode.name !== 'Good') {
                    throw new Error(`Bad status: ${dataValue.statusCode.name}`);
                }
                // Health check OK — silent (don't spam logs)
            } catch (err) {
                logger.error('OPC', `Health check failed: ${err.message}`);
                this.connected = false;
                this._emitStatus();
                this._stopHealthCheck();
                this._triggerAutoReconnect();
            }
        }, HEALTH_CHECK_INTERVAL);
    }

    _stopHealthCheck() {
        if (this._healthCheckTimer) {
            clearInterval(this._healthCheckTimer);
            this._healthCheckTimer = null;
        }
    }

    // --- Auto-Reconnect ---

    _triggerAutoReconnect() {
        if (this._manualDisconnect) return;
        if (!this._isAutoConnectEnabled()) {
            logger.info('OPC', 'Auto-reconnect disabled. Will not attempt reconnection.');
            return;
        }
        if (this.reconnecting || this.connecting) return;

        const delay = RECONNECT_DELAYS[Math.min(this._reconnectAttempt, RECONNECT_DELAYS.length - 1)];
        this._reconnectAttempt++;
        this.reconnecting = true;
        this._emitStatus();

        logger.warn('OPC', `Auto-reconnect attempt #${this._reconnectAttempt} in ${delay / 1000}s...`);

        this._reconnectTimer = setTimeout(async () => {
            this.reconnecting = false;
            if (this._manualDisconnect) return;

            logger.info('OPC', `Attempting auto-reconnect #${this._reconnectAttempt}...`);
            const result = await this.connect();
            if (result.error) {
                logger.error('OPC', `Auto-reconnect failed: ${result.error}`);
                // Will be called again from connect() failure path or close event
            }
        }, delay);
    }

    _cancelAutoReconnect() {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
        this.reconnecting = false;
        this._reconnectAttempt = 0;
    }

    // --- Connection ---

    async connect() {
        if (this.connected || this.connecting) {
            return { error: this.connected ? 'Already connected' : 'Connection in progress' };
        }
        if (!this.config.endpointUrl) {
            return { error: 'No endpoint URL configured' };
        }

        this._manualDisconnect = false;
        this.connecting = true;
        this.reconnecting = false;
        this._emitStatus();

        try {
            let secMode = MessageSecurityMode.None;
            if (this.config.securityMode === 'SignAndEncrypt') secMode = MessageSecurityMode.SignAndEncrypt;
            else if (this.config.securityMode === 'Sign') secMode = MessageSecurityMode.Sign;

            let secPolicy = SecurityPolicy.None;
            if (secMode !== MessageSecurityMode.None) {
                const policyMap = {
                    'Basic128Rsa15': SecurityPolicy.Basic128Rsa15,
                    'Basic256': SecurityPolicy.Basic256,
                    'Basic256Sha256': SecurityPolicy.Basic256Sha256
                };
                secPolicy = policyMap[this.config.securityPolicy] || SecurityPolicy.Basic256;
            }

            this.client = OPCUAClient.create({
                endpointMustExist: false,
                securityMode: secMode,
                securityPolicy: secPolicy,
                connectionStrategy: { maxRetry: 3, initialDelay: 1000, maxDelay: 5000 }
            });

            // Bypass strict server certificate verification for self-signed certs
            if (secMode !== MessageSecurityMode.None) {
                this.client.fetchServerCertificate = (endpointUrl, callback) => {
                    const tmpClient = OPCUAClient.create({
                        endpointMustExist: false,
                        securityMode: MessageSecurityMode.None,
                        securityPolicy: SecurityPolicy.None,
                        connectionStrategy: { maxRetry: 1, initialDelay: 1000, maxDelay: 3000 }
                    });
                    tmpClient.connect(endpointUrl)
                        .then(() => tmpClient.getEndpoints())
                        .then((endpoints) => {
                            tmpClient.disconnect().catch(() => { });
                            const policyName = this.config.securityPolicy || 'Basic256';
                            const matching = endpoints.find(ep =>
                                ep.securityMode === secMode &&
                                ep.securityPolicyUri &&
                                ep.securityPolicyUri.endsWith(policyName)
                            );
                            if (matching && matching.serverCertificate) {
                                this.client.serverCertificate = matching.serverCertificate;
                                logger.info('OPC', 'Server certificate accepted (bypass mode)');
                                callback(null, endpointUrl);
                            } else if (endpoints.length > 0 && endpoints[0].serverCertificate) {
                                this.client.serverCertificate = endpoints[0].serverCertificate;
                                logger.info('OPC', 'Server certificate accepted (first endpoint)');
                                callback(null, endpointUrl);
                            } else {
                                callback(new Error('No server certificate found'));
                            }
                        })
                        .catch((err) => {
                            tmpClient.disconnect().catch(() => { });
                            logger.error('OPC', `Certificate discovery failed: ${err.message}`);
                            callback(err);
                        });
                };
            }

            this.client.on('close', () => {
                logger.warn('OPC', 'Connection closed');
                const wasConnected = this.connected;
                this.connected = false;
                this.connecting = false;
                this._stopHealthCheck();
                this._emitStatus();
                if (wasConnected && !this._manualDisconnect) {
                    this._triggerAutoReconnect();
                }
            });

            logger.info('OPC', `Connecting to ${this.config.endpointUrl} (${this.config.securityMode}/${this.config.securityPolicy || 'None'})...`);
            await this.client.connect(this.config.endpointUrl);
            logger.info('OPC', 'TCP connection established');

            // Build user identity
            let userIdentity = { type: UserTokenType.Anonymous };
            if (this.config.username) {
                userIdentity = {
                    type: UserTokenType.UserName,
                    userName: this.config.username,
                    password: this.config.password || ''
                };
                logger.info('OPC', `Authenticating as '${this.config.username}'`);
            }

            this.session = await this.client.createSession(userIdentity);
            logger.info('OPC', 'Session created');

            this.connected = true;
            this.connecting = false;
            this._reconnectAttempt = 0; // Reset backoff on success

            await this._createSubscription();
            this._startHealthCheck();
            this._emitStatus();
            logger.info('OPC', `Connected successfully. Monitoring ${this.config.nodes.length} nodes.`);
            return { success: true, message: 'Connected successfully' };
        } catch (err) {
            logger.error('OPC', `Connection failed: ${err.message}`);
            this.connected = false;
            this.connecting = false;
            this._emitStatus();
            try { if (this.client) await this.client.disconnect(); } catch (e) { }
            this.client = null;
            this.session = null;

            // Auto-reconnect on failure
            if (!this._manualDisconnect && this._isAutoConnectEnabled()) {
                this._triggerAutoReconnect();
            }
            return { error: `Connection failed: ${err.message}` };
        }
    }

    async disconnect() {
        if (!this.connected && !this.connecting && !this.reconnecting) return { error: 'Not connected' };
        this._manualDisconnect = true;
        this._cancelAutoReconnect();
        this._stopHealthCheck();

        try {
            if (this.subscription) { await this.subscription.terminate(); this.subscription = null; }
            if (this.session) { await this.session.close(); this.session = null; }
            if (this.client) { await this.client.disconnect(); this.client = null; }
        } catch (err) {
            logger.error('OPC', `Disconnect error: ${err.message}`);
        }
        this.connected = false;
        this.connecting = false;
        this.reconnecting = false;
        this.monitoredItems = [];
        this.liveValues = {};
        this._emitStatus();
        logger.info('OPC', 'Disconnected manually');
        return { success: true, message: 'Disconnected' };
    }

    // --- Subscription ---

    async _createSubscription() {
        if (!this.session) return;
        this.subscription = ClientSubscription.create(this.session, {
            requestedPublishingInterval: this.config.publishInterval || 1000,
            requestedLifetimeCount: 100,
            requestedMaxKeepAliveCount: 10,
            maxNotificationsPerPublish: 100,
            publishingEnabled: true,
            priority: 10
        });

        this.subscription.on('started', () => {
            logger.info('OPC', 'Subscription started');
            this._monitorNodes();
        });
        this.subscription.on('terminated', () => logger.info('OPC', 'Subscription terminated'));
    }

    async _monitorNodes() {
        if (!this.subscription || this.config.nodes.length === 0) return;
        this.monitoredItems = [];

        for (const node of this.config.nodes) {
            if (!node.nodeId || node.enabled === false) continue;
            try {
                const monitoredItem = ClientMonitoredItem.create(
                    this.subscription,
                    { nodeId: node.nodeId, attributeId: AttributeIds.Value },
                    { samplingInterval: this.config.samplingInterval || 500, discardOldest: true, queueSize: 10 },
                    TimestampsToReturn.Both
                );

                monitoredItem.on('err', (err) => {
                    logger.error('OPC', `Error for ${node.name}: ${err.message}`);
                });
                monitoredItem.on('changed', (dataValue) => {
                    const value = dataValue.value ? dataValue.value.value : null;
                    this.liveValues[node.name] = {
                        value,
                        timestamp: new Date().toISOString(),
                        nodeId: node.nodeId,
                        statusCode: dataValue.statusCode ? dataValue.statusCode.toString() : 'Good'
                    };
                    this._emitUpdate(node.name, this.liveValues[node.name]);
                });

                this.monitoredItems.push({ node, monitoredItem });
                logger.info('OPC', `Monitoring: ${node.name} (${node.nodeId})`);
            } catch (err) {
                logger.error('OPC', `Failed to monitor ${node.name}: ${err.message}`);
            }
        }
        this._emitStatus();
    }

    _monitorSingleNode(node) {
        if (!this.subscription || !node.nodeId || node.enabled === false) return null;
        try {
            const monitoredItem = ClientMonitoredItem.create(
                this.subscription,
                { nodeId: node.nodeId, attributeId: AttributeIds.Value },
                { samplingInterval: this.config.samplingInterval || 500, discardOldest: true, queueSize: 10 },
                TimestampsToReturn.Both
            );

            monitoredItem.on('err', (err) => {
                logger.error('OPC', `Error for ${node.name}: ${err.message}`);
            });
            monitoredItem.on('changed', (dataValue) => {
                const value = dataValue.value ? dataValue.value.value : null;
                this.liveValues[node.name] = {
                    value,
                    timestamp: new Date().toISOString(),
                    nodeId: node.nodeId,
                    statusCode: dataValue.statusCode ? dataValue.statusCode.toString() : 'Good'
                };
                this._emitUpdate(node.name, this.liveValues[node.name]);
            });

            this.monitoredItems.push({ node, monitoredItem });
            logger.info('OPC', `Monitoring (dynamic): ${node.name} (${node.nodeId})`);
            this._emitStatus();
            return monitoredItem;
        } catch (err) {
            logger.error('OPC', `Failed to monitor ${node.name} dynamically: ${err.message}`);
            return null;
        }
    }

    // --- Browse ---

    async browseNodes(nodeId) {
        if (!this.session) return { error: 'Not connected' };
        try {
            const targetNodeId = nodeId || 'RootFolder';
            const browseResult = await this.session.browse(targetNodeId);
            const nodes = browseResult.references.map(ref => ({
                nodeId: ref.nodeId.toString(),
                browseName: ref.browseName.toString(),
                displayName: ref.displayName.text || ref.browseName.name,
                nodeClass: NodeClass[ref.nodeClass] || ref.nodeClass.toString(),
                isFolder: ref.nodeClass === NodeClass.Object || ref.nodeClass === NodeClass.View
            }));
            return { success: true, parentNodeId: targetNodeId, nodes };
        } catch (err) {
            return { error: `Browse failed: ${err.message}` };
        }
    }

    // --- Write ---

    async _getNodeValueDataType(nodeId) {
        const { DataType } = require("node-opcua");
        const dataValue = await this.session.read({
            nodeId,
            attributeId: AttributeIds.Value
        });

        if (!dataValue || !dataValue.statusCode || dataValue.statusCode.name !== 'Good') {
            throw new Error(`Read before write returned ${dataValue?.statusCode?.name || 'an invalid status'}`);
        }

        const dataType = dataValue.value && dataValue.value.dataType;
        if (typeof dataType !== 'number' || dataType === DataType.Null) {
            throw new Error('Node value does not expose a scalar OPC UA data type');
        }

        return dataType;
    }

    _coerceValueForDataType(value, dataType) {
        const { DataType } = require("node-opcua");
        if (dataType === DataType.Boolean) return Boolean(value);

        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            throw new Error(`Value ${value} is not a finite number`);
        }

        const integerTypes = new Set([
            DataType.SByte, DataType.Byte, DataType.Int16, DataType.UInt16,
            DataType.Int32, DataType.UInt32
        ]);
        if (integerTypes.has(dataType) && !Number.isInteger(numericValue)) {
            throw new Error(`Value ${numericValue} is not valid for integer OPC UA type ${DataType[dataType]}`);
        }

        return numericValue;
    }

    async writeNode(nodeId, value, dataType) {
        if (!this.session) return { error: 'Not connected' };
        try {
            const { DataType } = require("node-opcua");
            const resolvedDataType = dataType === undefined || dataType === null
                ? await this._getNodeValueDataType(nodeId)
                : (typeof dataType === 'number' ? dataType : DataType[dataType]);
            if (typeof resolvedDataType !== 'number') {
                throw new Error(`Unsupported OPC UA data type: ${dataType}`);
            }
            const variantValue = {
                dataType: resolvedDataType,
                value: this._coerceValueForDataType(value, resolvedDataType)
            };

            const statusCode = await this.session.write({
                nodeId: nodeId,
                attributeId: AttributeIds.Value,
                value: {
                    value: variantValue
                }
            });

            if (statusCode.name === 'Good') {
                return { success: true, writtenValue: variantValue.value, dataType: resolvedDataType };
            } else {
                return { error: statusCode.name };
            }
        } catch (err) {
            return { error: `Write failed: ${err.message}` };
        }
    }

    /**
     * Read a node's current value back from the PLC and compare it against
     * the value we believe we just wrote. This closes the gap where the
     * OPC UA write() call returns StatusCode 'Good' (meaning the server
     * *accepted* the request) but the underlying PLC tag never actually
     * updated (e.g. write-protected tag, wrong node mapping, PLC busy,
     * scan-cycle timing, etc.).
     *
     * @param {string} nodeId
     * @param {number|boolean} expectedValue - the raw value expected on the wire (post-scale for tolerances)
     * @param {boolean} isBoolean
     * @returns {Promise<{verified: boolean, actualValue?: any, reason?: string}>}
     */
    async _verifyWrite(nodeId, expectedValue, isBoolean = false) {
        if (!this.session) return { verified: false, reason: 'Not connected' };
        try {
            const dataValue = await this.session.read({
                nodeId,
                attributeId: AttributeIds.Value
            });

            if (!dataValue || !dataValue.statusCode || dataValue.statusCode.name !== 'Good') {
                return { verified: false, reason: `Read-back status: ${dataValue?.statusCode?.name || 'unknown'}` };
            }

            const actual = dataValue.value ? dataValue.value.value : undefined;

            if (isBoolean) {
                const actualBool = Boolean(actual);
                const expectedBool = Boolean(expectedValue);
                if (actualBool !== expectedBool) {
                    return { verified: false, actualValue: actualBool, reason: `Expected ${expectedBool}, read back ${actualBool}` };
                }
                return { verified: true, actualValue: actualBool };
            }

            const actualNum = Number(actual);
            const expectedNum = Number(expectedValue);
            if (!Number.isFinite(actualNum) || !Number.isFinite(expectedNum)) {
                return { verified: false, actualValue: actual, reason: `Non-numeric comparison: actual=${actual} expected=${expectedValue}` };
            }

            // Allow small tolerance for float rounding on the wire (e.g. Real/Float32 tags)
            const tolerance = Math.max(Math.abs(expectedNum) * 0.001, 0.01);
            if (Math.abs(actualNum - expectedNum) > tolerance) {
                return {
                    verified: false,
                    actualValue: actualNum,
                    reason: `Expected ${expectedNum}, read back ${actualNum} (diff ${Math.abs(actualNum - expectedNum).toFixed(4)})`
                };
            }
            return { verified: true, actualValue: actualNum };
        } catch (err) {
            return { verified: false, reason: `Read-back error: ${err.message}` };
        }
    }

    /**
     * Write a value to all OPC nodes matching a given signalType and optional machineId.
     * Useful for pushing tolerance / setpoint data from the app back to the PLC.
     *
     * @param {string} signalType - e.g. 'TOLERANCE_MIN', 'TOLERANCE_MAX', 'DEVIATION_TOLERANCE_MIN'
     * @param {number|null} machineId - 1-5 to filter by carousel, or null for global nodes
     * @param {number} value - the numeric value to write
     * @returns {Promise<Array<{nodeId: string, name: string, success?: boolean, error?: string}>>}
     */
    async writeToNodesBySignalType(signalType, machineId, value) {
        if (!this.session) return [];

        const nodes = this.config.nodes.filter(n => {
            if (!n.nodeId || n.enabled === false) return false;
            if ((n.signalType || '').toString().trim().toUpperCase() !== String(signalType).toUpperCase()) return false;
            if (machineId !== null && machineId !== undefined) {
                const mid = parseInt(n.machineId, 10);
                if (mid !== parseInt(machineId, 10)) return false;
            }
            return true;
        });

        if (nodes.length === 0) {
            logger.warn('OPC', `No nodes found for signalType=${signalType} machineId=${machineId}`);
            return [];
        }

        const results = [];
        for (const node of nodes) {
            const isMachineRun = String(signalType).toUpperCase() === 'MACHINE_RUN';
            const isTolerance = ['TOLERANCE_MIN', 'TOLERANCE_MAX', 'DEVIATION_TOLERANCE_MIN']
                .includes(String(signalType).toUpperCase());
            const scale = Number(node.scale);
            const rawValue = isTolerance && Number.isFinite(scale) && scale > 0
                ? Number((Number(value) / scale).toFixed(10))
                : value;

            // Use the same Variant type currently exposed by the PLC node.
            // In particular, Siemens tags are frequently Int16/UInt16 rather
            // than Double, which otherwise yields BadTypeMismatch.
            let result = await this.writeNode(node.nodeId, isMachineRun ? value === 1 : rawValue);
            if (isMachineRun && !result.success) {
                // Preserve the numeric fallback for servers that do not expose
                // a readable current value before accepting a write.
                result = await this.writeNode(node.nodeId, value, 'Int16');
            }

            // --- Read-back verification ---
            // A 'Good' write status only confirms the OPC server accepted the
            // request; it does NOT guarantee the PLC tag actually changed.
            // Re-read the node and compare against what we intended to write.
            if (result.success) {
                const expectedOnWire = isMachineRun ? (value === 1) : rawValue;
                const verification = await this._verifyWrite(node.nodeId, expectedOnWire, isMachineRun);
                result.verified = verification.verified;
                result.actualValue = verification.actualValue;
                if (!verification.verified) {
                    // Downgrade to failure so callers (and their caches) do not
                    // treat this as a confirmed write.
                    result.success = false;
                    result.error = `Write accepted but read-back mismatch: ${verification.reason}`;
                }
            }

            results.push({ nodeId: node.nodeId, name: node.name, ...result });
            if (result.success) {
                const valueInfo = rawValue === value ? String(value) : `${value} (raw ${rawValue})`;
                logger.info('OPC', `Wrote ${signalType}=${valueInfo} to ${node.name} (${node.nodeId}) — verified OK`);
            } else {
                logger.error('OPC', `Failed writing ${signalType}=${value} to ${node.name}: ${result.error}`);
            }
        }
        return results;
    }

    // --- Socket.IO Subscribers ---

    subscribe(id, callback) { this.subscribers[id] = callback; }
    unsubscribe(id) { delete this.subscribers[id]; }

    _emitStatus() {
        const status = this.getStatus();
        for (const cb of Object.values(this.subscribers)) cb('opcua-status', status);
    }

    _emitUpdate(name, data) {
        for (const cb of Object.values(this.subscribers)) cb('opcua-value', { name, ...data });
    }

    // --- Auto-connect ---

    async autoConnect() {
        if (this._isAutoConnectEnabled() && this.config.endpointUrl) {
            logger.info('OPC', 'Auto-connecting on startup...');
            await this.connect();
        } else {
            logger.info('OPC', 'Startup auto-connect is disabled. Waiting for manual connect from dashboard.');
        }
    }
}

module.exports = new OpcUaManager();
