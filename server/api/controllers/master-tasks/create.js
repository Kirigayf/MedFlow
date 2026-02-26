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
        // 2. ПЕРЕДАЕМ МЕТКИ В ХЕЛПЕР
        labels: inputs.labels || [], 
      },
      user: currentUser,
      targets: inputs.targets,
      request: this.req,
    });

    // === НАЧАЛО: Рассылка уведомлений для кросс-проектных задач ===
    try {
      // 1. Находим все карточки-клоны, которые только что были созданы
      const createdCards = await Card.find({ masterTaskId: masterTask.id });

      // 2. Проходимся по каждой созданной карточке
      for (const card of createdCards) {
        // Подтягиваем данные о доске, списке и проекте (это нужно для истории и интерфейса)
        const board = await Board.findOne({ id: card.boardId });
        const list = await List.findOne({ id: card.listId });
        if (!board || !list) continue;
        
        const project = await Project.findOne({ id: board.projectId });

        // 3. Находим всех пользователей, у которых есть доступ к этой доске
        const boardMemberships = await BoardMembership.find({ boardId: board.id });
        
        // Оставляем только чужие ID (чтобы создатель не получал уведомление о своих же действиях)
        const userIdsToNotify = boardMemberships
          .map(m => m.userId)
          .filter(userId => userId !== currentUser.id);

        if (userIdsToNotify.length > 0) {
          // 4. Создаем запись о действии (Action) — она появится в истории доски
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

          // 5. Генерируем сами уведомления (чтобы зажегся красный колокольчик)
          const notificationsToCreate = userIdsToNotify.map(userId => ({
            userId: userId,
            actionId: action.id,
            cardId: card.id,
            isRead: false
          }));
          
          await Notification.createEach(notificationsToCreate);

          // 6. Отправляем WebSocket-сигнал, чтобы интерфейс обновился без перезагрузки страницы
          userIdsToNotify.forEach(userId => {
            sails.sockets.broadcast(
              `user:${userId}`,
              'actionCreate', // Стандартный ивент Planka для обновления колокольчика
              { item: action }
            );
          });
        }
      }
    } catch (err) {
      // Логируем ошибку, но не прерываем работу (задача в любом случае будет создана)
      console.error('Ошибка при рассылке уведомлений о кросс-проектной задаче:', err);
    }
    // === КОНЕЦ: Рассылка уведомлений ===

    return {
      item: masterTask,
    };
  }
};