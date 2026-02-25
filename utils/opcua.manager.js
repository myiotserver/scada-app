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
        } catch (err) {
            logger.error('OPC', `Failed to save config: ${err.message}`);
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
        return { success: true, nodes: this.config.nodes };
    }

    updateNode(index, data) {
        if (index < 0 || index >= this.config.nodes.length) return { error: 'Invalid index' };

        const node = this.config.nodes[index];
        if (data.nodeId !== undefined) node.nodeId = data.nodeId;
        if (data.name !== undefined) node.name = data.name;
        if (data.description !== undefined) node.description = data.description;
        if (data.machineId !== undefined) node.machineId = data.machineId ? parseInt(data.machineId, 10) : null;
        if (data.signalType !== undefined) node.signalType = data.signalType;
        if (data.scale !== undefined) node.scale = parseFloat(data.scale);
        if (data.enabled !== undefined) node.enabled = !!data.enabled;

        this._saveConfig();
        logger.info('OPC', `Node updated: ${node.name}`);
        return { success: true, nodes: this.config.nodes };
    }

    removeNode(index) {
        if (index < 0 || index >= this.config.nodes.length) return { error: 'Invalid index' };
        const removed = this.config.nodes.splice(index, 1);
        this._saveConfig();
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
        if (!this.config.autoConnect) {
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
            if (!this._manualDisconnect && this.config.autoConnect) {
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

    async writeNode(nodeId, value, dataType) {
        if (!this.session) return { error: 'Not connected' };
        try {
            const { DataType } = require("node-opcua");
            const variantValue = {
                dataType: DataType[dataType] || DataType.Int16,
                value: value
            };

            const statusCode = await this.session.write({
                nodeId: nodeId,
                attributeId: AttributeIds.Value,
                value: {
                    value: variantValue
                }
            });

            if (statusCode.name === 'Good') {
                return { success: true };
            } else {
                return { error: statusCode.name };
            }
        } catch (err) {
            return { error: `Write failed: ${err.message}` };
        }
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
        if (this.config.autoConnect && this.config.endpointUrl) {
            logger.info('OPC', 'Auto-connecting on startup...');
            await this.connect();
        }
    }
}

module.exports = new OpcUaManager();
