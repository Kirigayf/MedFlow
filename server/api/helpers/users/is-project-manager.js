/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

module.exports = {
  inputs: {
    id: {
      type: 'string',
      required: true,
    },
    projectId: {
      type: 'string',
      required: true,
    },
  },

  async fn(inputs) {
    // === ДАЕМ ПРАВА МОДЕРАТОРУ ===
    // Проверяем, не является ли пользователь админом или модератором
    const user = await User.findOne({ id: inputs.id });
    if (user && (user.role === 'admin' || user.role === 'moderator')) {
      return true;
    }
    // =============================

    const projectManager = await ProjectManager.qm.getOneByProjectIdAndUserId(
      inputs.projectId,
      inputs.id,
    );

    return !!projectManager;
  },
};