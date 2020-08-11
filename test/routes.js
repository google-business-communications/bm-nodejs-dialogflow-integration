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

const sinon = require('sinon');
const uuid = require('uuid');
const routes = require('../routes.js');
const liveAgent = require('../lib/live_agent.js');
const bmApiHelper = require('../lib/bm_api_helper.js');
const firebaseHandler = require('../lib/firebase_handler.js');
const firebase = firebaseHandler.firebase;
const liveAgentStatus = firebaseHandler.liveAgentStatus;
const dfRequest = require('../lib/dialogflow_request.js');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;

// verify server message directing
describe('#handleByServer', () => {
  beforeEach(() => {
    sinon.restore();
  });
  it('should direct messages correctly', async () => {
    // stub duplication + response functions
    const responseStub = sinon.stub(routes, 'handleResponse').resolves();
    const messageStub = sinon.stub(firebase, 'addMessageId').resolves();
    const saveStub = sinon.stub(firebase, 'saveMessage').resolves();
    const sampleAgent = 'sampleAgent';
    const sampleBody = {
      conversationId: uuid.v4(),
      message: {
        text: 'sample message',
        messageId: uuid.v4(),
      },
      agent: `brands/sampleBrand/agents/${sampleAgent}`,
    };
    await routes.handleByServer(sampleBody);
    // verify correct functions were called
    sinon.assert.calledOnce(messageStub);
    sinon.assert.calledWith(
        messageStub,
        sampleAgent,
        sampleBody.conversationId,
        sampleBody.message.messageId,
    );
    sinon.assert.calledOnce(responseStub);
    sinon.assert.calledWith(
        responseStub,
        sampleAgent,
        sampleBody.conversationId,
        sampleBody.message.text,
    );
    sinon.assert.calledOnce(saveStub);
  });
  it('should direct suggestionResponse correctly', async () => {
    // stub server response function
    const responseStub = sinon.stub(routes, 'handleResponse').resolves();
    const saveStub = sinon.stub(firebase, 'saveMessage').resolves();
    const sampleAgent = 'sampleAgent';
    const sampleBody = {
      conversationId: uuid.v4(),
      suggestionResponse: {
        postbackData: 'sample postback data',
      },
      agent: `brands/sampleBrand/agents/${sampleAgent}`,
    };
    await routes.handleByServer(sampleBody);
    // verify was called with correct data
    sinon.assert.calledOnce(responseStub);
    sinon.assert.calledWith(
        responseStub,
        sampleAgent,
        sampleBody.conversationId,
        sampleBody.suggestionResponse.postbackData,
    );
    sinon.assert.calledOnce(saveStub);
  });

  it('should request live agent correctly', async () => {
    // stub server response function
    const agentStub = sinon.stub(liveAgent, 'requestAgent').resolves();
    const sampleAgent = 'sampleAgent';
    const sampleBody = {
      conversationId: uuid.v4(),
      userStatus: {
        requestedLiveAgent: true,
      },
      agent: `brands/sampleBrand/agents/${sampleAgent}`,
    };
    await routes.handleByServer(sampleBody);
    // verify live agent was called
    sinon.assert.calledOnce(agentStub);
  });

  it('should handle duplicate crash', async () => {
    // stub live agent calling
    sinon.stub(liveAgent, 'requestAgent').resolves();
    sinon
        .stub(firebase, 'addMessageId')
        .rejects(new Error('Message already received'));
    const sampleAgent = 'sampleAgent';
    const sampleBody = {
      conversationId: uuid.v4(),
      message: {
        text: 'sample message',
        messageId: uuid.v4(),
      },
      agent: `brands/sampleBrand/agents/${sampleAgent}`,
    };
    await expect(
        routes.handleByServer(sampleBody),
    ).to.eventually.be.rejectedWith(Error, 'Dedupe: message already received');
    // verify was called with correct data
  });
});

