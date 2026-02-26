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

          // 1. ВСТАВЬТЕ СЮДА ТОКЕН ВАШЕГО БОТА (от @BotFather)
          const TELEGRAM_BOT_TOKEN = '1234567890:AAH_Ваш_Длинный_Токен_Здесь';

          // 2. СЛОВАРЬ СОПОСТАВЛЕНИЯ ПОЛЬЗОВАТЕЛЕЙ
          // Слева: ID пользователя в вашей Planka
          // Справа: chat_id этого человека в Telegram (можно узнать через бота @userinfobot)
          const telegramChatIds = {
            '1': '1122334455', // Например, это вы (Админ)
            '2': '9988776655', // Какой-то другой участник
            // 'ID_В_PLANKA': 'CHAT_ID_В_ТЕЛЕГРАМ'
          };

          for (const user of usersToNotify) {
            // Ищем chat_id пользователя в нашем словаре
            const chatId = telegramChatIds[user.id]; 
            
            // Если для пользователя не указан chat_id, просто пропускаем его
            if (!chatId) continue;

            // Формируем красивый текст сообщения (Telegram поддерживает разметку Markdown)
            const messageText = `🔔 *Новая задача!*\n\n*Проект:* ${project.name}\n*Доска:* ${board.name}\n*Задача:* ${masterTask.name}\n*Создал:* ${currentUser.name || currentUser.email}`;

            // Отправляем HTTP-запрос серверам Telegram
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: messageText,
                parse_mode: 'Markdown' // Включаем поддержку жирного шрифта (*)
              })
            });
          }
        }
      }
    } catch (err) {
      // Если у Telegram сбой или нет интернета, система просто запишет ошибку в лог,
      // но задача всё равно будет успешно создана.
      console.error('Ошибка при отправке уведомлений в Telegram:', err);
    }
    // === КОНЕЦ: Отправка уведомлений в Telegram ===

    return {
      item: masterTask,
    };
  }
};