const _ = require("lodash");
let config = {};

function copy(params) {
  config = _.cloneDeep(params);
}

function get() {
  return config;
}

module.exports = { config, copy, get };
