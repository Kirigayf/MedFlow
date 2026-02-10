/* server/db/migrations/20260210120000_add_master_tasks.js */

exports.up = function(knex) {
  return knex.schema
    // 1. Создаем таблицу master_task
    .createTable('master_task', function(table) {
      table.bigIncrements('id').primary();
      table.string('name').notNullable();
      table.text('description');
      table.string('status').defaultTo('active'); // active, completed
      table.integer('progress').defaultTo(0);
      
      // ИСПРАВЛЕНИЕ: Таблица называется 'user_account', а не 'user'
      table.bigInteger('creator_user_id').unsigned().references('id').inTable('user_account').onDelete('CASCADE');
      
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    // 2. Добавляем колонку в таблицу card
    .alterTable('card', function(table) {
      table.bigInteger('master_task_id').unsigned().references('id').inTable('master_task').onDelete('SET NULL');
      table.index('master_task_id');
    });
};

exports.down = function(knex) {
  return knex.schema
    .table('card', function(table) {
      table.dropColumn('master_task_id');
    })
    .dropTable('master_task');
};