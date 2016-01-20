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
/*eslint-enble */
'use strict';

var Bluebird = require('bluebird');
var _ = require('lodash');
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

var sizes = require('./sizes')(platform);
var size = sizes[position];

var WILDCARD = '%';

var all = [
  channel,
  platform + size + position,
  region,
  partner,
  WILDCARD
].join('_').toUpperCase();

console.log(process.argv.slice(2).join(' '));

Bluebird.resolve(dfp.getLineItems(all))
  .then(function(lineItems) {
    console.log('got all line items');
    return [lineItems, dfp.getCreatives(all)];
  })
  .spread(function(lineItems, creatives) {
    var associations = {};
    console.log('got all creatives');

    lineItems.forEach(function(lineItem) {
      associations[lineItem.name] = {
        lineItemId: lineItem.id
      };
    });

    creatives.forEach(function(creative) {
      if (associations[creative.name]) {
        associations[creative.name].creativeId = creative.id;
      }
    });

    return associations;
  })
  .then(function(associations) {
    var ids = _.map(associations, function(associationIds, names) {
      return associationIds;
    });
    ids = _.compact(ids);
    return dfp.createAssociations(ids);
  })
  .then(function(associations) {
    console.log('created associations');
  })
  .catch(function(err) {
    console.log('creating all associations failed');
    console.log('because', err.stack);
  });
