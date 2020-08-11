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
const moment = require('moment');
const firebaseHandler = require('../lib/firebase_handler.js');
const firebase = firebaseHandler.firebase;
const liveAgentStatus = firebaseHandler.liveAgentStatus;
const firebaseStub = require('./util/firebase_stub.js');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;

describe('#setRequestedLiveAgent', () => {
  const sampleAgentId = uuid.v4();
  beforeEach(() => {
    // stub firebase object
    sinon.restore();
    sinon.stub(firebase, 'database').callsFake(() => {
      return firebaseStub.database();
    });
    this.sampleDb = firebaseStub.database();
    this.sampleConversationId = uuid.v4();
    this.sampleAgentId = uuid.v4();
    this.sampleRef = this.sampleDb.ref(
        `conversations/${this.sampleAgentId}/${this.sampleConversationId}`,
    );
  });

  it('should set live agent status', async () => {
    this.sampleRef.set({
      requestedLiveAgent: false,
    });
    await firebase.setRequestedLiveAgent(sampleAgentId,
        this.sampleConversationId);
    this.sampleRef.once('value', (snapshot) => {
      const data = snapshot.val();
      expect(data.requestedLiveAgent).to.equal(true);
    });
  });

  it('should crash when live agent already requested', async () => {
    this.sampleRef.set({
      requestedLiveAgent: true,
    });
    await expect(
        firebase.setRequestedLiveAgent(sampleAgentId,
            this.sampleConversationId),
    ).to.eventually.be.rejectedWith(Error, 'Live agent already requested');
  });
});

describe('#clearLiveAgent', () => {
  const sampleAgentId = uuid.v4();
  beforeEach(() => {
    // stub firebase object
    sinon.restore();
    sinon.stub(firebase, 'database').callsFake(() => {
      return firebaseStub.database();
    });
    this.sampleDb = firebaseStub.database();
    this.sampleConversationId = uuid.v4();
    this.sampleRef = this.sampleDb.ref(
        `conversations/${this.sampleAgentId}/${this.sampleConversationId}`,
    );
  });

  it('should clear live agent ', async () => {
    this.sampleRef.set({
      representativeInfo: {
        representativeName: 'sample',
      },
      requestedLiveAgent: true,
    });
    await firebase.clearLiveAgent(sampleAgentId, this.sampleConversationId);
    this.sampleRef.once('value', (snapshot) => {
      const data = snapshot.val();
      expect(data.requestedLiveAgent).to.equal(false);
      expect(data.representativeInfo).to.eql({});
    });
  });

  it('should crash when no live agent is present', async () => {
    this.sampleRef.set({});
    await expect(
        firebase.clearLiveAgent(sampleAgentId, this.sampleConversationId),
    ).to.eventually.be.rejectedWith(Error, 'No live agent present');
  });
});

describe('#setRepresentativeInfo', () => {
  const sampleAgentId = uuid.v4();
  beforeEach(() => {
    // stub firebase object
    sinon.restore();
    sinon.stub(firebase, 'database').callsFake(() => {
      return firebaseStub.database();
    });
    this.sampleDb = firebaseStub.database();
    this.sampleConversationId = uuid.v4();
    this.sampleRef = this.sampleDb.ref(
        `conversations/${this.sampleAgentId}/${this.sampleConversationId}`,
    );
  });

  it('should set representative name', async () => {
    repName = 'sample';
    this.sampleRef.set({
      requestedLiveAgent: true,
    });

    await firebase.setRepresentativeInfo(sampleAgentId,
        this.sampleConversationId, repName);
    this.sampleRef.once('value', (snapshot) => {
      const data = snapshot.val();
      expect(data.requestedLiveAgent).to.equal(false);
      expect(data.representativeInfo).to.eql({
        representativeName: repName,
      });
    });
  });

  it('should crash on existing representative', async () => {
    this.sampleRef.set({
      requestedLiveAgent: true,
      representativeInfo: {
        representativeName: 'sample',
      },
    });
    await expect(
        firebase.setRepresentativeInfo(sampleAgentId,
            this.sampleConversationId),
    ).to.eventually.be.rejectedWith(Error, 'Representative is already present');
  });
});

