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

    return {
      item: masterTask,
    };
  }
};