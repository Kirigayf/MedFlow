/**
 * can-manage-master-tasks
 *
 * @description :: Policy to allow admin, moderator, or project owner to manage master tasks.
 */

module.exports = async function (req, res, proceed) {
  const { currentUser } = req;

  // Если пользователя нет (не залогинен) - ошибка 401
  if (!currentUser) {
    return res.unauthorized();
  }

  // === ОБНОВЛЕННОЕ УСЛОВИЕ ===
  // Разрешаем, если роль 'admin', 'moderator' ИЛИ 'projectOwner'
  const isAuthorized = [
    'admin', 
    'moderator', 
    'projectOwner'
  ].includes(currentUser.role);

  if (isAuthorized) {
    return proceed();
  }
  // ===========================

  // Всем остальным - ошибка 403 (Запрещено)
  return res.forbidden();
};