'use strict';

var nodeGoogleDfp = require('node-google-dfp');
var Bluebird = require('bluebird');
var path = require('path');
var _ = require('lodash');

var PnDfpUser = require('./user').PnDfpUser;
var DFP_CREDS = require('../local/application-creds');
var config = require('../local/config');

var CONCURRENCY = {
  concurrency: 1
};

var levelup = require('level');

/**
 * These leveldb stores are used to cache lookups to DFP so that anything that
 * has already been queried before does not require a call over the network. If
 * the cache becomes invalid, delete the directories created in local/
 */
var criteriaKeyPath = path.resolve(__dirname, '../local/criteriaKeyStore');
var criteriaValuePath = path.resolve(__dirname, '../local/criteriaValueStore');
var adUnitPath = path.resolve(__dirname, '../local/adUnitStore');
var orderPath = path.resolve(__dirname, '../local/orderStore');
var labelPath = path.resolve(__dirname, '../local/labelStore');

var criteriaKeyStore = levelup(criteriaKeyPath);
var criteriaValueStore = levelup(criteriaValuePath);
var adUnitStore = levelup(adUnitPath);
var orderStore = levelup(orderPath);
var labelStore = levelup(labelPath);

Bluebird.promisifyAll(criteriaKeyStore);
Bluebird.promisifyAll(criteriaValueStore);
Bluebird.promisifyAll(adUnitStore);
Bluebird.promisifyAll(orderStore);
Bluebird.promisifyAll(labelStore);

/**
 * Calling this constructor instantiates the client to the DFP api.
 * @class
 */
function Dfp() {
  var networkCode = config.networkCode;
  var appName = config.appName;
  var version = config.version;

  this.dfpUser = new PnDfpUser(networkCode, appName, version);

  this.dfpUser.setSettings({
    client_id: DFP_CREDS.installed.client_id,
    client_secret: DFP_CREDS.installed.client_secret,
    refresh_token: config.refreshToken,
    redirect_url: DFP_CREDS.installed.redirect_uris[0],
  });
}

/**
 * Updates line items in DFP. Caution: archived line items cannot be updated and
 * attempting to do so will throw an error. It is best to filter out archived
 * line items before calling this method.
 *
 * @param  {Array} lineItems The line items with any updates already made.
 * @return {Array}           Updated line items. Should be the same as what was
 *                           passed it, with the addition of any fields created
 *                           by DFP
 */
Dfp.prototype.updateLineItems = function(lineItems) {
  var ctx = this;

  return ctx.dfpUser.executeAPIFunction('LineItemService', 'updateLineItems', {
      'lineItems': lineItems
    })
    .catch(function(e) {
      console.log('updating line items failed', e.stack);
    });
};

/**
 * Updates creatives in DFP. Caution: archived creatives cannot be updated and
 * attempting to do so will throw an error. It is best to filter out archived
 * creatives before calling this method.
 *
 * @param  {Array} creatives The creatives with any updates already made.
 * @return {Array}           Updated creatives. Should be the same as what was
 *                           passed it, with the addition of any fields created
 *                           by DFP
 */
Dfp.prototype.updateCreatives = function(creatives) {
  var ctx = this;

  return ctx.dfpUser.executeAPIFunction('CreativeService', 'updateCreatives', {
      'creatives': creatives
    })
    .catch(function(e) {
      console.log('updating line items failed', e.stack);
    });
};

/**
 * Queries DFP to get all line items that match the string passed in.
 *
 * @param  {String} name String used for querying. This string can include
 *                       wildcards and other special characters accepted by DFP.
 * @return {Array}       All matching line items found in DFP
 */
Dfp.prototype.getLineItems = function(name) {
  var ctx = this;
  var service = 'LineItemService';
  var method = 'getLineItemsByStatement';

  var query = "Where name like '" + name + "'";
  query = new nodeGoogleDfp.Statement(query);

  return ctx.dfpUser.executeAPIFunction(service, method, query)
    .then(function(response) {
      return response.results;
    })
    .catch(function(e) {
      console.log('getting lineItem failed', e.stack);
    });
};

