/*eslint-disable */
/**
 *
 * This script queries dfp for all line items that match the arguments
 * specified, modifies their javascript representation and the submits an update
 * to DFP.
 *
 * Usage:
 *
 *   $ node scripts/update-orders.js --channel A --platform M --position MIDDLE --region USA --partner SONOBI
 *
 */
'use strict';

var Bluebird = require('bluebird');
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

var WILDCARD = '%';

var ProgressBar = require('progress');
var progressBar;

var CONCURRENCY = {
  concurrency: 1
};

console.log(process.argv.slice(2).join(' '));

function prepareQuery(){
  var name = [
    channel,
    platform + size + position,
    region,
    partner,
    WILDCARD
  ].join('_');

  var query = {
    name: name
  };

  return query;
}

function getOrders(query) {
  return dfp.getOrders(query);
}

function editOrder(order) {
  order.name = order.name.toUpperCase();
  return order;
}

function includeOrder(order) {
  return !order.isArchived;
}

function updateOrders(orders) {
  return dfp.updateOrders(orders)
    .tap(advanceProgress);
}

function logSuccess(results) {
  if (results) {
    console.log('sucessfully updated orders');
  }
}

function handleError(err) {
  console.log('updating orders failed');
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
  .then(getOrders)
  .map(editOrder)
  .filter(includeOrder)
  .then(splitBatches)
  .map(updateOrders, CONCURRENCY)
  .then(logSuccess)
  .catch(handleError);
