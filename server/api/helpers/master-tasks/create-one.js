// Генератор уникальных ID (timestamp + случайное число)
const generateId = () => {
  return Date.now().toString() + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
};

module.exports = {
  inputs: {
    values: { type: 'ref', required: true },
    user: { type: 'ref', required: true },
    targets: { type: 'ref', required: true },
    request: { type: 'ref' },
  },

  exits: {
    success: {},
  },

  async fn(inputs) {
    const { values, user, targets } = inputs;
    const { 
      name,
      description,
      dueDate,
      memberIds,
      labels 
    } = values;

    // 1. Создаем Мастер-Задачу (с ручным ID)
    const masterTask = await MasterTask.create({
      id: generateId(), 
      name,
      description,
      creatorUserId: user.id,
      labels: labels || [], 
    }).fetch();

    // 2. Создаем карточки
    if (targets && targets.length > 0) {
      for (const target of targets) {
        if (!target.listId) continue;

        const list = await List.findOne(target.listId);
        if (!list) continue;

        const board = await Board.findOne(list.boardId);
        if (!board) continue;
        
        const project = await Project.findOne(board.projectId);

        const lastCard = await Card.find({ listId: list.id }).sort('position DESC').limit(1);
        const newPosition = lastCard.length > 0 ? lastCard[0].position + 65536 : 65536;

        // --- Генерируем ID для карточки ---
        const newCardId = generateId(); 

        // --- Создаем Карточку ---
        // Передаем сгенерированный ID внутрь values
        const createdCard = await sails.helpers.cards.createOne.with({
          values: {
            id: newCardId, // <--- ВАЖНО: Передаем ID сюда
            name,
            description,
            list: list,
            board: board,
            creatorUser: user,
            type: 'project', 
            masterTaskId: masterTask.id,
            position: newPosition,
            dueDate: dueDate || null,
          },
          project: project,
          request: inputs.request,
        });

        // Получаем ID (на всякий случай берем наш generated, если helper не вернул)
        const cardId = createdCard.id || (createdCard.item && createdCard.item.id) || newCardId;

        // --- Участники ---
        if (memberIds && memberIds.length > 0) {
          const boardMembers = await BoardMembership.find({
            boardId: board.id,
            userId: { in: memberIds }
          });
          
          const validUserIds = boardMembers.map(m => m.userId);

          if (validUserIds.length > 0) {
             const memberships = validUserIds.map(uid => ({
              cardId: cardId,
              userId: uid
            }));
            try {
              await CardMembership.createEach(memberships).tolerate('E_UNIQUE');
            } catch (e) {}
          }
        }
      }
    }

    return masterTask;
  },
};