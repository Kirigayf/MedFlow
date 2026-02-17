import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Modal, Form, Button, Message, Icon, Dropdown, Checkbox, Input } from 'semantic-ui-react';
import * as api from '../../api/master-tasks';
import * as AccessTokenStorage from '../../utils/access-token-storage';
import socket from '../../api/socket';

const LABEL_COLORS = ['red', 'orange', 'yellow', 'olive', 'green', 'teal', 'blue', 'violet', 'purple', 'pink', 'brown', 'grey', 'black'];

// Названия списков, которые мы ищем по умолчанию (приоритет сверху вниз)
const PREFERRED_LIST_NAMES = ['Задачи', 'Tasks', 'To Do', 'Входящие'];

const CreateMasterTaskModal = ({ open, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // Метки
  const [selectedLabels, setSelectedLabels] = useState([]); 
  const [labelOptions, setLabelOptions] = useState([]); 

  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // ДАННЫЕ
  const [dataTree, setDataTree] = useState([]);
  const [isLoadingData, setLoadingData] = useState(false);
  const [filterText, setFilterText] = useState(''); 
  
  // Состояние раскрытых проектов (аккордеон)
  const [expandedProjectIds, setExpandedProjectIds] = useState([]);

  // ВЫБРАННЫЕ ЦЕЛИ: Ключ = boardId, Значение = listId
  // Мы храним только выбранные доски. Если доска в объекте - значит она выбрана.
  const [selectedBoards, setSelectedBoards] = useState({}); 

  useEffect(() => {
    if (open) {
      loadDataTree();
    } else {
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setSelectedBoards({});
    setName('');
    setDescription('');
    setSelectedLabels([]);
    setError(null);
    setFilterText('');
    setExpandedProjectIds([]);
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

  // --- ХЕЛПЕРЫ ЛОГИКИ ---

  // Функция для поиска "лучшего" списка по умолчанию
  const findDefaultListId = (board) => {
    if (!board.lists || board.lists.length === 0) return null;
    
    // 1. Ищем по приоритетным названиям
    for (const name of PREFERRED_LIST_NAMES) {
      const found = board.lists.find(l => l.name.toLowerCase() === name.toLowerCase());
      if (found) return found.id;
    }
    
    // 2. Если не нашли, берем первый попавшийся
    return board.lists[0].id;
  };

  // --- ОБРАБОТЧИКИ НАЖАТИЙ ---

  // Клик по Доске
  const handleBoardToggle = (board) => {
    setSelectedBoards(prev => {
      const newState = { ...prev };
      if (newState[board.id]) {
        delete newState[board.id]; // Убрать выделение
      } else {
        const listId = findDefaultListId(board);
        if (listId) {
          newState[board.id] = listId; // Выбрать (с дефолтным списком)
        }
      }
      return newState;
    });
  };

  // Клик по Проекту (Выбрать все доски проекта / Снять все)
  const handleProjectToggle = (project) => {
    // Проверяем, все ли доски уже выбраны
    const allSelected = project.boards.length > 0 && project.boards.every(b => selectedBoards[b.id]);

    setSelectedBoards(prev => {
      const newState = { ...prev };
      project.boards.forEach(board => {
        if (allSelected) {
          delete newState[board.id];
        } else {
          const listId = findDefaultListId(board);
          if (listId) {
            newState[board.id] = listId;
          }
        }
      });
      return newState;
    });
  };

  // Изменение конкретного списка у выбранной доски
  const handleListChange = (boardId, newListId) => {
    setSelectedBoards(prev => ({
      ...prev,
      [boardId]: newListId
    }));
  };

  // Раскрытие/Скрытие аккордеона проекта
  const toggleProjectExpand = (projectId) => {
    setExpandedProjectIds(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId) 
        : [...prev, projectId]
    );
  };

  // Глобальные кнопки
  const handleSelectAll = () => {
    const newState = { ...selectedBoards };
    filteredProjects.forEach(p => {
      p.boards.forEach(b => {
        if (!newState[b.id]) {
          const listId = findDefaultListId(b);
          if (listId) newState[b.id] = listId;
        }
      });
    });
    setSelectedBoards(newState);
  };

  const handleDeselectAll = () => {
    setSelectedBoards({});
  };

  // --- UI ФИЛЬТРАЦИЯ ---
  const filteredProjects = useMemo(() => {
    if (!filterText) return dataTree;
    const lowerFilter = filterText.toLowerCase();

    return dataTree.reduce((acc, project) => {
      const projectMatches = project.name.toLowerCase().includes(lowerFilter);
      const matchingBoards = project.boards.filter(b => b.name.toLowerCase().includes(lowerFilter));
      
      if (projectMatches) {
        // Если проект подходит, показываем его целиком
        acc.push(project);
      } else if (matchingBoards.length > 0) {
        // Если проект не подходит, но есть подходящие доски
        acc.push({
          ...project,
          boards: matchingBoards 
        });
      }
      return acc;
    }, []);
  }, [dataTree, filterText]);

  // Авто-раскрытие при поиске
  useEffect(() => {
    if (filterText) {
      setExpandedProjectIds(filteredProjects.map(p => p.id));
    }
  }, [filterText, filteredProjects]);


  // --- ОТПРАВКА ---
  const handleLabelAdd = (e, { value }) => {
    const newLabels = value.map(val => {
      const existing = labelOptions.find(opt => opt.value === val);
      if (existing) return existing;
      const randomColor = LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)];
      const newOption = { text: val, value: val, color: randomColor };
      setLabelOptions(prev => [...prev, newOption]);
      return newOption;
    });
    setSelectedLabels(newLabels);
  };
  const renderLabel = (label) => ({ color: label.color, content: label.text });

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return;

    // Превращаем map selectedBoards в массив targets
    const targetsPayload = Object.keys(selectedBoards).map(boardId => ({
      listId: selectedBoards[boardId]
    }));

    if (targetsPayload.length === 0) {
      setError('Выберите хотя бы одну доску');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const accessToken = AccessTokenStorage.getAccessToken();
      const headers = { Authorization: `Bearer ${accessToken}` };
      const labelsPayload = selectedLabels.map(l => ({ name: l.text, color: l.color }));

      const { item } = await api.createMasterTask({
        name,
        description,
        targets: targetsPayload,
        labels: labelsPayload
      }, headers);

      onCreate(item);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Ошибка создания');
    } finally {
      setSubmitting(false);
    }
  }, [name, description, selectedBoards, selectedLabels, onCreate, onClose]);

  return (
    <Modal open={open} onClose={onClose} size="large" dimmer="blurring">
      <Modal.Header>Создать кросс-проектную задачу</Modal.Header>
      <Modal.Content scrolling>
        {error && <Message error content={error} />}
        
        <Form>
          <Form.Input
            label="Название задачи"
            placeholder="Что нужно сделать?"
            value={name}
            onChange={(e, { value }) => setName(value)}
            required
            autoFocus
          />

          <Form.Field>
            <label>Метки</label>
            <Dropdown
              options={labelOptions}
              placeholder="Срочно, Баг..."
              search selection fluid multiple allowAdditions
              value={selectedLabels.map(l => l.value)}
              onAddItem={(e, { value }) => handleLabelAdd(null, { value: [...selectedLabels.map(l => l.value), value] })}
              onChange={handleLabelAdd}
              renderLabel={renderLabel}
            />
          </Form.Field>

          <Form.TextArea
            label="Описание"
            value={description}
            onChange={(e, { value }) => setDescription(value)}
            rows={3}
          />

          <Form.Field>
            <label>Выбор досок ({Object.keys(selectedBoards).length} выбрано)</label>
            
            {/* Панель управления */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
               <Input 
                 icon="search" 
                 placeholder="Поиск по проектам и доскам..." 
                 value={filterText}
                 onChange={(e) => setFilterText(e.target.value)}
                 style={{ flex: 1 }}
               />
               <Button size="tiny" onClick={handleSelectAll}>Выбрать все</Button>
               <Button size="tiny" onClick={handleDeselectAll}>Снять все</Button>
            </div>

            {/* ДЕРЕВО ПРОЕКТОВ */}
            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '10px', background: '#fafafa' }}>
              
              {filteredProjects.length === 0 && <div style={{textAlign:'center', color:'#999', padding: '20px'}}>Ничего не найдено</div>}

              {filteredProjects.map(project => {
                // Вычисление состояния чекбокса проекта (выбраны ли все доски?)
                const allSelected = project.boards.length > 0 && project.boards.every(b => selectedBoards[b.id]);
                const someSelected = project.boards.some(b => selectedBoards[b.id]);
                const isExpanded = expandedProjectIds.includes(project.id);

                return (
                  <div key={project.id} style={{ marginBottom: '5px', background: 'white', border: '1px solid #eee', borderRadius: '4px' }}>
                    
                    {/* ЗАГОЛОВОК ПРОЕКТА */}
                    <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', background: '#f0f0f0' }}>
                      <Icon 
                        name={isExpanded ? 'caret down' : 'caret right'} 
                        style={{ cursor: 'pointer', marginRight: '5px' }} 
                        onClick={() => toggleProjectExpand(project.id)}
                      />
                      <Checkbox 
                        checked={allSelected} 
                        indeterminate={!allSelected && someSelected}
                        onChange={() => handleProjectToggle(project)}
                        style={{ marginRight: '10px' }}
                      />
                      <span 
                        style={{ fontWeight: 'bold', cursor: 'pointer', flex: 1, userSelect: 'none' }}
                        onClick={() => toggleProjectExpand(project.id)}
                      >
                        {project.name}
                      </span>
                    </div>

                    {/* СПИСОК ДОСОК (раскрывающийся) */}
                    {isExpanded && (
                      <div style={{ padding: '5px 10px 5px 35px' }}>
                        {project.boards.map(board => {
                          const isSelected = !!selectedBoards[board.id];
                          const selectedListId = selectedBoards[board.id];
                          
                          // Опции списков для этой доски
                          const listOptions = board.lists.map(l => ({ key: l.id, value: l.id, text: l.name }));

                          return (
                            <div key={board.id} style={{ display: 'flex', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f9f9f9' }}>
                              <Checkbox 
                                checked={isSelected}
                                onChange={() => handleBoardToggle(board)}
                                label={board.name}
                                style={{ flex: '0 0 40%' }}
                              />
                              
                              {/* Выбор списка (показываем только если доска выбрана) */}
                              {isSelected && (
                                <div style={{ flex: 1, paddingLeft: '10px' }}>
                                  <Dropdown 
                                    inline
                                    options={listOptions}
                                    value={selectedListId}
                                    onChange={(e, { value }) => handleListChange(board.id, value)}
                                    icon="list"
                                    style={{ fontSize: '0.9em' }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {project.boards.length === 0 && <div style={{color: '#999', fontSize: '0.85em', padding: '5px 0'}}>Нет досок в проекте</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: '0.85em', color: '#888', marginTop: '5px' }}>
              * Система автоматически выбирает список "Задачи", если он есть.
            </div>
          </Form.Field>

        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose} disabled={isSubmitting}>Отмена</Button>
        <Button
          positive
          icon="checkmark"
          labelPosition="right"
          content={`Создать (${Object.keys(selectedBoards).length})`}
          onClick={handleSubmit}
          loading={isSubmitting}
          disabled={!name.trim() || isSubmitting}
        />
      </Modal.Actions>
    </Modal>
  );
};

export default CreateMasterTaskModal;