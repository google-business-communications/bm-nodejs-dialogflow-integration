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

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const logger = require('morgan');

const indexRouter = require('./routes.js').router;
const brandsRouter = require('./admin/routes/brands');
const agentRouter = require('./admin/routes/agents');
const locationRouter = require('./admin/routes/locations');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'admin', 'views'));
app.set('view engine', 'ejs');

const rawBodySaver = function(req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
};

app.use(bodyParser.json({verify: rawBodySaver}));
app.use(bodyParser.urlencoded({verify: rawBodySaver, extended: true}));
app.use(bodyParser.raw({verify: rawBodySaver, type: '*/*'}));
app.use(logger('dev'));
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'admin/public')));

app.use('/', indexRouter);
app.use('/admin', brandsRouter);
app.use('/admin/brands/', brandsRouter);
app.use('/admin/agents/', agentRouter);
app.use('/admin/locations/', locationRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
