import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Modal, Form, Button, Message, Icon, Dropdown, Checkbox, Input } from 'semantic-ui-react';
import * as api from '../../api/master-tasks';
import selectors from '../../selectors';
import * as AccessTokenStorage from '../../utils/access-token-storage';
import socket from '../../api/socket';

const LABEL_COLORS = ['red', 'orange', 'yellow', 'olive', 'green', 'teal', 'blue', 'violet', 'purple', 'pink', 'brown', 'grey', 'black'];

// Названия списков, которые мы ищем по умолчанию (приоритет сверху вниз)
const PREFERRED_LIST_NAMES = ['Задачи', 'Tasks', 'To Do', 'Входящие'];

const CreateMasterTaskModal = ({ open, onClose, onCreate }) => {
  // Получаем текущего пользователя из Redux
  const currentUser = useSelector(selectors.selectCurrentUser);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // Метки: храним только массив строк (названий) выбранных меток
  const [selectedLabels, setSelectedLabels] = useState([]); 
  // Опции: массив объектов { key, text, value, color }
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
      setDataTree(items || []);
    } catch (err) {
      console.error("Failed to load targets", err);
    } finally {
      setLoadingData(false);
    }
  };

  // --- ХЕЛПЕРЫ ЛОГИКИ ---

  const findDefaultListId = (board) => {
    if (!board.lists || board.lists.length === 0) return null;
    for (const listName of PREFERRED_LIST_NAMES) {
      const found = board.lists.find(l => l.name?.toLowerCase() === listName.toLowerCase());
      if (found) return found.id;
    }
    return board.lists[0].id;
  };

  // --- ОБРАБОТЧИКИ НАЖАТИЙ ---

  const handleBoardToggle = (board) => {
    setSelectedBoards(prev => {
      const newState = { ...prev };
      if (newState[board.id]) {
        delete newState[board.id];
      } else {
        const listId = findDefaultListId(board);
        if (listId) newState[board.id] = listId;
      }
      return newState;
    });
  };

  const handleProjectToggle = (project) => {
    const allSelected = project.boards.length > 0 && project.boards.every(b => selectedBoards[b.id]);
    setSelectedBoards(prev => {
      const newState = { ...prev };
      project.boards.forEach(board => {
        if (allSelected) {
          delete newState[board.id];
        } else {
          const listId = findDefaultListId(board);
          if (listId) newState[board.id] = listId;
        }
      });
      return newState;
    });
  };

  const handleListChange = (boardId, newListId) => {
    setSelectedBoards(prev => ({ ...prev, [boardId]: newListId }));
  };

  const toggleProjectExpand = (projectId) => {
    setExpandedProjectIds(prev => 
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
  };

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

  const handleDeselectAll = () => setSelectedBoards({});

  // --- UI ФИЛЬТРАЦИЯ ---
  const filteredProjects = useMemo(() => {
    if (!filterText) return dataTree;
    const lowerFilter = filterText.toLowerCase();

    return dataTree.reduce((acc, project) => {
      const nameMatches = project.name?.toLowerCase().includes(lowerFilter);
      const categoryMatches = project.categories && project.categories.some(cat => 
        cat.toLowerCase().includes(lowerFilter)
      );

      const projectMatches = nameMatches || categoryMatches;
      const matchingBoards = project.boards.filter(b => b.name?.toLowerCase().includes(lowerFilter));
      
      if (projectMatches) {
        acc.push(project);
      } else if (matchingBoards.length > 0) {
        acc.push({ ...project, boards: matchingBoards });
      }
      return acc;
    }, []);
  }, [dataTree, filterText]);

  useEffect(() => {
    if (filterText) setExpandedProjectIds(filteredProjects.map(p => p.id));
  }, [filterText, filteredProjects]);


  // --- МЕТКИ (ЛОГИКА БЕЗ ДУБЛЕЙ) ---

  const handleLabelAddition = (e, { value }) => {
    setLabelOptions((prev) => {
      // Проверяем, существует ли уже такая метка в опциях
      if (prev.some(opt => opt.value === value)) return prev;
      
      const randomColor = LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)];
      return [{ key: value, text: value, value: value, color: randomColor }, ...prev];
    });
  };

  const handleLabelChange = (e, { value }) => {
    setSelectedLabels(value); // value — это массив строк (выбранных значений)
  };

  // --- ОТПРАВКА ---

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return;

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
      
      // Собираем payload для меток, находя цвета в опциях
      const labelsPayload = selectedLabels.map(val => {
        const option = labelOptions.find(opt => opt.value === val);
        return {
          name: val,
          color: option ? option.color : 'grey'
        };
      });

      const { item } = await api.createMasterTask({
        name,
        description,
        targets: targetsPayload,
        labels: labelsPayload,
        userIds: currentUser ? [currentUser.id] : []
      }, headers);

      onCreate(item);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Ошибка создания');
    } finally {
      setSubmitting(false);
    }
  }, [name, description, selectedBoards, selectedLabels, labelOptions, currentUser, onCreate, onClose]);

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
              value={selectedLabels}
              onAddItem={handleLabelAddition}
              onChange={handleLabelChange}
              renderLabel={(label) => ({ color: label.color, content: label.text })}
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
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
               <Input 
                 icon="search" 
                 placeholder="Поиск по проектам (имя, категория) и доскам..." 
                 value={filterText}
                 onChange={(e) => setFilterText(e.target.value)}
                 style={{ flex: 1 }}
               />
               <Button size="tiny" onClick={handleSelectAll}>Выбрать все</Button>
               <Button size="tiny" onClick={handleDeselectAll}>Снять все</Button>
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '10px', background: '#fafafa' }}>
              {isLoadingData ? (
                 <div style={{textAlign:'center', color:'#999', padding: '20px'}}>Загрузка проектов...</div>
              ) : filteredProjects.length === 0 ? (
                 <div style={{textAlign:'center', color:'#999', padding: '20px'}}>Ничего не найдено</div>
              ) : (
                filteredProjects.map(project => {
                  const allSelected = project.boards.length > 0 && project.boards.every(b => selectedBoards[b.id]);
                  const someSelected = project.boards.some(b => selectedBoards[b.id]);
                  const isExpanded = expandedProjectIds.includes(project.id);

                  return (
                    <div key={project.id} style={{ marginBottom: '5px', background: 'white', border: '1px solid #eee', borderRadius: '4px' }}>
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
                        <div 
                          style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', flex: 1, userSelect: 'none' }}
                          onClick={() => toggleProjectExpand(project.id)}
                        >
                          <span style={{ fontWeight: 'bold' }}>{project.name}</span>
                          {project.categories && project.categories.length > 0 && (
                            <span style={{ fontSize: '0.8em', color: '#666', marginTop: '2px' }}>
                              {project.categories.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ padding: '5px 10px 5px 35px' }}>
                          {project.boards.map(board => {
                            const isSelected = !!selectedBoards[board.id];
                            const listOptions = board.lists.map(l => ({ key: l.id, value: l.id, text: l.name }));

                            return (
                              <div key={board.id} style={{ display: 'flex', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f9f9f9' }}>
                                <Checkbox 
                                  checked={isSelected}
                                  onChange={() => handleBoardToggle(board)}
                                  label={board.name}
                                  style={{ flex: '0 0 40%' }}
                                />
                                {isSelected && (
                                  <div style={{ flex: 1, paddingLeft: '10px' }}>
                                    <Dropdown 
                                      inline
                                      options={listOptions}
                                      value={selectedBoards[board.id]}
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
                })
              )}
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