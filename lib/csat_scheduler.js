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
const cron = require('node-cron');
const uuid = require('uuid');
const moment = require('moment');
const firebase = require('./firebase_handler.js').firebase;
const bmApiHelper = require('./bm_api_helper.js');

const db = firebase.database();
const convRef = db.ref('conversations/');

let conversations;

// update conversations list when firebase updates
convRef.on('value', (snapshot) => {
  conversations = [];
  const data = snapshot.val();
  if (data) {
    // search for conversations within agent, appending to list of
    // conversations
    const agentIds = Object.keys(data);
    for (let i = 0; i < agentIds.length; i++) {
      const agentId = agentIds[i];
      const convIds = Object.keys(data[agentId]);
      for (let j = 0; j < convIds.length; j++) {
        const id = convIds[j];
        conversations.push({
          conversationId: id,
          timestamp: data[agentId][id].lastTimestamp,
          csatSent: data[agentId][id].csatSent,
          agentId: agentId,
        });
      }
    }
  }
});


/**
 * startCsatScheduler - Starts the CSAT scheduler
 */
function startCsatScheduler() {
  // cron job to run every 5 minutes, sending csat if necessary
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running cron job for CSAT...');
    if (conversations !== []) {
      const currentTime = moment();
      // iterate through list of conversations
      for (let i = 0; i < conversations.length; i++) {
        const messageObject = conversations[i];
        const timestamp = moment.unix(messageObject.timestamp);
        // retrieve triggerWindow in Firebase
        let triggerWindow;
        try {
          triggerWindow = await firebase
              .getCsatTriggerWindow(messageObject.agentId);
          triggerWindow = parseInt(triggerWindow);
        } catch (e) {
          // default is 15 minutes
          triggerWindow = 15;
        }
        // check if messages have a difference longer than csatTriggerWindow
        const timeDiff = currentTime.diff(timestamp, 'minutes');

        if (timeDiff >= triggerWindow && !messageObject.csatSent) {
          // send CSAT survey and mark the conversation has had CSAT survey
          try {
            bmApiHelper.sendCsat(messageObject.conversationId, uuid.v4());
            // update firebase with csatSent property
            const conversationChild = convRef
                .child(messageObject.agentId)
                .child(messageObject.conversationId);
            conversationChild.update({csatSent: true});
          } catch (e) {
            console.error(e);
          }
        }
      }
    } else {
      console.log('No conversations present.');
    }
  });
}


module.exports = {
  startCsatScheduler,
};
