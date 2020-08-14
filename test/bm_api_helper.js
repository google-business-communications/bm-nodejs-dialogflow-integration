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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const bmApiHelper = require('../lib/bm_api_helper.js');
const firebase = require('../lib/firebase_handler.js').firebase;
const apiHelper = require('../lib/api_helper.js');
const nock = require('nock');
const uuid = require('uuid');
const sinon = require('sinon');

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('#sendMessages()', () => {
  const sampleConvId = uuid.v4();
  const sampleAgentId = uuid.v4();

  beforeEach(() => {
    sinon.restore();
  });

  it('should correctly call API', async () => {
    // stub API call function to return success
    const callStub = sinon.stub(bmApiHelper, 'sendBmMessage').callsFake(() => {
      return 200;
    });
    sampleMessages = [{}, {}];
    // call messages and verify correct number of calls
    await bmApiHelper.sendMessages(sampleAgentId, sampleMessages, sampleConvId);
    // console.log('called ' + callStub.callCount + ' times');
    expect(callStub.callCount).to.equal(sampleMessages.length);
  });

  it('should throw error on API error', async () => {
    // reject on API call fail
    const callStub = sinon.stub(bmApiHelper, 'sendBmMessage').rejects();
    sampleMessages = [{}, {}];
    await expect(
        bmApiHelper.sendMessages(sampleAgentId, sampleMessages, sampleConvId),
    ).to.eventually.be.rejectedWith(Error);
    expect(callStub.callCount).to.equal(1);
  });
});

describe('#sendBmMessage()', () => {
  const sampleEndpoint = 'http://www.google.com';
  const sampleResponse = {
    valid: 'true',
  };
  const sampleConvId = uuid.v4();

  beforeEach(() => {
    sinon.restore();
    // creates mock successful API for testing calls
    nock(sampleEndpoint)
        .post('/')
        .reply(200, sampleResponse);
  });

  // test with invalid credentials stub
  it('should crash on invalid credentials', async () => {
    sinon
        .stub(firebase, 'getCredentials')
        .resolves({bmServiceAccountKey: ''});
    expect(
        bmApiHelper.sendBmMessage(sampleEndpoint, {}, sampleConvId),
    ).to.be.rejectedWith(Error);
  });
});

describe('#sendTypingEvent()', () => {
  beforeEach(() => {
    sinon.restore();
  });
  it('should run without crashing', () => {
    const sampleConvId = uuid.v4();
    const sampleEventId = uuid.v4();
    sinon.stub(apiHelper.bmApi.conversations.events, 'create').callsFake();
    bmApiHelper.sendTypingEvent(true, sampleConvId, sampleEventId);
  });
  context('with incorrect arguments', () => {
    it('should crash without arguments', () => {
      // create a stub for BM api
      sinon.stub(apiHelper.bmApi.conversations.events, 'create').callsFake();
      expect(bmApiHelper.sendTypingEvent())
          .to.eventually.be.rejectedWith(Error);
    });
  });
});

describe('#sendCsat', () => {
  beforeEach(() => {
    sinon.restore();
  });
  it('should run without crashing', () => {
    // create a stub for BM api
    sinon.stub(apiHelper.bmApi.conversations.surveys, 'create').callsFake();
    const sampleConvId = uuid.v4();
    const sampleSurveyId = uuid.v4();
    bmApiHelper.sendCsat(sampleConvId, sampleSurveyId);
  });
});

describe('#sendRepresentativeEvent()', () => {
  beforeEach(() => {
    sinon.restore();
  });
  it('should run without crashing', () => {
    // create a stub for BM api
    sinon.stub(apiHelper.bmApi.conversations.events, 'create').callsFake();
    const sampleConvId = uuid.v4();
    const sampleEventId = uuid.v4();
    bmApiHelper.sendRepresentativeEvent(true, sampleConvId, sampleEventId);
  });
  context('with incorrect arguments', () => {
    it('should crash without arguments', () => {
      sinon.stub(apiHelper.bmApi.conversations.events, 'create').callsFake();
      expect(
          bmApiHelper.sendRepresentativeEvent(),
      ).to.eventually.be.rejectedWith(Error);
    });
  });
});