describe('#handleByAgent', () => {
  beforeEach(() => {
    sinon.restore();
  });
  it('should send messages to live agent', async () => {
    const sampleAgent = 'sampleAgent';
    const sampleBody = {
      conversationId: uuid.v4(),
      message: {
        text: 'sample message',
      },
      agent: `brands/sampleBrand/agents/${sampleAgent}`,
    };
    // stub receive message
    const receiveStub = sinon.stub(liveAgent, 'receiveMessage').resolves();
    sinon.stub(firebase, 'saveMessage').resolves();
    sinon.stub(firebase, 'addMessageId').resolves();
    await routes.handleByAgent(sampleBody);
    sinon.assert.calledOnce(receiveStub);
    sinon.assert.calledWith(
        receiveStub,
        sampleBody.message.text,
        sampleBody.conversationId,
    );
  });
  it('should detect duplicates', async () => {
    const sampleAgent = 'sampleAgent';
    const sampleBody = {
      conversationId: uuid.v4(),
      message: {
        text: 'sample message',
      },
      agent: `brands/sampleBrand/agents/${sampleAgent}`,
    };
    sinon.stub(firebase, 'saveMessage').resolves();
    sinon.stub(firebase, 'addMessageId')
        .rejects(new Error('Message already received'));
    expect(routes.handleByAgent(sampleBody))
        .to.be.rejectedWith('Dedupe: message already received');
  });
  context('should send typing status indicators', () => {
    beforeEach(() => {
      const sampleAgent = 'sampleAgent';
      this.sampleBody = {
        conversationId: uuid.v4(),
        agent: `brands/sampleBrand/agents/${sampleAgent}`,
        userStatus: {
          isTyping: true,
        },
      };
    });
    it('should send start typing', async () => {
      sinon.stub(firebase, 'setTypingStatus').resolves();
      await routes.handleByAgent(this.sampleBody);
    });
  });
});

describe('#directMessage()', () => {
  beforeEach(() => {
    sinon.restore();
    sinon.stub(firebase, 'updateTimestamp').resolves();
  });
  it('should direct messages to server', async () => {
    // verify will direct to bot
    const statusStub = sinon
        .stub(firebase, 'getUserStatus')
        .resolves(liveAgentStatus.SPEAKING_WITH_BOT);
    sinon.stub(firebase, 'setTypingStatus').resolves();
    const serverStub = sinon.stub(routes, 'handleByServer').resolves();
    sinon.stub(firebase, 'getCredentials').resolves();
    const sampleAgent = 'sampleAgent';
    await routes.directMessage({
      conversationId: uuid.v4(),
      context: {
        userInfo: {
          displayName: 'sample name',
        },
      },
      agent: `brands/sampleBrand/agents/${sampleAgent}`,
    });
    sinon.assert.calledOnce(serverStub);
    sinon.assert.calledOnce(statusStub);
  });
  it('should direct messages to agent', async () => {
    // verify will direct messages with agent status
    const statusStub = sinon
        .stub(firebase, 'getUserStatus')
        .resolves(liveAgentStatus.SPEAKING_WITH_AGENT);
    sinon.stub(firebase, 'setTypingStatus').resolves();
    const serverStub = sinon.stub(routes, 'handleByAgent').resolves();
    sinon.stub(firebase, 'getCredentials').resolves();
    const sampleAgent = 'sampleAgent';
    await routes.directMessage({
      conversationId: uuid.v4(),
      context: {
        userInfo: {
          displayName: 'sample name',
        },
      },
      agent: `brands/sampleBrand/agents/${sampleAgent}`,
    });
    sinon.assert.calledOnce(serverStub);
    sinon.assert.calledOnce(statusStub);
  });
});

describe('#handleResponse()', async () => {
  beforeEach(() => {
    sinon.restore();
  });

  it('should call without crashing', async () => {
    const typingStub = sinon.stub(bmApiHelper, 'sendTypingEvent').resolves();
    sinon.stub(dfRequest, 'callDialogflow').resolves();
    sinon.stub(bmApiHelper, 'sendMessages').resolves();
    await routes.handleResponse('sample message', uuid.v4());
    sinon.assert.calledTwice(typingStub);
  });
});
