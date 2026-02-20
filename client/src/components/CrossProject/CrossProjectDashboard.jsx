import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux'; // <-- Добавили для поиска карточек
import { Button, Header, Icon, Loader, Segment, Progress, Message, Menu, Label, Popup } from 'semantic-ui-react';
import * as api from '../../api/master-tasks';
import socket from '../../api/socket';
import * as AccessTokenStorage from '../../utils/access-token-storage';
import history from '../../history'; // <-- Добавили для перехода в карточку
import styles from './CrossProjectDashboard.module.scss';
import CreateMasterTaskModal from './CreateMasterTaskModal';

const CrossProjectDashboard = () => {
  // Получаем ВСЕ карточки, которые загружены в браузере (Redux)
  const allCards = useSelector(state => state.cards ? Object.values(state.cards.items) : []);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    loadTasks();
  }, []);

  const getHeaders = () => ({
    Authorization: `Bearer ${AccessTokenStorage.getAccessToken()}`,
  });

  const loadTasks = async () => {
    try {
      setLoading(true);
      const { items } = await api.getMasterTasks(getHeaders());
      setTasks(items || []);
    } catch (err) {
      console.error("Failed to load tasks", err);
      setError("Не удалось загрузить список задач.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = (newTask) => {
    setTasks([newTask, ...tasks]);
    setActiveTab('active');
  };

  const handleArchive = async (task) => {
    try {
      const newStatus = task.status === 'archived' ? 'active' : 'archived';
      await socket.patch(`/master-tasks/${task.id}`, { status: newStatus }, getHeaders());
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    } catch (err) {
      console.error(err);
      alert('Ошибка при обновлении статуса');
    }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Вы уверены? Задачи на досках останутся, но связь пропадет.')) {
      return;
    }
    try {
      await socket.delete(`/master-tasks/${taskId}`, undefined, getHeaders());
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error(err);
      alert('Ошибка при удалении');
    }
  };

  // === НОВАЯ ФУНКЦИЯ: Открытие модалки карточки ===
  const handleOpenTask = (task) => {
    // Теперь мы берем ID прямо из того, что прислал сервер!
    if (task.linkedBoardId && task.linkedCardId) {
      history.push(`/boards/${task.linkedBoardId}/cards/${task.linkedCardId}`);
    } else {
      alert('Связанная карточка не найдена. Возможно, она удалена с досок.');
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'active') return task.status !== 'archived';
    return task.status === 'archived';
  });

  if (loading) {
    return (
      <div className={styles.wrapper} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Loader active size="large" inverted>Загрузка задач...</Loader>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <CreateMasterTaskModal 
        open={isModalOpen} 
        onClose={() => setModalOpen(false)} 
        onCreate={handleCreate} 
      />

      <div className={styles.header}>
        <Header as="h1" inverted style={{ margin: 0 }}>
          <Header.Content>
            Кросс-проектные задачи
            <Header.Subheader style={{ color: '#6d7988', marginTop: '5px' }}>
              Управление глобальными целями
            </Header.Subheader>
          </Header.Content>
        </Header>
        
        <Button 
          primary
          size="medium"
          icon
          labelPosition="left" 
          onClick={() => setModalOpen(true)}
          style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}
        >
          <Icon name="plus" /> Создать задачу
        </Button>
      </div>

      {error && <Message error content={error} />}

      <Menu secondary pointing inverted className={styles.tabs}>
        <Menu.Item
          name='Активные'
          active={activeTab === 'active'}
          onClick={() => setActiveTab('active')}
        />
        <Menu.Item
          name='Архив'
          active={activeTab === 'archived'}
          onClick={() => setActiveTab('archived')}
        />
      </Menu>

      <div className={styles.content}>
        {filteredTasks.length === 0 ? (
          <Segment placeholder basic className={styles.emptyState}>
            <Header icon inverted>
              <Icon name={activeTab === 'active' ? 'clipboard check' : 'archive'} />
              {activeTab === 'active' ? 'Все задачи выполнены' : 'Архив пуст'}
              <Header.Subheader>
                {activeTab === 'active' 
                  ? 'Создайте новую мастер-задачу, чтобы начать отслеживание прогресса.' 
                  : 'Здесь будут храниться завершенные и скрытые задачи.'}
              </Header.Subheader>
            </Header>
          </Segment>
        ) : (
          <div className={styles.taskList}>
            {filteredTasks.map((task) => (
              <div 
                key={task.id} 
                className={styles.taskCard} 
                onClick={() => handleOpenTask(task)} 
                style={{ cursor: 'pointer' }} // <-- Добавили указатель мыши
              >
                
                {/* Верх: Заголовок и Статус */}
                <div>
                  <div className={styles.cardHeader}>
                    <h3 title={task.name}>{task.name}</h3>
                    {task.status === 'completed' ? (
                      <Label color="green" className={styles.statusBadge}>Готово</Label>
                    ) : (
                      <Label color="blue" basic className={styles.statusBadge}>В работе</Label>
                    )}
                  </div>

                {task.labels && task.labels.length > 0 && (
                    <div style={{ marginBottom: '15px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {task.labels.map((label, idx) => (
                        <Label 
                          key={idx} 
                          color={label.color} 
                          size="tiny" 
                          style={{ borderRadius: '4px', opacity: 0.9 }}
                        >
                          {label.name}
                        </Label>
                      ))}
                    </div>
                  )}

                  <div className={styles.description}>
                    {task.description || "Нет описания"}
                  </div>
                </div>

                {/* Низ: Прогресс и Кнопки */}
                <div className={styles.cardFooter}>
                  <div className={styles.metrics}>
                    <div className={styles.progressText}>
                      <span>Прогресс</span>
                      <span>{task.progress}%</span>
                    </div>
                    <Progress 
                      percent={task.progress} 
                      inverted 
                      color={task.progress === 100 ? 'green' : 'blue'} 
                      size="tiny" 
                      style={{ margin: 0 }}
                    />
                  </div>

                  <div className={styles.actions}>
                    <Popup
                      content={task.status === 'archived' ? "Вернуть" : "В архив"}
                      position="top center"
                      trigger={
                        <Button 
                          icon={task.status === 'archived' ? "undo" : "archive"} 
                          size="mini" 
                          inverted 
                          basic
                          color={task.status === 'archived' ? "green" : "grey"}
                          onClick={(e) => { 
                            e.stopPropagation(); // <-- Чтобы клик по кнопке не открывал карточку
                            handleArchive(task); 
                          }}
                        />
                      }
                    />
                    
                    <Popup
                      content="Удалить"
                      position="top center"
                      trigger={
                        <Button 
                          icon="trash" 
                          size="mini" 
                          inverted 
                          basic 
                          color="red"
                          onClick={(e) => { 
                            e.stopPropagation(); // <-- Чтобы клик по кнопке не открывал карточку
                            handleDelete(task.id); 
                          }}
                        />
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CrossProjectDashboard;