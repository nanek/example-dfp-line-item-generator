'use strict';
module.exports = function(platform) {
  var slots = {
    "HEADER": "1",
    "SIDEBAR": "2",
    "SIDERAIL": "3",
    "FOOTER": "4",
    "SIDEBAR2": "5",
    "CONTENT": "6",
    "ADHESION": "7",
    "MIDDLE": "10"
  };
  if (platform === 'M') {
    slots["CONTENT"] = "8";
    slots["HEADER"] = "9";
  }
  return slots;
};
