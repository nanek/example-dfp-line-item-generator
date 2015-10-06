/*eslint-disable */
/**
 *
 * This script creates a new line item for each price point specified in
 * ./price-points.json.
 *
 * Usage:
 *
 *   $ node create-line-items.js --channel A --platform M --position MIDDLE --region USA --partner SONOBI
 *
 */
/*eslint-enble */
'use strict';

var Bluebird = require('bluebird');
var formatter = require('../lib/formatter');
var _ = require('lodash');
var ProgressBar = require('progress');
var progressBar;
var argv = require('minimist')(process.argv.slice(2));

var Dfp = require('../lib/dfp');
var dfp = new Dfp();

var channel = argv.channel;
var region = argv.region;
var position = argv.position;
var partner = argv.partner;
var platform = argv.platform;

var pricePoints = require('./price-points');
var sizes = require('./sizes')(platform);
var slots = require('../input/index-slot')(platform);

var size = sizes[position];
var slot = slots[position];

console.log(process.argv.slice(2).join(' '));

function prepareLineItem(input) {
  return dfp.prepareLineItem(input)
    .tap(function() {
      progressBar.tick();
    });
}

function getCPM(pricePoint) {
  var cpm = pricePoint;

  //add trailing 0 if needed
  var index = pricePoint.length - 2;
  if (cpm[index] === '.') {
    cpm += '0';
  }

  return cpm;
}

function indexCriteria(slot, cpm) {
  var criteria = '';

  criteria += slot;
  criteria += '_';
  criteria += cpm.replace('.', '').replace(/^0/, '');

  return criteria;
}

function getCombinations() {
  var combinations = [];

  _.forEach(pricePoints, function(bucket, pricePoint) {
    var cpm = getCPM(pricePoint);

    var lineItem = formatter.formatLineItem({
      cpm: cpm,
      channel: channel,
      position: position,
      platform: platform,
      geoTargeting: region,
      partner: partner,
      width: size.split('x')[0],
      height: size.split('x')[1],
      customCriteriaKVPairs: {
        sd_adtest: "sovrn"
      }
    });

    combinations.push(lineItem);
  });

  progressBar = new ProgressBar('Progress [:bar] :percent :elapseds', {
    total: combinations.length + 1
  });

  return combinations;
}

Bluebird.resolve(getCombinations())
  .map(prepareLineItem, {
    concurrency: 1
  })
  .then(function(lineItems) {
    return dfp.createLineItems(lineItems);
  })
  .then(function(lineItems) {
    progressBar.tick();
    console.log('end create-line-items.js!');
  });
