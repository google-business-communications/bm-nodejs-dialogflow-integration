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

const express = require('express');
const router = express.Router();
const uuid = require('uuid');
const crypto = require('crypto');
const moment = require('moment');

const bmApiHelper = require('./lib/bm_api_helper.js');
const config = require('./resources/config.json');
const dfRequest = require('./lib/dialogflow_request.js');
const firebaseHandler = require('./lib/firebase_handler.js');
const firebase = firebaseHandler.firebase;
const liveAgentStatus = firebaseHandler.liveAgentStatus;
const liveAgent = require('./lib/live_agent.js');

const factory = {
  router,
  handleResponse,
  handleByServer,
  handleByAgent,
  directMessage,
};

/*
 * Webhook callback function, endpoint for BM
 */
router.post('/callback', async (req, res, next) => {
  const requestBody = req.body;
  // verify origin of messages is Google
  const rawBody = req.rawBody;
  const signature = req.headers['x-goog-signature'];
  const signedValue = crypto.createHmac('sha512', config.verification_token)
      .update(Buffer.from(rawBody, 'utf8')).digest('base64');
  if (signedValue === signature) {
    console.log('Verified message is from Google');
    try {
      res.sendStatus(200);
      await factory.directMessage(requestBody);
    } catch (e) {
      console.error(e);
      res.sendStatus(400);
    }
  } else {
    console.log('Message is not from Google source.');
    res.sendStatus(400);
  }
});

/**
 * Direct a message to the Dialogflow platform + server logic
 * @param {object} requestBody Request body of incoming message
 */
async function handleByServer(requestBody) {
  const conversationId = requestBody.conversationId;
  // get agentID from request information + truncate brand
  let agentId = requestBody.agent;
  agentId = agentId.substring(agentId.lastIndexOf('/') + 1);
  // Check that the message and text values exist
  if (
    requestBody.message !== undefined &&
    requestBody.message.text !== undefined
  ) {
    const message = requestBody.message.text;
    const messageId = requestBody.message.messageId;
    try {
      const messageObject = {
        messageId: messageId,
        text: message,
      };
      await firebase.addMessageId(agentId, conversationId, messageId);

      await firebase.saveMessage(
          agentId,
          conversationId,
          messageObject,
          moment().unix(),
          'USER',
      );
      await factory.handleResponse(agentId, conversationId, message);
    } catch (e) {
      if (e.message === 'Message already received') {
        throw new Error('Dedupe: message already received');
      }
    }
  } else if ( // check if message is a suggestionResponse
    requestBody.suggestionResponse !== undefined &&
    requestBody.suggestionResponse.postbackData !== undefined
  ) {
    const message = requestBody.suggestionResponse.postbackData;
    const messageObject = {
      text: message,
    };

    await firebase.saveMessage(
        agentId,
        conversationId,
        messageObject,
        moment().unix(),
        'USER',
    );
    // change if there should be alternate behavior for suggestions
    await factory.handleResponse(agentId, conversationId, message);
  } else if (requestBody.userStatus !== undefined) {
    // otherwise, check for live agent request
    if (requestBody.userStatus.requestedLiveAgent) {
      // user requested live agent
      await liveAgent.requestAgent(agentId, conversationId);
    }
  }
}

/**
 * Direct a message to Live Agent
 * @param {object} requestBody Request body of incoming message
 */
async function handleByAgent(requestBody) {
  // truncate brand ID + save to agentID
  let agentId = requestBody.agent;
  agentId = agentId.substring(agentId.lastIndexOf('/') + 1);
  if ( // send message to live agent
    requestBody.message != undefined &&
    requestBody.message.text != undefined
  ) {
    const message = requestBody.message.text;
    const messageId = requestBody.message.messageId;

    const messageObject = {
      messageId: messageId,
      text: message,
    };

    const conversationId = requestBody.conversationId;
    try {
      // save message + message ID to database
      await firebase.addMessageId(agentId, conversationId, messageId);
      await firebase.saveMessage(
          agentId,
          conversationId,
          messageObject,
          moment().unix(),
          'USER',
      );
    } catch (e) {
      if (e.message === 'Message already received') {
        throw new Error('Dedupe: message already received');
      } else {
        console.error(e);
      }
    }
    liveAgent.receiveMessage(message, conversationId);
  } else if (requestBody.userStatus !== undefined) {
    // check for typing status for live agent
    const conversationId = requestBody.conversationId;
    if (requestBody.userStatus.isTyping) {
      firebase.setTypingStatus(agentId, conversationId, true);
    } else {
      firebase.setTypingStatus(agentId, conversationId, false);
    }
  }
}

/**
 * Validates that a response contains a message or suggestionResponse
 * and calls handleResponse
 * @param {string} requestBody HTTP request body from callback
 */
async function directMessage(requestBody) {
  // Extract the message payload parameters
  const conversationId = requestBody.conversationId;
  let agentId = requestBody.agent;
  agentId = agentId.substring(agentId.lastIndexOf('/') + 1);
  const userStatus = await firebase.getUserStatus(
      agentId,
      conversationId,
      requestBody.context.userInfo.displayName,
  );
  // send stop typing to firebase + update timestamp
  await firebase.setTypingStatus(agentId, conversationId, false);
  await firebase.updateTimestamp(agentId, conversationId, moment().unix());
  try {
    // check for credentials in Firebase
    if (config.use_firebase_for_credentials) {
      await firebase.getCredentials(agentId);
    }
    // Direct message by agent availability
    if (
      userStatus === liveAgentStatus.SPEAKING_WITH_BOT ||
      userStatus === liveAgentStatus.REQUESTED_LIVE_AGENT
    ) {
      await factory.handleByServer(requestBody);
    } else {
      await factory.handleByAgent(requestBody);
    }
  } catch (e) {
    if (e.message === 'Error reading credentials from Firebase') {
      // If no credentials in Firebase, then direct message to live agent
      await factory.handleByAgent(requestBody);
    } else if (e.message === 'Dedupe: message already received') {
      console.error('Dedupe: message already received');
    }
  }
}

/**
 * Sends the request to DialogFlow + sends to BM Client
 * @param {string} agentId The agent ID associated with Dialogflow
 * @param {string} conversationId The unique id for user + agent
 * @param {string} message The message text received from the user
 */
async function handleResponse(agentId, conversationId, message) {
  try {
    // send typing started/stopped for Dialogflow
    await bmApiHelper.sendTypingEvent(true, conversationId, uuid.v4());
    // call Dialogflow messages
    const results = await dfRequest
        .callDialogflow(agentId, conversationId, message);
    await bmApiHelper.sendTypingEvent(false, conversationId, uuid.v4());
    await bmApiHelper.sendMessages(agentId, results, conversationId);
  } catch (e) {
    console.error(e);
  }
}

module.exports = factory;
