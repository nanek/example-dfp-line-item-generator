'use strict';

var Bluebird = require('bluebird');

var DFP_CREDS = require('../local/application-creds');
var config = require('../local/config');

var Dfp = require('node-google-dfp-wrapper');

var credentials = {
  clientId: DFP_CREDS.installed.client_id,
  clientSecret: DFP_CREDS.installed.client_secret,
  redirectUrl: DFP_CREDS.installed.redirect_uris[0]
};

var dfp = new Dfp(credentials, config, config.refreshToken);

var conditions = {
  name: 'PREBID_00001'
};

dfp.getLineItems(conditions).then(function(val) {
  console.log(JSON.stringify(val,null,4));
});
