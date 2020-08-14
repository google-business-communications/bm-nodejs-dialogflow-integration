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

/* eslint new-cap: [2, {"capIsNewExceptions": ["express.Router"]}]*/
const express = require('express');
const router = express.Router();
const util = require('util');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const request = require('request');
const ct = require('countries-and-timezones');
const uuid = require('uuid');
const apiHelper = require('../../lib/api_helper.js');
const bmApiHelper = require('../../lib/bm_api_helper.js');
const liveAgent = require('../../lib/live_agent.js');
const config = require('../../resources/config.json');

// Reference to the backend firebase util
const firebaseUtil = require('../libs/firebase_util');

// Default hours for a location when not set by an agent
const TEMPLATE_HOURS = [
  {
    endTime: {hours: '23', minutes: '59'},
    timeZone: '',
    startDay: 'MONDAY',
    endDay: 'SUNDAY',
  },
];

// set up live agent message sending
firebaseUtil.getConversationsList().then((conversations) => {
  for (let i = 0; i < conversations.length; i++) {
    const conversation = conversations[i];
    // Create message listener that will send messages on message receive in
    // database
    firebaseUtil.createMessageListener(
        conversation.agentId,
        conversation.conversationId,
        (messageContent, messageId) => {
          liveAgent
              .sendMessage(
                  conversation.agentId,
                  conversation.conversationId,
                  messageContent.messageInfo.messageId,
                  messageContent.messageInfo.text,
                  liveAgent.MessageContentType.TEXT,
              )
              .then(() => {
                firebaseUtil
                    .setMessageSent(
                        conversation.agentId,
                        conversation.conversationId,
                        messageId);
              }, 5000)
              .catch((err) => {
                console.error(err);
              });
        },
    );
  }
});

/**
 * Agent listing page.
 */
router.get('/', function(req, res, next) {
  const brandId = req.query.brandId;

  // setup the parameters for the API call
  const apiParams = {
    auth: apiHelper.authClient,
    parent: brandId,
  };

  apiHelper.bcApi.brands.agents.list(apiParams, {}, function(
      err,
      response,
  ) {
    console.log(err);
    const agents = response.data === undefined ?
          [] : response.data.agents;

    res.render('agents/list', {
      agents: agents,
      brandId: brandId,
    });
  });
});

/**
 * Searches Google for the searchText and inserts a Message button
 * to simulate the launch experience for Business Messages.
 */
router.get('/search', function(req, res, next) {
  const searchText = req.query.q;

  const url =
    'https://www.google.com/search?client=ms-android-google&rlz=1C5CHFA' +
     '_enUS786US786&sxsrf=ALeKk02JVydnbPluG7wZuLnJPkIE-48DuQ%3A1583534881841' +
     '&ei=IdNiXuH6Mr_B0PEPhIyLyAs&q=' + searchText +
    '&oq=target&gs_l=mobile-gws-wiz-serp.1.0.35i39l3j0i67l2j0i273j0l2.9685.' +
    '10266..11346...0.3..0.95.509.6......0....1.........0i71j0i131.p6WgpR2xalo';

  const agentId = req.query.agentId;

  // Store the message
  firebaseUtil.saveMock(searchText, agentId);

  // setup the parameters for the API call
  const apiParams = {
    auth: apiHelper.authClient,
    name: agentId,
  };

  // Get the agent details to show in the edit form
  apiHelper.bcApi.brands.agents.get(apiParams, {}, function(err, response) {
    if (response == undefined) {
      return;
    }
    const agent = response.data;

    const opts = {
      url: url,
      headers: {
        'User-Agent':
            'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10.6; rv:1.9.2.16)' +
            'Gecko/20110319 Firefox/3.6.16',
      },
    };

    request(opts, function(err, response, body) {
      if (err) {
        console.dir(err);
        return;
      }

      let html = response.body;

      if (html.indexOf('Directions') >= 0) {
        html = html.replace('max-width:736px;', '');

        const $ = cheerio.load(html);

        // Insert Message button with agent test intent URL
        const r = $('#dimg_3').parent().parent().parent().parent();
        const buttons = require('./buttons.json');
        const buttonHtml =
            buttons.call +
            agent.businessMessagesAgent.agentTestUrl +
            buttons.other;
        const styles = fs.readFileSync(
            path.resolve(__dirname, 'search.html'),
            'utf8',
        );

        $(r).html(buttonHtml);

        $('#sf').attr('style', 'display:none');
        $('#sf').parent().attr('style', 'margin-bottom: 20px;');

        $('head').append(styles);

        res.json({result: $.html()});
      } else {
        res.json({
          result:
            '<p>Sorry, but no placesheet entry found. Try being more' +
            ' specific with your search.</p>',
        });
      }
    });
  });
});

