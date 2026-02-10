module.exports = {
  tableName: 'master_task',

  attributes: {

    id: {
      type: 'string',
      columnName: 'id',
      required: true,
    },

    name: { type: 'string', required: true },
    description: { type: 'string', allowNull: true },
    
    // ДОБАВИЛИ 'archived' в список
    status: { 
      type: 'string', 
      isIn: ['active', 'completed', 'archived'], 
      defaultsTo: 'active' 
    },

    labels: {
      type: 'json',
      defaultsTo: [], // По умолчанию пустой массив
    },
    
    progress: { type: 'number', defaultsTo: 0 },
    
    createdAt: { type: 'ref', columnName: 'created_at' },
    updatedAt: { type: 'ref', columnName: 'updated_at' },

    creatorUserId: {
      model: 'User',
      columnName: 'creator_user_id',
    },
    cards: {
      collection: 'Card',
      via: 'masterTaskId',
    },
  },
};