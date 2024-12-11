const Settings = require("../models/Settings");

async function get({ projectId }) {
  const settingsInstance = await Settings.findOne({
    where: { projectId },
  });

  if (settingsInstance) {
    return settingsInstance.settings;
  } else {
    return {};
  }
}

async function upsert({ projectId }, settings) {
  const settingsInstance = await Settings.findOne({
    where: { projectId },
  });

  if (settingsInstance) {
    await settingsInstance.update({
      projectId,
      settings: {
        ...settingsInstance.toJSON().settings,
        ...settings,
      },
    });
  } else {
    await Settings.create({
      projectId,
      settings: { ...settings },
    });
  }
}

module.exports = { get, upsert };
