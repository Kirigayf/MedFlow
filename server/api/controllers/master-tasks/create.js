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

    // === НАЧАЛО: Отправка уведомлений в Telegram ===
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

          // ВСТАВЬТЕ СЮДА ТОКЕН ВАШЕГО БОТА (от @BotFather)
          const TELEGRAM_BOT_TOKEN = '8614492190:AAGlOJxBr_WgXLZ6UOrDTBE9J4FJosBQHJ0';

          for (const user of usersToNotify) {
            // Берем ID из профиля: поле phone (если есть) или username
            const chatId = user.phone || user.username; 
            
            // Важная защита: проверяем, что поле не пустое и содержит ТОЛЬКО цифры.
            // (Telegram chat_id всегда состоит только из цифр, например 1122334455)
            if (!chatId || !/^\d+$/.test(chatId)) continue;

            const messageText = `🔔 *Новая задача!*\n\n*Проект:* ${project.name}\n*Доска:* ${board.name}\n*Задача:* ${masterTask.name}\n*Создал:* ${currentUser.name || currentUser.email}`;

            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: messageText,
                parse_mode: 'Markdown'
              })
            });
          }
        }
      }
    } catch (err) {
      console.error('Ошибка при отправке уведомлений в Telegram:', err);
    }
    // === КОНЕЦ: Отправка уведомлений в Telegram ===

    return {
      item: masterTask,
    };
  }
};