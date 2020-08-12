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

const path = require('path');
const config = require('../resources/config.json');
const moment = require('moment');
const firebaseAdmin = require('firebase-admin');

const serviceAccount = require(path.resolve(
    __dirname,
    '../resources/',
    config.firebase_service_account,
));

const liveAgentStatus = {
  SPEAKING_WITH_AGENT: 0,
  SPEAKING_WITH_BOT: 1,
  REQUESTED_AGENT: 2,
};

/**
 * Firebase class
 */
class Firebase {
  /**
   * constructor - Initialize Firebase
   */
  constructor() {
    this.firebase = firebaseAdmin;
    this.firebase.initializeApp({
      credential: this.firebase.credential.cert(serviceAccount),
      databaseURL: config.firebase_database_url,
    });
  }

  /**
   * getDatabase - Get database access
   * @return {object} Firebase database
   */
  database() {
    return this.firebase.database();
  }

  /**
   * setRequestedLiveAgent - Set requestedLiveAgent parameter
   * @param {string} agentId The Agent ID
   * @param {string} conversationId Conversation ID
   * @return {Promise} Resolves when request is updated
   */
  setRequestedLiveAgent(agentId, conversationId) {
    return new Promise((resolve, reject) => {
      if (agentId === undefined || conversationId === undefined) {
        reject(new Error('Missing arguments'));
      }
      // set the requestd live agent status in Firebase
      const db = this.database();
      const convRef = db.ref(`conversations/${agentId}/${conversationId}`);
      convRef.once('value', (snapshot) => {
        const data = snapshot.val();
        if (data === undefined || data === null) {
          reject(new Error('No conversation present'));
        }
        if (data.requestedLiveAgent) {
          reject(new Error('Live agent already requested'));
        }
        convRef.update({requestedLiveAgent: true});
        resolve(true);
      });
    });
  }

  /**
   * clearLiveAgent - Remove live agent information
   * @param {string} agentId The Agent ID
   * @param  {string} conversationId Conversation ID
   * @return {Promise} Resolves if successfully updates db
   */
  clearLiveAgent(agentId, conversationId) {
    return new Promise((resolve, reject) => {
      if (agentId === undefined || conversationId === undefined) {
        reject(new Error('Missing arguments'));
      }
      const db = this.database();
      // update representative info in conversations object with agent
      const convRef = db.ref(`conversations/${agentId}/${conversationId}`);
      convRef.once('value', (snapshot) => {
        const data = snapshot.val();
        if (data === undefined || data === null) {
          reject(new Error('No conversation present'));
        }
        if (
          data.representativeInfo === {} ||
          data.representativeInfo === undefined
        ) {
          reject(new Error('No live agent present'));
        }
        data.requestedLiveAgent = false;
        data.representativeInfo = {};
        convRef.update(data);
        resolve();
      });
    });
  }

  /**
   * setRepresentativeInfo - Sets representative information
   * @param {string} agentId The Agent ID
   * @param  {string} conversationId The Conversation ID
   * @param  {string} representativeName Name of customer representative
   * @return {Promise} Resolves if updates
   */
  setRepresentativeInfo(agentId, conversationId, representativeName) {
    return new Promise((resolve, reject) => {
      if (agentId === undefined || conversationId === undefined) {
        reject(new Error('Missing arguments'));
      }
      // Set live agent presence in conversationId under agent
      const db = this.database();
      const convRef = db.ref(`conversations/${agentId}/${conversationId}`);
      convRef.once('value', (snapshot) => {
        const data = snapshot.val();
        if (data == undefined || data == null) {
          reject(new Error('No conversation present'));
        }
        if (data.representativeInfo !== undefined) {
          reject(new Error('Representative is already present'));
        }
        data.requestedLiveAgent = false;
        data.representativeInfo = {
          representativeName: representativeName,
        };
        convRef.update(data);
        resolve();
      });
    });
  }

  /**
   * getRepresentativeInfo - Gets representative information
   * @param {string} agentId The Agent ID
   * @param  {string} conversationId The Conversation ID
   * @return {Promise} Resolves with representativeInfo object
   */
  getRepresentativeInfo(agentId, conversationId) {
    return new Promise((resolve, reject) => {
      if (agentId === undefined || conversationId === undefined) {
        reject(new Error('Missing arguments'));
      }
      // Set live agent presence in conversationId under agent
      const db = this.database();
      const convRef = db.ref(`conversations/${agentId}/${conversationId}`);
      convRef.once('value', (snapshot) => {
        const data = snapshot.val();
        if (data == undefined || data == null) {
          reject(new Error('No conversation present'));
        }
        resolve(data.representativeInfo);
      });
    });
  }

  /**
   * addMessageId - Add a message ID to conversations, for deduplication
   * @param {string} agentId The Agent ID
   * @param  {string} conversationId The conversation ID
   * @param  {string} messageId      The message ID to add
   * @return {Promise}               Resolves if added
   */
  addMessageId(agentId, conversationId, messageId) {
    return new Promise((resolve, reject) => {
      if (agentId === undefined || conversationId === undefined ||
          messageId === undefined) {
        reject(new Error('Missing arguments'));
      }
      const db = this.database();
      const convRef = db.ref(`conversations/${agentId}/${conversationId}`);
      convRef.once('value', (snapshot) => {
        // append to messageIds list
        const data = snapshot.val();
        if (data.messageIds === undefined) {
          data.messageIds = [messageId];
          convRef.update(data);
          resolve(true);
        } else if (data.messageIds.includes(messageId)) {
          // console.log('Message already received');
          reject(new Error('Message already received'));
        } else {
          data.messageIds.push(messageId);
          data.lastTimestamp = moment().unix();
          convRef.update(data);
          resolve(true);
        }
      });
    });
  }

