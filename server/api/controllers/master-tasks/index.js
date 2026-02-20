module.exports = {
  inputs: {},

  exits: {
    success: { responseType: 'ok' },
    notEnoughRights: { responseType: 'forbidden' }, // Добавляем обработку запрета доступа
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    // === ПРОВЕРКА РОЛЕЙ ===
    // Разрешаем доступ только Админам, Модераторам и Владельцам проектов
    const isAuthorized = [
      'admin', 
      'moderator', 
      'projectOwner'
    ].includes(currentUser.role);

    if (!isAuthorized) {
      throw 'notEnoughRights';
    }

    let query = {};
    // Если пользователь не обладает высшими правами (админ/модератор),
    // ограничиваем список только теми задачами, которые он создал сам.
    if (currentUser.role !== 'admin' && currentUser.role !== 'moderator') {
      query.creatorUserId = currentUser.id;
    }

    // 1. Находим задачи согласно фильтру
    const masterTasks = await MasterTask.find(query).sort('createdAt DESC');

    const tasksWithLinks = [];
    for (const task of masterTasks) {
      // 2. Ищем привязанную карточку для формирования ссылки на фронтенде
      const linkedCards = await Card.find({ masterTaskId: task.id }).limit(1);
      const linkedCard = linkedCards.length > 0 ? linkedCards[0] : null;
      
      tasksWithLinks.push({
        ...task,
        linkedBoardId: linkedCard ? linkedCard.boardId : null,
        linkedCardId: linkedCard ? linkedCard.id : null,
      });
    }

    return {
      items: tasksWithLinks,
    };
  }
};