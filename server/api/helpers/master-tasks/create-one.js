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
      userIds, // <--- Получаем ID из нового фронтенда
      labels 
    } = values;

    // === СОБИРАЕМ ВСЕХ УЧАСТНИКОВ ===
    let allMemberIds = [];
    if (Array.isArray(memberIds)) allMemberIds.push(...memberIds);
    if (Array.isArray(userIds)) allMemberIds.push(...userIds);
    if (user && user.id) allMemberIds.push(user.id); // Обязательно добавляем самого создателя
    
    // Убираем дубликаты (чтобы не пытаться добавить одного человека дважды)
    allMemberIds = [...new Set(allMemberIds)];

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
        const createdCard = await sails.helpers.cards.createOne.with({
          values: {
            id: newCardId, 
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

        const cardId = createdCard.id || (createdCard.item && createdCard.item.id) || newCardId;

        // --- ПРИВЯЗЫВАЕМ УЧАСТНИКОВ (И АВАТАРКИ) К КАРТОЧКЕ ---
        if (allMemberIds.length > 0) {
          // Ищем, кто из списка реально состоит в этой доске
          const boardMembers = await BoardMembership.find({
            boardId: board.id,
            userId: { in: allMemberIds }
          });
          
          let validUserIds = boardMembers.map(m => m.userId);

          // === ВАЖНОЕ ИСКЛЮЧЕНИЕ ДЛЯ АДМИНОВ И МОДЕРАТОРОВ ===
          // Если создатель имеет высшие права, его может не быть в участниках доски.
          // Поэтому мы принудительно разрешаем ему быть на карточке!
          if (user && (user.role === 'admin' || user.role === 'moderator' || user.role === 'project_owner')) {
            if (!validUserIds.includes(user.id)) {
              validUserIds.push(user.id);
            }
          }

          if (validUserIds.length > 0) {
             const memberships = validUserIds.map(uid => ({
              cardId: cardId,
              userId: uid
            }));
            try {
              // Привязываем людей к карточке
              await CardMembership.createEach(memberships).tolerate('E_UNIQUE');
            } catch (e) {
              console.error('Ошибка привязки участника к карточке:', e);
            }
          }
        }
      }
    }

    return masterTask;
  },
};