module.exports = async function (req, res, proceed) {
  const { currentUser } = req;

  // Если пользователя нет (не залогинен) - ошибка 401
  if (!currentUser) {
    return res.unauthorized();
  }

  // Разрешаем, если роль 'admin' ИЛИ 'moderator'
  if (currentUser.role === 'admin' || currentUser.role === 'moderator') {
    return proceed();
  }

  // Всем остальным - ошибка 403 (Запрещено)
  return res.forbidden();
};