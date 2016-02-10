/*eslint-disable */
/**
 *
 * This script queries DFP for all a creatives in the order specified by the
 * script arguments. It then modifies their javascript representation and
 * submits an update to DFP.
 * ./price-points.json.
 *
 * Usage:
 *
 *   $ node sripts/update-creatives.js --channel A --platform M --position MIDDLE --region USA --partner SONOBI
 *
 */
'use strict';

var Bluebird = require('bluebird');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var argv = require('minimist')(process.argv.slice(2));

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
var channel = argv.channel;
var region = argv.region;
var position = argv.position;
var partner = argv.partner;
var platform = argv.platform;

// use arguments to determine any other variables
var pricePoints = require('./price-points');
var sizes = require('./sizes')(platform);
var size = sizes[position];
var snippetPath = '../input/snippets/' + partner + '_SNIPPET.html';
var relativePath = path.resolve(__dirname, snippetPath);
var snippet = fs.readFileSync(relativePath, 'utf8');

var WILDCARD = '%';

var ProgressBar = require('progress');
var progressBar;

var CONCURRENCY = {
  concurrency: 1
};

console.log(process.argv.slice(2).join(' '));

function prepareQuery(){
  var allCreatives = [
    channel,
    platform + size + position,
    region,
    partner,
    WILDCARD
  ].join('_');

  var query = {
    name: allCreatives
  };

  return query;
}

function getCreatives(query) {
  return dfp.getCreatives(query);
}

function editCreative(creative) {
  creative.snippet = snippet.replace('some-text', 'edited-text');
  // This property is a copy of snippet and will be outdated
  delete creative.expandedSnippet;
  return creative;
}

function includeCreative(creative) {
  return true;
}

function updateCreatives(creatives) {
  return dfp.updateCreatives(creatives)
    .tap(advanceProgress);
}

function logSuccess(results) {
  advanceProgress();
  if (results) {
    console.log('sucessfully updated creatives');
  }
}

function handleError(err) {
  console.log('updating creatives failed');
  console.log('because', err.stack);
}

function splitBatches(lineItems){
  var batches = _.chunk(lineItems, 400);
  progressBar = new ProgressBar('Progress [:bar] :percent :elapseds', {
    total: batches.length + 1
  });
  return batches;
}

function advanceProgress(){
  progressBar.tick();
}

// this function is to help debugging
function log(x){
  console.log(x);
}

Bluebird.resolve(prepareQuery())
  .then(getCreatives)
  .map(editCreative)
  .filter(includeCreative)
  .then(splitBatches)
  .map(updateCreatives, CONCURRENCY)
  .then(logSuccess)
  .catch(handleError);