/**
 * Receive live agent post requests from frontend.
 * Handles Agent Join/Leave + Typing events
 */
router.post('/live_agent', async (req, res) => {
  const requestType = req.body.type;
  const conversationId = req.body.conversationId;
  const agentId = req.body.agentId;
  if (requestType === 'join') {
    const name = req.body.name;
    await liveAgent.agentJoined(agentId, conversationId, name);
  } else if (requestType === 'leave') {
    await liveAgent.agentLeft(agentId, conversationId);
  } else if (requestType === 'start_typing') {
    await bmApiHelper.sendTypingEvent(true, conversationId, uuid.v4());
  } else if (requestType === 'stop_typing') {
    await bmApiHelper.sendTypingEvent(false, conversationId, uuid.v4());
  }
  res.status(200).send();
});

/**
 * Create an agent page.
 */
router.get('/create', function(req, res, next) {
  const brandId = req.query.brandId;

  let message = '';
  if (req.query.message !== undefined) {
    message = req.query.message;
  }

  const timezones = ct.getAllTimezones();

  // Create empty agent so fields render as defaults
  const agent = {
    displayName: '',
    businessMessagesAgent: {
      customAgentId: '',
      logoUrl: '',
      conversationalSettings: {
        en: {
          privacyPolicy: {
            url: '',
          },
          welcomeMessage: {
            text: '',
          },
        },
      },
      primaryAgentInteraction: {
        interactionType: 'BOT',
        botRepresentative: {
          botMessagingAvailability: {
            hours: TEMPLATE_HOURS,
          },
        },
      },
      additionalAgentInteractions: [
        {
          interactionType: 'HUMAN',
          humanRepresentative: {
            humanMessagingAvailability: {
              hours: TEMPLATE_HOURS,
            },
          },
        },
      ],
    },
  };

  res.render('agents/edit', {
    agent: agent,
    title: 'Create Agent',
    agentId: '',
    formUrl: '/admin/agents/save?brandId=' + brandId,
    brandId: brandId,
    isEdit: false,
    timezones: Object.keys(timezones),
    message: message,
    botObject: false,
    conversationsList: null,
    botConnectorUrl: '',
    firebaseConfig: {
      authDomain: config.firebase_auth_domain,
      databaseURL: config.firebase_database_url,
    },
    locationQuery: '',
  });
});

/**
 * Edit an existing agent page.
 */
router.get('/edit', function(req, res, next) {
  const agentId = req.query.agentId;
  const brandId = req.query.brandId;

  let message = '';
  if (req.query.message !== undefined) {
    message = req.query.message;
  }

  const timezones = ct.getAllTimezones();

  // setup the parameters for the API call
  const apiParams = {
    auth: apiHelper.authClient,
    name: agentId,
  };

  // Get the agent details to show in the edit form
  apiHelper.bcApi.brands.agents.get(apiParams, {}, function(
      err,
      response,
  ) {
    console.log(err);
    // console.log(response);

    const agent = response.data;

    if (
      agent.businessMessagesAgent.conversationalSettings.en
          .privacyPolicy === undefined
    ) {
      agent.businessMessagesAgent
          .conversationalSettings.en.privacyPolicy = {
            url: '',
          };
    }

    firebaseUtil.getBotInfo(agentId, function(botObject) {
      firebaseUtil.getMock(agentId, function(mockObject) {
        let locationQuery = '';
        if (mockObject) {
          locationQuery = mockObject.searchText;
        }
        const agentIdOnly = agentId
            .substring(agentId.lastIndexOf('/') + 1);
        res.render('agents/edit', {
          agent: agent,
          agentId: agentIdOnly,
          title: 'Edit Agent',
          formUrl:
                '/admin/agents/save?agentId=' + agentId + '&brandId=' + brandId,
          brandId: brandId,
          isEdit: true,
          timezones: Object.keys(timezones),
          templateHours: TEMPLATE_HOURS,
          message: message,
          locationQuery: locationQuery,
          botObject: botObject,
          firebaseConfig: {
            databaseURL: config.firebase_database_url,
          },
          botConnectorUrl:
                '/admin/agents/saveBotInfo?agentId=' +
                agentId +
                '&brandId=' +
                brandId,
        });
      });
    });
  });
});

