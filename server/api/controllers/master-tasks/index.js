module.exports = {
  inputs: {},

  exits: {
    success: { responseType: 'ok' },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    // Находим все мастер-задачи, созданные пользователем
    // (Или можно сделать поиск по member-ству, но начнем с простого)
    const masterTasks = await MasterTask.find({
      creatorUserId: currentUser.id
    }).sort('createdAt DESC');

    return {
      items: masterTasks,
    };
  }
};