describe('#addMessageId()', () => {
  const sampleAgentId = uuid.v4();
  beforeEach(() => {
    // stub firebase object
    sinon.restore();
    sinon.stub(firebase, 'database').callsFake(() => {
      return firebaseStub.database();
    });
    this.sampleDb = firebaseStub.database();
    this.sampleConversationId = uuid.v4();
    this.sampleRef = this.sampleDb.ref(
        `conversations/${this.sampleAgentId}/${this.sampleConversationId}`,
    );
  });
  it('should create new messageId array', async () => {
    const sampleMessageId = uuid.v4();
    this.sampleRef.set({});
    await firebase.addMessageId(sampleAgentId,
        this.sampleConversationId, sampleMessageId);
    this.sampleRef.once('value', (snapshot) => {
      const data = snapshot.val();
      expect(data.messageIds).to.eql([sampleMessageId]);
    });
  });
  it('should append to existing messageId array', async () => {
    const sampleMessageId = uuid.v4();
    const existingMessageId = uuid.v4();
    this.sampleRef.set({
      messageIds: [existingMessageId],
    });
    await firebase.addMessageId(sampleAgentId,
        this.sampleConversationId, sampleMessageId);
    this.sampleRef.once('value', (snapshot) => {
      const data = snapshot.val();
      expect(data.messageIds).to.eql([existingMessageId, sampleMessageId]);
    });
  });
  it('should reject on existing messageId', async () => {
    const existingMessageId = uuid.v4();
    this.sampleRef.set({
      messageIds: [existingMessageId],
    });
    await expect(
        firebase.addMessageId(sampleAgentId,
            this.sampleConversationId, existingMessageId),
    ).to.eventually.be.rejectedWith('Message already received');
  });
});

describe('#updateTimestamp()', () => {
  const sampleAgentId = uuid.v4();
  beforeEach(() => {
    sinon.restore();
    sinon.stub(firebase, 'database').callsFake(() => {
      return firebaseStub.database();
    });
    this.sampleDb = firebaseStub.database();
    this.sampleConversationId = uuid.v4();
    this.sampleRef = this.sampleDb.ref(
        `conversations/${this.sampleAgentId}/${this.sampleConversationId}`,
    );
  });

  it('should update to new timestamp', async () => {
    const newTime = moment().unix();
    this.sampleRef.set({});
    await firebase.updateTimestamp(sampleAgentId,
        this.sampleConversationId, newTime),
    this.sampleRef.once('value', (snapshot) => {
      const data = snapshot.val();
      expect(data.lastTimestamp).to.equal(newTime);
      expect(data.csatSent).to.equal(false);
    });
  });
});

describe('#getUserStatus()', () => {
  const sampleAgentId = uuid.v4();
  beforeEach(() => {
    // stub firebase object
    sinon.restore();
    sinon.stub(firebase, 'database').callsFake(() => {
      return firebaseStub.database();
    });
    this.sampleDb = firebaseStub.database();
    this.sampleConversationId = uuid.v4();
    this.sampleRef = this.sampleDb.ref(
        `conversations/${this.sampleAgentId}/${this.sampleConversationId}`,
    );
  });

  context('directing tests:', () => {
    it('should direct requested agent messages correctly', async () => {
      this.sampleRef.set({requestedLiveAgent: true});
      const result = await firebase.getUserStatus(sampleAgentId,
          this.sampleConversationId, '');
      expect(result).to.equal(liveAgentStatus.REQUESTED_LIVE_AGENT);
    });

    it('should direct live agent messages correctly', async () => {
      this.sampleRef.set({
        representativeInfo: {representativeName: 'sample'},
      });
      const result = await firebase.getUserStatus(sampleAgentId,
          this.sampleConversationId, '');
      expect(result).to.equal(liveAgentStatus.SPEAKING_WITH_AGENT);
    });

    it('should direct bot messages correctly', async () => {
      this.sampleRef.set({requestedLiveAgent: false});
      const result = await firebase.getUserStatus(sampleAgentId,
          this.sampleConversationId, '');
      expect(result).to.equal(liveAgentStatus.SPEAKING_WITH_BOT);
    });
  });

  it('should create new conversation + direct to bot', async () => {
    this.sampleRef.set();
    const result = await firebase.getUserStatus(sampleAgentId,
        this.sampleConversationId, '');
    expect(result).to.equal(liveAgentStatus.SPEAKING_WITH_BOT);
    this.sampleRef.once('value', (snapshot) => {
      const data = snapshot.val();
      expect(data.requestedLiveAgent).to.equal(false);
    });
  });
});