/**
 * Gets the system assigned id of a given criteria key in DFP. Uses a local
 * store for caching.
 *
 * @param  {String} name String used for querying. This string can include
 *                       wildcards and other special characters accepted by DFP.
 * @return {String}      The system assigned id of the passed in key.
 */
Dfp.prototype.getCriteriaKey = function(name) {
  var ctx = this;
  var service = 'CustomTargetingService';
  var method = 'getCustomTargetingKeysByStatement';

  var query = "Where name like '" + name + "'";
  query = new nodeGoogleDfp.Statement(query);

  return criteriaKeyStore.getAsync(name)
    .catch(function() {
      return ctx.dfpUser.executeAPIFunction(service, method, query)
        .then(function(response) {
          return response.results[0].id;
        })
        .tap(function(id) {
          return criteriaKeyStore.putAsync(name, id)
            .catch(function(e) {
              console.log('locally storing criteria key failed', e.stack);
            });
        })
        .catch(function(e) {
          console.log('getting criteria key failed', e.stack);
        });
    })
    .then(function(id) {
      return id;
    });
};

/**
 * Gets the system assigned id of a given criteria value in DFP. Uses a local
 * store for caching.
 *
 * @param  {String} name  String used for querying. This string can include
 *                        wildcards and other special characters accepted by DFP
 * @param  {String} keyId Limits search to values associated with this key.
 * @return {String}      The system assigned id of the passed in key.
 */
Dfp.prototype.getCriteriaValues = function(name, keyId) {
  var ctx = this;
  var service = 'CustomTargetingService';
  var method = 'getCustomTargetingValuesByStatement';

  var query = "Where name like '";
  query += name ;
  query += "' and customTargetingKeyId like '" ;
  query += keyId ;
  query += "'";

  query = new nodeGoogleDfp.Statement(query);

  return criteriaValueStore.getAsync(name)
    .catch(function(e) {
      // not found in store, look up instead
      return ctx.dfpUser.executeAPIFunction(service, method, query)
        .then(function(response) {
          return response.results[0].id;
        })
        .tap(function(id) {
          return criteriaValueStore.putAsync(name, id)
            .catch(function(e) {
              console.log('locally storing criteria value failed', e.stack);
            });
        })
        .catch(function(e) {
          console.log('getting criteria value failed', e.stack);
        });
    })
    .then(function(id) {
      return [id];
    });
};

/**
 * Find the DFP ids of the key value pairs passed in.
 * @param  {Object} criteria The key value pairs to look up.
 * @return {Array}           Objects containing the ids of the keys and values
 *                           passed in.
 */
Dfp.prototype.getCriteria = function(criteria) {
  var ctx = this;

  return Bluebird.resolve(_.pairs(criteria))
    .map(function(pair) {
      return ctx.getCriteriaKey(pair[0])
        .then(function(key) {
          return Bluebird.resolve(pair[1])
            .then(function(value) {
              return ctx.getCriteriaValues(value, key);
            })
            .then(function(value) {
              return [key, value];
            });
        })
        .spread(function(keyId, valueIds) {
          return {
            keyId: keyId,
            valueIds: valueIds
          };
        });
    }, CONCURRENCY)
    .then(function(pairs) {
      return pairs;
    });
};

/**
 * Gets the system assigned id of the ad unit corresponding to the details
 * passed in. NOTE: the logic used to determine an ad unit name are specific to
 * Curiosity Media.
 *
 * @param  {Object} name Name given to the ad unit in DFP.
 * @return {String}      The id of the ad unit matching the details passed in.
 */
Dfp.prototype.getAdUnit = function(name) {
  var ctx = this;
  var service = 'InventoryService';
  var method = 'getAdUnitsByStatement';

  var query;
  query = "Where name like '" + name + "'";
  query = new nodeGoogleDfp.Statement(query);

  return adUnitStore.getAsync(name)
    .catch(function() {
      return ctx.dfpUser.executeAPIFunction(service, method, query)
        .then(function(response) {
          return response.results[0].id;
        })
        .tap(function(id) {
          return adUnitStore.putAsync(name, id)
            .catch(function(e) {
              console.log('locally storing ad unit failed', e.stac);
            });
        })
        .catch(function(e) {
          console.log('getting ad units failed', e.stack);
        });
    })
    .then(function(id) {
      return id;
    });
};

