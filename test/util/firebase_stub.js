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
const uuid = require('uuid');
// mock firebase stub object
module.exports = {
  // mock firebase realtime database
  database: () => ({
    // mock ref() functionality
    ref: (reference) => ({
      reference: reference,
      // mocks retrieval of data for testing db
      once: (instruction, cb) => {
        cb({
          val: () => this.data,
        });
      },
      set: (newData) => {
        this.data = newData;
      },
      update: (newData, cb) => {
        this.data = newData;
        if (cb) {
          cb();
        }
      },
      push: (newData, cb) => {
        if (!this.data) {
          this.data = {
            [uuid.v4()]: newData,
          };
        } else {
          this.data[uuid.v4()] = newData;
        }
        cb();
      },
    }),
  }),
};
