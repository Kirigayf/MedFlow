module.exports = {
  inputs: {
    id: { type: 'string', required: true },
  },

  exits: {
    success: { responseType: 'ok' },
  },

  async fn(inputs) {
    // 1. Сначала "отвязываем" все дочерние карточки
    // Они останутся на досках, но перестанут ссылаться на удаляемую мастер-задачу
    await Card.update({ masterTaskId: inputs.id }).set({
      masterTaskId: null
    });

    // 2. Удаляем саму мастер-задачу
    await MasterTask.destroyOne({ id: inputs.id });

    return {};
  }
};