/**
 * Find the DFP id of the order passed in.
 *
 * @param  {String} name The name of the order in DFP.
 * @return {String}      The id of the order corresponding to the name passed in
 */
Dfp.prototype.getOrder = function(name) {
  var ctx = this;
  var service = 'OrderService';
  var method = 'getOrdersByStatement';

  var query = "Where name like '" + name + "'";
  query = new nodeGoogleDfp.Statement(query);

  return orderStore.getAsync(name)
    .catch(function() {
      return ctx.dfpUser.executeAPIFunction(service, method, query)
        .then(function(response) {
          return response.results[0].id;
        })
        .tap(function(id) {
          return orderStore.putAsync(name, id)
            .catch(function(e) {
              console.log('locally storing order failed', e.stack);
            });
        })
        .catch(function(e) {
          console.log('getting order', e.stack);
        });
    })
    .then(function(id) {
      return id;
    });
};

/**
 * Modifies the line item passed in so that has the correct order id, ad unit
 * id, and criteria key and value ids, which are required in DFP. Prepares the
 * line item object for actually creating a line item in DFP.
 *
 * @param  {Object} lineItemParam Object representation of a line item.
 * @return {Object}               The original line item with additions. Ready
 *                                to be passed to the method for creating a line
 *                                item.
 */
Dfp.prototype.prepareLineItem = function(lineItemParam) {
  var ctx = this;

  // Make a clone so that the original parameters are not mutated.
  var lineItem = _.cloneDeep(lineItemParam);

  return ctx.getOrder(lineItem.orderName)
    .then(function(orderId) {
      lineItem.orderId = orderId;
      delete lineItem.orderName;
    })
    .then(function() {
      return ctx.getAdUnit(lineItem.adUnitName);
    })
    .then(function(adUnitId) {
      lineItem.targeting.inventoryTargeting.targetedAdUnits = [{
        adUnitId: adUnitId,
        includeDescendants: true
      }];
      delete lineItem.adUnitName;
    })
    .then(function() {
      return ctx.getCriteria(lineItem.customCriteriaKVPairs)
    })
    .then(function(criteria) {
      _.forEach(criteria, function(condition) {
        lineItem.targeting.customTargeting.children[0].children.push({
          "attributes": {
            "xsi:type": "CustomCriteria"
          },
          "keyId": condition.keyId,
          "valueIds": condition.valueIds,
          "operator": "IS"
        });
      });
      delete lineItem.customCriteriaKVPairs;
      return lineItem;
    });
};

/**
 * Creates a line item in DFP.
 *
 * @param  {Array} lineItems Line items to be created in DFP
 * @return {Object}          Response from the DFP api, containing the line
 *                           items if the creation succeeded or an error if
 *                           it failed.
 */
Dfp.prototype.createLineItems = function(lineItems) {
  var ctx = this;
  var service = 'LineItemService';
  var method = 'createLineItems';

  return ctx.dfpUser.executeAPIFunction(service, method, {
      lineItems: lineItems
    })
    .catch(function(e) {
      console.log('creating line items failed', e.stack);
    });
};

/**
 * Find the DFP id of the advertiser passed in.
 *
 * @param  {String} name The name of the advertiser in DFP.
 * @return {String}      The id of the advertiser corresponding to the name
 *                       passed in.
 */
Dfp.prototype.getAdvertiser = function(name) {
  var ctx = this;
  var service = 'CompanyService';
  var method = 'getCompaniesByStatement';

  var query = "Where name like '" + name + "'";
  query = new nodeGoogleDfp.Statement(query);

  return ctx.dfpUser.executeAPIFunction(service, method, query)
    .then(function(response) {
      return response.results[0].id;
    })
    .catch(function(e) {
      console.log('getting advertiserId failed', e.stack);
    });
};

