const _ = require("lodash");
let _config = {};

function init(config = {}) {
  _config = _.merge(
    {
      sequelize: {},
      dynamodb: {},
    },
    config
  );

  return _config;
}

module.exports = () => _config;
module.exports.init = init;
