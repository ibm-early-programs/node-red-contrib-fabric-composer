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
   * @param {string} lbModelName the fully qualified model name.
   * @param {Object} data the data for the asset or transaction.
   * @param {function} callback the callback to call when complete.
   */
  function create (data, node) {
    node.log('create', data);

    ensureConnected(node)
      .then(() => {
      node.log('connection');
        // Convert the JSON data into a resource.
        let serializer = businessNetworkDefinition.getSerializer();
        let resource = serializer.fromJSON(data);

        // The create action is based on the type of the resource.
        let classDeclaration = resource.getClassDeclaration();
        if (classDeclaration instanceof AssetDeclaration) {
          node.log('creating asset', data);
          // For assets, we add the asset to its default asset registry
          businessNetworkConnection.getAssetRegistry(classDeclaration.getFullyQualifiedName())
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
          businessNetworkConnection.submitTransaction(resource)
            .then(() => {
              node.status({});
            })
            .catch((error) => {
              node.error(error.message);
            });

        } else if (classDeclaration instanceof ParticipantDeclaration) {
          node.log('creating participant');
          businessNetworkConnection.getParticipantRegistry(classDeclaration.getFullyQualifiedName())
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

  function FabricComposerOutNode (config) {
    var node = this;
    RED.nodes.createNode(node, config);

    node.on('input', function (msg) {
      connectionProfileName = config.connectionProfile;
      businessNetworkIdentifier = config.businessNetworkIdentifier;
      participantId = config.participantId;
      participantPassword = config.participantPassword;

      create(msg.payload, node)
    });
  }

  RED.nodes.registerType('fabric-composer-out', FabricComposerOutNode);
};


