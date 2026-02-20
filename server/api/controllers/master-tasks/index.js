module.exports = {
  inputs: {},

  exits: {
    success: { responseType: 'ok' },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    // Находим все мастер-задачи, созданные пользователем
    const masterTasks = await MasterTask.find({
      creatorUserId: currentUser.id
    }).sort('createdAt DESC');

    // === ДОБАВЛЕННЫЙ БЛОК: Ищем привязанные карточки ===
    const tasksWithLinks = [];
    for (const task of masterTasks) {
      // Ищем самую первую попавшуюся карточку с таким masterTaskId
      const linkedCards = await Card.find({ masterTaskId: task.id }).limit(1);
      const linkedCard = linkedCards.length > 0 ? linkedCards[0] : null;
      
      // Добавляем к задаче адреса доски и карточки (если нашли)
      tasksWithLinks.push({
        ...task,
        linkedBoardId: linkedCard ? linkedCard.boardId : null,
        linkedCardId: linkedCard ? linkedCard.id : null,
      });
    }
    // ====================================================

    return {
      items: tasksWithLinks, // Отдаем фронтенду обогащенный массив
    };
  }
};