/**
 * Gets the system assigned id of the label passed in. Uses a local store for
 * caching.
 *
 * @param  {String} name String used for querying. This string can include
 *                       wildcards and other special characters accepted by DFP.
 * @return {String}      The system assigned id of the passed in key.
 */
Dfp.prototype.getLabel = function(name) {
  var ctx = this;
  var service = 'LabelService';
  var method = 'getLabelsByStatement';

  var query = "Where name like '" + name + "'";
  query = new nodeGoogleDfp.Statement(query);

  return labelStore.getAsync(name)
    .catch(function() {
      return ctx.dfpUser.executeAPIFunction(service, method, query)
        .then(function(response) {
          return response.results[0].id;
        })
        .tap(function(id) {
          return labelStore.putAsync(name, id)
            .then(function() {
              return id;
            })
            .catch(function(e) {
              console.log('locally storing label failed', e.stack);
            });
        })
        .catch(function(e) {
          console.log('getting criteria label failed', e.stack);
        });
    })
    .then(function(id) {
      return id;
    });
};

/**
 * Gets the full creative matching the name passed in.
 *
 * @param  {String} name String used for querying. This string can include
 *                       wildcards and other special characters accepted by DFP.
 * @return {String}      The system assigned id of the passed in key.
 */
Dfp.prototype.getCreatives = function(name) {
  var ctx = this;
  var service = 'CreativeService';
  var method = 'getCreativesByStatement';

  var query = "Where name like '" + name + "'";
  query = new nodeGoogleDfp.Statement(query);

  return ctx.dfpUser.executeAPIFunction(service, method, query)
    .then(function(response) {
      return response.results;
    })
    .catch(function(e) {
      console.log('creating line items failed', e.stack);
    });
};

/**
 * Creates a creatives in DFP.
 *
 * @param  {Array}  creativesParam Creatives to be created in DFP
 * @param  {String} partner        The name of the advertiser to associate this
 *                                 creative with.
 * @return {Object}                Response from the DFP api, containing the
 *                                 creatives if the creation succeeded or an
 *                                 error if it failed.
 */
Dfp.prototype.createCreatives = function(creativesParam, partner) {
  var ctx = this;
  var service = 'CreativeService';
  var method = 'createCreatives';

  var creatives = _.cloneDeep(creativesParam);

  return ctx.getAdvertiser(partner)
    .then(function(advertiserId) {
      creatives =  _.map(creatives, function(creative) {
        creative.advertiserId = advertiserId;
        return creative;
      });
    })
    .then(function() {
      return ctx.dfpUser.executeAPIFunction(service, method, {
        creatives: creatives
      });
    })
    .catch(function(e) {
      console.log('creating creatives failed', e.stack);
    });
};

/**
 * Creates an order in DFP.
 *
 * @param  {Object} order Order to be created in DFP
 * @return {Object}       Response from the DFP api, containing the order if the
 *                        creation succeeded or an error if it failed.
 */
Dfp.prototype.createOrder = function(order) {
  var ctx = this;
  return ctx.getAdvertiser(order.partner)
    .then(function(advertiserId) {
      order.advertiserId = advertiserId;
      delete order.partner;
      return order;
    })
    .then(function(newOrder) {
      return ctx.dfpUser.executeAPIFunction('OrderService', 'createOrders', {
        orders: newOrder
      });
    })
    .catch(function(e) {
      console.log('creating orders failed', e.stack);
    });
};

/**
 * Creates a line item creative association in DFP.
 *
 * @param  {Object} associations The ids of the line item and creative to
 *                               create an association for
 * @return {Object}              Response from the DFP api, containing the
 *                               line item associations if the creation
 *                               succeeded or an error if it failed.
 */
Dfp.prototype.createAssociations = function(associations) {
  var ctx = this;
  var service = 'LineItemCreativeAssociationService';
  var method = 'createLineItemCreativeAssociations';

  return ctx.dfpUser.executeAPIFunction(service, method, {
      lineItemCreativeAssociations: associations
    })
    .catch(function(e) {
      console.log('creating association failed', e.stack);
    });
};

module.exports = Dfp;
