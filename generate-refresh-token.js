'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var util = require('util');
var debug = require('debug')('main');
var google = require('googleapis');
var Bluebird = require('bluebird');
var mkdirp = require('mkdirp-then');
var OAuth2 = google.auth.OAuth2;
var argv = require('minimist')(process.argv.slice(2));
var dfp = require('./lib/dfp');
var creative = require('./lib/creative');
var PnDfpUser = require('./lib/user').PnDfpUser;
var DFP_CREDS = require('./local/application-creds');

// Constants and arguments.
var APP_NAME = 'PubNation Macromaker';
var VERSION = 'v201502';
var CONCURRENCY = 2;
var MAX_ERRORS = 10;
var AUTH_CODE = argv.authCode;
var NETWORK_CODE = argv.networkCode;
var REFRESH_TOKEN = argv.refreshToken;
var OUTFILE = argv.outfile || './report.html';
var COMMAND = argv._[0] || 'report';
var isFullReport = !!argv.full;
var LIMIT = parseInt(argv.limit, 10);

// Initial state.
var offset = parseInt(argv.offset, 10) || 0;
var caughtErrors = 0;

function main () {
  var opts;
  var dfpUser = new PnDfpUser(NETWORK_CODE, APP_NAME, VERSION);

  dfpUser.setSettings({
    client_id: DFP_CREDS.installed.client_id,
    client_secret: DFP_CREDS.installed.client_secret,
    refresh_token: REFRESH_TOKEN,
    redirect_url: DFP_CREDS.installed.redirect_uris[0],
  });

  opts = {
    user: dfpUser,
    networkCode: NETWORK_CODE,
  };

  switch (COMMAND) {
  case 'addMacro':
    if (!LIMIT) LIMIT = 100;

    addMacroCommand(opts);
    break;

  default:
    if (!LIMIT) LIMIT = null;

    reportCommand(opts);
    break;
  }
}

function addMacroCommand (opts) {
  var whileMore;

  // For adding macro, we fetch only all creatives (no orders or line items,
  // because not needed). We need to limit/batch or else DFP will likely
  // eventually throw a QuotaExceededError or simply hang.
  _.extend(opts, {
    limit: LIMIT,
  });

  whileMore = Bluebird.method(function fn (action) {
    if (offset == null) return;
    /* eslint-disable consistent-return */
    return action().then(whileMore.bind(null, action));
    /* eslint-enable consistent-return */
  });

  return whileMore(addMacro.bind(null, opts)).catch(function error (err) {
    caughtErrors += 1;

    debug('caught error %d (%s) on offset %d',
      caughtErrors,
      err,
      offset
    );

    if (caughtErrors > MAX_ERRORS) {
      debug('bailing');
      return null;
    }

    // Continue from same offset.
    return Bluebird.delay(2000)
      .tap(function msg () {
        debug('resuming from %d', offset);
      })
      .then(addMacroCommand.bind(null, opts));
  });
}

function reportCommand (opts) {
  // For full reporting, we fetch all creatives from all line items for each
  // order (LIMIT is null) unless overridden by user. No batching or retry
  // implemented yet.
  _.extend(opts, {
    limit: LIMIT,
  });

  // For partner reporting, we fetch one creative from one line item for
  // each order.
  if (!isFullReport) {
    _.extend(opts, {
      lineItemLimit: 1,
      creativeLimit: 1,
    });
  }

  return report(opts);
}

function getCreativesAll (opts) {
  var getCreatives = _.partial(
    dfp.getCreatives,
    opts.limit,
    offset
  );

  debug('getCreativesAll, offset: %d, opts: %s',
    offset,
    util.inspect(opts, {depth: 0})
  );

  return Bluebird.bind(opts)
    .then(getCreatives)
    .tap(function updateOffset (creatives) {
      if (creatives && creatives.length > 0) {
        offset += creatives.length;
      } else {
        // No more.
        offset = null;
      }
    });
}

function getCreativesLimits (opts) {

  var getOrders = _.partial(
    dfp.getOrders,
    opts.limit,
    offset
  );

  var getLineItemsForOrder = _.partial(
    dfp.getLineItemsForOrder,
    opts.lineItemLimit
  );

  var getLineItemCreativeAssociations = _.partial(
    dfp.getLineItemCreativeAssociations,
    opts.creativeLimit
  );

  debug('getCreativesLimits, offset: %d, opts: %s',
    offset,
    util.inspect(opts, {depth: 0})
  );

  return Bluebird.bind(opts)
    .then(getOrders)
    .tap(function updateOffset (orders) {
      if (orders && orders.length > 0) {
        offset += orders.length;
      } else {
        // No more.
        offset = null;
      }
    })
    .map(getLineItemsForOrder, {concurrency: CONCURRENCY})
    .then(_.flatten)
    .filter(_.identity)
    .map(getLineItemCreativeAssociations, {concurrency: CONCURRENCY})
    .then(_.flatten)
    .filter(_.identity)
    .map(dfp.getCreativesForAssoc, {concurrency: CONCURRENCY})
    .then(_.flatten)
    .filter(_.identity);
}

function getMacroless (opts) {
  var fn = getCreativesLimits;

  if (opts.onlyCreatives) fn = getCreativesAll;

  return fn(opts)
    .filter(creative.needsMacro);
}

function report (opts) {
  // Reporting needs order and line item info in addition to the creatives.
  opts.onlyCreatives = false;

  return getMacroless(opts)
    .map(creative.report, {concurrency: CONCURRENCY})
    .tap(function doMkdirp () {
      var dirname = path.dirname(OUTFILE);
      return mkdirp(dirname);
    })
    .tap(function startOutfile () {
      var style = fs.readFileSync('style.css');
      this.outfileStream = fs.createWriteStream(OUTFILE);
      this.outfileStream.write('<html><head><style>');
      this.outfileStream.write(style);
      this.outfileStream.write('</style></head>\n<body><pre>');
    })
    .each(function writeReportHtml (creativeReportHtml) {
      this.outfileStream.write(creativeReportHtml);
    }).tap(function endOutfile () {
      this.outfileStream.end('</pre></body><html>');
    });
}

function addMacro (opts) {
  // Adding the macro does not need order and line item info, only the
  // creatives.
  opts.onlyCreatives = true;

  return getMacroless(opts)
    .map(creative.update, {concurrency: CONCURRENCY})
    .then(function chunkCreatives (creatives) {
      // This is redundant since we're applying limit when fetching the
      // creatives, but leaving it in as a guard.
      var chunks = _.chunk(creatives, LIMIT);
      return Bluebird.resolve(chunks)
        .bind(this)
        .map(dfp.saveCreatives, {concurrency: 1});
    });
}

function getRefreshToken () {
  var oauth2Client;
  var msg = 'Getting new refresh token with auth code %s...';
  console.log(msg, AUTH_CODE); // eslint-disable-line no-console

  oauth2Client = new OAuth2(
    DFP_CREDS.installed.client_id,
    DFP_CREDS.installed.client_secret,
    DFP_CREDS.installed.redirect_uris[0]
  );

  oauth2Client.getToken(AUTH_CODE, function showToken (error, token) {
    var tokenMsg = 'Got refresh token: %s';
    if (error) {
      console.error('Error: ', error); // eslint-disable-line no-console
    } else {
      REFRESH_TOKEN = token.refresh_token;
      console.log(tokenMsg, REFRESH_TOKEN); // eslint-disable-line no-console
    }
  });
}

// Kick things off.
if (AUTH_CODE || !REFRESH_TOKEN) {
  getRefreshToken();
} else {
  main();
}
