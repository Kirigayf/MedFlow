/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { dequal } from 'dequal';
import React, { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import TextareaAutosize from 'react-textarea-autosize';
import { Button, Form, Input, TextArea, Dropdown } from 'semantic-ui-react'; // Добавлен Dropdown

import selectors from '../../../../selectors';
import entryActions from '../../../../entry-actions';
import { useForm, useNestedRef } from '../../../../hooks';
import { isModifierKeyPressed } from '../../../../utils/event-helpers';

import styles from './EditInformation.module.scss';

const EditInformation = React.memo(() => {
  const project = useSelector(selectors.selectCurrentProject);

  const dispatch = useDispatch();
  const [t] = useTranslation();

  // === ДОБАВЛЕНО ПОЛЕ CATEGORIES ===
  const defaultData = useMemo(
    () => ({
      name: project.name,
      description: project.description,
      categories: project.categories || [], // Берем массив категорий из проекта (или пустой массив)
    }),
    [project.name, project.description, project.categories],
  );

  const [data, handleFieldChange, setData] = useForm(() => ({
    name: '',
    ...defaultData,
    description: defaultData.description || '',
    categories: defaultData.categories || [],
  }));

  // Состояние для вариантов выбора в Dropdown (чтобы можно было добавлять свои)
  const [categoryOptions, setCategoryOptions] = useState(
    (defaultData.categories || []).map(cat => ({ key: cat, text: cat, value: cat }))
  );

  // Обработчик добавления новой категории (по нажатию Enter в Dropdown)
  const handleCategoryAddition = (e, { value }) => {
    setCategoryOptions((prevOptions) => [{ key: value, text: value, value }, ...prevOptions]);
  };

  // Обработчик изменения выбора в Dropdown
  const handleCategoryChange = (e, { value }) => {
    setData((prevData) => ({ ...prevData, categories: value }));
  };
  // ===================================

  const cleanData = useMemo(
    () => ({
      ...data,
      name: data.name.trim(),
      description: data.description.trim() || null,
      categories: data.categories || [], // Гарантируем отправку массива
    }),
    [data],
  );

  const [nameFieldRef, handleNameFieldRef] = useNestedRef('inputRef');

  const submit = useCallback(() => {
    if (!cleanData.name) {
      nameFieldRef.current.select();
      return;
    }

    dispatch(entryActions.updateCurrentProject(cleanData));
  }, [dispatch, cleanData, nameFieldRef]);

  const handleSubmit = useCallback(() => {
    submit();
  }, [submit]);

  const handleDescriptionKeyDown = useCallback(
    (event) => {
      if (isModifierKeyPressed(event) && event.key === 'Enter') {
        submit();
      }
    },
    [submit],
  );

  return (
    <Form onSubmit={handleSubmit}>
      <div className={styles.text}>{t('common.title')}</div>
      <Input
        fluid
        ref={handleNameFieldRef}
        name="name"
        value={data.name}
        maxLength={128}
        className={styles.field}
        onChange={handleFieldChange}
      />

      {/* === НОВОЕ ПОЛЕ ВВОДА ДЛЯ КАТЕГОРИЙ === */}
      <div className={styles.text}>Категории проекта (теги)</div>
      <Dropdown
        options={categoryOptions}
        placeholder="Введите тег и нажмите Enter (например: Медицина)"
        search
        selection
        fluid
        multiple
        allowAdditions
        value={data.categories}
        onAddItem={handleCategoryAddition}
        onChange={handleCategoryChange}
        className={styles.field}
        style={{ marginBottom: '1rem' }}
      />
      {/* ======================================== */}

      <div className={styles.text}>{t('common.description')}</div>
      <TextArea
        as={TextareaAutosize}
        name="description"
        value={data.description}
        maxLength={1024}
        minRows={2}
        className={styles.field}
        onKeyDown={handleDescriptionKeyDown}
        onChange={handleFieldChange}
      />
      <Button positive disabled={dequal(cleanData, defaultData)} content={t('action.save')} />
    </Form>
  );
});

export default EditInformation;