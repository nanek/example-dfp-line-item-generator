/*eslint-disable */
/**
 *
 * This script queries dfp for all line items that match the arguments
 * specified, modifies their javascript representation and the submits an update
 * to DFP.
 *
 * Usage:
 *
 *   $ node update-line-items.js --channel A --platform M --position MIDDLE --region USA --partner SONOBI
 *
 */
'use strict';

var Bluebird = require('bluebird');
var argv = require('minimist')(process.argv.slice(2));

var Dfp = require('../lib/dfp');
var dfp = new Dfp();

var channel = argv.channel;
var region = argv.region;
var position = argv.position;
var partner = argv.partner;
var platform = argv.platform;

var sizes = require('../sizes')(platform);

var size = sizes[position];

var WILDCARD = '%';

var all = [
  channel,
  platform + size + position,
  region,
  partner,
  WILDCARD
].join('_');

console.log(process.argv.slice(2).join(' '));

Bluebird.resolve(dfp.getLineItems(all))
  .map(function(lineItem) {
    // In this case we're chaging one option which we missed
    lineItem.disableSameAdvertiserCompetitiveExclusion = 'true';
    return lineItem;
  })
  .then(function(lineItems) {
    // Don't update archived line items.
    var filtered = lineItems.filter(function(lineItem) {
      return !lineItem.isArchived;
    });

    return dfp.updateLineItems(filtered);
  })
  .then(function(results) {
    console.log('sucessfully updated lineItems');
  })
  .catch(function(err) {
    console.log('failed because', err.stack);
  });
