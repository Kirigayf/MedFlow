module.exports = {
  inputs: {
    name: { type: 'string', required: true },
    description: { type: 'string' },
    targets: { type: 'json', required: true }, // [{ listId: '...' }]
    
    // 1. ДОБАВЛЯЕМ РАЗРЕШЕНИЕ НА ПРИЕМ МЕТОК
    labels: { type: 'json' } 
  },

  exits: {
    success: { responseType: 'ok' },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const masterTask = await sails.helpers.masterTasks.createOne.with({
      values: {
        name: inputs.name,
        description: inputs.description,
        labels: inputs.labels || [], 
      },
      user: currentUser,
      targets: inputs.targets,
      request: this.req,
    });

    // === НАЧАЛО: Рассылка уведомлений для кросс-проектных задач ===
    try {
      const createdCards = await Card.find({ masterTaskId: masterTask.id });

      for (const card of createdCards) {
        const board = await Board.findOne({ id: card.boardId });
        const list = await List.findOne({ id: card.listId });
        if (!board || !list) continue;
        
        const project = await Project.findOne({ id: board.projectId });

        const boardMemberships = await BoardMembership.find({ boardId: board.id });
        
        const userIdsToNotify = boardMemberships
          .map(m => m.userId)
          .filter(userId => userId !== currentUser.id);

        if (userIdsToNotify.length > 0) {
          // Действие в истории оставляем настоящим (создание карточки)
          const action = await Action.create({
            type: 'createCard',
            data: {
              card: { id: card.id, name: card.name },
              list: { id: list.id, name: list.name },
              board: { id: board.id, name: board.name },
              project: { id: project.id, name: project.name }
            },
            userId: currentUser.id,
            cardId: card.id,
            boardId: board.id
          }).fetch();

          // А само уведомление маскируем под разрешенный базой тип
          const notificationsToCreate = userIdsToNotify.map(userId => ({
            userId: userId,
            actionId: action.id,
            cardId: card.id,
            isRead: false,
            type: 'addMemberToCard' // <--- ИСПРАВЛЕНИЕ: Используем разрешенный тип
          }));
          
          await Notification.createEach(notificationsToCreate);

          userIdsToNotify.forEach(userId => {
            sails.sockets.broadcast(
              `user:${userId}`,
              'actionCreate',
              { item: action }
            );
          });
        }
      }
    } catch (err) {
      console.error('Ошибка при рассылке уведомлений о кросс-проектной задаче:', err);
    }
    // === КОНЕЦ: Рассылка уведомлений ===

    return {
      item: masterTask,
    };
  }
};