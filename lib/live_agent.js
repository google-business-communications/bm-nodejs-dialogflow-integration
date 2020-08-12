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

/**
 * Live Agent Implementation File: to integrate a live agent platform, call
 * the following functions:
 * When a live agent joins the conversation, call the agentJoined function
 * When a live agent leaves the conversation, call the agentLeft function
 * To send a message to the user, call the sendMessage function.
 * Add your logic to onReceiveMessage and onAgentRequested
 */


'use strict';

const firebase = require('./firebase_handler.js').firebase;
const uuid = require('uuid');
const bmApiHelper = require('./bm_api_helper.js');

/**
 * Supported message content types
 * @enum {number}
 */
const MessageContentType = {
  JSON: 1,
  TEXT: 2,
};

const factory = {
  receiveMessage: onReceiveMessage,
  requestAgent: onAgentRequested,
  sendMessage,
  agentJoined,
  agentLeft,
  MessageContentType,
};

/**
 * Template function for receiving message: called by router
 * When the user sends a message in Business Messages and a live agent is
 * present, the router will call this function with the message.
 * @param {string} message The message to receive
 * @param {string} conversationId The conversation ID
 */
async function onReceiveMessage(message, conversationId) {
  if (message === undefined || conversationId === undefined) {
    throw new Error('Message or conversationId is invalid');
  }
  // TODO: Add your live agent logic here
}

/**
 * On request a live agent: called by router
 * When the user requests a live agent through chat, the router will call
 * this function. This function serves to start the live agent transfer process.
 * @param {string} agentId The agent ID
 * @param {string} conversationId The conversation ID
 */
function onAgentRequested(agentId, conversationId) {
  firebase.setRequestedLiveAgent(agentId, conversationId).then(() => {
    // TODO: Add your live agent logic here.
  });
}

/**
 * Template function for sending message: called by live agent
 *
 * @param {string} agentId The agent ID
 * @param {string} conversationId The conversation ID
 * @param {string} messageId The message ID
 * @param {string} message The message to send
 * @param {MessageContentType} messageContentType Message content type (default
 * JSON)
 */
async function sendMessage(
    agentId,
    conversationId,
    messageId,
    message,
    messageContentType = MessageContentType.TEXT,
) {
  if (
    agentId === undefined ||
    message === undefined ||
    conversationId === undefined ||
    messageId === undefined
  ) {
    throw new Error('Invalid argument(s)');
  } else {
    let msgJson;
    if (messageContentType === MessageContentType.JSON) {
      msgJson = message;
    } else {
      const representativeInfo = await firebase
          .getRepresentativeInfo(agentId, conversationId);
      msgJson = {
        messageId: messageId,
        representative: {
          representativeType: 'HUMAN',
          displayName: representativeInfo.representativeName,
        },
        text: message,
      };
    }
    await bmApiHelper
        .sendBmMessage(agentId, msgJson, conversationId, /* update */ false);
  }
}

/**
 * Agent leaves conversation: called by live agent
 * @param {string} agentId The agent ID
 * @param {string} conversationId The conversation ID
 */
async function agentLeft(agentId, conversationId) {
  firebase.clearLiveAgent(agentId, conversationId).then(async () => {
    // Send "Representative Left" message in chat
    await bmApiHelper.sendRepresentativeEvent(false, conversationId, uuid.v4());
    await bmApiHelper.sendCsat(conversationId, uuid.v4());
  });
}

/**
 * Agent joins conversation: called by the live agent
 * @param {string} agentId The agent ID
 * @param {string} conversationId The conversation ID
 * @param {string} representativeName The name of the business representative
 */
function agentJoined(agentId, conversationId, representativeName) {
  firebase.setRepresentativeInfo(agentId,
      conversationId,
      representativeName).then(async () => {
    // Send "Representative Joined" message in chat
    await bmApiHelper.sendRepresentativeEvent(true, conversationId, uuid.v4());
  });
}

module.exports = factory;
