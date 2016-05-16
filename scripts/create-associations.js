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
 *   $ node scripts/create-associations.js --partner PREBID
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
var partner = argv.partner;

var WILDCARD = '%';

var all = [
  "TEST",
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
  '115407550216',
  '115406983456',
  '115407550816',
  '115407550576',
  '115407550336',
  '115407550936',
  '115407550696',
  '115407550456'
];

console.log(process.argv.slice(2).join(' '));

function getLineItems(query){
  return dfp.getLineItems(query);
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
  .then(prepareAssociations)
  .then(_.flatten)
  .then(splitBatches)
  .map(createAssociations, CONCURRENCY)
  .then(logSuccess)
  .catch(handleError);