describe('#saveMessage()', () => {
  beforeEach(() => {
    // stub firebase object
    sinon.restore();
    sinon.stub(firebase, 'database').callsFake(() => {
      return firebaseStub.database();
    });
    this.sampleDb = firebaseStub.database();
    this.sampleConversationId = uuid.v4();
    this.sampleAgentId = uuid.v4();
    this.sampleRef = this.sampleDb.ref(
        `conversations/${this.sampleAgentId}/${this.sampleConversationId}`,
    );
  });

  it('should save message correctly', async () => {
    this.sampleRef.set();
    const sampleMsgInfo = {
      text: 'hello',
    };
    const sampleSender = 'sender';
    const sampleTimestamp = 12398;
    await firebase.saveMessage(
        this.sampleAgentId,
        this.sampleConversationId,
        sampleMsgInfo,
        sampleTimestamp,
        sampleSender,
    );
    this.sampleRef.once('value', (snapshot) => {
      const data = snapshot.val();
      expect(Object.values(data)[0]).to.eql({
        timestamp: sampleTimestamp,
        messageInfo: sampleMsgInfo,
        sender: sampleSender,
        sent: true,
      });
    });
  });
});

describe('#getRepresentativeInfo', () => {
  beforeEach(() => {
  // stub firebase object
    sinon.restore();
    sinon.stub(firebase, 'database').callsFake(() => {
      return firebaseStub.database();
    });
    this.sampleDb = firebaseStub.database();
    this.sampleConversationId = uuid.v4();
    this.sampleAgentId = uuid.v4();
    this.sampleRef = this.sampleDb.ref(
        `conversations/${this.sampleAgentId}/${this.sampleConversationId}`,
    );
  });
  it('should yield representative info', async () => {
    const sampleRep = {
      representativeInfo: {
        representativeName: 'Test',
      },
    };
    this.sampleRef.set(sampleRep);

    const results = await firebase.getRepresentativeInfo(this.sampleAgentId,
        this.sampleConversationId);
    expect(results).to.eql(sampleRep.representativeInfo);
  });
});

describe('#getCredentials', () => {
  beforeEach(() => {
  // stub firebase object
    sinon.restore();
    sinon.stub(firebase, 'database').callsFake(() => {
      return firebaseStub.database();
    });
    this.sampleDb = firebaseStub.database();
    this.sampleConversationId = uuid.v4();
    this.sampleAgentId = uuid.v4();
    this.sampleRef = this.sampleDb.ref(
        `admin/agents/${this.sampleAgentId}`,
    );
  });
  it('should yield credentials', async () => {
    const sampleKey = {
      serviceKey: 'test',
    };
    const sampleProjectId = 'sample';
    const sampleCreds = {
      dfServiceAccountKey: JSON.stringify(sampleKey),
      projectId: sampleProjectId,
    };
    this.sampleRef.set(sampleCreds);

    const results = await firebase.getCredentials(this.sampleAgentId);
    expect(results).to.eql({
      dfServiceAccountKey: sampleKey,
      dialogflowProjectId: sampleProjectId,
    });
  });
});

describe('#setTypingStatus', () => {
  beforeEach(() => {
  // stub firebase object
    sinon.restore();
    sinon.stub(firebase, 'database').callsFake(() => {
      return firebaseStub.database();
    });
    this.sampleDb = firebaseStub.database();
    this.sampleConversationId = uuid.v4();
    this.sampleAgentId = uuid.v4();
    this.sampleRef = this.sampleDb.ref(
        `conversations/${this.sampleAgentId}/${this.sampleConversationId}`,
    );
  });
  it('should update typing status', async () => {
    this.sampleRef.set();
    await firebase
        .setTypingStatus(this.sampleAgentId, this.sampleConversationId, true);
    this.sampleRef.once('value', (snapshot) => {
      const data = snapshot.val();
      expect(data.userIsTyping).to.equal(true);
    });
  });
});
