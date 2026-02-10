module.exports = {
  inputs: {
    id: { type: 'string', required: true },
    name: { type: 'string' },
    description: { type: 'string' },
    status: { type: 'string', isIn: ['active', 'completed', 'archived'] },
  },

  exits: {
    success: { responseType: 'ok' },
    notFound: { responseType: 'notFound' },
  },

  async fn(inputs) {
    const { id, ...values } = inputs;

    const updatedTask = await MasterTask.updateOne({ id }).set(values);

    if (!updatedTask) {
      throw 'notFound';
    }

    return {
      item: updatedTask,
    };
  }
};