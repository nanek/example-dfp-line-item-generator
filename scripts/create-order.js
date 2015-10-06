/*eslint-disable */
/**
 *
 * This script creates a new order tied to the partner you specify.
 *
 * Usage:
 *
 *   $ node create-order.js --channel A --platform M --position MIDDLE --region USA --partner SONOBI
 *
 */
/*eslint-enble */
'use strict';

var Bluebird = require('bluebird');
var formatter = require('../lib/formatter');
var argv = require('minimist')(process.argv.slice(2));

var Dfp = require('../lib/dfp');
var dfp = new Dfp();

var channel = argv.channel;
var region = argv.region;
var position = argv.position;
var partner = argv.partner.replace('-Test', '');
var platform = argv.platform;

// This is the id of a DFP user that will be listed as trafficker.
var traffickerId = '142204336';

// Print out arguments so we can know which script is executing
console.log(process.argv.slice(2).join(' '));

Bluebird.resolve({
    channel: channel,
    region: region,
    position: position,
    partner: partner,
    platform: platform,
    traffickerId: traffickerId
  })
  .then(function(params) {
    var order = formatter.formatOrder(params);
    return order;
  })
  .then(function(order) {
    return dfp.createOrder(order, partner);
  })
  .then(function(results) {
    if (results) {
      console.log('sucessfully created order');
    }
  })
  .catch(function(err) {
    console.log('creating order failed');
    console.log('because', err.stack);
  });
