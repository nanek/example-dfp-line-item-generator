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

// use arguments to determine any other variables
var sizes = require('./sizes')(platform);
var size = sizes[position];

var WILDCARD = '%';

var CONCURRENCY = {
  concurrency: 1
};

console.log(process.argv.slice(2).join(' '));

function prepareQuery() {
  var allLineItems = [
    channel,
    platform + size + position,
    region,
    partner,
    WILDCARD
  ].join('_').toUpperCase();

  return {"name": allLineItems};
}

function getLineItems(query) {
  return [dfp.getLineItems(query), query];
}

function getCreatives(lineItems, query) {
  console.log('got all line items');
  return [lineItems, dfp.getCreatives(query)];
}

function combineByName(lineItems, creatives) {
  var associations = {};
  console.log('got all creatives');

  lineItems.forEach(function(lineItem) {
    associations[lineItem.name] = []
    creatives.forEach(function(creative) {
      associations[lineItem.name].push({ lineItemId: lineItem.id, creativeId: creative.id });
    });
  });

  return associations;
}

function prepareAssociations(ids) {
  var associations = _.map(ids, function(associationIds, names) {
    return associationIds;
  });
  associations = _.flatten(_.compact(associations));
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

function advanceProgress() {
  progressBar.tick();
}

// this function is to help debugging
/* eslint-disable */
function log(x){
  console.log(x);
}
/*eslint-enable */

Bluebird.resolve(prepareQuery())
  .then(getLineItems)
  .spread(getCreatives)
  .spread(combineByName)
  .then(prepareAssociations)
  .then(splitBatches)
  .map(createAssociations, CONCURRENCY)
  .then(logSuccess)
  .catch(handleError);
