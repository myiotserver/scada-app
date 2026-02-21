/**
 * OPC-UA Manager - Weighing App (SRIBOGA)
 * Manages OPC-UA client connections, subscriptions, and node monitoring.
 * Config persisted in config/opcua.config.json
 */

const fs = require('fs');
const path = require('path');
const { OPCUAClient, AttributeIds, ClientSubscription, ClientMonitoredItem, TimestampsToReturn, SecurityPolicy, MessageSecurityMode, NodeClass, UserTokenType } = require("node-opcua");

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'opcua.config.json');

class OpcUaManager {
    constructor() {
        this.client = null;
        this.session = null;
        this.subscription = null;
        this.monitoredItems = [];
        this.connected = false;
        this.connecting = false;
        this.config = this._loadConfig();
        this.liveValues = {};

        // Socket.IO subscribers
        this.subscribers = {};
    }

    // --- Config ---

    _loadConfig() {
        try {
            const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
            return JSON.parse(raw);
        } catch (err) {
            console.error('[OPC-UA] Failed to load config:', err.message);
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
            console.error('[OPC-UA] Failed to save config:', err.message);
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
        return this.config;
    }

    addNode(nodeId, name, description) {
        const exists = this.config.nodes.find(n => n.nodeId === nodeId);
        if (exists) return { error: 'Node already exists' };
        this.config.nodes.push({ nodeId, name: name || nodeId, description: description || '' });
        this._saveConfig();
        return { success: true, nodes: this.config.nodes };
    }

    removeNode(index) {
        if (index < 0 || index >= this.config.nodes.length) return { error: 'Invalid index' };
        this.config.nodes.splice(index, 1);
        this._saveConfig();
        return { success: true, nodes: this.config.nodes };
    }

    // --- Status ---

    getStatus() {
        return {
            connected: this.connected,
            connecting: this.connecting,
            endpointUrl: this.config.endpointUrl,
            monitoredNodes: this.monitoredItems.length,
            totalConfiguredNodes: this.config.nodes.length,
            liveValues: this.liveValues
        };
    }

    // --- Connection ---

    async connect() {
        if (this.connected || this.connecting) {
            return { error: this.connected ? 'Already connected' : 'Connection in progress' };
        }
        if (!this.config.endpointUrl) {
            return { error: 'No endpoint URL configured' };
        }

        this.connecting = true;
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
            // (KEPServerEX and many industrial OPC-UA servers use self-signed certificates)
            if (secMode !== MessageSecurityMode.None) {
                this.client.fetchServerCertificate = (endpointUrl, callback) => {
                    // Use a temporary None-security client to discover the server certificate
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
                            // Find matching endpoint by security mode and policy name
                            const policyName = this.config.securityPolicy || 'Basic256';
                            const matching = endpoints.find(ep =>
                                ep.securityMode === secMode &&
                                ep.securityPolicyUri &&
                                ep.securityPolicyUri.endsWith(policyName)
                            );
                            if (matching && matching.serverCertificate) {
                                this.client.serverCertificate = matching.serverCertificate;
                                console.log('[OPC-UA] Server certificate accepted (bypass mode)');
                                // Always use original endpointUrl (server may report 127.0.0.1)
                                callback(null, endpointUrl);
                            } else if (endpoints.length > 0 && endpoints[0].serverCertificate) {
                                this.client.serverCertificate = endpoints[0].serverCertificate;
                                console.log('[OPC-UA] Server certificate accepted (first endpoint)');
                                callback(null, endpointUrl);
                            } else {
                                callback(new Error('No server certificate found'));
                            }
                        })
                        .catch((err) => {
                            tmpClient.disconnect().catch(() => { });
                            console.error('[OPC-UA] Certificate discovery failed:', err.message);
                            callback(err);
                        });
                };
            }

            this.client.on('close', () => {
                console.log('[OPC-UA] Connection closed');
                this.connected = false;
                this.connecting = false;
                this._emitStatus();
            });

            console.log(`[OPC-UA] Connecting to ${this.config.endpointUrl} (${this.config.securityMode}/${this.config.securityPolicy || 'None'})...`);
            await this.client.connect(this.config.endpointUrl);
            console.log('[OPC-UA] Connected!');

            // Build user identity
            let userIdentity = { type: UserTokenType.Anonymous };
            if (this.config.username) {
                userIdentity = {
                    type: UserTokenType.UserName,
                    userName: this.config.username,
                    password: this.config.password || ''
                };
                console.log(`[OPC-UA] Authenticating as '${this.config.username}'`);
            }

            this.session = await this.client.createSession(userIdentity);
            console.log('[OPC-UA] Session created');

            this.connected = true;
            this.connecting = false;

            await this._createSubscription();
            this._emitStatus();
            return { success: true, message: 'Connected successfully' };
        } catch (err) {
            console.error('[OPC-UA] Connection failed:', err.message);
            this.connected = false;
            this.connecting = false;
            this._emitStatus();
            try { if (this.client) await this.client.disconnect(); } catch (e) { }
            this.client = null;
            this.session = null;
            return { error: `Connection failed: ${err.message}` };
        }
    }

    async disconnect() {
        if (!this.connected && !this.connecting) return { error: 'Not connected' };
        try {
            if (this.subscription) { await this.subscription.terminate(); this.subscription = null; }
            if (this.session) { await this.session.close(); this.session = null; }
            if (this.client) { await this.client.disconnect(); this.client = null; }
        } catch (err) {
            console.error('[OPC-UA] Disconnect error:', err.message);
        }
        this.connected = false;
        this.connecting = false;
        this.monitoredItems = [];
        this.liveValues = {};
        this._emitStatus();
        console.log('[OPC-UA] Disconnected');
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
            console.log('[OPC-UA] Subscription started');
            this._monitorNodes();
        });
        this.subscription.on('terminated', () => console.log('[OPC-UA] Subscription terminated'));
    }

    async _monitorNodes() {
        if (!this.subscription || this.config.nodes.length === 0) return;
        this.monitoredItems = [];

        for (const node of this.config.nodes) {
            if (!node.nodeId) continue;
            try {
                const monitoredItem = ClientMonitoredItem.create(
                    this.subscription,
                    { nodeId: node.nodeId, attributeId: AttributeIds.Value },
                    { samplingInterval: this.config.samplingInterval || 500, discardOldest: true, queueSize: 10 },
                    TimestampsToReturn.Both
                );

                monitoredItem.on('err', (err) => {
                    console.error(`[OPC-UA] Error for ${node.name}:`, err.message);
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
                console.log(`[OPC-UA] Monitoring: ${node.name} (${node.nodeId})`);
            } catch (err) {
                console.error(`[OPC-UA] Failed to monitor ${node.name}:`, err.message);
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
                dataType: DataType[dataType] || DataType.Int16, // Default to Int16
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
            console.log('[OPC-UA] Auto-connecting...');
            await this.connect();
        }
    }
}

module.exports = new OpcUaManager();
