var expect = require('chai').expect;
var formatter = require('../lib/formatter');
var FIXTURES = require('./fixtures/line-items.js')

describe('formatter', function(){

  describe('formatLineItem', function(){

    it('should return a line item', function(){
      var item = {
        cpm: '1',
        channel: 'A',
        position: 'SIDEBAR',
        platform: 'D',
        orderName: 'PREBID-0-400',
        region: 'USA',
        partner: 'SOVRN',
        width: 320,
        height: 50,
        customCriteriaKVPairs: {
          'hb_pb': '1'
        },
        date: '2-04-2016, 16:10:53'
      };

      var lineItem = formatter.formatLineItem(item);

      expect(lineItem.name).to.eql('PREBID_00001');
      expect(lineItem.costPerUnit.microAmount).to.eql('1000000');
      expect(lineItem.adUnitName).to.eql('BSM_320_50_SIDEBAR');
      expect(lineItem.orderName).to.eql('PREBID-0-400');
      expect(lineItem.date).to.eql('2-04-2016, 16:10:53');

      expect(lineItem).to.eql(FIXTURES.a);
    });

    it('should return a mobile line item', function(){
      var item = {
        cpm: '1',
        channel: 'A',
        position: 'HEADER',
        platform: 'M',
        orderName: 'PREBID-0-400',
        region: 'USA',
        partner: 'SOVRN',
        width: 320,
        height: 50,
        customCriteriaKVPairs: {
          'hb_pb': '1'
        },
        date: '2-04-2016, 16:10:53'
      };

      var lineItem = formatter.formatLineItem(item);

      expect(lineItem.name).to.eql('PREBID_00001');
      expect(lineItem.costPerUnit.microAmount).to.eql('1000000');
      expect(lineItem.adUnitName).to.eql('SD_MOBILE_HEADER');
      expect(lineItem.orderName).to.eql('PREBID-0-400');
      expect(lineItem.date).to.eql('2-04-2016, 16:10:53');
    });

  });

  describe('generatePricePoints', function(){
    it('should generate price points', function(){
      var prices = formatter.generatePricePoints(1, 400);

      expect(prices[0]).to.eql('0.01');
      expect(prices[399]).to.eql('4.00');
      expect(prices).to.have.length(400);
    });
  });
});
