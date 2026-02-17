/**
 * Default model settings
 * (sails.config.models)
 *
 * Your default, project-wide model settings. Can also be overridden on a
 * per-model basis by setting a top-level properties in the model definition.
 *
 * For details about all available model settings, see:
 * https://sailsjs.com/config/models
 *
 * For more general background on Sails model settings, and how to configure
 * them on a project-wide or per-model basis, see:
 * https://sailsjs.com/docs/concepts/models-and-orm/model-settings
 */

// --- 1. Функция генерации ID ---
const generateId = () => {
  return Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
};
// -------------------------------

module.exports.models = {
  /**
   *
   * Whether model methods like `.create()` and `.update()` should ignore
   * (and refuse to persist) unrecognized data-- i.e. properties other than
   * those explicitly defined by attributes in the model definition.
   */

  // schema: true,

  /**
   *
   * How and whether Sails will attempt to automatically rebuild the
   * tables/collections/etc. in your schema.
   */

  migrate: 'safe',

  /**
   *
   * Base attributes that are included in all of your models by default.
   */

  attributes: {
    id: {
      type: 'string',
      columnName: 'id',
      // required: true,
      autoIncrement: true, // <--- УБРАЛИ ЭТО, так как генерируем ID сами
    },
    createdAt: {
      type: 'ref',
      columnName: 'created_at',
    },
    updatedAt: {
      type: 'ref',
      columnName: 'updated_at',
    },
  },

  // --- 2. Обновленный хук создания ---
  beforeCreate(valuesToSet, proceed) {
    // Если ID не передан явно, генерируем его автоматически
    if (!valuesToSet.id) {
      valuesToSet.id = generateId();
    }

    valuesToSet.createdAt = new Date().toISOString(); // eslint-disable-line no-param-reassign

    proceed();
  },
  // -----------------------------------

  beforeUpdate(valuesToSet, proceed) {
    valuesToSet.updatedAt = new Date().toISOString(); // eslint-disable-line no-param-reassign

    proceed();
  },

  /**
   *
   * The set of DEKs (data encryption keys) for at-rest encryption.
   */

  dataEncryptionKeys: {
    default: 'fKSf/hPekelUegjM7IyM/EhHbd7HI9Kiec5Lxy2t+7w=',
  },

  /**
   *
   * Whether or not implicit records for associations should be cleaned up
   * automatically using the built-in polyfill.
   */

  // cascadeOnDestroy: true,

  archiveModelIdentity: false,
};