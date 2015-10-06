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
 *   $ node update-creatives.js --channel A --platform M --position MIDDLE --region USA --partner SONOBI
 *
 */
'use strict';

var Bluebird = require('bluebird');
var fs = require('fs');
var path = require('path');
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

var WILDCARD = '%';

var all = [
  channel,
  platform + size + position,
  region,
  partner,
  WILDCARD
].join('_');

var snippetPath = './input/snippets/' + partner + '_SNIPPET.html';
var relativePath = path.resolve(__dirname, snippetPath);
var snippet = fs.readFileSync(relativePath, 'utf8');

console.log(process.argv.slice(2).join(' '));

Bluebird.resolve(dfp.getCreatives(all))
  .map(function(creative) {
    var price;
    var bucket;
    var prefix;
    var amznslots;
    var width;
    var height;

    // In this case we are changing the snippet associated with a creative
    price = creative.name.match(/\d*$/)[0];
    price = price.replace(/^0/, '');
    price = price[0] + '.' + price.slice(1);

    bucket = pricePoints[price];
    prefix = platform === 'D' ? 'a' : 'm';

    width = size.split('x')[0][0];
    height = size.split('x')[1][0];

    amznslots = prefix + width + 'x' + height + 'p' + bucket;
    creative.snippet = snippet.replace('#AMAZON_KVP', amznslots);

    delete creative.expandedSnippet;
    return creative;
  })
  .then(function(newCreatives) {
    return dfp.updateCreatives(newCreatives);
  })
  .catch(function(err) {
    console.log('failed because', err.stack);
  });
