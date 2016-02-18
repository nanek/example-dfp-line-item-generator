/*eslint-disable */
/**
 *
 * This script creates a new order tied to the partner you specify.
 *
 * Usage:
 *
 *   $ node scripts/create-order.js --channel A --platform M --position MIDDLE --region USA --partner SONOBI
 *
 */
/*eslint-enable */
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
var partner = argv.partner.replace('-Test', '');
var platform = argv.platform;

// This is the id of a DFP user that will be listed as trafficker.
var traffickerId = '142204336';

var name = [
  partner,
  channel,
  platform,
  position,
  region
].join('_').toUpperCase();

// Print out arguments so we can know which script is executing
console.log(process.argv.slice(2).join(' '));

function formatOrder() {
  var order = formatter.formatOrder(name, traffickerId, partner);
  return order;
}

function prepareOrder(order) {
  return dfp.prepareOrder(order);
}

function createOrder(order) {
  return dfp.createOrder(order);
}

function logSuccess(results) {
  if (results) {
    console.log('sucessfully created order');
  }
}

function handleError(err) {
  console.log('creating order failed');
  console.log('because', err.stack);
}

// MAIN
Bluebird.resolve(formatOrder())
  .then(prepareOrder)
  .then(createOrder)
  .then(logSuccess)
  .catch(handleError);
