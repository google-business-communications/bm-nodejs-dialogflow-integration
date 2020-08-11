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

const apiHelper = require('./api_helper.js');
const firebase = require('./firebase_handler.js').firebase;
const moment = require('moment');

const factory = {
  sendMessages,
  sendTypingEvent,
  sendBmMessage,
  sendRepresentativeEvent,
  sendCsat,
};

/**
 * Builds a message from the response from Dialogflow and sends it to the user.
 *
 * @param {array} agentId The Agent ID
 * @param {array} messages The messages received from the user.
 * @param {string} conversationId The unique id for this user and agent.
 */
async function sendMessages(agentId, messages, conversationId) {
  // Send messages to user in an order that the response were received from DF
  for (let i = 0; i < messages.length; i++) {
    try {
      await factory.sendBmMessage(agentId, messages[i], conversationId);
    } catch (e) {
      throw new Error(e);
    }
  }
  return true;
}

/**
 * Send customer satisfaction survey
 *
 * @param {string} conversationId Conversation ID
 * @param {string} surveyId Survey ID
 */
async function sendCsat(conversationId, surveyId) {
  return new Promise((resolve, reject) => {
    // create survey parameters + send to BM
    const params = {
      auth: apiHelper.authClient,
      parent:
          'conversations/' + conversationId + '/surveys?surveyId=' + surveyId,
    };
    apiHelper.bmApi.conversations.surveys
        .create(params, {}, (err, response) => {
          if (err) reject(err);
          resolve(response);
        });
  });
}

/**
 * Builds an event to send a typing status to the user
 * @param {boolean} typingStatus Whether to send a typing start/stop event
 * @param {string} conversationId The unique id for this conversation
 * @param {string} eventId The event id to be sent to the user
 */
async function sendTypingEvent(typingStatus, conversationId, eventId) {
  return new Promise((resolve, reject) => {
    if (
      typingStatus === undefined ||
      conversationId === undefined ||
      eventId === undefined
    ) {
      reject(new Error('One or more arguments are invalid'));
    }
    // create typing parameter + send
    const params = {
      auth: apiHelper.authClient,
      parent:
          'conversations/' + conversationId + '/events?eventId=' + eventId,
      resource: {
        eventType: typingStatus ? 'TYPING_STARTED' : 'TYPING_STOPPED',
        representative: {
          representativeType: 'BOT',
        },
      },
    };
    apiHelper.bmApi.conversations.events
        .create(params, {}, (err, response) => {
          if (err) reject(err);
          resolve(response);
        });
  });
}

/**
 * Builds an event to send a representative event (join/leave) to the user
 * @param {boolean} representativeStatus Whether to send a join/leave event
 *    (true = join)
 * @param {string} conversationId The unique id for this user + agent
 * @param {string} eventId The event id to be sent to the user
 */
async function sendRepresentativeEvent(
    representativeStatus,
    conversationId,
    eventId,
) {
  return new Promise((resolve, reject) => {
    if (
      representativeStatus === undefined ||
      conversationId === undefined ||
      eventId === undefined
    ) {
      reject(new Error('One or more arguments are invalid'));
    }
    // create representative join/leave event + send to BM
    const params = {
      auth: apiHelper.authClient,
      parent:
          'conversations/' + conversationId + '/events?eventId=' + eventId,
      resource: {
        eventType: representativeStatus ?
            'REPRESENTATIVE_JOINED' :
            'REPRESENTATIVE_LEFT',
        representative: {
          representativeType: 'BOT',
        },
      },
    };
    apiHelper.bmApi.conversations.events
        .create(params, {}, (err, response) => {
          if (err) reject(err);
          resolve(response);
        });
  });
}

/**
 * Posts the given JSON to the API endpoint URL.
 *
 * @param {string} agentId The agent ID associated with the message
 * @param {string} jsonBody The JSON payload to send to the API.
 * @param {string} conversationId The conversationId of the message to send
 * @param {bool} update Whether to update the firebase with message
 * @return {Promise} resolves/rejects depending on whether
 *     message was successfully sent
 */
async function sendBmMessage(agentId, jsonBody, conversationId, update = true) {
  return new Promise((resolve, reject) => {
    const params = {
      auth: apiHelper.authClient,
      parent: 'conversations/' + conversationId,
      resource: jsonBody,
    };
    apiHelper.bmApi.conversations.messages.create(
        params,
        {},
        (err, response) => {
          if (err) {
            reject(err);
          } else {
            // check for update status + send message to BM
            if (update) {
              firebase.saveMessage(
                  agentId,
                  conversationId,
                  jsonBody,
                  moment().unix(),
                jsonBody.representative.representativeType === 'HUMAN' ?
                  'AGENT' :
                  'BOT',
              );
            }
            resolve(response);
          }
        },
    );
  });
}

module.exports = factory;