/**
 * Create/update a search entry point
 */
router.post('/saveBotInfo', function(req, res, next) {
  const agentId = req.query.agentId;

  const formObject = req.body;

  firebaseUtil.saveBotInfo(agentId, formObject, function() {
    res.json({result: 'done'});
  });
});

/**
 * Create/update an agent.
 */
router.post('/save', function(req, res, next) {
  let agentId = false;
  if (req.query.agentId !== undefined) {
    agentId = req.query.agentId;
  }

  const brandId = req.query.brandId;

  const formObject = req.body;

  const agentObject = {
    displayName: formObject.displayName,
    businessMessagesAgent: {
      customAgentId: formObject.customAgentId,
      logoUrl: formObject.logoUrl,
      conversationalSettings: {},
    },
  };

  // Add the conversational settings, only English is supported right now
  // but for the future, keeping this generic and based on the form input
  agentObject.businessMessagesAgent.conversationalSettings[
      formObject.locale
  ] = {
    privacyPolicy: {
      url: formObject.privacyPolicy,
    },
    welcomeMessage: {
      text: formObject.welcomeMessage,
    },
    conversationStarters: getConversationalStarters(
        formObject,
        'conversationalStarter',
    ),
  };

  // Set the primary representation
  agentObject.businessMessagesAgent.primaryAgentInteraction = getRepresentative(
      formObject,
      formObject['primaryAgentInteraction.interactionType'],
      'primary',
  );

  // Set the additional representation if it exists
  if (formObject['additionalAgentInteraction.interactionType'] != undefined) {
    agentObject
        .businessMessagesAgent.additionalAgentInteractions = getRepresentative(
            formObject,
            formObject['additionalAgentInteraction.interactionType'],
            'additional',
        );
  }

  // Update location
  if (agentId) {
    updateAgent(res, brandId, agentId, agentObject, apiHelper);
  } else {
    // Create location
    createAgent(res, brandId, agentObject, apiHelper);
  }
});

/**
 * Patches the agent name and agent values. If there are no errors,
 * the user is redirected to the list of all locations for the brand.
 *
 * @param {object} res The HTTP response object.
 * @param {string} brandId The brand id for the location.
 * @param {string} agentId The agent id for the agent being updated.
 * @param {object} agentObject The JSON object to post.
 * @param {object} apiObject The BC API object.
 */
function updateAgent(res, brandId, agentId, agentObject, apiObject) {
  // setup the parameters for the API call
  const apiParams = {
    auth: apiObject.authClient,
    name: agentId,
    resource: agentObject,
    updateMask: 'display_name,business_messages_agent',
  };

  apiObject.bcApi.brands.agents.patch(apiParams, {}, function(err, response) {
    if (err !== undefined && err !== null) {
      handleError(res, err, brandId, agentId);
    } else {
      res.redirect('/admin/agents?brandId=' + brandId);
    }
  });
}

/**
 * Creates a new agent. If there are no errors,
 * the user is redirected to the list of all locations for the brand.
 *
 * @param {object} res The HTTP response object.
 * @param {string} brandId The brand id for the location.
 * @param {object} agentObject The JSON object to post.
 * @param {object} apiObject The BC API object.
 */
function createAgent(res, brandId, agentObject, apiObject) {
  // setup the parameters for the API call
  const apiParams = {
    auth: apiObject.authClient,
    parent: brandId,
    resource: agentObject,
  };

  apiObject.bcApi.brands.agents.create(apiParams, {}, function(err, response) {
    console.log(err);
    if (err !== undefined && err !== null) {
      handleError(res, err, brandId);
    } else {
      res.redirect('/admin/agents?brandId=' + brandId);
    }
  });
}

