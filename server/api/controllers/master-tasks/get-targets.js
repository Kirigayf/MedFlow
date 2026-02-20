module.exports = {
  inputs: {},

  exits: {
    success: { responseType: 'ok' },
    notEnoughRights: { responseType: 'forbidden' },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    // Проверка базового доступа к кросс-проектному функционалу
    const isAuthorized = ['admin', 'moderator', 'projectOwner'].includes(currentUser.role);
    if (!isAuthorized) {
      throw 'notEnoughRights';
    }

    // 1. Получаем все проекты, где пользователь является менеджером
    const managedProjectIds = await sails.helpers.users.getManagerProjectIds(currentUser.id);

    // 2. Получаем все членства пользователя в досках
    const boardMemberships = await BoardMembership.find({ userId: currentUser.id });
    const memberBoardIds = boardMemberships.map(bm => bm.boardId);

    // 3. Находим все проекты, в которых у пользователя есть доступ хотя бы к одной доске
    const membershipBoards = await Board.find({ id: memberBoardIds });
    const membershipProjectIds = membershipBoards.map(b => b.projectId);

    // Объединяем ID всех доступных проектов
    const allAccessibleProjectIds = _.uniq([...managedProjectIds, ...membershipProjectIds]);

    // 4. Загружаем проекты с их досками
    const projects = await Project.find({ id: allAccessibleProjectIds }).populate('boards');

    const result = [];

    for (const project of projects) {
      const projectData = {
        id: project.id,
        name: project.name,
        categories: project.categories || [],
        boards: []
      };

      for (const board of project.boards) {
        // Доска добавляется в дерево, если:
        // - Пользователь админ/модератор (видят всё)
        // - Пользователь менеджер этого проекта
        // - Пользователь является участником конкретно этой доски
        const isManager = managedProjectIds.includes(project.id);
        const isMember = memberBoardIds.includes(board.id);
        const isPowerUser = ['admin', 'moderator'].includes(currentUser.role);

        if (isPowerUser || isManager || isMember) {
          // Загружаем списки для доски, чтобы можно было выбрать целевой список
          const lists = await List.find({ boardId: board.id }).sort('position ASC');
          
          projectData.boards.push({
            id: board.id,
            name: board.name,
            lists: lists.map(l => ({ id: l.id, name: l.name }))
          });
        }
      }

      // Добавляем проект в дерево только если в нем есть хотя бы одна доступная доска
      if (projectData.boards.length > 0) {
        result.push(projectData);
      }
    }

    return {
      items: result
    };
  }
};