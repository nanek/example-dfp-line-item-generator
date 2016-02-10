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
var formatter = require('../lib/formatter');

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

var exampleAssociation = {
  lineItemId: null,
  creativeId: null,
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

function includeAssociation(association){
  var isIncluded = true;
  if(association.sizes){
    isIncluded = association.sizes.length !== 4;
  }
  return isIncluded;
}

function editAssociation(association){
  var clone = _.cloneDeep(exampleAssociation);
  association = _.assign(clone, association);
  association.sizes = [ { width: 300, height: 250, isAspectRatio: false },
                        { width: 160, height: 600, isAspectRatio: false },
                        { width: 728, height: 90, isAspectRatio: false },
                        { width: 320, height: 50, isAspectRatio: false } ];
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
