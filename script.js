document.addEventListener('DOMContentLoaded', () => {
    // Configurações do Supabase (COLOQUE SUAS CREDENCIAIS AQUI)
    const SUPABASE_URL = 'https://jodgaradzeyoqgiwivty.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_08nasEG6jbI06xAh_WWW5g_6wU21j97';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // State
    let tasks = [];
    let tags = [];
    let taskToReschedule = null;
    let showCompletedGroups = JSON.parse(localStorage.getItem('daily_show_completed_groups')) || {};

    // Elements
    const fabAddTask = document.getElementById('fab-add-task');
    const addTaskModal = document.getElementById('add-task-modal');
    const cancelAddTaskBtn = document.getElementById('cancel-add-task');

    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const requesterInput = document.getElementById('requester-input');
    const taskNotes = document.getElementById('task-notes');
    const dateInput = document.getElementById('date-input');
    const tasksContainer = document.getElementById('tasks-container');

    const tagSelect = document.getElementById('tag-select');
    const addTagBtn = document.getElementById('add-tag-btn');

    const modalOverlay = document.getElementById('reschedule-modal');
    const rescheduleDateInput = document.getElementById('reschedule-date-input');
    const btnCancelReschedule = document.getElementById('cancel-reschedule');
    const btnConfirmReschedule = document.getElementById('confirm-reschedule');
    const rescheduleTaskName = document.getElementById('reschedule-task-name');

    const tagModal = document.getElementById('tag-modal');
    const newTagName = document.getElementById('new-tag-name');
    const newTagColor = document.getElementById('new-tag-color');
    const btnCancelTag = document.getElementById('cancel-tag');
    const btnConfirmTag = document.getElementById('confirm-tag');

    const editModal = document.getElementById('edit-modal');
    const editTaskInput = document.getElementById('edit-task-input');
    const editRequesterInput = document.getElementById('edit-requester-input');
    const editTaskNotes = document.getElementById('edit-task-notes');
    const editDateInput = document.getElementById('edit-date-input');
    const editTagSelect = document.getElementById('edit-tag-select');
    const editSubtasksList = document.getElementById('edit-subtasks-list');
    const newSubtaskInput = document.getElementById('new-subtask-input');
    const addSubtaskBtn = document.getElementById('add-subtask-btn');
    const btnCancelEdit = document.getElementById('cancel-edit');
    const btnConfirmEdit = document.getElementById('confirm-edit');
    let taskToEdit = null;
    let currentEditSubtasks = [];

    const newTaskSubtasksList = document.getElementById('new-task-subtasks-list');
    const addSubtaskInput = document.getElementById('add-subtask-input');
    const directAddSubtaskBtn = document.getElementById('direct-add-subtask-btn');
    let currentNewTaskSubtasks = [];

    // Initialize dates
    const today = new Date();
    const todayStr = formatToYYYYMMDD(today);
    dateInput.value = todayStr;

    // Load initial data
    loadTasks();

    // Functions
    function getDragAfterElement(container, y, itemSelector) {
        const draggableElements = [...container.querySelectorAll(`${itemSelector}:not(.dragging)`)];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function formatToYYYYMMDD(date) {
        return date.toISOString().split('T')[0];
    }

    function parseYYYYMMDD(dateStr) {
        const [year, month, day] = dateStr.split('-');
        return new Date(year, month - 1, day);
    }

    function getRelativeDateLabel(dateStr) {
        if (!dateStr) return "Backlog";
        const todayDateStr = formatToYYYYMMDD(new Date());

        let tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowDateStr = formatToYYYYMMDD(tomorrow);

        let yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayDateStr = formatToYYYYMMDD(yesterday);

        if (dateStr === todayDateStr) return "Hoje";
        if (dateStr === tomorrowDateStr) return "Amanhã";
        if (dateStr === yesterdayDateStr) return "Ontem";

        const parsedDate = parseYYYYMMDD(dateStr);
        return parsedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
    }

    // Backend / Storage integrations
    async function loadTasks() {
        try {
            // Buscando as Tags do Supabase
            const { data: tagsData, error: tagsErr } = await supabase.from('tags').select('*');
            if (tagsErr) throw tagsErr;
            tags = tagsData || [];

            // Buscando as Tasks + Subtasks ligadas a ela
            const { data: tasksData, error: tasksErr } = await supabase.from('tasks').select('*, subtasks(*)');
            if (tasksErr) throw tasksErr;

            // Formata o array para voltar a comportar os objetos subtasks diretamente na task
            tasks = (tasksData || []).map(t => {
                // garante que exista array pelo menos
                t.subtasks = t.subtasks || [];
                return t;
            });
        } catch (err) {
            console.warn(err.message, "- Fallback para localStorage Ativado");
            const localDataTasks = localStorage.getItem('daily_tasks');

            if (localDataTasks) {
                const parsed = JSON.parse(localDataTasks);
                if (Array.isArray(parsed)) {
                    tasks = parsed;
                } else {
                    tasks = parsed.tasks || [];
                    tags = parsed.tags || [];
                }
            }
        }

        renderTags();
        renderTasks();
    }

    async function saveTasks() {
        try {
            // Upsert tags
            if (tags.length > 0) {
                await supabase.from('tags').upsert(tags.map(t => ({
                    id: t.id, name: t.name, color: t.color
                })));
            }

            // Upsert tasks
            if (tasks.length > 0) {
                const tasksPayload = tasks.map(t => ({
                    id: t.id,
                    title: t.title,
                    date: t.date || null,
                    completed: Boolean(t.completed),
                    tagId: t.tagId || null,
                    requesters: t.requesters || [],
                    completedDate: t.completedDate || null
                }));
                await supabase.from('tasks').upsert(tasksPayload);

                // Upsert subtasks
                let allSubtasks = [];
                tasks.forEach(t => {
                    if (t.subtasks && t.subtasks.length > 0) {
                        t.subtasks.forEach(st => {
                            allSubtasks.push({
                                id: st.id,
                                taskId: t.id,
                                title: st.title,
                                completed: Boolean(st.completed),
                                completedDate: st.completedDate || null
                            });
                        });
                    }
                });

                if (allSubtasks.length > 0) {
                    await supabase.from('subtasks').upsert(allSubtasks);
                }
            }
        } catch (err) {
            console.warn("Falha ao salvar no banco Supabase:", err);
        }

        // Fallback de segurança local
        const payload = { tasks, tags };
        localStorage.setItem('daily_tasks', JSON.stringify(payload));

        renderTasks();
    }

    function renderTags() {
        if (!tagSelect) return;
        const currentVal = tagSelect.value;
        tagSelect.innerHTML = '<option value="">Sem etiqueta</option>';
        if (editTagSelect) {
            editTagSelect.innerHTML = '<option value="">Sem etiqueta</option>';
        }

        tags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag.id;
            option.textContent = tag.name;
            tagSelect.appendChild(option);

            if (editTagSelect) {
                const editOption = document.createElement('option');
                editOption.value = tag.id;
                editOption.textContent = tag.name;
                editTagSelect.appendChild(editOption);
            }
        });
        tagSelect.value = currentVal;
    }

    function renderTasks() {
        tasksContainer.innerHTML = '';

        // Groups definition
        const todayStr = formatToYYYYMMDD(new Date());

        const groups = {
            'backlog': { label: 'Backlog', icon: 'ph-stack', tasks: [] },
            'pendentes': { label: 'Pendentes', icon: 'ph-warning-circle', tasks: [] },
            'hoje': { label: 'Hoje', icon: 'ph-calendar-check', tasks: [] },
            'planejados': { label: 'Planejados', icon: 'ph-calendar-plus', tasks: [] },
            'concluidos': { label: 'Concluídos', icon: 'ph-check-circle', tasks: [] }
        };

        tasks.forEach(task => {
            let groupKey = '';

            if (task.completed) {
                groupKey = 'concluidos';
            } else if (!task.date) {
                groupKey = 'backlog';
            } else if (task.date < todayStr) {
                groupKey = 'pendentes';
            } else if (task.date === todayStr) {
                groupKey = 'hoje';
            } else {
                groupKey = 'planejados';
            }

            groups[groupKey].tasks.push(task);
        });

        groups['concluidos'].tasks.sort((a, b) => {
            let dateA = a.completedDate || '';
            let dateB = b.completedDate || '';
            if (dateA === dateB) {
                return (b.id || '').localeCompare(a.id || ''); // fallback
            }
            return dateB.localeCompare(dateA);
        });

        const order = ['backlog', 'pendentes', 'hoje', 'planejados', 'concluidos'];
        let hasRenderedTask = false;

        order.forEach(groupKey => {
            const groupData = groups[groupKey];
            let isShowingCompleted = showCompletedGroups[groupKey] || false;

            const dateTasks = groupData.tasks.filter(task => isShowingCompleted || !task.completed);

            hasRenderedTask = hasRenderedTask || (dateTasks.length > 0);

            const groupDiv = document.createElement('div');
            groupDiv.className = 'date-group';

            const header = document.createElement('div');
            header.className = 'date-header';
            header.style.display = "flex";
            header.style.alignItems = "center";
            header.style.justifyContent = "space-between";
            header.style.cursor = "pointer";

            header.innerHTML = `
                <div style="display: flex; align-items: center; gap: 6px;">
                    <i class="ph ${groupData.icon} ph-lg"></i> ${groupData.label} <span style="font-size: 0.75rem; background: var(--bg-dark); padding: 2px 6px; border-radius: 10px; margin-left: 4px;">${dateTasks.length}</span>
                </div>
                <button class="toggle-show-completed-btn btn-icon" title="${isShowingCompleted ? 'Ocultar Concluídas' : 'Mostrar Concluídas'}" style="background: transparent; border: none; padding: 2px; color: var(--text-muted);">
                    <i class="ph ${isShowingCompleted ? 'ph-eye' : 'ph-eye-slash'} ph-lg"></i>
                </button>
            `;

            header.addEventListener('click', (e) => {
                isShowingCompleted = !isShowingCompleted;
                showCompletedGroups[groupKey] = isShowingCompleted;
                localStorage.setItem('daily_show_completed_groups', JSON.stringify(showCompletedGroups));
                renderTasks();
            });

            groupDiv.appendChild(header);

            const list = document.createElement('ul');
            list.className = 'task-list';
            list.dataset.date = groupKey;

            // Drag and drop event listeners on the list for tasks
            list.addEventListener('dragover', e => {
                e.preventDefault();
                // Only style if dragging a task
                if (e.dataTransfer.types.includes('task')) {
                    groupDiv.classList.add('drag-over');
                    const afterElement = getDragAfterElement(list, e.clientY, '.task-item');
                    const draggingTask = document.querySelector('.dragging');
                    if (draggingTask && draggingTask.classList.contains('task-item')) {
                        if (afterElement == null) {
                            list.appendChild(draggingTask);
                        } else {
                            list.insertBefore(draggingTask, afterElement);
                        }
                    }
                }
            });
            list.addEventListener('dragleave', e => {
                groupDiv.classList.remove('drag-over');
            });
            list.addEventListener('drop', e => {
                e.preventDefault();
                groupDiv.classList.remove('drag-over');

                // Handling Task Drop
                const draggedId = e.dataTransfer.getData('task');
                if (draggedId) {
                    const afterElement = getDragAfterElement(list, e.clientY, '.task-item');
                    const targetId = afterElement ? afterElement.dataset.id : null;
                    moveTask(draggedId, groupKey, targetId);
                }
            });

            dateTasks.forEach(task => {
                const li = document.createElement('li');
                li.className = `task-item ${task.completed ? 'completed' : ''}`;
                li.dataset.id = task.id;
                li.draggable = true;

                const taskTag = tags.find(t => t.id === task.tagId);

                // Function to determine if white or black text is better for a given hex background
                const getContrastYIQ = (hexcolor) => {
                    const hex = hexcolor.replace('#', '');
                    const r = parseInt(hex.substr(0, 2), 16);
                    const g = parseInt(hex.substr(2, 2), 16);
                    const b = parseInt(hex.substr(4, 2), 16);
                    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                    return (yiq >= 128) ? '#000000' : '#ffffff';
                };

                const tagBadgeHtml = taskTag ? `<span class="task-tag" style="background-color: ${taskTag.color}; color: ${getContrastYIQ(taskTag.color)}; border: 1px solid ${taskTag.color};">${taskTag.name}</span>` : '';

                const requestersHtml = (task.requesters && task.requesters.length > 0)
                    ? `<div class="requester-area">
                        ${task.requesters.map(req => `<span class="requester-badge"><i class="ph ph-user"></i> ${req}</span>`).join('')}
                       </div>`
                    : '';

                const notesHtml = task.notes
                    ? `<div class="task-notes-display" style="font-size: 0.8rem; color: var(--text-muted); padding: 6px 8px; background: rgba(0,0,0,0.03); border-radius: 4px; margin-top: 6px; border-left: 2px solid var(--border);">${task.notes.replace(/\n/g, '<br>')}</div>`
                    : '';

                li.innerHTML = `
                    <div class="task-content">
                        <div style="display: flex; gap: 6px; align-items: flex-start; justify-content: space-between;">
                            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                                ${tagBadgeHtml}
                                <span class="task-text">${task.title}</span>
                            </div>
                            <label class="switch-wrapper" title="Marcar como concluída">
                                <input type="checkbox" class="switch-custom" ${task.completed ? 'checked' : ''} />
                                <span class="switch-slider"></span>
                            </label>
                        </div>
                        ${requestersHtml}
                        ${notesHtml}
                        <div class="subtasks-container" style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px;"></div>
                    </div>
                    <div class="task-actions" style="flex-direction: column; justify-content: flex-start;">
                        <button class="btn-icon edit-btn" title="Editar">
                            <i class="ph ph-pencil-simple ph-lg"></i>
                        </button>
                        <button class="btn-icon reschedule-btn" title="Remarcar">
                            <i class="ph ph-calendar ph-lg"></i>
                        </button>
                        <button class="btn-icon delete delete-btn" title="Excluir">
                            <i class="ph ph-trash ph-lg"></i>
                        </button>
                    </div>
                `;

                // Render subtasks as true DOM elements to support DND
                const subtasksContainer = li.querySelector('.subtasks-container');
                if (task.subtasks && task.subtasks.length > 0) {
                    task.subtasks.forEach(st => {
                        const stId = st.id;
                        const stLabel = document.createElement('label');
                        stLabel.className = 'subtask-item';
                        stLabel.draggable = true;
                        stLabel.dataset.stId = stId;
                        stLabel.style.display = 'flex';
                        stLabel.style.alignItems = 'center';
                        stLabel.style.gap = '6px';
                        stLabel.style.cursor = 'grab';
                        stLabel.style.fontSize = '0.85rem';
                        stLabel.style.padding = '2px';
                        stLabel.style.borderRadius = '4px';

                        stLabel.innerHTML = `
                            <i class="ph ph-dots-six-vertical" style="color: var(--text-muted); cursor: grab;"></i>
                            <input type="checkbox" class="subtask-checkbox checkbox-custom" style="width: 16px; height: 16px;" data-task-id="${task.id}" data-subtask-id="${st.id}" ${st.completed ? 'checked' : ''} />
                            <span style="${st.completed ? 'text-decoration: line-through; color: var(--text-muted);' : ''} flex: 1;" title="${st.title}">${st.title}</span>
                            <input type="date" class="subtask-date-input" title="Data de conclusão" value="${st.completedDate || ''}" style="width: auto; padding: 2px 4px; font-size: 0.75rem; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-dark); color: var(--text-muted); ${st.completed ? '' : 'display: none;'}" />
                        `;

                        // Drag start/end for subtasks
                        stLabel.addEventListener('dragstart', (e) => {
                            e.stopPropagation(); // prevent dragging parent task
                            e.dataTransfer.setData('subtask', st.id);
                            e.dataTransfer.setData('parentTask', task.id);
                            setTimeout(() => stLabel.classList.add('dragging'), 0);
                        });
                        stLabel.addEventListener('dragend', (e) => {
                            e.stopPropagation();
                            stLabel.classList.remove('dragging');
                        });

                        const cb = stLabel.querySelector('.subtask-checkbox');
                        const dateInput = stLabel.querySelector('.subtask-date-input');
                        cb.addEventListener('change', (e) => {
                            st.completed = e.target.checked;
                            const span = stLabel.querySelector('span');
                            if (st.completed) {
                                span.style.textDecoration = 'line-through';
                                span.style.color = 'var(--text-muted)';
                                if (!st.completedDate) {
                                    st.completedDate = formatToYYYYMMDD(new Date());
                                }
                                dateInput.value = st.completedDate;
                                dateInput.style.display = 'inline-block';
                            } else {
                                span.style.textDecoration = 'none';
                                span.style.color = 'inherit';
                                dateInput.style.display = 'none';
                                st.completedDate = null;
                            }
                            saveTasks();
                        });
                        dateInput.addEventListener('mousedown', e => e.stopPropagation()); // prevent drag on click
                        dateInput.addEventListener('change', (e) => {
                            st.completedDate = e.target.value;
                            saveTasks();
                        });

                        subtasksContainer.appendChild(stLabel);
                    });

                    // Subtasks dragover and drop
                    subtasksContainer.addEventListener('dragover', e => {
                        e.preventDefault();
                        if (e.dataTransfer.types.includes('subtask')) {
                            const afterElement = getDragAfterElement(subtasksContainer, e.clientY, '.subtask-item');
                            const draggingSt = document.querySelector('.subtask-item.dragging');
                            if (draggingSt) {
                                if (afterElement == null) {
                                    subtasksContainer.appendChild(draggingSt);
                                } else {
                                    subtasksContainer.insertBefore(draggingSt, afterElement);
                                }
                            }
                        }
                    });

                    subtasksContainer.addEventListener('drop', e => {
                        e.preventDefault();
                        e.stopPropagation();
                        const draggedStId = e.dataTransfer.getData('subtask');
                        const pTaskId = e.dataTransfer.getData('parentTask');
                        if (draggedStId && pTaskId === task.id) {
                            const afterElement = getDragAfterElement(subtasksContainer, e.clientY, '.subtask-item');
                            const targetStId = afterElement ? afterElement.dataset.stId : null;
                            moveSubtask(task.id, draggedStId, targetStId);
                        }
                    });
                }

                // Drag start/end events for main task
                li.addEventListener('dragstart', (e) => {
                    // Prevent if what we drag is actually a subtask
                    if (e.target === li) {
                        e.dataTransfer.setData('task', task.id);
                        setTimeout(() => li.classList.add('dragging'), 0);
                    }
                });
                li.addEventListener('dragend', () => {
                    li.classList.remove('dragging');
                });

                // Event Listeners
                const checkbox = li.querySelector('.switch-custom');
                checkbox.addEventListener('change', (e) => toggleTaskStatus(task.id, e.target.checked));

                const delBtn = li.querySelector('.delete-btn');
                delBtn.addEventListener('click', () => deleteTask(task.id));

                const resBtn = li.querySelector('.reschedule-btn');
                resBtn.addEventListener('click', () => openRescheduleModal(task.id));

                const editBtn = li.querySelector('.edit-btn');
                if (editBtn) editBtn.addEventListener('click', () => openEditModal(task.id));

                list.appendChild(li);
            });

            groupDiv.appendChild(list);
            tasksContainer.appendChild(groupDiv);
        });

        if (!hasRenderedTask) {
            tasksContainer.innerHTML = '<div style="text-align:center;color:var(--text-muted);margin-top:24px;font-size:0.9rem;">Nenhuma atividade cadastrada ou todas estão concluídas.</div>';
        }
    }

    // Handlers
    function addTask(e) {
        e.preventDefault();
        const title = taskInput.value.trim();
        const date = dateInput.value;
        const tagId = tagSelect ? tagSelect.value : '';
        const reqVal = requesterInput ? requesterInput.value.trim() : '';
        const notes = taskNotes ? taskNotes.value.trim() : '';

        if (!title) return;

        const requesters = reqVal ? reqVal.split(',').map(r => r.trim()).filter(Boolean) : [];

        const newTask = {
            id: Date.now().toString(),
            title,
            date: date || '',
            tagId,
            requesters,
            notes,
            subtasks: [...currentNewTaskSubtasks],
            completed: false
        };

        tasks.push(newTask);
        saveTasks();

        taskInput.value = '';
        if (requesterInput) requesterInput.value = '';
        if (taskNotes) taskNotes.value = '';
        currentNewTaskSubtasks = [];
        renderNewTaskSubtasks();
        closeAddTaskModal();
    }

    function toggleTaskStatus(id, isCompleted) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = isCompleted;
            if (isCompleted) {
                task.completedDate = formatToYYYYMMDD(new Date());
            } else {
                task.completedDate = null;
            }
            saveTasks();
        }
    }

    function deleteTask(id) {
        tasks = tasks.filter(t => t.id !== id);
        // Exclui diretamente da base
        supabase.from('tasks').delete().eq('id', id).then(() => {
            saveTasks();
        }).catch(err => {
            console.error("Erro ao deletar do Supabase:", err);
            saveTasks();
        });
    }

    function moveTask(id, targetDate, targetId = null) {
        const taskIndex = tasks.findIndex(t => t.id === id);
        if (taskIndex > -1) {
            const task = tasks.splice(taskIndex, 1)[0];

            const todayStr = formatToYYYYMMDD(new Date());

            if (targetDate === 'concluidos') {
                task.completed = true;
                if (!task.completedDate) {
                    task.completedDate = todayStr;
                }
            } else {
                task.completed = false;
                task.completedDate = null;
                if (targetDate === 'backlog') {
                    task.date = '';
                } else if (targetDate === 'hoje') {
                    task.date = todayStr;
                } else if (targetDate === 'pendentes') {
                    if (!task.date || task.date >= todayStr) {
                        let y = new Date(); y.setDate(y.getDate() - 1);
                        task.date = formatToYYYYMMDD(y);
                    }
                } else if (targetDate === 'planejados') {
                    if (!task.date || task.date <= todayStr) {
                        let tm = new Date(); tm.setDate(tm.getDate() + 1);
                        task.date = formatToYYYYMMDD(tm);
                    }
                } else {
                    task.date = targetDate;
                }
            }

            if (targetId) {
                const targetIndex = tasks.findIndex(t => t.id === targetId);
                if (targetIndex > -1) {
                    tasks.splice(targetIndex, 0, task);
                } else {
                    tasks.push(task);
                }
            } else {
                tasks.push(task);
            }
            saveTasks();
        }
    }

    function moveSubtask(taskId, subtaskId, targetSubtaskId = null) {
        const task = tasks.find(t => t.id === taskId);
        if (task && task.subtasks) {
            const stIndex = task.subtasks.findIndex(s => s.id === subtaskId);
            if (stIndex > -1) {
                const st = task.subtasks.splice(stIndex, 1)[0];
                if (targetSubtaskId) {
                    const targetIndex = task.subtasks.findIndex(s => s.id === targetSubtaskId);
                    if (targetIndex > -1) {
                        task.subtasks.splice(targetIndex, 0, st);
                    } else {
                        task.subtasks.push(st);
                    }
                } else {
                    task.subtasks.push(st);
                }
                saveTasks();
            }
        }
    }

    function openRescheduleModal(id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            taskToReschedule = id;
            rescheduleTaskName.textContent = task.title;
            rescheduleDateInput.value = task.date;
            modalOverlay.classList.add('active');
            rescheduleDateInput.focus();
        }
    }

    function closeRescheduleModal() {
        modalOverlay.classList.remove('active');
        taskToReschedule = null;
    }

    function confirmReschedule() {
        if (!taskToReschedule || !rescheduleDateInput.value) return;

        const task = tasks.find(t => t.id === taskToReschedule);
        if (task) {
            task.date = rescheduleDateInput.value;
            saveTasks();
        }
        closeRescheduleModal();
    }

    function openTagModal() {
        newTagName.value = '';
        newTagColor.value = '#3b82f6';
        tagModal.classList.add('active');
        newTagName.focus();
    }

    function closeTagModal() {
        tagModal.classList.remove('active');
    }

    function confirmTagCreation() {
        const name = newTagName.value.trim();
        const color = newTagColor.value;
        if (!name) return;

        const newTag = {
            id: Date.now().toString(),
            name,
            color
        };
        tags.push(newTag);
        saveTasks();
        renderTags();

        if (tagSelect) tagSelect.value = newTag.id;
        closeTagModal();
    }

    function openEditModal(id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            taskToEdit = id;
            editTaskInput.value = task.title;
            if (editRequesterInput) editRequesterInput.value = (task.requesters && task.requesters.length > 0) ? task.requesters.join(', ') : '';
            if (editTaskNotes) editTaskNotes.value = task.notes || '';
            editDateInput.value = task.date;
            editTagSelect.value = task.tagId || '';
            currentEditSubtasks = task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : [];
            renderEditSubtasks();
            editModal.classList.add('active');
            editTaskInput.focus();
        }
    }

    function renderEditSubtasks() {
        if (!editSubtasksList) return;
        editSubtasksList.innerHTML = '';
        currentEditSubtasks.forEach(st => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.gap = '8px';
            div.style.alignItems = 'center';
            div.innerHTML = `
                <input type="checkbox" class="checkbox-custom" style="width: 16px; height: 16px; border-radius: 4px;" ${st.completed ? 'checked' : ''} />
                <span style="flex: 1; font-size: 0.85rem; ${st.completed ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">${st.title}</span>
                <button type="button" class="btn-icon" style="padding: 2px; color: var(--danger)" title="Excluir">
                    <i class="ph ph-trash"></i>
                </button>
            `;
            const checkbox = div.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                st.completed = e.target.checked;
                renderEditSubtasks();
            });
            const delBtn = div.querySelector('.btn-icon');
            delBtn.addEventListener('click', () => {
                const subId = st.id;
                currentEditSubtasks = currentEditSubtasks.filter(s => s.id !== subId);
                // Exclui subtask da base do Supabase
                supabase.from('subtasks').delete().eq('id', subId).then(() => {
                    renderEditSubtasks();
                });
            });
            editSubtasksList.appendChild(div);
        });
    }

    function closeEditModal() {
        editModal.classList.remove('active');
        taskToEdit = null;
    }

    function confirmEdit() {
        if (!taskToEdit || !editTaskInput.value.trim()) return;

        const task = tasks.find(t => t.id === taskToEdit);
        if (task) {
            task.title = editTaskInput.value.trim();
            task.date = editDateInput.value;
            task.tagId = editTagSelect.value;

            if (editRequesterInput) {
                const reqVal = editRequesterInput.value.trim();
                task.requesters = reqVal ? reqVal.split(',').map(r => r.trim()).filter(Boolean) : [];
            }
            if (editTaskNotes) {
                task.notes = editTaskNotes.value.trim();
            }
            task.subtasks = currentEditSubtasks;
            saveTasks();
        }
        closeEditModal();
    }

    function openAddTaskModal() {
        addTaskModal.classList.add('active');
        taskInput.focus();
    }

    function closeAddTaskModal() {
        addTaskModal.classList.remove('active');
        taskInput.value = '';
        if (requesterInput) requesterInput.value = '';
        if (taskNotes) taskNotes.value = '';
        currentNewTaskSubtasks = [];
        renderNewTaskSubtasks();
    }

    function renderNewTaskSubtasks() {
        if (!newTaskSubtasksList) return;
        newTaskSubtasksList.innerHTML = '';
        currentNewTaskSubtasks.forEach(st => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.gap = '8px';
            div.style.alignItems = 'center';
            div.innerHTML = `
                <span style="flex: 1; font-size: 0.85rem; color: var(--text-primary);">• ${st.title}</span>
                <button type="button" class="btn-icon" style="padding: 2px; color: var(--danger)" title="Excluir">
                    <i class="ph ph-trash"></i>
                </button>
            `;
            const delBtn = div.querySelector('.btn-icon');
            delBtn.addEventListener('click', () => {
                currentNewTaskSubtasks = currentNewTaskSubtasks.filter(s => s.id !== st.id);
                renderNewTaskSubtasks();
            });
            newTaskSubtasksList.appendChild(div);
        });
    }

    // Attach base events
    if (fabAddTask) {
        fabAddTask.addEventListener('click', openAddTaskModal);
    }
    if (cancelAddTaskBtn) {
        cancelAddTaskBtn.addEventListener('click', closeAddTaskModal);
    }

    taskForm.addEventListener('submit', addTask);

    if (directAddSubtaskBtn) {
        directAddSubtaskBtn.addEventListener('click', () => {
            const val = addSubtaskInput.value.trim();
            if (val) {
                currentNewTaskSubtasks.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    title: val,
                    completed: false
                });
                addSubtaskInput.value = '';
                renderNewTaskSubtasks();
                addSubtaskInput.focus();
            }
        });
        addSubtaskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                directAddSubtaskBtn.click();
            }
        });
    }
    btnCancelReschedule.addEventListener('click', closeRescheduleModal);
    btnConfirmReschedule.addEventListener('click', confirmReschedule);

    if (addTagBtn) {
        addTagBtn.addEventListener('click', openTagModal);
    }
    if (btnCancelTag) {
        btnCancelTag.addEventListener('click', closeTagModal);
    }
    if (btnConfirmTag) {
        btnConfirmTag.addEventListener('click', confirmTagCreation);
    }
    if (btnCancelEdit) {
        btnCancelEdit.addEventListener('click', closeEditModal);
    }
    if (btnConfirmEdit) {
        btnConfirmEdit.addEventListener('click', confirmEdit);
    }
    if (addSubtaskBtn) {
        addSubtaskBtn.addEventListener('click', () => {
            const val = newSubtaskInput.value.trim();
            if (val) {
                currentEditSubtasks.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    title: val,
                    completed: false
                });
                newSubtaskInput.value = '';
                renderEditSubtasks();
                newSubtaskInput.focus();
            }
        });

        newSubtaskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addSubtaskBtn.click();
            }
        });
    }

    // Close modal on outside click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeRescheduleModal();
    });
    if (tagModal) {
        tagModal.addEventListener('click', (e) => {
            if (e.target === tagModal) closeTagModal();
        });
    }
    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) closeEditModal();
        });
    }
    if (addTaskModal) {
        addTaskModal.addEventListener('click', (e) => {
            if (e.target === addTaskModal) closeAddTaskModal();
        });
    }
});
