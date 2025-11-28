import Settings from "../models/Settings.model";

async function get({
  projectId,
}: {
  projectId: string;
}): Promise<Record<string, unknown>> {
  const settingsInstance = await Settings.findOne({
    where: { projectId },
  });

  if (settingsInstance) {
    return settingsInstance.settings;
  } else {
    return {};
  }
}

async function upsert(
  {
    projectId,
  }: {
    projectId: string;
  },
  settings: Record<string, unknown>,
  _params?: Record<string, unknown>
): Promise<void> {
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

export { get, upsert };
