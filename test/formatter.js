var expect = require('chai').expect;
var formatter = require('../lib/formatter');
var FIXTURES = require('./fixtures/line-items.js')

describe('formatter', function(){

  describe('formatLineItem', function(){

    it('should return a line item', function(){
      var item = {
        cpm: '100',
        channel: 'A',
        position: 'SIDEBAR',
        platform: 'D',
        orderName: 'PREBID-0-400',
        region: 'USA',
        partner: 'SOVRN',
        width: 320,
        height: 50,
        customCriteriaKVPairs: {
          'hb_pb': '100'
        },
        date: '2-04-2016, 16:10:53'
      };

      var lineItem = formatter.formatLineItem(item);

      expect(lineItem.name).to.eql('A_USA_SOVRN_0100');
      expect(lineItem.costPerUnit).to.eql('100000000');
      expect(lineItem.adUnitName).to.eql('BSM_320_50_SIDEBAR');
      expect(lineItem.orderName).to.eql('PREBID-0-400');
      expect(lineItem.date).to.eql('2-04-2016, 16:10:53'));

      expect(lineItem).to.eql(FIXTURES.a);
    });

  });
});
