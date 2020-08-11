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

const express = require('express');
const router = express.Router();
const util = require('util');
const apiHelper = require('../../lib/api_helper.js');

// Constant for an entry point that should not be used
const IGNORE_ENTRY_POINT = 'IGNORE';

// Constant for supported entry points
const ALLOWED_ENTRY_POINTS = ['PLACESHEET', 'MAPS_TACTILE', 'IGNORE'];

/**
 * Location listing page.
 */
router.get('/', function(req, res, next) {
  const brandId = req.query.brandId;

  // setup the parameters for the API call
  const apiParams = {
    auth: apiHelper.authClient,
    parent: brandId,
  };

  apiHelper.bcApi.brands.locations.list(apiParams, {}, function(
      err,
      response,
  ) {
    res.render('locations/list', {
      locations: response.data.locations,
      brandId: brandId,
    });
  });
});

/**
 * Create a new location.
 */
router.get('/create', function(req, res, next) {
  const brandId = req.query.brandId;

  let message = '';
  if (req.query.message !== undefined) {
    message = req.query.message;
  }

  // Creates default location values for the form
  const location = {
    placeId: '',
    locationTestUrl: '',
    agent: '',
    locationEntryPointConfigs: [
      {
        allowedEntryPoint: 'PLACESHEET',
      },
      {
        allowedEntryPoint: 'MAPS_TACTILE',
      },
    ],
  };

  const apiParams = {
    auth: apiHelper.authClient,
    parent: brandId,
  };

  apiHelper.bcApi.brands.agents.list(apiParams, {}, function(err, response) {
    res.render('locations/edit', {
      title: 'Create Location',
      location: location,
      agents: response.data.agents,
      formUrl: '/locations/save?brandId=' + brandId,
      brandId: brandId,
      isEdit: false,
      message: message,
      allowedEntryPoints: ALLOWED_ENTRY_POINTS,
    });
  });
});

/**
 * Edit an existing location.
 */
router.get('/edit', function(req, res, next) {
  const locationId = req.query.locationId;
  const brandId = req.query.brandId;

  let message = '';
  if (req.query.message !== undefined) {
    message = req.query.message;
  }
  // setup the parameters for the API call
  let apiParams = {
    auth: apiHelper.authClient,
    name: locationId,
  };

  apiHelper.bcApi.brands.locations.get(apiParams, {}, function(
      err,
      response,
  ) {
    const location = response.data;

    apiParams = {
      auth: apiHelper.authClient,
      parent: brandId,
    };

    apiHelper.bcApi.brands.agents.list(apiParams, {}, function(
        err,
        response,
    ) {
      res.render('locations/edit', {
        location: location,
        title: 'Edit Location',
        formUrl:
              '/locations/save?locationId=' +
              locationId +
              '&brandId=' +
              brandId,
        brandId: brandId,
        isEdit: true,
        message: message,
        agents: response.data.agents,
        allowedEntryPoints: ALLOWED_ENTRY_POINTS,
      });
    });
  });
});

/**
 * Create/update a location.
 */
router.post('/save', function(req, res, next) {
  let locationId = false;
  const brandId = req.query.brandId;

  if (req.query.locationId !== undefined) {
    locationId = req.query.locationId;
    method = 'PATCH';
    url = '/' + locationId + '?updateMask=agent';
  }

  const formObject = req.body;

  const locationObject = {
    placeId: formObject.placeId,
    agent: formObject.agent,
    locationEntryPointConfigs: getEntryPoints(formObject),
  };

  // Update location
  if (locationId) {
    updateLocation(res, brandId, locationId, locationObject, apiHelper);
  } else {
    // Create location
    createLocation(res, brandId, locationObject, apiHelper);
  }
});

/**
 * Patches the location's associated agent value. If there are no errors,
 * the user is redirected to the list of all locations for the brand.
 *
 * @param {object} res The HTTP response object.
 * @param {string} brandId The brand id for the location.
 * @param {string} locationId The location id for the location being updated.
 * @param {object} locationObject The JSON object to post.
 * @param {object} apiObject The BC API object.
 */
function updateLocation(res, brandId, locationId, locationObject, apiObject) {
  // setup the parameters for the API call
  const apiParams = {
    auth: apiObject.authClient,
    name: locationId,
    resource: locationObject,
    updateMask: 'agent',
  };

  apiObject.bcApi.brands.locations.patch(apiParams, {}, function(
      err,
      response,
  ) {
    if (err !== undefined && err !== null) {
      handleError(res, err, brandId, locationId);
    } else {
      res.redirect('/locations?brandId=' + brandId);
    }
  });
}

/**
 * Creates a new. If there are no errors,
 * the user is redirected to the list of all locations for the brand.
 *
 * @param {object} res The HTTP response object.
 * @param {string} brandId The brand id for the location.
 * @param {object} locationObject The JSON object to post.
 * @param {object} apiObject The BC API object.
 */
function createLocation(res, brandId, locationObject, apiObject) {
  // setup the parameters for the API call
  const apiParams = {
    auth: apiObject.authClient,
    parent: brandId,
    resource: locationObject,
  };

  apiObject.bcApi.brands.locations.create(apiParams, {}, function(
      err,
      response,
  ) {
    if (err !== undefined && err !== null) {
      handleError(res, err, brandId, locationId);
    } else {
      res.redirect('/locations?brandId=' + brandId);
    }
  });
}

/**
 * Parses the error and redirects to display the error message.
 *
 * @param {object} res The HTTP response object.
 * @param {object} error The error object.
 * @param {string} brandId The brand id for the location.
 * @param {string} locationId The location id for the location being updated.
 * @param {object} apiObject The BC API object.
 */
function handleError(res, error, brandId, locationId) {
  console.log(util.inspect(error, {showHidden: false, depth: null}));

  const errorMessage = error.errors[0].message;

  let url =
    '/locations/edit?brandId=' +
    brandId +
    '&message=' +
    errorMessage +
    '&locationId=' +
    locationId;

  if (locationId === undefined) {
    url = '/locations/create?brandId=' + brandId + '&message=' + errorMessage;
  }

  res.redirect(url);
}

/**
 * Converts the form input for entry points into a JSON object to
 * store via the API. Any "ignore" selections are not included.
 * @param {object} formObject The form values.
 * @return {object} A JSON object representing the selected entry points.
 */
function getEntryPoints(formObject) {
  const entryPoints = [];
  for (let i = 0; i < formObject['allowedEntryPoint[]'].length; i++) {
    if (formObject['allowedEntryPoint[]'][i] !== IGNORE_ENTRY_POINT) {
      entryPoints.push({
        allowedEntryPoint: formObject['allowedEntryPoint[]'][i],
      });
    }
  }

  return entryPoints;
}

module.exports = router;
