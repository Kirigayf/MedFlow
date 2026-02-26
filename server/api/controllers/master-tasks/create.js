module.exports = {
  inputs: {
    name: { type: 'string', required: true },
    description: { type: 'string' },
    targets: { type: 'json', required: true }, 
    
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
        if (!board) continue;
        
        const boardMemberships = await BoardMembership.find({ boardId: board.id });
        
        const userIdsToNotify = boardMemberships
          .map(m => m.userId)
          .filter(userId => userId !== currentUser.id);

        if (userIdsToNotify.length > 0) {
          // 1. Ищем действие (Action), которое Planka уже сама создала секунду назад
          const action = await Action.findOne({ cardId: card.id }).sort('createdAt DESC');
          
          if (!action) continue; // На всякий случай: если действия нет, пропускаем

          // 2. Генерируем уведомления (привязываем к реальному системному действию)
          const notificationsToCreate = userIdsToNotify.map(userId => ({
            userId: userId,
            actionId: action.id, 
            cardId: card.id,
            isRead: false,
            type: 'addMemberToCard' 
          }));
          
          // .fetch() нужен, чтобы получить сгенерированные ID уведомлений
          const createdNotifications = await Notification.createEach(notificationsToCreate).fetch();

          // 3. Отправляем WebSocket-сигналы, чтобы колокольчик загорелся в реальном времени
          createdNotifications.forEach(notification => {
            sails.sockets.broadcast(
              `user:${notification.userId}`,
              'notificationCreate', 
              { item: notification }
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