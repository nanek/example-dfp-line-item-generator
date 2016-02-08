/*eslint-disable */
/**
 *
 * This script queries dfp for all line items that match the arguments
 * specified, modifies their javascript representation and the submits an update
 * to DFP.
 *
 * Usage:
 *
 *   $ node scripts/update-line-items.js --channel A --platform M --position MIDDLE --region USA --partner SONOBI
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

var channel = argv.channel;
var region = argv.region;
var position = argv.position;
var partner = argv.partner;
var platform = argv.platform;

var sizes = require('./sizes')(platform);

var size = sizes[position];

var WILDCARD = '%';

var all = [
  partner,
  WILDCARD
].join('_');

var query = {
  name: all
};

console.log(process.argv.slice(2).join(' '));

function getOrders(query) {
  console.log(query);
  return dfp.getOrders(query);
}

function editOrder(order) {
  order.name = order.name.toUpperCase();
  return order;
}

function isNotArchived(order) {
  return !order.isArchived;
}

function updateOrders(orders) {
  return dfp.updateOrders(orders);
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


Bluebird.resolve(query)
  .then(getOrders)
  .filter(isNotArchived)
  .map(editOrder)
  .then(updateOrders)
  .then(logSuccess)
  .catch(handleError);
