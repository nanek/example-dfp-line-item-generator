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
var argv = require('minimist')(process.argv.slice(2));

var DFP_CREDS = require('../local/application-creds');
var config = require('../local/config')
var formatter = require('../lib/formatter');

var Dfp = require('node-google-dfp-wrapper');

var credentials = {
  clientId: DFP_CREDS.installed.client_id,
  clientSecret: DFP_CREDS.installed.client_secret,
  redirectUrl: DFP_CREDS.installed.redirect_uris[0]
}

var dfp = new Dfp(credentials, config, config.refreshToken);

var channel = argv.channel;
var region = argv.region;
var position = argv.position;
var partner = argv.partner;
var platform = argv.platform;

var pricePoints = require('./price-points');
var sizes = require('./sizes')(platform);

var size = sizes[position];

var WILDCARD = '%';

var all = [
  channel,
  platform + size + position,
  region,
  partner,
  WILDCARD
].join('_');

var query = {
  name: all
};

var snippetPath = '../input/snippets/' + partner + '_SNIPPET.html';
var relativePath = path.resolve(__dirname, snippetPath);
var snippet = fs.readFileSync(relativePath, 'utf8');

console.log(process.argv.slice(2).join(' '));

function getCreatives(query) {
  return dfp.getCreatives(query);
}

function editCreative(creative) {
  creative.snippet = snippet.replace('some-text', 'edited-text');
  // This property is a copy of snipppet and will be outdated
  delete creative.expandedSnippet;
  return creative;
}

function updateCreatives(creatives) {
  return dfp.updateCreatives(creatives);
}

function logSuccess(results) {
  if (results) {
    console.log('sucessfully updated creatives');
  }
}

function handleError(err) {
  console.log('updating creatives failed');
  console.log('because', err.stack);
}

Bluebird.resolve(query)
  .then(getCreatives)
  .map(editCreative)
  .then(updateCreatives)
  .then(logSuccess)
  .catch(handleError);
