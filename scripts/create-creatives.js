/*eslint-disable */
/**
 *
 * This script creates a creative for each price point specified in
 * ./price-points.json.
 *
 * Usage:
 *
 *   $ node scripts/create-creatives.js --channel A --platform M --position MIDDLE --region USA --partner SONOBI
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
var sizes = require('./sizes')(platform);
var size = sizes[position];

var CONCURRENCY = {
  concurrency: 1
};

console.log(process.argv.slice(2).join(' '));

function getCombinations() {
  var combinations = [];

  var count = ['1', '2', '3', '4', '5'];
  _.forEach(count, function(number) {

    var creative = formatter.formatCreative({
      size: size,
      partner: partner,
      platform: platform,
      region: region,
      channel: channel,
      position: position,
      number: number
    });

    combinations.push(creative);

  });

  progressBar = new ProgressBar('Progress [:bar] :percent :elapseds', {
    total: combinations.length + 1
  });

  return combinations;
}

function prepareCreative(creative) {
  return dfp.prepareCreative(creative)
    .tap(advanceProgress);
}

function createCreatives(creatives) {
  return dfp.createCreatives(creatives);
}

function logSuccess(results) {
  if (results) {
    advanceProgress();
    console.log('sucessfully created creatives');
  }
}

function handleError(err) {
  console.log('creating creatives failed');
  console.log('because', err.stack);
}

function advanceProgress() {
  progressBar.tick();
}

Bluebird.resolve(getCombinations())
  .map(prepareCreative, CONCURRENCY)
  .then(createCreatives)
  .then(logSuccess)
  .catch(handleError);
