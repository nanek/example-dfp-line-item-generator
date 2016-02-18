/*eslint-disable */
/**
 *
 * This script queries dfp for all line items that match the arguments
 * specified, modifies their javascript representation and the submits an update
 * to DFP.
 *
 * Usage:
 *
 *   $ node scripts/update-associations.js --channel A --platform M --position MIDDLE --region USA --partner SONOBI
 *
 */
'use strict';

var Bluebird = require('bluebird');
var argv = require('minimist')(process.argv.slice(2));
var _ = require('lodash');

var DFP_CREDS = require('../local/application-creds');
var config = require('../local/config');

var Dfp = require('node-google-dfp-wrapper');

var credentials = {
  clientId: DFP_CREDS.installed.client_id,
  clientSecret: DFP_CREDS.installed.client_secret,
  redirectUrl: DFP_CREDS.installed.redirect_uris[0]
};

var dfp = new Dfp(credentials, config, config.refreshToken);

// read command line arguments
var creativeId = argv.creativeId;

var ProgressBar = require('progress');
var progressBar;

var CONCURRENCY = {
  concurrency: 1
};

// use a default object to force certain properties to be in the correct order
var defaultAssociation = {
  lineItemId: null,
  creativeId: null,
  // startDateTime throws an error if you use full values
  startDateTime: {
    date: { year: 2016, month: 2, day: 9 },
    hour: 11,
    minute: 19,
    second: 35,
    timeZoneID: 'America/New_York'
  },
  startDateTimeType: 'USE_START_DATE_TIME',
  sizes: null,
  status: null,
  stats: {stats:{}},
  lastModifiedDateTime: null
};

console.log(process.argv.slice(2).join(' '));

function getQuery() {
  return {
    creativeId: creativeId
  };
};

function getAssociations(query) {
  return dfp.getAssociations(query);
}

function includeAssociation(association) {
  // filter associations however you need to
  return true;
}

function editAssociation(_association) {
  // extend the default association so that all fields are in the correct order
  var clone = _.cloneDeep(defaultAssociation);
  var association = _.assign(clone, _association);
  //mutate association however you need to
  return association;
}
function updateAssociations(associations) {
  return dfp.updateAssociations(associations)
    .tap(advanceProgress);
}

function logSuccess(results) {
  if (results) {
    console.log('sucessfully updated associations');
  }
}

function handleError(err) {
  console.log('updating associations failed');
  console.log('because', err.stack);
}

// this function is to help debugging
function log(x){
  console.log(x);
}

function splitBatches(associations){
  var batches = _.chunk(associations, 400);
  console.log(batches.length, 'batches');
  progressBar = new ProgressBar('Progress [:bar] :percent :elapseds', {
    total: batches.length + 1
  });
  advanceProgress();
  return batches;
}

function advanceProgress(){
  progressBar.tick();
};

Bluebird.resolve(getQuery())
  .then(getAssociations)
  .filter(includeAssociation)
  .map(editAssociation)
  .then(splitBatches)
  .map(updateAssociations, CONCURRENCY)
  .then(logSuccess)
  .catch(handleError);
