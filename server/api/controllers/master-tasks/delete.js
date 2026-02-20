module.exports = {
  inputs: {
    id: { type: 'string', required: true },
  },

  exits: {
    success: { responseType: 'ok' },
    notFound: { responseType: 'notFound' },
  },

  async fn(inputs) {
    const { id } = inputs;

    // 1. Проверяем, существует ли такая мастер-задача
    const task = await MasterTask.findOne({ id });
    if (!task) {
      throw 'notFound';
    }

    // === ГЛАВНАЯ МАГИЯ: УДАЛЕНИЕ ВСЕХ КЛОНОВ ===
    // Находим и навсегда удаляем все карточки на досках, привязанные к этой задаче
    await Card.destroy({ masterTaskId: id });
    // ============================================

    // 2. Удаляем саму мастер-задачу из базы
    await MasterTask.destroy({ id });

    return {
      item: task,
    };
  }
};