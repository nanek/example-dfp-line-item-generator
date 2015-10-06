'use strict';

module.exports = function(platform) {
  var sizes = {
    'SIDEBAR': '300x250',
    'SIDERAIL': '160x600',
    'SIDEBAR2': '300x250',
    'CONTENT': '300x250',
    'FOOTER': '728x90',
    'HEADER': '728x90',
    'ADHESION': '320x50',
    'MIDDLE': '300x250'
  };
  if (platform === 'M') {
    sizes.HEADER = '320x50';
  }
  return sizes;
};