  /**
   * updateTimestamp - Update the lastTimestamp field of a conversation
   * @param {string} agentId The Agent ID
   * @param  {string} conversationId The Conversation ID
   * @param  {number} newTime The new unix timestamp to add
   * @return {Promise} Resolves if correctly updates timestamp
   */
  updateTimestamp(agentId, conversationId, newTime) {
    return new Promise((resolve, reject) => {
      if (agentId === undefined || conversationId === undefined ||
          newTime === undefined) {
        reject(new Error('Missing arguments'));
      }
      const db = this.database();
      const ref = db.ref(`conversations/${agentId}/${conversationId}`);
      // set a new timestamp in database
      ref.once('value', (snapshot) => {
        const data = snapshot.val();
        data.lastTimestamp = newTime;
        data.csatSent = false;
        ref.update(data);
        resolve();
      });
    });
  }

  /**
   * getUserStatus - returns user status.
   * @param {string} agentId The Agent ID
   * @param {string} conversationId The conversation ID
   * @param {string} displayName The displayName of conversation
   * @return {Promise} Resolves with user status
   */
  getUserStatus(agentId, conversationId, displayName) {
    return new Promise((resolve, reject) => {
      if (agentId === undefined || conversationId === undefined ||
          displayName === undefined) {
        reject(new Error('Missing arguments'));
      }
      const db = this.database();
      const ref = db.ref(`conversations/${agentId}/${conversationId}`);
      // check whether user is messaging with a bot by live agent presence
      ref.once('value', (snapshot) => {
        const data = snapshot.val();
        if (!data || data == {}) {
          // create new entry with name, empty message id list, timestamp, etc.
          ref.set({
            name: displayName,
            messageIds: [],
            lastTimestamp: moment().unix(),
            csatSent: false,
            requestedLiveAgent: false,
          });
          resolve(liveAgentStatus.SPEAKING_WITH_BOT);
        } else {
          // check if user is currently messaging live agent or bot
          if (data.requestedLiveAgent) {
            resolve(liveAgentStatus.REQUESTED_LIVE_AGENT);
          } else if (data.representativeInfo !== undefined) {
            resolve(liveAgentStatus.SPEAKING_WITH_AGENT);
          } else {
            resolve(liveAgentStatus.SPEAKING_WITH_BOT);
          }
        }
      });
    });
  }

  /**
   * saveMessage - Save a message to conversation history after it's been sent.
   * @param  {string} agentId The agent ID
   * @param  {string} conversationId The conversation ID
   * @param  {object} messageInfo The message information object
   * @param {number} timestamp Unix time that the message was sent
   * @param {string} sender Sender of message (USER/BOT/AGENT)
   * @return {Promise} Resolves if successful
   */
  saveMessage(agentId, conversationId, messageInfo, timestamp, sender) {
    return new Promise((resolve, reject) => {
      if (agentId === undefined || conversationId === undefined ||
          messageInfo === undefined || sender === undefined) {
        reject(new Error('Missing arguments'));
      }
      const db = this.database();
      const ref = db.ref(`conversations/${agentId}/${conversationId}/messages`);
      // delete rich text information from message
      delete messageInfo.representative;
      delete messageInfo.richCard;
      delete messageInfo.suggestions;
      // push message information to messages array
      ref.push(
          {
            timestamp: timestamp,
            messageInfo: messageInfo,
            sender: sender,
            sent: true,
          },
          (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          },
      );
    });
  }

  /**
   * getDialogflowCredentials - Retrieves Dialogflow service account
   * credentials from Firebase
   * @param {string} agentId The agent ID with Dialogflow credentials associated
   * @return {Promise} Resolves with credentials object
   */
  getCredentials(agentId) {
    return new Promise((resolve, reject) => {
      if (agentId === undefined) {
        reject(new Error('Missing arguments'));
      }
      const db = this.database();
      const ref = db.ref(`admin/agents/${agentId}`);
      // Retrieve Dialogflow credentials from Database
      ref.once('value', (snapshot) => {
        const data = snapshot.val();
        if (!data || data == null || !data.dfServiceAccountKey) {
          reject(new Error('Error reading credentials from Firebase'));
        } else {
          const credentials = {
            // parse service account key from JSON stored in database
            dfServiceAccountKey: JSON.parse(data.dfServiceAccountKey),
            dialogflowProjectId: data.projectId,
          };
          resolve(credentials);
        }
      });
    });
  }

  /**
   * setTypingStatus - Set a user's typing status
   * @param {string} agentId The agent ID
   * @param  {string} conversationId The conversation ID
   * @param  {boolean} typingStatus Whether user is typing or not
   * @return {Promise} Resolves when finished
   */
  setTypingStatus(agentId, conversationId, typingStatus) {
    return new Promise((resolve, reject) => {
      if (agentId === undefined || conversationId === undefined ||
          typingStatus === undefined) {
        reject(new Error('Missing arguments'));
      }
      const db = this.database();
      const ref = db.ref(`conversations/${agentId}/${conversationId}`);
      // update typing status under conversation
      ref.update({userIsTyping: typingStatus}, (err) => {
        if (err) reject(err);
        resolve();
      });
    });
  }
}

module.exports = {
  firebase: new Firebase(),
  liveAgentStatus,
};
