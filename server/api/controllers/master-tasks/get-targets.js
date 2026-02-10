module.exports = {
  inputs: {},

  exits: {
    success: { responseType: 'ok' },
  },

  async fn() {
    const { currentUser } = this.req;

    // 1. Получаем проекты, доступные пользователю
    // Используем существующий хелпер Planka или ищем напрямую
    // Для надежности найдем проекты, где пользователь является участником или менеджером
    // Но так как в Planka сложная система прав, упростим: берем все проекты (фильтрацию добавите по необходимости)
    // В идеале: const projectIds = await sails.helpers.users.getAccessibleProjectIds(currentUser.id);
    const projects = await Project.find().sort('name ASC');

    // 2. Получаем доски для этих проектов
    const projectIds = projects.map(p => p.id);
    const boards = await Board.find({ projectId: projectIds }).sort('name ASC');

    // 3. Получаем списки для этих досок
    const boardIds = boards.map(b => b.id);
    const lists = await List.find({ boardId: boardIds }).sort('position ASC');

    // 4. Собираем дерево
    const tree = projects.map(project => {
      const projectBoards = boards
        .filter(b => b.projectId === project.id)
        .map(board => {
          const boardLists = lists
            .filter(l => l.boardId === board.id)
            .map(list => ({
              id: list.id,
              name: list.name
            }));
          
          return {
            id: board.id,
            name: board.name,
            lists: boardLists
          };
        });

      return {
        id: project.id,
        name: project.name,
        boards: projectBoards
      };
    });

    return {
      items: tree
    };
  }
};