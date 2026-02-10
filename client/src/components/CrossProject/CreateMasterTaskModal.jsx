import React, { useState, useCallback, useEffect } from 'react';
// 1. Добавляем Label в импорты
import { Modal, Form, Button, Message, Icon, Dropdown, Label } from 'semantic-ui-react'; // <--- Добавили Label
import * as api from '../../api/master-tasks';
import * as AccessTokenStorage from '../../utils/access-token-storage';
import socket from '../../api/socket';

// 2. Добавляем массив цветов перед компонентом
// <--- НАЧАЛО ВСТАВКИ
const LABEL_COLORS = ['red', 'orange', 'yellow', 'olive', 'green', 'teal', 'blue', 'violet', 'purple', 'pink', 'brown', 'grey', 'black'];
// <--- КОНЕЦ ВСТАВКИ

const CreateMasterTaskModal = ({ open, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // 3. Добавляем стейт для меток
  // <--- НАЧАЛО ВСТАВКИ
  const [selectedLabels, setSelectedLabels] = useState([]); 
  const [labelOptions, setLabelOptions] = useState([]); 
  // <--- КОНЕЦ ВСТАВКИ

  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [targets, setTargets] = useState([{ id: Date.now(), projectId: null, boardId: null, listId: null }]);
  const [dataTree, setDataTree] = useState([]);
  const [isLoadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (open) {
      loadDataTree();
    } else {
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setTargets([{ id: Date.now(), projectId: null, boardId: null, listId: null }]);
    setName('');
    setDescription('');
    // 4. Сбрасываем метки при закрытии
    setSelectedLabels([]); // <--- ВСТАВКА
    setError(null);
  };

  const loadDataTree = async () => {
    try {
      setLoadingData(true);
      const accessToken = AccessTokenStorage.getAccessToken();
      const headers = { Authorization: `Bearer ${accessToken}` };
      
      const { items } = await socket.get('/master-tasks/targets', undefined, headers);
      setDataTree(items);
    } catch (err) {
      console.error("Failed to load targets", err);
    } finally {
      setLoadingData(false);
    }
  };

  // 5. Функции для обработки меток
  // <--- НАЧАЛО БЛОКА МЕТОК
  const handleLabelAdd = (e, { value }) => {
    const newLabels = value.map(val => {
      // Ищем, есть ли такая метка уже в опциях
      const existing = labelOptions.find(opt => opt.value === val);
      if (existing) return existing;
      
      // Если нет - создаем новую со случайным цветом
      const randomColor = LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)];
      const newOption = { text: val, value: val, color: randomColor };
      
      setLabelOptions(prev => [...prev, newOption]);
      return newOption;
    });

    setSelectedLabels(newLabels);
  };

  const renderLabel = (label) => ({
    color: label.color,
    content: label.text,
  });
  // <--- КОНЕЦ БЛОКА МЕТОК

  // --- Хелперы для Dropdown ---
  const projectOptions = dataTree.map(p => ({ key: p.id, text: p.name, value: p.id }));

  const getBoardOptions = (projectId) => {
    const project = dataTree.find(p => p.id === projectId);
    return project ? project.boards.map(b => ({ key: b.id, text: b.name, value: b.id })) : [];
  };

  const getListOptions = (projectId, boardId) => {
    const project = dataTree.find(p => p.id === projectId);
    if (!project) return [];
    const board = project.boards.find(b => b.id === boardId);
    return board ? board.lists.map(l => ({ key: l.id, text: l.name, value: l.id })) : [];
  };

  // --- Управление строками ---
  const addTargetRow = () => {
    setTargets([...targets, { id: Date.now(), projectId: null, boardId: null, listId: null }]);
  };

  const removeTargetRow = (rowId) => {
    setTargets(targets.filter(t => t.id !== rowId));
  };

  const handleTargetChange = (rowId, field, value) => {
    setTargets(prev => prev.map(t => {
      if (t.id !== rowId) return t;
      const updated = { ...t, [field]: value };
      if (field === 'projectId') { updated.boardId = null; updated.listId = null; }
      else if (field === 'boardId') { updated.listId = null; }
      return updated;
    }));
  };

  // --- Отправка ---
  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return;

    const validTargets = targets.filter(t => t.listId).map(t => ({ listId: t.listId }));

    if (validTargets.length === 0) {
      setError('Выберите хотя бы один список для создания задачи');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const accessToken = AccessTokenStorage.getAccessToken();
      const headers = { Authorization: `Bearer ${accessToken}` };

      // 6. Подготавливаем метки для отправки
      // <--- ВСТАВКА
      const labelsPayload = selectedLabels.map(l => ({ name: l.text, color: l.color }));

      const { item } = await api.createMasterTask({
        name,
        description,
        targets: validTargets,
        labels: labelsPayload // <--- Отправляем метки
      }, headers);

      onCreate(item);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Не удалось создать задачу.');
    } finally {
      setSubmitting(false);
    }
  }, [name, description, targets, selectedLabels, onCreate, onClose]); // Добавили selectedLabels в зависимости

  return (
    <>
      <style>{`
        .ui.dimmer.modals { z-index: 10000 !important; }
        .ui.modal { z-index: 10001 !important; }
        .target-row { margin-bottom: 10px; padding: 15px; background: #f9f9f9; border: 1px solid #eee; border-radius: 5px; position: relative; }
        .target-row .delete-btn { position: absolute; top: 10px; right: 10px; }
      `}</style>

      <Modal open={open} onClose={onClose} size="large" dimmer="blurring">
        <Modal.Header>Создать кросс-проектную задачу</Modal.Header>
        <Modal.Content scrolling>
          {error && <Message error content={error} />}
          
          <Form>
            <Form.Input
              label="Название задачи"
              placeholder="Например: Обновить логотип везде"
              value={name}
              onChange={(e, { value }) => setName(value)}
              required
              autoFocus
            />

            {/* 7. Вставляем поле выбора меток */}
            {/* <--- НАЧАЛО ВСТАВКИ UI */}
            <Form.Field>
              <label>Метки (Напишите название и нажмите Enter)</label>
              <Dropdown
                options={labelOptions}
                placeholder="Срочно, Маркетинг..."
                search
                selection
                fluid
                multiple
                allowAdditions
                value={selectedLabels.map(l => l.value)}
                onAddItem={(e, { value }) => handleLabelAdd(null, { value: [...selectedLabels.map(l => l.value), value] })}
                onChange={handleLabelAdd}
                renderLabel={renderLabel}
              />
            </Form.Field>
            {/* <--- КОНЕЦ ВСТАВКИ UI */}

            <Form.TextArea
              label="Описание"
              placeholder="Подробности..."
              value={description}
              onChange={(e, { value }) => setDescription(value)}
            />

            <Form.Field>
              <label>Где создать задачи? (Проект &rarr; Доска &rarr; Список)</label>
              
              {targets.map((target) => (
                <div key={target.id} className="target-row">
                  <Form.Group widths="equal" style={{ marginBottom: 0, paddingRight: targets.length > 1 ? '30px' : 0 }}>
                    <Form.Field>
                      <Dropdown
                        placeholder="Проект"
                        selection
                        search
                        options={projectOptions}
                        value={target.projectId}
                        onChange={(e, { value }) => handleTargetChange(target.id, 'projectId', value)}
                        loading={isLoadingData}
                      />
                    </Form.Field>
                    <Form.Field>
                      <Dropdown
                        placeholder="Доска"
                        selection
                        search
                        disabled={!target.projectId}
                        options={getBoardOptions(target.projectId)}
                        value={target.boardId}
                        onChange={(e, { value }) => handleTargetChange(target.id, 'boardId', value)}
                      />
                    </Form.Field>
                    <Form.Field>
                      <Dropdown
                        placeholder="Список"
                        selection
                        search
                        disabled={!target.boardId}
                        options={getListOptions(target.projectId, target.boardId)}
                        value={target.listId}
                        onChange={(e, { value }) => handleTargetChange(target.id, 'listId', value)}
                      />
                    </Form.Field>
                  </Form.Group>
                  {targets.length > 1 && (
                    <Button icon="trash" color="red" size="tiny" basic className="delete-btn" onClick={() => removeTargetRow(target.id)} />
                  )}
                </div>
              ))}

              <Button basic icon labelPosition="left" onClick={addTargetRow}>
                <Icon name="plus" /> Добавить еще место
              </Button>
            </Form.Field>

          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={onClose} disabled={isSubmitting}>Отмена</Button>
          <Button
            positive
            icon="checkmark"
            labelPosition="right"
            content="Создать и распределить"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={!name.trim() || isSubmitting}
          />
        </Modal.Actions>
      </Modal>
    </>
  );
};

export default CreateMasterTaskModal;