/**
 * Parses the error and redirects to display the error message.
 *
 * @param {object} res The HTTP response object.
 * @param {object} error The error object.
 * @param {string} brandId The brand id.
 * @param {string} agentId The agent id.
 * @param {object} apiObject The BC API object.
 */
function handleError(res, error, brandId, agentId) {
  console.log(util.inspect(error, {showHidden: false, depth: null}));

  const errorMessage = error.errors[0].message;

  let url =
    '/admin/agents/edit?brandId=' +
    brandId +
    '&message=' +
    errorMessage +
    '&agentId=' +
    agentId;
  if (!agentId) {
    url =
      '/admin/agents/create?brandId=' + brandId + '&message=' + errorMessage;
  }

  res.redirect(url);
}

/**
 * Parses the form key/value pairs into an array
 * of conversation starter objects.
 *
 * @param {object} formObject Key/value pairs from the HTML form.
 * @param {string} prefix The prefix string for the form keys.
 * @return {Array} Array of conversation starters.
 */
function getConversationalStarters(formObject, prefix) {
  const conversationalStarters = [];

  for (let i = 0; i < formObject[prefix + '.text'].length; i++) {
    if (formObject[prefix + '.text'][i] != '') {
      if (formObject[prefix + '.url'][i] != '') {
        conversationalStarters.push({
          suggestion: {
            action: {
              text: formObject[prefix + '.text'][i],
              postbackData: formObject[prefix + '.postbackData'][i],
              openUrlAction: {url: formObject[prefix + '.url'][i]},
            },
          },
        });
      } else {
        conversationalStarters.push({
          suggestion: {
            reply: {
              text: formObject[prefix + '.text'][i],
              postbackData: formObject[prefix + '.postbackData'][i],
            },
          },
        });
      }
    }
  }

  return conversationalStarters;
}

/**
 * Gets the represenative object from the form values.
 *
 * @param {object} formObject Key/value pairs from the HTML form.
 * @param {string} interactionType Bot/human interaction type.
 * @param {string} prefix The prefix string for the form keys.
 * @return {object} The represenative.
 */
function getRepresentative(formObject, interactionType, prefix) {
  if (interactionType != undefined) {
    if (interactionType === 'BOT') {
      return {
        interactionType: interactionType,
        botRepresentative: {
          botMessagingAvailability: {
            hours: getTimeObject(formObject, prefix),
          },
        },
      };
    } else {
      return {
        interactionType: interactionType,
        humanRepresentative: {
          humanMessagingAvailability: {
            hours: getTimeObject(formObject, prefix),
          },
        },
      };
    }
  }

  return {};
}

/**
 * Gets the start and end time information for an interaction.
 *
 * @param {object} formObject Key/value pairs from the HTML form.
 * @param {string} prefix The prefix string for the form keys.
 * @return {Array} The data/time information for an interaction.
 */
function getTimeObject(formObject, prefix) {
  const timeObjects = [];

  // If an array, push all values onto the the time object
  if (Array.isArray(formObject[prefix + '.availability.startTime.hours'])) {
    for (
      let i = 0;
      i < formObject[prefix + '.availability.startTime.hours'].length;
      i++
    ) {
      timeObjects.push({
        startTime: {
          hours: formObject[prefix + '.availability.startTime.hours'][i],
          minutes: formObject[prefix + '.availability.startTime.minutes'][i],
        },
        endTime: {
          hours: formObject[prefix + '.availability.endTime.hours'][i],
          minutes: formObject[prefix + '.availability.endTime.minutes'][i],
        },
        timeZone: formObject[prefix + '.availability.timezone'][i],
        startDay: formObject[prefix + '.availability.startDay'][i],
        endDay: formObject[prefix + '.availability.endDay'][i],
      });
    }
  } else {
    // Not an array, so push only the one form element
    timeObjects.push({
      startTime: {
        hours: formObject[prefix + '.availability.startTime.hours'],
        minutes: formObject[prefix + '.availability.startTime.minutes'],
      },
      endTime: {
        hours: formObject[prefix + '.availability.endTime.hours'],
        minutes: formObject[prefix + '.availability.endTime.minutes'],
      },
      timeZone: formObject[prefix + '.availability.timezone'],
      startDay: formObject[prefix + '.availability.startDay'],
      endDay: formObject[prefix + '.availability.endDay'],
    });
  }

  return timeObjects;
}

module.exports = router;
