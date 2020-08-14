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
const liveAgent = require('../lib/live_agent.js');
const sinon = require('sinon');
const uuid = require('uuid');
const firebaseHandler = require('../lib/firebase_handler.js').firebase;

const bmApiHelper = require('../lib/bm_api_helper.js');

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('#receiveMessage()', () => {
  beforeEach(() => {
    sinon.restore();
  });

  it('should throw errors without message or conversationId', async () => {
    await expect(liveAgent.receiveMessage()).to.eventually.be.rejectedWith(
        Error,
        'Message or conversationId is invalid',
    );
    await expect(liveAgent.receiveMessage('')).to.eventually.be.rejectedWith(
        Error,
        'Message or conversationId is invalid',
    );
  });
});
describe('#sendMessage()', () => {
  beforeEach(() => {
    sinon.restore();
  });
  context('with text input', () => {
    it('should call correctly', async () => {
      // should send text json
      const agentId = uuid.v4();
      const conversationId = uuid.v4();
      const messageId = uuid.v4();
      const testMessage = 'test message';
      const testObj = {
        messageId: messageId,
        representative: {
          representativeType: 'HUMAN',
          displayName: 'Echo',
        },
        text: testMessage,
      };
      sinon.stub(firebaseHandler, 'getRepresentativeInfo').resolves({
        representativeName: 'Echo',
      });
      const apiStub = sinon.stub(bmApiHelper, 'sendBmMessage').resolves();

      await liveAgent.sendMessage(
          agentId,
          conversationId,
          messageId,
          testMessage,
          liveAgent.MessageContentType.TEXT,
      );
      sinon.assert.calledWith(apiStub, agentId, testObj, conversationId,
          false);
    });
  });
  context('with json input', () => {
    it('should call correctly', async () => {
      // should send text json
      const agentId = uuid.v4();
      const conversationId = uuid.v4();
      const messageId = uuid.v4();
      const testMessage = 'test message';
      const testObj = {
        messageId: messageId,
        representative: {
          representativeType: 'HUMAN',
          displayName: 'Echo',
        },
        text: testMessage,
      };
      sinon.stub(firebaseHandler, 'getRepresentativeInfo').resolves({
        representativeName: 'Echo',
      });
      const apiStub = sinon.stub(bmApiHelper, 'sendBmMessage').resolves();

      await liveAgent.sendMessage(
          agentId,
          conversationId,
          messageId,
          testObj,
          liveAgent.MessageContentType.JSON,
      );
      sinon.assert.calledWith(apiStub, agentId, testObj, conversationId,
          false);
    });
  });

  context('with missing arguments', () => {
    it('should throw error', async () => {
      await expect(liveAgent.sendMessage()).to.eventually.be.rejectedWith(
          Error,
          'Invalid argument(s)',
      );
    });
  });
});

describe('#agentLeft()', () => {
  beforeEach(() => {
    sinon.restore();
  });
  it('should run without crashing', async () => {
    // stub firebase
    const sampleConversationId = uuid.v4();
    const reprStub = sinon
        .stub(bmApiHelper, 'sendRepresentativeEvent')
        .resolves();
    sinon.stub(bmApiHelper, 'sendCsat').resolves();
    const fbStub = sinon.stub(firebaseHandler, 'clearLiveAgent').resolves();
    await liveAgent.agentLeft(sampleConversationId);
    sinon.assert.calledOnce(fbStub);
    sinon.assert.calledOnce(reprStub);
  });
});

describe('#requestAgent()', () => {
  beforeEach(() => {
    sinon.restore();
    sinon.stub(liveAgent, 'agentJoined').callsFake();
  });
  it('should run without crashing', () => {
    // stub firebase
    const sampleConversationId = uuid.v4();
    sinon.stub(firebaseHandler, 'setRequestedLiveAgent').resolves();
    return liveAgent.requestAgent(sampleConversationId);
  });
});

describe('#agentJoined()', () => {
  const sampleAgentId = uuid.v4();
  beforeEach(() => {
    sinon.restore();
  });
  it('should run without crashing', async () => {
    const sampleConversationId = uuid.v4();
    const fbStub = sinon
        .stub(firebaseHandler, 'setRepresentativeInfo')
        .resolves();
    const apiStub = sinon
        .stub(bmApiHelper, 'sendRepresentativeEvent')
        .resolves();
    sinon.stub(liveAgent, 'agentLeft').resolves();
    const sampleName = 'sample';
    await liveAgent.agentJoined(sampleAgentId,
        sampleConversationId, sampleName);
    sinon.assert.calledOnce(fbStub);
    sinon.assert.calledOnce(apiStub);
    sinon.assert.calledWith(fbStub, sampleAgentId,
        sampleConversationId, sampleName);
    sinon.assert.calledWith(apiStub, true, sampleConversationId);
  });
});
