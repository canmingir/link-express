const _ = require("lodash");
let _config = {};

function init(config = {}) {
  _config = _.merge(
    {
      link: {},
      project: null,
      openapi: {},
      postgres: null,
      dynamodb: null,
    },
    config
  );

  return _config;
}

module.exports = () => _config;
module.exports.init = init;
