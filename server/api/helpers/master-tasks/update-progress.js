module.exports = {
  inputs: {
    masterTaskId: { type: 'string', required: true },
  },

  exits: {
    success: {},
  },

  async fn(inputs) {
    const { masterTaskId } = inputs;

    // 1. Находим все карточки, привязанные к этой Мастер-задаче
    const cards = await Card.find({ masterTaskId });

    if (!cards || cards.length === 0) {
      return;
    }

    // 2. Получаем ID всех списков, в которых лежат эти карточки
    const listIds = cards.map((c) => c.listId);
    
    // 3. Загружаем сами Списки, чтобы проверить их названия
    const lists = await List.find({ id: listIds });

    // 4. Определяем ключевые слова для готовых колонок
    // Вы можете добавить сюда свои варианты
    const doneKeywords = ['готово', 'выполнено', 'done', 'completed', 'success', 'archive', 'завершено'];

    let completedCount = 0;

    // 5. Считаем, сколько карточек лежит в колонках "Готово"
    cards.forEach((card) => {
      const list = lists.find((l) => l.id === card.listId);
      if (list) {
        const listName = list.name.toLowerCase().trim();
        // Проверяем, содержит ли название списка одно из ключевых слов
        const isDone = doneKeywords.some((keyword) => listName.includes(keyword));
        
        if (isDone) {
          completedCount++;
        }
      }
    });

    // 6. Вычисляем процент
    const progress = Math.round((completedCount / cards.length) * 100);

    // 7. Обновляем Мастер-Задачу
    const updatedMasterTask = await MasterTask.updateOne({ id: masterTaskId }).set({
      progress: progress,
      // Если прогресс 100%, можно автоматически менять статус самой мастер задачи
      status: progress === 100 ? 'completed' : 'active'
    });

    // 8. (Опционально) Отправляем событие через сокеты, чтобы фронтенд обновился сам
    // sails.sockets.broadcast('masterTask', 'updated', updatedMasterTask); 

    return updatedMasterTask;
  },
};