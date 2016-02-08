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
var _ = require('lodash');

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
var partner = argv.partner;
var offset = argv.offset;

var WILDCARD = '%';

var all = [
  channel,
  region,
  partner,
  WILDCARD + offset
].join('_');

var ProgressBar = require('progress');
var progressBar;

var CONCURRENCY = {
  concurrency: 1
};

var query = {
  name: all
};

progressBar = new ProgressBar('Progress [:bar] :percent :elapseds', {
  total: 2
});

console.log(process.argv.slice(2).join(' '));

function getLineItems(query) {
  return dfp.getLineItems(query);
}

function onlyAbove10Dollars(lineItem) {
  return lineItem.name.match(/_[12]...$/);
}

function editLineItem(lineItem) {
  lineItem.targeting.inventoryTargeting.targetedAdUnits = [{
    adUnitId: '118649536',
    includeDescendants: true
  }, {
    adUnitId: '118650016',
    includeDescendants: true
  }, {
    adUnitId: '118649776',
    includeDescendants: true
  }, {
    adUnitId: '118650256',
    includeDescendants: true
  }, {
    adUnitId: '124991056',
    includeDescendants: true
  }, {
    adUnitId: '31562776',
    includeDescendants: true
  }, {
    adUnitId: '118649896',
    includeDescendants: true
  }, {
    adUnitId: '119700376',
    includeDescendants: true
  }, {
    adUnitId: '118649656',
    includeDescendants: true
  }, {
    adUnitId: '4628056',
    includeDescendants: true
  }];
  lineItem.targeting.technologyTargeting = [];
  return lineItem;
}
function isNotArchived(lineItem) {
  return !lineItem.isArchived;
}

function updateLineItems(lineItems) {
  advanceProgress();
  return dfp.updateLineItems(lineItems)
    .tap(advanceProgress);
}

function logSuccess(results) {
  if (results) {
    console.log('sucessfully updated line items');
  }
}

function handleError(err) {
  console.log('updating line items failed');
  console.log('because', err.stack);
}

function log(x){
  console.log(x[0].targeting.inventoryTargeting.targetedAdUnits);
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
};

Bluebird.resolve(query)
  .then(getLineItems)
  .map(editLineItem)
  .filter(isNotArchived)
  .then(updateLineItems)
  .then(logSuccess)
  .then(advanceProgress)
  .catch(handleError);
