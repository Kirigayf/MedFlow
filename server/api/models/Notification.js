/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * Notification.js
 *
 * @description :: A model definition represents a database table/collection.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       required:
 *         - id
 *         - userId
 *         - creatorUserId
 *         - boardId
 *         - cardId
 *         - commentId
 *         - actionId
 *         - type
 *         - data
 *         - isRead
 *         - createdAt
 *         - updatedAt
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the notification
 *           example: "1357158568008091264"
 *         userId:
 *           type: string
 *           description: ID of the user who receives the notification
 *           example: "1357158568008091265"
 *         creatorUserId:
 *           type: string
 *           nullable: true
 *           description: ID of the user who created the notification
 *           example: "1357158568008091266"
 *         boardId:
 *           type: string
 *           description: ID of the board associated with the notification (denormalized)
 *           example: "1357158568008091267"
 *         cardId:
 *           type: string
 *           description: ID of the card associated with the notification
 *           example: "1357158568008091268"
 *         commentId:
 *           type: string
 *           nullable: true
 *           description: ID of the comment associated with the notification
 *           example: "1357158568008091269"
 *         actionId:
 *           type: string
 *           nullable: true
 *           description: ID of the action associated with the notification
 *           example: "1357158568008091270"
 *         type:
 *           type: string
 *           enum: [moveCard, commentCard, addMemberToCard, mentionInComment]
 *           description: Type of the notification
 *           example: commentCard
 *         data:
 *           type: object
 *           description: Notification specific data (varies by type)
 *           example: {"card": {"name": "Implement user authentication"}, "text": "This task is almost complete..."}
 *         isRead:
 *           type: boolean
 *           default: false
 *           description: Whether the notification has been read
 *           example: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the notification was created
 *           example: 2024-01-01T00:00:00.000Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the notification was last updated
 *           example: 2024-01-01T00:00:00.000Z
 */

const Types = {
  MOVE_CARD: 'moveCard',
  COMMENT_CARD: 'commentCard',
  ADD_MEMBER_TO_CARD: 'addMemberToCard',
  MENTION_IN_COMMENT: 'mentionInComment',
};

module.exports = {
  Types,

  attributes: {
    type: {
      type: 'string',
      isIn: Object.values(Types),
      required: true,
    },
    data: {
      type: 'json',
      required: true,
    },
    isRead: {
      type: 'boolean',
      defaultsTo: false,
      columnName: 'is_read',
    },

    userId: {
      model: 'User',
      required: true,
      columnName: 'user_id',
    },
    creatorUserId: {
      model: 'User',
      columnName: 'creator_user_id',
    },
    boardId: {
      model: 'Board',
      required: true,
      columnName: 'board_id',
    },
    cardId: {
      model: 'Card',
      required: true,
      columnName: 'card_id',
    },
    commentId: {
      model: 'Comment',
      columnName: 'comment_id',
    },
    actionId: {
      model: 'Action',
      columnName: 'action_id',
    },
  },

  // === ГЛОБАЛЬНЫЙ ПЕРЕХВАТЧИК УВЕДОМЛЕНИЙ MAX ===
  afterCreate: function (newlyCreatedRecord, proceed) {
    proceed(); // Отпускаем БД, чтобы интерфейс не ждал

    (async () => {
      try {
        const user = await User.findOne({ id: newlyCreatedRecord.userId });
        if (!user) return;

        // Берем ID пользователя из профиля (поле phone или username)
        const chatId = user.phone || user.username;
        if (!chatId || !/^\d+$/.test(chatId)) return; 

        let creatorName = 'Кто-то';
        if (newlyCreatedRecord.creatorUserId) {
          const creator = await User.findOne({ id: newlyCreatedRecord.creatorUserId });
          if (creator) creatorName = creator.name || creator.email || creator.username;
        }

        let boardName = 'Неизвестная доска';
        if (newlyCreatedRecord.boardId) {
          const board = await Board.findOne({ id: newlyCreatedRecord.boardId });
          if (board) boardName = board.name;
        }

        const data = newlyCreatedRecord.data || {};
        const cardName = data.card ? data.card.name : 'карточка';

        let actionText = '';
        switch (newlyCreatedRecord.type) {
          case Types.MOVE_CARD:
            actionText = 'переместил(а) карточку';
            break;
          case Types.COMMENT_CARD:
            actionText = 'оставил(а) комментарий к карточке';
            break;
          case Types.ADD_MEMBER_TO_CARD:
            actionText = 'назначил(а) вас на задачу';
            break;
          case Types.MENTION_IN_COMMENT:
            actionText = 'упомянул(а) вас в комментарии';
            break;
          default:
            actionText = 'обновил(а) карточку';
        }

        let messageText = `🔔 *Dелай: Новое уведомление*\n\n`;
        messageText += `*Кто:* ${creatorName}\n`;
        messageText += `*Действие:* ${actionText}\n`;
        messageText += `*Доска:* ${boardName}\n`;
        messageText += `*Карточка:* ${cardName}\n`;

        if (data.text) {
          messageText += `\n*Текст:* _${data.text}_`;
        }

        // --- ТОКЕН БОТА MAX ---
        const MAX_BOT_TOKEN = 'f9LHodD0cOIwD-0N8IVM1Q11GW_Ozt8YYRJrSlffytvUAh6FrOsIr1naGp0yel0WIaCY0WhnYWOQcK6Dqdkx';

        // Отправка в MAX
        await fetch(`https://platform-api.max.ru/messages?user_id=${chatId}`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': MAX_BOT_TOKEN
          },
          body: JSON.stringify({
            text: messageText,
            format: 'markdown' // Max поддерживает markdown
          })
        });

      } catch (err) {
        console.error('Ошибка глобального перехватчика Max:', err);
      }
    })();
  },
};