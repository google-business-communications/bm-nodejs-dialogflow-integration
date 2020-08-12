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

// File is currently outdated: will be updated later

'use strict';
const firebase = require('./firebase_handler.js').firebase;
const cron = require('node-cron');
const moment = require('moment');

const db = firebase.database();
const convRef = db.ref('conversations');

const conversations = {
  messages: [],
};

// update conversations list when firebase updates
convRef.once('value', (snapshot) => {
  const data = snapshot.val();
  const messages = [];
  for (const [key, value] of Object.entries(data)) {
    messages.push({
      conversationId: key,
      timestamp: value.lastTimestamp,
      csatSent: value.csatSent,
    });
  }
  conversations.messages = messages;
});

// cron job to run every minute, sending csat if necessary
cron.schedule('*/5 * * * *', () => {
  if (conversations.messages !== []) {
    const currentTime = moment();
    // check if messages have >15 min diff
    for (let i = 0; i < conversations.messages.length; i++) {
      const messageObject = conversations.messages[i];
      const timestamp = moment.unix(messageObject.timestamp);
      const timeDiff = currentTime.diff(timestamp, 'minutes');
      if (timeDiff >= 15 && !messageObject.csatSent) {
        // update firebase with csatSent property
        const conversationChild = convRef.child(messageObject.conversationId);
        conversationChild.once('value', (snapshot) => {
          const data = snapshot.val();
          data.csatSent = true;
          messageObject.csatSent = true;
          conversationChild.update(data);
        });
      }
    }
  } else {
    console.log('Empty messages file');
  }
});
