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

const firebase = require('../../lib/firebase_handler.js').firebase;

// Firebase utility class for managing search queries for an agent
const firebaseUtil = {

  /**
   * Gets a mock search entry point based on the agentId.
   *
   * @param {string} agentName The agent id with the associated search query.
   * @param {function} callback Callback method for after
   * the method is complete.
   */
  getMock: (agentName, callback) => {
    // remove "brands/" from agent ID
    const agentId = agentName.substring(agentName.lastIndexOf('/') + 1);
    const db = firebase.database();
    const agentRef = db.ref('admin/agentsMock').child(agentId);
    agentRef.once('value', (snapshot) => {
      const data = snapshot.val();
      if (data !== null && data !== undefined) {
        callback(data);
      } else {
        callback(false);
      }
    });
  },

  /**
   * Saves a new search query for an agent to the datastore.
   *
   * @param {string} searchText The search text.
   * @param {string} agentId The agent id.
   * @param {function} callback
   * Callback method for after the method is complete.
   */
  saveMock: (searchText, agentId, callback) => {
    if (searchText === '') {
      return;
    }
    // remove "brands/" from agent ID
    agentId = agentId.substring(agentId.lastIndexOf('/') + 1);
    // if existing search, then replace searchText with new searchText.
    const db = firebase.database();
    const agentRef = db.ref('admin/agentsMock').child(agentId);
    agentRef.transaction(
        (data) => {
          if (data) {
            data.searchText = searchText;
          } else {
            data = {
              agentId: agentId,
              searchText: searchText,
            };
          }
          return data;
        },
        () => {
          // on finish, run callback if present
          if (callback !== undefined) {
            callback();
          }
        },
    );
  },


  /**
   * getBotInfo - Get bot info saved in database
   *
   * @param  {string} agentName The agent name
   * @param  {function} callback Callback function
   */
  getBotInfo: function(agentName, callback) {
    const db = firebase.database();
    const agentId = agentName.substring(agentName.lastIndexOf('/') + 1);
    const agentRef = db.ref('admin/agents').child(agentId);
    agentRef.once('value', (snapshot) => {
      const data = snapshot.val();
      callback(data);
    });
  },

  /**
   * Saves a new bot mapping for an agent to the datastore.
   *
   * @param {string} agentName The brand/ID/agent/ID
   * @param {object} formObject The form key/value pairs
   * @param {function} callback
   * Callback method for after the method is complete.
   */
  saveBotInfo: (agentName, formObject, callback) => {
    const dfProjectId = formObject.projectId;
    const dfServiceAccountKey = formObject.dfServiceAccountKey;

    // remove brands from agent ID
    const agentId = fullAgentId.substring(fullAgentId.lastIndexOf('/') + 1);
    let csatTriggerWindow = formObject.csatTriggerWindow;

    if (csatTriggerWindow.length == 0) {
      csatTriggerWindow = 0;
    }

    const db = firebase.database();
    const agentRef = db.ref('admin/agents').child(agentId);

    const botInfo = {
      dfServiceAccountKey: dfServiceAccountKey,
      agentId: fullAgentId,
      csatTriggerWindow: csatTriggerWindow,
      projectId: dfProjectId,
    };
    // update botInfo in database
    agentRef.set(botInfo, (err) => {
      if (err) {
        console.error(err);
      } else {
        if (callback) {
          callback();
        }
      }
    });
  },

  /**
   * getConversationsList - gets list of conversations associated with provider
   * @return {Array} List of conversations
   */
  getConversationsList: () => {
    return new Promise((resolve, reject) => {
      const db = firebase.database();
      const conversationsRef = db.ref(`conversations/`);
      conversationsRef.once('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          resolve([]);
        } else {
          // search for conversations within agent, appending to list of
          // conversations
          const conversations = [];
          const agentIds = Object.keys(data);
          for (let i = 0; i < agentIds.length; i++) {
            const agentId = agentIds[i];
            const convIds = Object.keys(data[agentId]);
            for (let j = 0; j < convIds.length; j++) {
              const id = convIds[j];
              conversations.push({
                conversationId: id,
                displayName: data[agentId][id].name,
                agentId: agentId,
              });
            }
          }
          resolve(conversations);
        }
      });
    });
  },

  /**
   * createMessageListener - Creates a message to listen for the latest live
   * agent messages and respond
   * @param {string} agentId The Agent ID
   * @param {string} conversationId The Conversation ID
   * @param {function} callback Callback to run with message details
   */
  createMessageListener: (agentId, conversationId, callback) => {
    const db = firebase.database();
    const conversationsRef = db
        .ref(`conversations/${agentId}/${conversationId}/messages`);
    conversationsRef.on('value', (snapshot) => {
      const data = snapshot.val();
      // find the message with the last timestamp
      if (data === undefined || data === null) {
        return;
      } else {
        // iterate through and find the latest timestamp key
        const newestKey = Object.keys(data).reduce((newestKey, key) => {
          if (data[key].timestamp > data[newestKey].timestamp) {
            return key;
          }
          return newestKey;
        });
        // run callback on new live agent message if not already sent
        if (!data[newestKey].sent) {
          callback(data[newestKey], newestKey);
        }
      }
    });
  },

  /**
   * setMessageSent - Update an agent message to be "sent"
   * @param {string} agentId The Agent ID
   * @param  {string} conversationId The conversation ID
   * @param  {string} messageId Message ID to set as read
   */
  setMessageSent: (agentId, conversationId, messageId) => {
    const db = firebase.database();
    const conversationsRef = db.ref(
        `conversations/${agentId}/${conversationId}/messages/${messageId}`,
    );
    conversationsRef.update({sent: true});
  },
};

module.exports = firebaseUtil;
