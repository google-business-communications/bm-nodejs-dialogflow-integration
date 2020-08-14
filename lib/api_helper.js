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

// get the GoogleAuth library
const {GoogleAuth} = require('google-auth-library');
// get the GoogleAPI library
const {google} = require('googleapis');
// Get the Business Messages API client library
const businessmessages = require('businessmessages');
// Get the Business Communications API client library
const businesscommunications = require('businesscommunications');

const factory = {
  bmApi: new businessmessages.businessmessages_v1.Businessmessages({}),
  bcApi: new businesscommunications.businesscommunications_v1
      .Businesscommunications({}, google),
  auth: new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/businessmessages',
      'https://www.googleapis.com/auth/businesscommunications'],
  }),
  initCredentials,
  authClient: false,
};

/**
 * Initializes the Google credentials for calling the
 * Business Messages API.
 */
async function initCredentials() {
  factory.authClient = await factory.auth.getClient();
  // Initialize auth token
  factory.authClient.refreshAccessToken();
  await factory.authClient.getAccessToken();
}
initCredentials();

module.exports = factory;
