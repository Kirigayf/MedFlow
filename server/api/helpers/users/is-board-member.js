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
    boardId: {
      type: 'string',
      required: true,
    },
  },

  async fn(inputs) {
    // === ДАЕМ ПРАВА МОДЕРАТОРУ ===
    const user = await User.findOne({ id: inputs.id });
    if (user && (user.role === 'admin' || user.role === 'moderator')) {
      return true;
    }
    // =============================

    const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
      inputs.boardId,
      inputs.id,
    );

    return !!boardMembership;
  },
};