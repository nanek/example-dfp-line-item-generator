/*eslint-disable */
/**
 *
 * This script queries DFP for all line item for the partner you provide. It
 * then queries for all creatives for that partner. It matches the all line
 * items and creatives by name and creates a line-item-creative-association
 * for each pair.
 *
 * Usage:
 *
 *   $ node scripts/create-associations.js --channel A --platform M --position MIDDLE --region USA --partner SONOBI
 *
 */
/*eslint-enable */
'use strict';

var Bluebird = require('bluebird');
var _ = require('lodash');
var ProgressBar = require('progress');
var progressBar;
var argv = require('minimist')(process.argv.slice(2));

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
var channel = argv.channel;
var region = argv.region;
var position = argv.position;
var partner = argv.partner;
var platform = argv.platform;
var offset = argv.offset;

// use arguments to determine any other variables
var sizes = require('./sizes')(platform);
var size = sizes[position];

var WILDCARD = '%';

var all = [
  channel,
  region,
  partner,
  WILDCARD
].join('_').toUpperCase();

var CONCURRENCY = {
  concurrency: 1
};

var query = {
  name: all
};

var creatives = [
  '92877739936',
  '95043909256',
  '95043981976',
  '95044399336',
  '95044464736',
  '95044558336',
  '95044595056'
];

var sizes =  [
  { width: 300, height: 250, isAspectRatio: false },
  { width: 728, height: 90, isAspectRatio: false },
  { width: 160, height: 600, isAspectRatio: false },
  { width: 320, height: 50, isAspectRatio: false }
];

console.log(process.argv.slice(2).join(' '));

function getLineItems(query){
  return dfp.getLineItems(query);
}

function notFiveCent(lineItem){
  return !lineItem.name.match(/[05]$/);
}

function prepareAssociations(lineItems) {
  var associations  = lineItems.map(function(lineItem) {
    return creatives.map(function(creativeId){
      return {
        lineItemId: lineItem.id,
        creativeId: creativeId
      };
    });
  });

  return associations;
}

function prepareQuery() {
  var allLineItems = [
    channel,
    platform + size + position,
    region,
    partner,
    WILDCARD
  ].join('_').toUpperCase();

  return allLineItems;
}

function prepareAssociations(ids) {
  var associations = _.map(ids, function(associationIds, names) {
    return associationIds;
  });
  associations = _.compact(associations);
  return associations;
}

function createAssociations(ids) {
  return dfp.createAssociations(ids)
    .tap(advanceProgress);
}

function logSuccess(results) {
  advanceProgress();
  if (results) {
    console.log('created associations');
  }
}

function handleError(err) {
  console.log('creating all associations failed');
  console.log('because', err.stack);
}

function splitBatches(lineItems) {
  var batches = _.chunk(lineItems, 400);
  progressBar = new ProgressBar('Progress [:bar] :percent :elapseds', {
    total: batches.length + 1
  });
  return batches;
}

function createAssociations(associations) {
  return dfp.createAssociations(associations)
    .tap(advanceProgress);
}

function logSuccess(results) {
  if (results) {
    console.log('sucessfully created associations');
  }
}

function handleError(err) {
  console.log('creating associations failed');
  console.log('because', err.stack);
}

function advanceProgress() {
  progressBar.tick();
}

// this function is to help debugging
/* eslint-disable */
function log(x){
  console.log(x);
}
/*eslint-enable */

Bluebird.resolve(query)
  .then(getLineItems)
  .filter(notFiveCent)
  .then(prepareAssociations)
  .then(_.flatten)
  .then(splitBatches)
  .map(createAssociations, CONCURRENCY)
  .then(logSuccess)
  .catch(handleError);
