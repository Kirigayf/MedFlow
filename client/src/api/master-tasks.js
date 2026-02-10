/* client/src/api/master-tasks.js */

import socket from './socket';

// Трансформер для дат (как в cards.js)
const transformMasterTask = (task) => ({
  ...task,
  ...(task.createdAt && {
    createdAt: new Date(task.createdAt),
  }),
  ...(task.updatedAt && {
    updatedAt: new Date(task.updatedAt),
  }),
});

// GET запрос (нужно будет добавить контроллер index на бэкенде для этого)
export const getMasterTasks = (headers) =>
  socket.get('/master-tasks', undefined, headers).then((body) => ({
    ...body,
    items: body.items.map(transformMasterTask),
  }));

// POST запрос создания
export const createMasterTask = (data, headers) =>
  socket.post('/master-tasks', data, headers).then((body) => ({
    ...body,
    item: transformMasterTask(body.item),
  }));