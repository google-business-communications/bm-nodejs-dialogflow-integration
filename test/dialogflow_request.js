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

const expect = require('chai').expect;
const dfRequest = require('../lib/dialogflow_request.js');
const firebase = require('../lib/firebase_handler.js').firebase;
const dialogflow = require('@google-cloud/dialogflow');
const uuid = require('uuid');
const sinon = require('sinon');

const sampleMsg = {
  payload: {
    fields: {
      foo: {
        kind: 'stringValue',
        stringValue: 'bar',
      },
      testing: {
        kind: 'boolValue',
        boolValue: true,
      },
    },
  },
};

describe('#callDialogflow()', () => {
  beforeEach(() => {
    sinon.restore();
  });
  // test dialogflow intent API call and response reading
  context('with message', () => {
    it('should call Dialogflow', async () => {
      // stub dialogflow agent
      sinon
          .stub(firebase, 'getCredentials')
          .resolves({dfServiceAccountKey: ''});
      sinon.stub(dialogflow, 'SessionsClient').callsFake(() => {
        // console.log('called fake');
        return {
          projectAgentSessionPath: () => {
            // console.log('fake sessionPath');
            return 'fake sessionPath';
          },
          detectIntent: () => {
            // console.log('fake detectintent');
            return [
              {
                queryResult: {
                  fulfillmentMessages: [sampleMsg],
                },
              },
            ];
          },
        };
      });

      // run sample dialogflow call + test response information
      const fulfillmentMessages = await dfRequest.callDialogflow(uuid.v4(),
          uuid.v4(), 'what\'s the weather?',
      );
      expect(fulfillmentMessages.length).to.not.equal(0);
      delete fulfillmentMessages[0].messageId;
      expect(fulfillmentMessages[0]).to.eql({
        foo: 'bar',
        testing: true,
      });
    });
  });
});

describe('#convertToBm()', () => {
  beforeEach(() => {
    sinon.restore();
  });
  context('with custom payload', () => {
    // create a sample custom JSON from Dialogflow

    // test convertToBm() correctly adds a messageId
    it('should add a messageId', () => {
      const result = dfRequest.convertToBm(sampleMsg);
      expect(result.messageId).to.exist;
    });
    it('should correctly decode', () => {
      const result = dfRequest.convertToBm(sampleMsg);
      delete result.messageId;
      expect(result).to.eql({
        foo: 'bar',
        testing: true,
      });
    });
  });
  context('with plaintext response', () => {
    // create a sample plaintext response
    const sampleMsg = {
      text: {
        text: ['custom message'],
      },
    };
    // test if creates the correct JSON for a plaintext response
    it('should add a messageId', () => {
      const result = dfRequest.convertToBm(sampleMsg);
      expect(result.messageId).to.exist;
    });
    it('should correctly decode', () => {
      const result = dfRequest.convertToBm(sampleMsg);
      // remove variable messageId
      delete result.messageId;
      expect(result).to.eql({
        text: 'custom message',
        representative: {
          representativeType: 'BOT',
        },
      });
    });
  });
});

// test function that generates a dialogflow API call
describe('#generateDfCall()', () => {
  beforeEach(() => {
    sinon.restore();
  });
  const testSessionPath = 'test_string';
  const testMessage = 'test_message';
  const expectedResult = {
    session: testSessionPath,
    queryInput: {
      text: {
        text: testMessage,
        languageCode: 'en-US',
      },
    },
  };
  // test that it correctly generates a dialogflow message
  context('with message', () => {
    it('should correctly generate a request', () => {
      // generate test session + message and run generateDfCall
      const request = dfRequest.generateDfCall(testMessage, testSessionPath);
      expect(request).to.eql(expectedResult);
    });
  });
  // test that errors are thrown without message or sessionPath values
  context('without message', () => {
    it('should throw error', () => {
      expect(() => {
        dfRequest.generateDfCall('', testSessionPath);
      }).to.throw(Error, 'Message is empty or undefined');

      expect(() => {
        dfRequest.generateDfCall(undefined, testSessionPath);
      }).to.throw(Error, 'Message is empty or undefined');
    });
  });

  context('without sessionPath', () => {
    it('should throw error', () => {
      expect(() => {
        dfRequest.generateDfCall(testMessage, '');
      }).to.throw(Error, 'sessionPath is empty or undefined');

      expect(() => {
        dfRequest.generateDfCall(testMessage, undefined);
      }).to.throw(Error, 'sessionPath is empty or undefined');
    });
  });
});
