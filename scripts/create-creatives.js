/*eslint-disable */
/**
 *
 * This script creates a creative for each price point specified in
 * ./price-points.json.
 *
 * Usage:
 *
 *   $ node create-creatives.js --channel A --platform M --position MIDDLE --region USA --partner SONOBI
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

var size = sizes[position];
var slots = require('../input/index-slot')(platform);

var slot = slots[position];

console.log(process.argv.slice(2).join(' '));

function getCPM(pricePoint) {
  var cpm = pricePoint;

  //add trailing 0 if needed
  var index = pricePoint.length - 2;
  if (cpm[index] === '.') {
    cpm += '0';
  }

  return cpm;
}

function getCombinations() {
  var combinations = [];

  _.forEach(pricePoints, function(bucket, pricePoint) {

    combinations.push({
      cpm: getCPM(pricePoint),
      bucket: bucket,
      pricePoint: pricePoint,
      size: size,
      partner: partner,
      platform: platform,
      geoTargeting: region,
      channel: channel,
      position: position,
      replacements:{
        "#INDEX_SLOT": slot
      }
    });
  });

  progressBar = new ProgressBar('Progress [:bar] :percent :elapseds', {
    total: combinations.length + 1
  });

  return combinations;
}

Bluebird.resolve(getCombinations())
  .map(function(params) {
    var creative = formatter.formatCreative(params);
    progressBar.tick();
    return creative;
  })
  .then(function(creatives) {
    return dfp.createCreatives(creatives, partner.replace('-TEST', ''));
  })
  .then(function(results) {
    if (results) {
      progressBar.tick();
      console.log('sucessfully created creatives');
    }
  })
  .catch(function(err) {
    console.log('creating creative failed');
    console.log('because', err.stack);
  });
