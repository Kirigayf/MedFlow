/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// --- 1. ДОБАВЛЯЕМ ГЕНЕРАТОР ID ---
const generateId = () => {
  return Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
};
// ---------------------------------

module.exports = {
  inputs: {
    values: {
      type: 'json',
      required: true,
    },
    actorUser: {
      type: 'ref',
      required: true,
    },
    request: {
      type: 'ref',
    },
  },

  async fn(inputs) {
    const { values } = inputs;

    // --- 2. ГЕНЕРИРУЕМ ID И ДОБАВЛЯЕМ В VALUES ---
    // Мы принудительно добавляем ID в объект значений перед созданием
    const valuesWithId = {
      id: generateId(),
      ...values
    };
    // ----------------------------------------------

    // Передаем обновленный объект valuesWithId
    const { project, projectManager } = await Project.qm.createOne(valuesWithId, {
      user: inputs.actorUser,
    });

    const scoper = sails.helpers.projects.makeScoper.with({
      record: project,
    });

    scoper.projectManagerUserIds = [projectManager.userId];
    const userIdsWithFullProjectVisibility = await scoper.getUserIdsWithFullProjectVisibility();

    userIdsWithFullProjectVisibility.forEach((userId) => {
      // TODO: send projectManager in included
      sails.sockets.broadcast(
        `user:${userId}`,
        'projectCreate',
        {
          item: project,
        },
        inputs.request,
      );
    });

    const webhooks = await Webhook.qm.getAll();

    sails.helpers.utils.sendWebhooks.with({
      webhooks,
      event: Webhook.Events.PROJECT_CREATE,
      buildData: () => ({
        item: project,
      }),
      user: inputs.actorUser,
    });

    return {
      project,
      projectManager,
    };
  },
};