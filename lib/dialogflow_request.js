/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const dialogflow = require('@google-cloud/dialogflow');
const uuid = require('uuid');
const config = require('../resources/config.json');
const {struct} = require('pb-util');
const firebase = require('./firebase_handler.js').firebase;

const factory = {
  callDialogflow: callDialogflow,
  convertToBm: convertToBm,
  generateDfCall: generateDfCall,
};

/**
 * Send a query to the dialogflow agent, and return the query result.
 * @param {string} agentId The agent ID with DF
 * @param {string} conversationId The conversation id of the message
 * @param {string} message The user message to be sent to dialogflow
 */
async function callDialogflow(agentId, conversationId, message) {
  if (agentId === undefined || conversationId === undefined ||
      message === undefined) {
    throw new Error('Missing arguments');
  }
  let sessionClient;
  let projectId;
  if (config.use_firebase_for_credentials) {
    try {
      const credentials = await firebase.getCredentials(agentId);
      projectId = credentials.dialogflowProjectId;
      sessionClient = new dialogflow.SessionsClient({
        credentials: credentials.dfServiceAccountKey,
      });
    } catch (e) {
      throw new Error('Dialogflow credentials not found');
    }
  } else {
    projectId = config.dialogflow_project_id;
    sessionClient = new dialogflow.SessionsClient({
      keyFilename:
        __dirname +
        '/../resources/' +
        config.df_service_account_credentials_name,
    });
  }

  // A unique identifier for the given session
  const sessionId = conversationId;
  const sessionPath = sessionClient.projectAgentSessionPath(
      projectId,
      sessionId,
  );
  const request = generateDfCall(message, sessionPath);

  // Send request and log result
  const responses = await sessionClient.detectIntent(request);
  const result = responses[0].queryResult;

  // convert dialogflow responses to BM-sendable JSON + add messageId
  const fulfillmentMessages = result.fulfillmentMessages.map(convertToBm);
  return fulfillmentMessages;
}

/**
 * Generates the API request that will be sent to Dialogflow
 * @param {string} message Message to be included
 * @param {string} sessionPath Dialogfow sessionPath
 * @return {object} The request to send to DialogFlow
 */
function generateDfCall(message, sessionPath) {
  if (message === undefined || message === '') {
    throw new Error('Message is empty or undefined');
  } else if (sessionPath === undefined || sessionPath === '') {
    throw new Error('sessionPath is empty or undefined');
  }
  // The text query request.
  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        // The query to send to the dialogflow agent
        text: message,
        // The language used by the client (en-US)
        languageCode: 'en-US',
      },
    },
  };
  return request;
}

/**
 * Convert a Dialogflow payload JSON (protobuf) to a business
 *    messages chip/response
 * @param {string} msg JSON to be converted
 * @return {object} Object containing converted payload
 */
function convertToBm(msg) {
  const messageId = uuid.v4();
  if (msg.payload !== undefined) {
    // custom payload
    const decoded = struct.decode(msg.payload);
    decoded.messageId = messageId;
    return decoded;
  } else {
    // simple text
    const msgObj = {
      messageId: messageId,
      text: msg.text.text[0],
      representative: {
        representativeType: 'BOT',
      },
    };
    return msgObj;
  }
}

module.exports = factory;
