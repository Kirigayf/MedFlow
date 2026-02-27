module.exports = {
  inputs: {
    name: { type: 'string', required: true },
    description: { type: 'string' },
    targets: { type: 'json', required: true }, 
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

    // === НАЧАЛО: Отправка уведомлений в мессенджер MAX ===
    try {
      const createdCards = await Card.find({ masterTaskId: masterTask.id });

      for (const card of createdCards) {
        const board = await Board.findOne({ id: card.boardId });
        if (!board) continue;
        
        const project = await Project.findOne({ id: board.projectId });
        const boardMemberships = await BoardMembership.find({ boardId: board.id });
        
        const userIdsToNotify = boardMemberships
          .map(m => m.userId)
          .filter(userId => userId !== currentUser.id);

        if (userIdsToNotify.length > 0) {
          const usersToNotify = await User.find({ id: userIdsToNotify });

          // --- ТОКЕН БОТА MAX ---
          const MAX_BOT_TOKEN = 'f9LHodD0cOIwD-0N8IVM1Q11GW_Ozt8YYRJrSlffytvUAh6FrOsIr1naGp0yel0WIaCY0WhnYWOQcK6Dqdkx';

          for (const user of usersToNotify) {
            // Берем ID из профиля (phone или username)
            const chatId = user.phone || user.username; 
            
            if (!chatId || !/^\d+$/.test(chatId)) continue;

            const messageText = `🔔 *Новая кросс-проектная задача!*\n\n*Проект:* ${project.name}\n*Доска:* ${board.name}\n*Задача:* ${masterTask.name}\n*Создал:* ${currentUser.name || currentUser.email}`;

            // Отправка запроса в API MAX
            await fetch(`https://platform-api.max.ru/messages?user_id=${chatId}`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': MAX_BOT_TOKEN
              },
              body: JSON.stringify({
                text: messageText,
                format: 'markdown'
              })
            });
          }
        }
      }
    } catch (err) {
      console.error('Ошибка при отправке уведомлений в Max:', err);
    }
    // === КОНЕЦ: Отправка уведомлений в MAX ===

    return {
      item: masterTask,
    };
  }
};