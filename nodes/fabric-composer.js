/**
 * Copyright 2017 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function (RED) {
  'use strict';
  const AssetDeclaration = require('composer-common').AssetDeclaration;
  const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
  const ConceptDeclaration = require('composer-common').ConceptDeclaration;
  const ParticipantDeclaration = require('composer-common').ParticipantDeclaration;
  const TransactionDeclaration = require('composer-common').TransactionDeclaration;

  let connected = false;
  let connecting = false;
  let connectionPromise;
  let businessNetworkConnection = new BusinessNetworkConnection();

  let connectionProfileName, businessNetworkIdentifier, participantId, participantPassword;
  let businessNetworkDefinition, serializer, modelManager, introspector;

  const UPDATE = 'update';
  const RETRIEVE = 'retrieve';
  const CREATE = 'create';

  /**
   * Connect to the Business Network
   * @return {Promise} A promise that is resolved when the connector has connected.
   */
  function connectInternal (node) {
    node.log('connectInternal');
    node.log('settings', connectionProfileName, businessNetworkIdentifier, participantId, participantPassword);
    connecting = true;
    connected = false;
    connectionPromise = businessNetworkConnection
      .connect(connectionProfileName,
        businessNetworkIdentifier,
        participantId,
        participantPassword
      )
      .then((result) => {
        // setup some objects for this business network
        businessNetworkDefinition = result;
        serializer = businessNetworkDefinition.getSerializer();
        modelManager = businessNetworkDefinition.getModelManager();
        introspector = businessNetworkDefinition.getIntrospector();
      })
      .then(() => {
        connected = true;
        connecting = false;
      })
      .catch((error) => {
        connected = connecting = false;
        node.error(error);
      });
    return connectionPromise;
  }

  /**
   * Ensure that the connector has connected to Composer.
   * @return {Promise} A promise that is resolved when the connector has connected.
   */
  function ensureConnected (node) {
    node.log('ensureConnected');
    if (connected) {
      return Promise.resolve();
    } else if (connecting) {
      return connectionPromise;
    } else {
      return connectInternal(node);
    }
  }

  /**
   * Create an instance of an object in Composer. For assets, this method
   * adds the asset to the default asset registry. For transactions, this method
   * submits the transaction for execution.
   */
  function create (data, node) {
    node.log('create', data);

    return ensureConnected(node)
      .then(() => {
        node.log('connected');
        // Convert the JSON data into a resource.
        let serializer = businessNetworkDefinition.getSerializer();
        let resource = serializer.fromJSON(data);

        // The create action is based on the type of the resource.
        let classDeclaration = resource.getClassDeclaration();
        if (classDeclaration instanceof AssetDeclaration) {
          node.log('creating asset', data);
          // For assets, we add the asset to its default asset registry
          return businessNetworkConnection.getAssetRegistry(classDeclaration.getFullyQualifiedName())
            .then((assetRegistry) => {
              node.log('Got asset registry');
              return assetRegistry.add(resource);
            })
            .then(() => {
              node.log('added resource');
              node.status({});
            })
            .catch((error) => {
              node.error(error.message);
            });

        } else if (classDeclaration instanceof TransactionDeclaration) {
          node.log('creating transaction');
          // For transactions, we submit the transaction for execution.
          return businessNetworkConnection.submitTransaction(resource)
            .then(() => {
              node.status({});
            })
            .catch((error) => {
              node.error(error.message);
            });

        } else if (classDeclaration instanceof ParticipantDeclaration) {
          node.log('creating participant');
          return businessNetworkConnection.getParticipantRegistry(classDeclaration.getFullyQualifiedName())
            .then((participantRegistry) => {
              node.log('got registry', participantRegistry);
              return participantRegistry.add(resource);
            })
            .then(() => {
              node.log('added');
              node.status({});
            })
            .catch((error) => {
              node.error(error.message);
            });
        } else {
          // For everything else, we blow up!
          node.error(`Unable to handle resource of type: ${typeof classDeclaration}`);
        }
      })
      .catch((error) => {
        node.error('create', 'error thrown doing create', error.message);
      });
  }

  /**
   * Get an instance of an object in Composer. For assets, this method
   * gets the asset from the default asset registry.
   */
  function retrieve (data, node) {
    node.log('retrieve');

    let modelName = data.modelName;
    let id = data.id;

    return ensureConnected(node)
      .then(() => {
        node.log('connected');
        let modelManager = businessNetworkDefinition.getModelManager();
        let classDeclaration = modelManager.getType(modelName);

        if (classDeclaration instanceof AssetDeclaration) {
          // For assets, we add the asset to its default asset registry.
          return businessNetworkConnection.getAssetRegistry(modelName)
            .then((assetRegistry) => {
              node.log('got asset registry');
              return assetRegistry.get(id);
            })
            .then((result) => {
              node.log('got asset');
              return serializer.toJSON(result);
            })
            .catch((error) => {
              throw error;
            });
        } else if (classDeclaration instanceof ParticipantDeclaration) {
          // For participants, we add the participant to its default participant registry.
          return businessNetworkConnection.getParticipantRegistry(modelName)
            .then((participantRegistry) => {
              node.log('got participant registry');
              return participantRegistry.get(id);
            })
            .then((result) => {
              node.log('got participant');
              return serializer.toJSON(result);
            })
            .catch((error) => {
              throw(error);
            });
        } else {
          // For everything else, we blow up!
          throw new Error(`Unable to handle resource of type: ${typeof classDeclaration}`);
        }
      })
      .catch((error) => {
        throw new Error('retrieve: error thrown doing retrieve ' + error.message);
      });
  }

  /**
   * Update an instance of an object in Composer. For assets, this method
   * updates the asset to the default asset registry.
   */
  function update (data, node) {
    node.log('update');

    return ensureConnected(node)
      .then(() => {
        node.log('connected');
        // Convert the JSON data into a resource.
        let serializer = businessNetworkDefinition.getSerializer();
        let resource = serializer.fromJSON(data);

        // The create action is based on the type of the resource.
        let classDeclaration = resource.getClassDeclaration();
        if (classDeclaration instanceof AssetDeclaration) {
          // For assets, we add the asset to its default asset registry.
          return businessNetworkConnection.getAssetRegistry(classDeclaration.getFullyQualifiedName())
            .then((assetRegistry) => {
              return assetRegistry.update(resource);
            })
            .then(() => {
              node.log('updated');
              node.status({});
            })
            .catch((error) => {
              throw(error);
            });
        } else if (classDeclaration instanceof ParticipantDeclaration) {
          // For participants, we add the participant to its default participant registry.
          return businessNetworkConnection.getParticipantRegistry(classDeclaration.getFullyQualifiedName())
            .then((participantRegistry) => {
              node.log('got participant registry');
              return participantRegistry.update(resource);
            })
            .then(() => {
              node.log('updated');
              node.status({});
            })
            .catch((error) => {
              throw(error);
            });
        } else {
          // For everything else, we blow up!
          throw new Error(`Unable to handle resource of type: ${typeof classDeclaration}`);
        }
      })
      .catch((error) => {
        node.status({fill : 'red', shape : 'dot', text : 'Error updating resource'});
        node.error('update: error thrown doing update ' + error.message);
      });
  }

  function checkConfig (config) {
    return Promise.resolve().then(() => {

      if (!config.connectionProfile) {
        throw new Error('connection profile must be set');
      } else if (!config.businessNetworkIdentifier) {
        throw new Error('business network identifier must be set');
      } else if (!config.participantId) {
        throw new Error('participant id must be set');
      } else if (!config.participantPassword) {
        throw new Error('participant password must be set');
      }

      return '';
    })
  }

  function checkPayLoad (payLoad, type) {
    return Promise.resolve().then(() => {
      if (type === RETRIEVE) {
        if (!payLoad.modelName) {
          throw new Error('modelName not set in payload');
        } else if (!payLoad.id) {
          throw new Error('id not set in payload');
        }
      } else if (type === UPDATE || type === CREATE) {
        if (!payLoad.$class) {
          throw new Error('$class not set in payload');
        }
      }

      return '';
    })
  }

  function FabricComposerOutNode (config) {
    var node = this;
    RED.nodes.createNode(node, config);

    node.on('input', function (msg) {

      checkConfig(config)
        .then(() => {
          connectionProfileName = config.connectionProfile;
          businessNetworkIdentifier = config.businessNetworkIdentifier;
          participantId = config.participantId;
          participantPassword = config.participantPassword;

          node.log('checking payload');
          return checkPayLoad(msg.payload, config.actionType);
        })
        .then(() => {
          if (config.actionType == 'create') {
            return create(msg.payload, node)
          } else {
            return update(msg.payload, node);
          }
        })
        .catch((error) => {
          node.status({fill : 'red', shape : 'dot', text : 'Error with inputs'});
          node.error(error.message);
        });
    });
  }

  RED.nodes.registerType('fabric-composer-out', FabricComposerOutNode);

  function FabricComposerMidNode (config) {
    var node = this;
    RED.nodes.createNode(node, config);

    node.on('input', function (msg) {

        checkConfig(config)
          .then(() => {
            connectionProfileName = config.connectionProfile;
            businessNetworkIdentifier = config.businessNetworkIdentifier;
            participantId = config.participantId;
            participantPassword = config.participantPassword;

            return checkPayLoad(msg.payload, RETRIEVE);

          })
          .then(() => {
            node.status('retrieving resource');
            return retrieve(msg.payload, node);
          })
          .then((result) => {
            node.log('got a result');
            msg.payload = result;
            node.status({});
            node.send(msg);
          })
          .catch((error) => {
            node.status({fill : 'red', shape : 'dot', text : 'Error'});
            node.error(error.message);
          });
      }
    );
  }

  RED.nodes.registerType('fabric-composer-mid', FabricComposerMidNode);
};


