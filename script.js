document.addEventListener('DOMContentLoaded', () => {
    // Configurações do Supabase (COLOQUE SUAS CREDENCIAIS AQUI)
    const SUPABASE_URL = 'https://jodgaradzeyoqgiwivty.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_08nasEG6jbI06xAh_WWW5g_6wU21j97';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // State
    let tasks = [];
    let tags = [];
    let taskToReschedule = null;
    let columnDateFilters = { pendentes: '', concluidos: '' };
    window.ganttExpandedTasks = window.ganttExpandedTasks || new Set();

    // Elements
    const fabAddTask = document.getElementById('fab-add-task');
    const addTaskModal = document.getElementById('add-task-modal');
    const cancelAddTaskBtn = document.getElementById('cancel-add-task');

    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const taskAzureCode = document.getElementById('task-azure-code');
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
    const editTaskAzureCode = document.getElementById('edit-task-azure-code');
    const editRequesterInput = document.getElementById('edit-requester-input');
    const editTaskNotes = document.getElementById('edit-task-notes');
    const editDateInput = document.getElementById('edit-date-input');
    const editTagSelect = document.getElementById('edit-tag-select');
    const editSubtasksList = document.getElementById('edit-subtasks-list');
    const newSubtaskInput = document.getElementById('new-subtask-input');
    const newSubtaskAzure = document.getElementById('new-subtask-azure');
    const addSubtaskBtn = document.getElementById('add-subtask-btn');
    const btnCancelEdit = document.getElementById('cancel-edit');
    const btnConfirmEdit = document.getElementById('confirm-edit');
    
    const commentsList = document.getElementById('comments-list');
    const newCommentInput = document.getElementById('new-comment-input');
    const addCommentBtn = document.getElementById('add-comment-btn');
    
    let taskToEdit = null;
    let currentEditSubtasks = [];
    let currentEditComments = [];

    const newTaskSubtasksList = document.getElementById('new-task-subtasks-list');
    const addSubtaskInput = document.getElementById('add-subtask-input');
    const addSubtaskAzure = document.getElementById('add-subtask-azure');
    const directAddSubtaskBtn = document.getElementById('direct-add-subtask-btn');
    let currentNewTaskSubtasks = [];

    const searchCodeInput = document.getElementById('search-code-input');
    if (searchCodeInput) {
        searchCodeInput.addEventListener('input', () => {
            renderTasks();
        });
    }

    const filterTagSelectObj = document.getElementById('filter-tag-select');
    if (filterTagSelectObj) {
        filterTagSelectObj.addEventListener('change', () => {
            renderTasks();
        });
    }

    // Sidebar logic
    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    if (sidebar && toggleSidebarBtn) {
        const sidebarTitle = sidebar.querySelector('.sidebar-title');
        const sidebarTexts = sidebar.querySelectorAll('.sidebar-item-text');

        toggleSidebarBtn.addEventListener('click', () => {
            const isCollapsed = sidebar.style.width === '64px';
            if (isCollapsed) {
                sidebar.style.width = '240px';
                sidebarTitle.style.opacity = '1';
                setTimeout(() => sidebarTexts.forEach(t => t.style.opacity = '1'), 150);
            } else {
                sidebar.style.width = '64px';
                sidebarTitle.style.opacity = '0';
                sidebarTexts.forEach(t => t.style.opacity = '0');
            }
        });
    }

    // View Navigation
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    const viewDaily = document.getElementById('view-daily');
    const viewGantt = document.getElementById('view-gantt');

    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            sidebarItems.forEach(i => {
                i.classList.remove('active');
                i.style.background = 'transparent';
                i.style.color = 'var(--text-muted)';
                i.style.borderLeftColor = 'transparent';
            });
            item.classList.add('active');
            item.style.background = 'rgba(59, 130, 246, 0.1)';
            item.style.color = 'var(--accent)';
            item.style.borderLeftColor = 'var(--accent)';

            const view = item.dataset.view;
            localStorage.setItem('activeView', view);
            if (view === 'daily') {
                if (viewDaily) viewDaily.style.display = 'flex';
                if (viewGantt) viewGantt.style.display = 'none';
            } else if (view === 'gantt') {
                if (viewDaily) viewDaily.style.display = 'none';
                if (viewGantt) viewGantt.style.display = 'flex';
                // TODO: trigger gantt rendering
            }
        });
    });

    // Restaurar view salva
    const activeView = localStorage.getItem('activeView') || 'daily';
    const activeTabObj = Array.from(sidebarItems).find(i => i.dataset.view === activeView);
    if (activeTabObj) activeTabObj.click();

    // Backlog Collapsible logic
    const toggleBacklogHeader = document.getElementById('toggle-backlog-header');
    const backlogSection = document.getElementById('gantt-backlog-section');
    const toggleBacklogIcon = document.getElementById('toggle-backlog-icon');
    if (toggleBacklogHeader && backlogSection && toggleBacklogIcon) {
        toggleBacklogHeader.addEventListener('click', () => {
            // Check current height without transition interference
            const isCollapsed = backlogSection.style.height === '49px' || backlogSection.getBoundingClientRect().height < 100;
            if (isCollapsed) {
                backlogSection.style.height = '220px';
                toggleBacklogIcon.style.transform = 'rotate(0deg)';
            } else {
                backlogSection.style.height = '49px';
                toggleBacklogIcon.style.transform = 'rotate(-180deg)';
            }
        });
    }

    // Global listener to close dropdowns
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.task-actions-wrapper')) {
            document.querySelectorAll('.task-actions-dropdown.show').forEach(d => {
                d.classList.remove('show');
                const parentLi = d.closest('.task-item');
                if (parentLi) {
                    parentLi.style.zIndex = '1';
                    parentLi.style.position = 'relative'; // Ensure z-index works
                }
            });
        }
    });

    let ganttDragState = {
        isDragging: false,
        isResizing: false,
        activeBar: null,
        startX: 0,
        startLeft: 0,
        startWidth: 0,
        resizeDir: '',
        dayWidth: 48,
        minDate: null
    };

    document.addEventListener('mousemove', (e) => {
        if (!ganttDragState.activeBar) return;
        const diffX = e.clientX - ganttDragState.startX;
        if (ganttDragState.isDragging) {
            const newLeft = Math.max(0, ganttDragState.startLeft + diffX);
            ganttDragState.activeBar.style.left = `${newLeft}px`;
        } else if (ganttDragState.isResizing) {
            if (ganttDragState.resizeDir === 'left') {
                let newLeft = ganttDragState.startLeft + diffX;
                let newWidth = ganttDragState.startWidth - (newLeft - ganttDragState.startLeft);
                if (newLeft < 0) {
                    newWidth = ganttDragState.startWidth + ganttDragState.startLeft;
                    newLeft = 0;
                }
                if (newWidth < ganttDragState.dayWidth) {
                    newWidth = ganttDragState.dayWidth;
                    newLeft = ganttDragState.startLeft + ganttDragState.startWidth - ganttDragState.dayWidth;
                }
                ganttDragState.activeBar.style.left = `${newLeft}px`;
                ganttDragState.activeBar.style.width = `${newWidth}px`;
            } else if (ganttDragState.resizeDir === 'right') {
                const newWidth = Math.max(ganttDragState.dayWidth, ganttDragState.startWidth + diffX);
                ganttDragState.activeBar.style.width = `${newWidth}px`;
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (ganttDragState.activeBar && (ganttDragState.isDragging || ganttDragState.isResizing)) {
            const finalLeft = parseInt(ganttDragState.activeBar.style.left || 0);
            const finalWidth = parseInt(ganttDragState.activeBar.style.width || 0);
            
            const startDaysOff = Math.round(finalLeft / ganttDragState.dayWidth);
            const durationDays = Math.round(finalWidth / ganttDragState.dayWidth) - 1;

            const newStart = new Date(ganttDragState.minDate);
            newStart.setDate(newStart.getDate() + startDaysOff);
            const newEnd = new Date(newStart);
            newEnd.setDate(newEnd.getDate() + durationDays);

            const taskId = ganttDragState.activeBar.dataset.id;
            const dataType = ganttDragState.activeBar.dataset.type;
            const parentId = ganttDragState.activeBar.dataset.parent;
            
            ganttDragState.isDragging = false;
            ganttDragState.isResizing = false;
            ganttDragState.activeBar.style.cursor = 'grab';
            ganttDragState.activeBar = null;
            document.body.style.cursor = 'default';

            if (dataType === 'subtask' && parentId) {
                const parent = tasks.find(t => t.id === parentId);
                if (parent) {
                    const sub = parent.subtasks.find(s => s.id === taskId);
                    if (sub) {
                        sub.startDate = formatToYYYYMMDD(newStart);
                        sub.endDate = formatToYYYYMMDD(newEnd);
                        
                        // Auto update parent dates based on ALL mapped subtasks
                        let minDateStr = null, maxDateStr = null;
                        parent.subtasks.forEach(s => {
                            if (s.startDate) {
                                if (!minDateStr || s.startDate < minDateStr) minDateStr = s.startDate;
                                if (!maxDateStr || s.endDate > maxDateStr) maxDateStr = s.endDate;
                            }
                        });
                        if (minDateStr && maxDateStr) {
                            parent.startDate = minDateStr;
                            parent.endDate = maxDateStr;
                        }
                        saveTasks();
                    }
                }
            } else {
                const task = tasks.find(t => t.id === taskId);
                if (task) {
                    task.startDate = formatToYYYYMMDD(newStart);
                    task.endDate = formatToYYYYMMDD(newEnd);
                    saveTasks();
                }
            }
        }
    });

    const ganttDropZone = document.getElementById('gantt-container');
    if (ganttDropZone) {
        ganttDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        ganttDropZone.addEventListener('drop', (e) => {
            const taskId = e.dataTransfer.getData('text/plain');
            if (taskId && ganttDragState.minDate) {
                e.preventDefault();
                
                const backgrounds = ganttDropZone.querySelector('.gantt-background');
                if (!backgrounds) return;
                
                const rect = backgrounds.getBoundingClientRect();
                const dropX = e.clientX - rect.left;
                
                let droppedDaysOff = Math.floor(dropX / ganttDragState.dayWidth);
                if (droppedDaysOff < 0) droppedDaysOff = 0;

                const start = new Date(ganttDragState.minDate);
                start.setDate(start.getDate() + droppedDaysOff);
                
                const task = tasks.find(t => t.id === taskId);
                if (task) {
                    task.startDate = formatToYYYYMMDD(start);
                    task.endDate = formatToYYYYMMDD(start);
                    saveTasks(); // re-renders Gantt automatically
                }
            }
        });
    }

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
                t.subtasks.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
                return t;
            });
            tasks.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
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
                const tasksPayload = tasks.map((t, index) => ({
                    id: t.id,
                    title: t.title,
                    date: t.date || null,
                    completed: Boolean(t.completed),
                    tagId: t.tagId || null,
                    requesters: t.requesters || [],
                    notes: t.notes || null,
                    azureCode: t.azureCode || null,
                    comments: t.comments || [],
                    completedDate: t.completedDate || null,
                    orderIndex: index,
                    startDate: t.startDate || null,
                    endDate: t.endDate || null
                }));
                const { error: tasksErr } = await supabase.from('tasks').upsert(tasksPayload);
                if (tasksErr) {
                    console.error("Erro no upsert de tasks (possível falta de orderIndex, startDate ou endDate):", tasksErr);
                    // Fallback para caso o usuário não tenha rodado o SQL dessas colunas
                    const fallbackTaskPayload = tasksPayload.map(({ orderIndex, startDate, endDate, ...rest }) => rest);
                    const { error: fallbackErr } = await supabase.from('tasks').upsert(fallbackTaskPayload);
                    if (fallbackErr) console.error("Falha fatal no upsert de tasks (fallback):", fallbackErr);
                }

                // Upsert subtasks
                let allSubtasks = [];
                tasks.forEach(t => {
                    if (t.subtasks && t.subtasks.length > 0) {
                        t.subtasks.forEach((st, stIndex) => {
                            allSubtasks.push({
                                id: st.id,
                                taskId: t.id,
                                title: st.title,
                                azureCode: st.azureCode || null,
                                completed: Boolean(st.completed),
                                completedDate: st.completedDate || null,
                                orderIndex: stIndex,
                                startDate: st.startDate || null,
                                endDate: st.endDate || null
                            });
                        });
                    }
                });

                if (allSubtasks.length > 0) {
                    const { error: subErr } = await supabase.from('subtasks').upsert(allSubtasks);
                    if (subErr) {
                        console.error("Erro no upsert de subtasks:", subErr);
                        const fallbackSubtasks = allSubtasks.map(({ orderIndex, startDate, endDate, ...rest }) => rest);
                        await supabase.from('subtasks').upsert(fallbackSubtasks).catch(e => console.error(e));
                    }
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

        const filterTagSelect = document.getElementById('filter-tag-select');
        let currentFilterVal = '';
        if (filterTagSelect) {
            currentFilterVal = filterTagSelect.value;
            filterTagSelect.innerHTML = '<option value="">Todas etiquetas</option>';
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

            if (filterTagSelect) {
                const filterOption = document.createElement('option');
                filterOption.value = tag.id;
                filterOption.textContent = tag.name;
                filterTagSelect.appendChild(filterOption);
            }
        });
        tagSelect.value = currentVal;
        if (filterTagSelect && currentFilterVal) filterTagSelect.value = currentFilterVal;
    }

    function renderTasks() {
        tasksContainer.innerHTML = '';

        // Groups definition
        const todayStr = formatToYYYYMMDD(new Date());

        const groups = {
            'backlog': { label: 'Backlog', icon: 'ph-stack', tasks: [] },
            'pendentes': { label: 'Pendentes', icon: 'ph-warning-circle', tasks: [] },
            'hoje': { label: 'Hoje', icon: 'ph-calendar-check', tasks: [] },
            'em_desenvolvimento': { label: 'Em Desenvolvimento', icon: 'ph-laptop', tasks: [] },
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
                groupKey = 'em_desenvolvimento';
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

        const order = ['backlog', 'pendentes', 'hoje', 'em_desenvolvimento', 'concluidos'];
        let hasRenderedTask = false;

        order.forEach(groupKey => {
            const groupData = groups[groupKey];
            
            // Filtro por data
            let dateTasks = groupData.tasks;
            if (groupKey === 'pendentes' || groupKey === 'concluidos') {
                const dateFilter = columnDateFilters[groupKey];
                if (dateFilter) {
                    dateTasks = groupData.tasks.filter(task => {
                        const taskDate = groupKey === 'concluidos' ? task.completedDate : task.date;
                        return taskDate === dateFilter;
                    });
                }
            }

            // Filtro por código Azure
            const searchInputObj = document.getElementById('search-code-input');
            const searchCodeVal = searchInputObj ? searchInputObj.value.trim().toLowerCase() : '';
            if (searchCodeVal) {
                dateTasks = dateTasks.filter(task => {
                    const taskMatch = task.azureCode && task.azureCode.toLowerCase().includes(searchCodeVal);
                    const subtaskMatch = task.subtasks && task.subtasks.some(st => st.azureCode && st.azureCode.toLowerCase().includes(searchCodeVal));
                    return taskMatch || subtaskMatch;
                });
            }

            // Filtro por Etiqueta (Tag)
            const globalTagFilter = document.getElementById('filter-tag-select');
            const searchTagVal = globalTagFilter ? globalTagFilter.value : '';
            if (searchTagVal) {
                dateTasks = dateTasks.filter(task => task.tagId === searchTagVal);
            }

            hasRenderedTask = hasRenderedTask || (dateTasks.length > 0);

            const groupDiv = document.createElement('div');
            groupDiv.className = 'date-group';

            const header = document.createElement('div');
            header.className = 'date-header';
            header.style.display = "flex";
            header.style.alignItems = "center";
            header.style.justifyContent = "space-between";

            let filterHtml = "";
            if (groupKey === 'pendentes' || groupKey === 'concluidos') {
                filterHtml = `<input type="date" class="column-date-filter" data-group="${groupKey}" value="${columnDateFilters[groupKey]}" title="Filtrar por data" style="max-width: 110px; padding: 2px 4px; font-size: 0.75rem; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-surface); color: var(--text-main);" />`;
            }

            header.innerHTML = `
                <div style="display: flex; align-items: center; gap: 6px; flex: 1;">
                    <i class="ph ${groupData.icon} ph-lg"></i> ${groupData.label} <span style="font-size: 0.75rem; background: var(--bg-dark); padding: 2px 6px; border-radius: 10px; margin-left: 4px;">${dateTasks.length}</span>
                </div>
                ${filterHtml}
            `;

            if (filterHtml) {
                const input = header.querySelector('.column-date-filter');
                input.addEventListener('change', (e) => {
                    columnDateFilters[groupKey] = e.target.value;
                    renderTasks();
                });
                input.addEventListener('click', (e) => e.stopPropagation()); // Evitar bolha se fosse arrastável
            }

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
                const azureLinkHtml = task.azureCode ? `<a href="https://dev.azure.com/milsenior/PORTFOLIO/_workitems/edit/${task.azureCode}" target="_blank" style="font-size: 0.8rem; background: var(--bg-surface-hover); padding: 2px 6px; border-radius: 4px; color: var(--text-main); text-decoration: none; border: 1px solid var(--border); display: inline-flex; align-items: center; gap: 4px;"><i class="ph ph-link"></i> #${task.azureCode}</a>` : '';

                let requestersAndDateHtml = '';
                const reqBadges = task.requesters && task.requesters.length > 0
                    ? task.requesters.map(req => `<span class="requester-badge"><i class="ph ph-user"></i> ${req}</span>`).join('')
                    : '';

                const taskCompletedDateHtml = (task.completed && task.completedDate)
                    ? `<span style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;"><i class="ph ph-calendar-check"></i> ${task.completedDate.split('-').reverse().join('/')}</span>`
                    : '';

                const expandSubtasksBtnHtml = (task.subtasks && task.subtasks.length > 0)
                    ? `<button type="button" class="btn-icon expand-subtasks-btn" title="Mostrar/Ocultar Checkpoints" style="padding: 2px 6px; display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--text-muted); border: 1px solid var(--border); border-radius: 12px; background: var(--bg-surface); margin-left: auto;">
                        <i class="ph ph-caret-down"></i> ${task.subtasks.length}
                       </button>`
                    : '';

                const row1Html = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; min-height: 24px;">
                        <div>
                            ${tagBadgeHtml}
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <label class="switch-wrapper" title="Marcar como concluída">
                                <input type="checkbox" class="switch-custom" ${task.completed ? 'checked' : ''} />
                                <span class="switch-slider"></span>
                            </label>
                            <div class="task-actions-wrapper">
                                <button class="task-actions-btn btn-icon" title="Opções" style="padding: 2px;">
                                    <i class="ph ph-dots-three-vertical ph-lg"></i>
                                </button>
                                <div class="task-actions-dropdown">
                                    <button class="task-action-item edit-btn"><i class="ph ph-pencil-simple ph-lg"></i> Editar</button>
                                    <button class="task-action-item reschedule-btn"><i class="ph ph-calendar ph-lg"></i> Remarcar</button>
                                    <button class="task-action-item delete delete-btn"><i class="ph ph-trash ph-lg"></i> Excluir</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const row2Html = `
                    <div style="display: flex; gap: 6px; align-items: flex-start; margin-bottom: 6px; flex-wrap: wrap;">
                        ${azureLinkHtml}
                        <span class="task-text" style="vertical-align: middle; line-height: 1.4;">${task.title}</span>
                    </div>
                `;

                let row3Html = '';
                if (reqBadges || expandSubtasksBtnHtml) {
                    row3Html = `
                        <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
                            <div class="requester-area" style="margin: 0; display: flex; gap: 4px; flex-wrap: wrap;">
                                ${reqBadges}
                            </div>
                            ${expandSubtasksBtnHtml}
                        </div>
                    `;
                }

                const notesHtml = task.notes
                    ? `<div class="task-notes-display" style="font-size: 0.8rem; color: var(--text-muted); padding: 6px 8px; background: rgba(0,0,0,0.03); border-radius: 4px; margin-top: 6px; border-left: 2px solid var(--border); margin-bottom: 6px;">${task.notes.replace(/\n/g, '<br>')}</div>`
                    : '';

                const dateRowHtml = taskCompletedDateHtml ? `
                    <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
                        ${taskCompletedDateHtml}
                    </div>
                ` : '';

                li.innerHTML = `
                    <div class="task-content" style="width: 100%;">
                        ${row1Html}
                        ${row2Html}
                        ${row3Html}
                        ${notesHtml}
                        <div class="subtasks-container" style="display: none; flex-direction: column; gap: 4px;"></div>
                        ${dateRowHtml}
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

                        const subAzureLinkHtml = st.azureCode ? `<a href="https://dev.azure.com/milsenior/PORTFOLIO/_workitems/edit/${st.azureCode}" target="_blank" style="font-size: 0.75rem; background: var(--bg-surface-hover); padding: 0 4px; border-radius: 4px; color: var(--text-main); text-decoration: none; border: 1px solid var(--border); display: inline-flex; align-items: center; gap: 2px; width: fit-content;"><i class="ph ph-link"></i> #${st.azureCode}</a>` : '';

                        stLabel.innerHTML = `
                            <div style="display: flex; align-items: flex-start; gap: 6px; width: 100%;">
                                <i class="ph ph-dots-six-vertical" style="color: var(--text-muted); cursor: grab; margin-top: 4px;"></i>
                                <input type="checkbox" class="subtask-checkbox checkbox-custom" style="width: 16px; height: 16px; margin-top: 3px; flex-shrink: 0;" data-task-id="${task.id}" data-subtask-id="${st.id}" ${st.completed ? 'checked' : ''} />
                                <div style="display: flex; flex-direction: column; flex: 1; align-items: flex-start; min-width: 0;">
                                    <div style="line-height: 1.5; word-break: break-word; width: 100%;">
                                        ${subAzureLinkHtml}
                                        <span style="${st.completed ? 'text-decoration: line-through; color: var(--text-muted);' : ''} vertical-align: middle;" title="${st.title}">${st.title}</span>
                                    </div>
                                    <input type="date" class="subtask-date-input" title="Data de conclusão" value="${st.completedDate || ''}" style="width: fit-content; margin-top: 4px; padding: 2px 4px; font-size: 0.75rem; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-dark); color: var(--text-muted); ${st.completed ? 'display: inline-block;' : 'display: none;'}" />
                                </div>
                            </div>
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

                    // Toggle subtasks visibility
                    const expandBtn = li.querySelector('.expand-subtasks-btn');
                    if (expandBtn) {
                        expandBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const isHidden = subtasksContainer.style.display === 'none';
                            subtasksContainer.style.display = isHidden ? 'flex' : 'none';
                            const icon = expandBtn.querySelector('i');
                            icon.className = isHidden ? 'ph ph-caret-up' : 'ph ph-caret-down';
                        });
                    }

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
                        if (draggedStId && pTaskId) {
                            const afterElement = getDragAfterElement(subtasksContainer, e.clientY, '.subtask-item');
                            const targetStId = afterElement ? afterElement.dataset.stId : null;
                            transferSubtask(pTaskId, task.id, draggedStId, targetStId);
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

                // Dropdown menu logic
                const actionsBtn = li.querySelector('.task-actions-btn');
                const actionsDropdown = li.querySelector('.task-actions-dropdown');
                
                actionsBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Fecha os outros que possam estar abertos
                    document.querySelectorAll('.task-actions-dropdown.show').forEach(d => {
                        if (d !== actionsDropdown) {
                            d.classList.remove('show');
                            const parentLi = d.closest('.task-item');
                            if (parentLi) {
                                parentLi.style.zIndex = '1';
                                parentLi.style.position = 'relative';
                            }
                        }
                    });
                    
                    const isOpening = !actionsDropdown.classList.contains('show');
                    actionsDropdown.classList.toggle('show');
                    
                    // Modifica o z-index da LI para sobrepor cards abaixo
                    li.style.position = 'relative';
                    li.style.zIndex = isOpening ? '9999' : '1';
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
        
        renderGantt();
    }

    function renderGantt() {
        const ganttContainer = document.getElementById('gantt-container');
        if (!ganttContainer) return;

        try {
        ganttContainer.innerHTML = '';
        
        let minDate = new Date();
        minDate.setDate(minDate.getDate() - 7);
        let maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 14);

        const tasksWithDates = tasks.filter(t => t.startDate && t.endDate);
        if (tasksWithDates.length > 0) {
            tasksWithDates.forEach(t => {
                const sTemp = parseYYYYMMDD(t.startDate);
                const eTemp = parseYYYYMMDD(t.endDate);
                if (sTemp < minDate) { minDate = new Date(sTemp); minDate.setDate(minDate.getDate() - 7); }
                if (eTemp > maxDate) { maxDate = new Date(eTemp); maxDate.setDate(maxDate.getDate() + 7); }
            });
        }

        minDate.setHours(0,0,0,0);
        maxDate.setHours(0,0,0,0);
        
        const dayWidth = 48;
        const totalDays = Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
        const totalWidth = totalDays * dayWidth;

        let timelineHTML = `<div class="gantt-timeline-header" style="display: flex; width: ${totalWidth}px; border-bottom: 1px solid var(--border); box-sizing: content-box;">`;
        let backgroundsHTML = `<div class="gantt-background" style="display: flex; position: absolute; top: 0; left: 0; bottom: 0; width: ${totalWidth}px; pointer-events: none; z-index: 0;">`;
        
        const todayStr = formatToYYYYMMDD(new Date());
        let todayOffsetLeft = 0;

        for (let i = 0; i < totalDays; i++) {
            let current = new Date(minDate);
            current.setDate(current.getDate() + i);
            let cDateStr = formatToYYYYMMDD(current);
            let isToday = cDateStr === todayStr;

            if (isToday) {
                todayOffsetLeft = i * dayWidth;
            }

            const dayName = current.toLocaleDateString('pt-BR', { weekday: 'short' });
            const dayNum = current.getDate();

            timelineHTML += `
                <div style="width: ${dayWidth}px; flex-shrink: 0; text-align: center; border-right: 1px solid var(--border); padding: 4px 0; background: ${isToday ? 'rgba(59, 130, 246, 0.1)' : 'transparent'};">
                    <div style="font-size: 0.65rem; color: ${isToday ? 'var(--accent)' : 'var(--text-muted)'}; text-transform: uppercase;">${dayName}</div>
                    <div style="font-size: 0.85rem; font-weight: ${isToday ? 'bold' : 'normal'}; color: ${isToday ? 'var(--text-main)' : 'var(--text-muted)'};">${dayNum}</div>
                </div>
            `;
            
            backgroundsHTML += `<div style="width: ${dayWidth}px; flex-shrink: 0; border-right: 1px solid var(--border); background: ${isToday ? 'rgba(59, 130, 246, 0.05)' : 'transparent'};"></div>`;
        }
        timelineHTML += `</div>`;
        backgroundsHTML += `</div>`;

        let todayLineHTML = '';
        if (todayOffsetLeft > 0) {
            todayLineHTML = `<div class="gantt-today-line" style="position: absolute; left: ${todayOffsetLeft + dayWidth/2}px; top: 0; bottom: 0; width: 2px; background: var(--accent); z-index: 2; pointer-events: none;"></div>`;
        }

        const defaultTag = { id: '', name: 'Sem projeto', color: '#64748b' };
        let allTags = [...tags, defaultTag];
        
        const ft = document.getElementById('filter-tag-select');
        let searchTagVal = ft ? ft.value : '';
        if (searchTagVal) {
            allTags = allTags.filter(t => t.id === searchTagVal);
        }

        const rowsHTML = [];

        allTags.forEach(tag => {
            const tagTasks = tasksWithDates.filter(t => (t.tagId === tag.id) || (!t.tagId && tag.id === ''));
            if (tagTasks.length === 0) return;

            // Ordenar por data inicial para otimizar os tracks
            tagTasks.sort((a, b) => parseYYYYMMDD(a.startDate) - parseYYYYMMDD(b.startDate));

            let rowHeader = `<div style="font-family: inherit; font-size: 0.9rem; font-weight: 500; display: flex; align-items: center; padding: 0 16px; background: var(--bg-surface); position: sticky; left: 0; z-index: 5; border-right: 1px solid var(--border); width: 200px; border-bottom: 1px solid var(--border);">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${tag.color}; flex-shrink: 0; margin-right: 8px;"></div>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${tag.name}">${tag.name}</span>
            </div>`;

            let absoluteRenderList = [];
            let svgsHTML = '';
            let boundingBoxes = []; // Engine 2D de colisão para compactar sub-itens
            
            // Construir Grupos Familiares (Pai + Filhos visíveis)
            tagTasks.forEach(t => {
                let groupItems = [];
                let sTemp = parseYYYYMMDD(t.startDate);
                let eTemp = parseYYYYMMDD(t.endDate);
                
                const isExpanded = window.ganttExpandedTasks.has(t.id);
                // Se expandido, as datas do PAI se baseiam nas subtasks mapeadas dinamicamente aqui visualmente
                // A persistência acontece apenas no momento do "drop" ou na edição
                
                let pLeft = Math.round((sTemp - minDate) / (1000 * 60 * 60 * 24)) * dayWidth;
                let pWidth = (Math.round((eTemp - sTemp) / (1000 * 60 * 60 * 24)) + 1) * dayWidth;
                
                groupItems.push({
                    type: 'task',
                    task: t,
                    localY: 0,
                    left: pLeft,
                    right: pLeft + pWidth,
                    width: pWidth
                });
                
                if (isExpanded && t.subtasks && t.subtasks.length > 0) {
                    let subY = 36;
                    t.subtasks.forEach(sub => {
                        let subSStr = sub.startDate || t.startDate;
                        let subEStr = sub.endDate || t.startDate; // Defaults to parent mapping
                        let subS = parseYYYYMMDD(subSStr);
                        let subE = parseYYYYMMDD(subEStr);
                        let sLeft = Math.round((subS - minDate) / (1000 * 60 * 60 * 24)) * dayWidth;
                        let sWidth = (Math.round((subE - subS) / (1000 * 60 * 60 * 24)) + 1) * dayWidth;
                        
                        groupItems.push({
                            type: 'subtask',
                            subtask: sub,
                            parentTask: t,
                            localY: subY,
                            left: sLeft,
                            right: sLeft + sWidth,
                            width: sWidth
                        });
                        subY += 36;
                    });
                }
                
                let dy = 0;
                while (true) {
                    let collision = false;
                    for (let item of groupItems) {
                        let aTop = dy + item.localY;
                        let aBottom = aTop + 26; // Height da barra (26px) + gap
                        for (let box of boundingBoxes) {
                            if (item.left < box.right && item.right > box.left && aTop < box.bottom && aBottom > box.top) {
                                collision = true; break;
                            }
                        }
                        if (collision) break;
                    }
                    if (!collision) break;
                    dy += 36; // Avança para a próxima faixa vertical (track)
                }
                
                // Add absolute items and bounding boxes
                groupItems.forEach((item, idx) => {
                    item.absoluteY = dy + item.localY;
                    boundingBoxes.push({ left: item.left, right: item.right, top: item.absoluteY, bottom: item.absoluteY + 26 });
                    absoluteRenderList.push(item);
                    
                    // Desenha linha de conexão como SVG no background
                    if (idx > 0) {
                        const parentItem = groupItems[0];
                        const startX = parentItem.left + 12; // Saindo pelo canto inferior esquerdo do pai
                        const startY = parentItem.absoluteY + 26;
                        let endX = item.left;
                        let endY = item.absoluteY + 13;
                        if (endX < startX) endX = item.left + item.width;
                        svgsHTML += `<path d="M ${startX} ${startY} V ${endY} H ${endX}" fill="none" stroke="${tag.color}" stroke-opacity="0.6" stroke-width="2" stroke-linejoin="round" />`;
                    }
                });
            });

            let rowBarsHTML = absoluteRenderList.map((item) => {
                if (item.type === 'task') {
                    const t = item.task;
                    const barColor = t.completed ? 'var(--success)' : tag.color;
                    const isExpanded = window.ganttExpandedTasks.has(t.id);
                    const expandBtn = (t.subtasks && t.subtasks.length > 0) ? `
                        <div class="gantt-expand-btn" data-id="${t.id}" style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; background: rgba(255,255,255,0.2); border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10;">
                            <i class="ph ${isExpanded ? 'ph-caret-up' : 'ph-caret-down'}" style="font-size: 0.75rem; color: #fff; pointer-events: none;"></i>
                        </div>` : '';
                    let etapa = '';
                    if (t.completed) etapa = 'Concluído';
                    else if (!t.date) etapa = 'Backlog';
                    else if (t.date < todayStr) etapa = 'Pendente';
                    else if (t.date === todayStr) etapa = 'Hoje';
                    else etapa = 'Em Desenvolvimento';

                    let subtasksListHtml = '';
                    if (t.subtasks && t.subtasks.length > 0) {
                        const completedCount = t.subtasks.filter(s => s.completed).length;
                        subtasksListHtml = `
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
                            <strong style="display:block; margin-bottom:4px; font-size:0.75rem;">Checkpoints (${completedCount}/${t.subtasks.length}):</strong>
                            <ul style="padding-left:16px; margin:0; font-size:0.75rem; color:var(--text-muted);">
                                ${t.subtasks.map(s => `<li style="margin-bottom:2px;">${s.completed ? `<strike style="color:var(--success)">${s.title}</strike>` : s.title}</li>`).join('')}
                            </ul>
                        </div>`;
                    }

                    return `
                        <div class="gantt-bar-item gantt-tooltip-container" data-type="task" data-id="${t.id}" style="position: absolute; top: ${8 + item.absoluteY}px; left: ${item.left}px; width: ${item.width}px; height: 26px; background: ${barColor}; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); cursor: grab; display: flex; align-items: center; padding: 0 26px 0 8px; z-index: 3; transition: background 0.2s;">
                            <span style="font-size: 0.75rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; user-select: none; pointer-events: none;">${t.title}</span>
                            ${expandBtn}
                            <div class="gantt-tooltip">
                                <strong style="color: #fff; font-size: 0.85rem; display: block; margin-bottom: 2px;">${t.title}</strong>
                                <span style="color: var(--accent); font-size: 0.7rem; display: block; margin-bottom: 2px;">Etapa: ${etapa}</span>
                                <span style="color: var(--text-muted); font-size: 0.7rem;">${t.startDate.split('-').reverse().join('/')} - ${t.endDate.split('-').reverse().join('/')}</span>
                                ${subtasksListHtml}
                            </div>
                            <div class="gantt-handle gantt-handle-left" style="position: absolute; left: 0; top: 0; bottom: 0; width: 6px; cursor: ew-resize;"></div>
                            <div class="gantt-handle gantt-handle-right" style="position: absolute; right: 0; top: 0; bottom: 0; width: 6px; cursor: ew-resize;"></div>
                        </div>
                    `;
                } else {
                    const sub = item.subtask;
                    const p = item.parentTask;
                    const barColor = sub.completed ? 'var(--success)' : 'var(--bg-surface-hover)';
                    const textColor = sub.completed ? '#fff' : 'var(--text-main)';
                    const border = `1px solid ${tag.color}`;
                    const subStartStr = sub.startDate || p.startDate || '';
                    const subEndStr = sub.endDate || p.startDate || '';
                    const subDateStr = subStartStr && subEndStr ? `${subStartStr.split('-').reverse().join('/')} - ${subEndStr.split('-').reverse().join('/')}` : '';

                    return `
                        <div class="gantt-bar-item gantt-tooltip-container" data-type="subtask" data-id="${sub.id}" data-parent="${p.id}" style="position: absolute; top: ${8 + item.absoluteY}px; left: ${item.left}px; width: ${item.width}px; height: 26px; background: ${barColor}; border: ${border}; border-radius: 4px; cursor: grab; display: flex; align-items: center; padding: 0 8px; z-index: 3;">
                            <span style="font-size: 0.75rem; color: ${textColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; user-select: none; pointer-events: none;">${sub.title}</span>
                            <div class="gantt-tooltip">
                                <strong style="color: #fff; font-size: 0.85rem; display: block; margin-bottom: 2px;">↳ ${sub.title}</strong>
                                <span style="color: var(--text-muted); font-size: 0.7rem; display: block; margin-bottom: 2px;">De: ${p.title}</span>
                                <span style="color: ${sub.completed ? 'var(--success)' : 'var(--text-muted)'}; font-size: 0.7rem; display: block; margin-bottom: 2px;">Status: ${sub.completed ? 'Concluída' : 'Pendente'}</span>
                                <span style="color: var(--text-muted); font-size: 0.7rem;">${subDateStr}</span>
                            </div>
                            <div class="gantt-handle gantt-handle-left" style="position: absolute; left: 0; top: 0; bottom: 0; width: 6px; cursor: ew-resize;"></div>
                            <div class="gantt-handle gantt-handle-right" style="position: absolute; right: 0; top: 0; bottom: 0; width: 6px; cursor: ew-resize;"></div>
                        </div>
                    `;
                }
            }).join('');

            const maxBottom = boundingBoxes.length > 0 ? Math.max(...boundingBoxes.map(b => b.bottom)) : 0;
            const rowHeight = Math.max(maxBottom + 16, 60);

            rowsHTML.push(`
                <div class="gantt-row" style="display: flex; min-height: ${rowHeight}px; border-bottom: 1px solid var(--border); box-sizing: content-box; position: relative; width: ${totalWidth + 200}px;">
                    ${rowHeader}
                    <div class="gantt-bars-container" style="position: relative; width: ${totalWidth}px; flex-shrink: 0;">
                        ${svgsHTML ? `<svg style="position: absolute; left:0; top:8px; width:100%; height:100%; pointer-events:none; z-index:2;">${svgsHTML}</svg>` : ''}
                        ${rowBarsHTML}
                    </div>
                </div>
            `);
        });

        ganttContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; position: relative; width: fit-content; min-width: 100%;">
                <div style="display: flex; position: sticky; top: 0; z-index: 10; background: var(--bg-dark);">
                    <div style="width: 200px; flex-shrink: 0; border-right: 1px solid var(--border); background: var(--bg-surface); position: sticky; left: 0; z-index: 11; border-bottom: 1px solid var(--border);"></div>
                    ${timelineHTML}
                </div>
                <div style="position: relative;">
                    <div style="position: absolute; left: 200px; right: 0; top: 0; bottom: 0; pointer-events: none; z-index: 1;">
                        ${backgroundsHTML}
                        ${todayLineHTML}
                    </div>
                    ${rowsHTML.length > 0 ? rowsHTML.join('') : '<div style="padding: 24px;">Nenhuma atividade com Início e Fim definidos para essa visão. Edite uma atividade para definir seu período no Gantt!</div>'}
                </div>
            </div>
        `;

        // Expand btn listeners
        ganttContainer.querySelectorAll('.gantt-expand-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (window.ganttExpandedTasks.has(id)) window.ganttExpandedTasks.delete(id);
                else window.ganttExpandedTasks.add(id);
                renderGantt();
            });
        });

        if (!ganttContainer.dataset.initialized && todayOffsetLeft > 0) {
            requestAnimationFrame(() => {
                ganttContainer.scrollLeft = todayOffsetLeft - ganttContainer.clientWidth / 2 + 200;
                ganttContainer.dataset.initialized = 'true';
            });
        }

        ganttDragState.minDate = minDate;
        ganttDragState.dayWidth = dayWidth;

        const bars = ganttContainer.querySelectorAll('.gantt-bar-item');
        bars.forEach(bar => {
            const handleLeft = bar.querySelector('.gantt-handle-left');
            const handleRight = bar.querySelector('.gantt-handle-right');

            bar.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('gantt-handle')) return;
                e.preventDefault();
                ganttDragState.isDragging = true;
                ganttDragState.activeBar = bar;
                ganttDragState.startX = e.clientX;
                ganttDragState.startLeft = parseInt(bar.style.left || 0);
                ganttDragState.startWidth = parseInt(bar.style.width || 0);
                bar.style.cursor = 'grabbing';
            });

            handleLeft.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                ganttDragState.isResizing = true;
                ganttDragState.resizeDir = 'left';
                ganttDragState.activeBar = bar;
                ganttDragState.startX = e.clientX;
                ganttDragState.startLeft = parseInt(bar.style.left || 0);
                ganttDragState.startWidth = parseInt(bar.style.width || 0);
                document.body.style.cursor = 'ew-resize';
            });

            handleRight.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                ganttDragState.isResizing = true;
                ganttDragState.resizeDir = 'right';
                ganttDragState.activeBar = bar;
                ganttDragState.startX = e.clientX;
                ganttDragState.startLeft = parseInt(bar.style.left || 0);
                ganttDragState.startWidth = parseInt(bar.style.width || 0);
                document.body.style.cursor = 'ew-resize';
            });

            bar.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                if (bar.dataset.type === 'subtask') {
                    openEditModal(bar.dataset.parent);
                } else {
                    openEditModal(bar.dataset.id);
                }
            });
        });

        // Populating the Backlog
        const backlogContainer = document.getElementById('gantt-backlog-content');
        if (backlogContainer) {
            backlogContainer.innerHTML = '';
            const unscheduledTasks = tasks.filter(t => !t.completed && (!t.startDate || !t.endDate));
            
            const backlogSection = document.getElementById('gantt-backlog-section');
            const toggleIcon = document.getElementById('toggle-backlog-icon');
            
            if (unscheduledTasks.length === 0) {
                backlogContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; padding: 8px;">Nenhuma atividade pendente para agendar no Quadro.</div>';
                if (backlogSection && toggleIcon) {
                    backlogSection.style.height = '49px';
                    toggleIcon.style.transform = 'rotate(-180deg)';
                }
            } else {
                if (backlogSection && toggleIcon) {
                    backlogSection.style.height = '220px';
                    toggleIcon.style.transform = 'rotate(0deg)';
                }
                unscheduledTasks.forEach(t => {
                    const tag = allTags.find(tg => tg.id === t.tagId) || defaultTag;
                    const card = document.createElement('div');
                    card.draggable = true;
                    card.className = 'gantt-backlog-card';
                    card.style.cssText = `
                        background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius);
                        padding: 12px; width: 240px; flex-shrink: 0; display: flex; flex-direction: column; gap: 6px;
                        cursor: grab; border-left: 4px solid ${tag.color}; transition: transform 0.2s, opacity 0.2s;
                    `;
                    card.title = "Dê clique-duplo para editar ou arraste para preencher sua data";
                    card.innerHTML = `
                        <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                            <span>${tag.name}</span>
                            <i class="ph ph-arrows-out-line-horizontal" style="color: var(--text-muted);"></i>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-main); font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">${t.title}</div>
                    `;
                    
                    card.addEventListener('dragstart', (e) => {
                        e.dataTransfer.setData('text/plain', t.id);
                        setTimeout(() => card.style.opacity = '0.5', 0);
                    });
                    card.addEventListener('dragend', () => {
                        card.style.opacity = '1';
                    });
                    card.addEventListener('dblclick', () => {
                        openEditModal(t.id);
                    });
                    
                    backlogContainer.appendChild(card);
                });
            }
        }
        } catch (e) {
            ganttContainer.innerHTML = `<div style="padding: 24px; color: #ef4444;">Erro ao renderizar Gantt: ${e.message}<br><br><pre>${e.stack}</pre></div>`;
            console.error("Gantt Render Error:", e);
        }
    }

    // Handlers
    function applyColumnTarget(targetColumn, inOutDate, inOutCompleted) {
        let date = inOutDate;
        let completed = inOutCompleted;
        const todayStr = formatToYYYYMMDD(new Date());
        
        if (targetColumn === 'concluidos') {
            completed = true;
        } else if (targetColumn) {
            completed = false;
            if (targetColumn === 'backlog') date = '';
            else if (targetColumn === 'hoje') date = todayStr;
            else if (targetColumn === 'pendentes') {
                if (!date || date >= todayStr) {
                    let y = new Date(); y.setDate(y.getDate() - 1);
                    date = formatToYYYYMMDD(y);
                }
            } else if (targetColumn === 'em_desenvolvimento') {
                if (!date || date <= todayStr) {
                    let tm = new Date(); tm.setDate(tm.getDate() + 1);
                    date = formatToYYYYMMDD(tm);
                }
            }
        }
        return { date, completed };
    }

    function addTask(e) {
        e.preventDefault();
        const title = taskInput.value.trim();
        const date = dateInput.value;
        const columnTarget = document.getElementById('column-select') ? document.getElementById('column-select').value : '';
        const tagId = tagSelect ? tagSelect.value : '';
        const reqVal = requesterInput ? requesterInput.value.trim() : '';
        const notes = taskNotes ? taskNotes.value.trim() : '';
        const azureCode = taskAzureCode ? taskAzureCode.value.trim() : '';
        const startDate = document.getElementById('start-date-input') ? document.getElementById('start-date-input').value : '';
        const endDate = document.getElementById('end-date-input') ? document.getElementById('end-date-input').value : '';

        if (!title) return;

        const requesters = reqVal ? reqVal.split(',').map(r => r.trim()).filter(Boolean) : [];

        const newTask = {
            id: Date.now().toString(),
            title,
            date: date || '',
            tagId,
            requesters,
            notes,
            azureCode,
            comments: [],
            subtasks: [...currentNewTaskSubtasks],
            completed: false,
            startDate,
            endDate
        };

        if (columnTarget) {
            const result = applyColumnTarget(columnTarget, newTask.date, newTask.completed);
            newTask.date = result.date;
            newTask.completed = result.completed;
            if (result.completed) newTask.completedDate = formatToYYYYMMDD(new Date());
        }

        tasks.push(newTask);
        saveTasks();

        taskInput.value = '';
        if (taskAzureCode) taskAzureCode.value = '';
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
                } else if (targetDate === 'em_desenvolvimento') {
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

    function transferSubtask(fromTaskId, toTaskId, subtaskId, targetSubtaskId = null) {
        if (fromTaskId === toTaskId) {
            moveSubtask(toTaskId, subtaskId, targetSubtaskId);
            return;
        }

        const fromTask = tasks.find(t => t.id === fromTaskId);
        const toTask = tasks.find(t => t.id === toTaskId);

        if (fromTask && toTask && fromTask.subtasks) {
            const stIndex = fromTask.subtasks.findIndex(s => s.id === subtaskId);
            if (stIndex > -1) {
                const st = fromTask.subtasks.splice(stIndex, 1)[0];
                toTask.subtasks = toTask.subtasks || [];
                
                if (targetSubtaskId) {
                    const targetIndex = toTask.subtasks.findIndex(s => s.id === targetSubtaskId);
                    if (targetIndex > -1) {
                        toTask.subtasks.splice(targetIndex, 0, st);
                    } else {
                        toTask.subtasks.push(st);
                    }
                } else {
                    toTask.subtasks.push(st);
                }
                saveTasks();
                // Render view after crossing tasks
                renderTasks();
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
            if (editTaskAzureCode) editTaskAzureCode.value = task.azureCode || '';
            if (editRequesterInput) editRequesterInput.value = (task.requesters && task.requesters.length > 0) ? task.requesters.join(', ') : '';
            if (editTaskNotes) editTaskNotes.value = task.notes || '';
            editDateInput.value = task.date;
            editTagSelect.value = task.tagId || '';
            
            const editStartDateInput = document.getElementById('edit-start-date-input');
            const editEndDateInput = document.getElementById('edit-end-date-input');
            if (editStartDateInput) editStartDateInput.value = task.startDate || '';
            if (editEndDateInput) editEndDateInput.value = task.endDate || '';

            const colSelect = document.getElementById('edit-column-select');
            if (colSelect) {
                const todayStr = formatToYYYYMMDD(new Date());
                let currentGroup = '';
                if (task.completed) currentGroup = 'concluidos';
                else if (!task.date) currentGroup = 'backlog';
                else if (task.date < todayStr) currentGroup = 'pendentes';
                else if (task.date === todayStr) currentGroup = 'hoje';
                else currentGroup = 'em_desenvolvimento';
                colSelect.value = currentGroup;
            }
            currentEditSubtasks = task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : [];
            currentEditComments = task.comments ? JSON.parse(JSON.stringify(task.comments)) : [];
            
            renderEditSubtasks();
            renderEditComments();
            
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
            div.style.gap = '6px';
            div.style.alignItems = 'center';
            div.innerHTML = `
                <input type="checkbox" class="checkbox-custom" style="width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0;" ${st.completed ? 'checked' : ''} />
                <input type="text" class="subtask-edit-input" value="${st.title.replace(/"/g, '&quot;')}" style="flex: 1; min-width: 0; background: transparent; border: 1px solid transparent; color: var(--text-main); font-family: inherit; font-size: 0.85rem; padding: 2px 4px; border-radius: 4px; transition: border-color 0.2s;" />
                <button type="button" class="btn-icon promote-btn" style="padding: 2px; color: var(--accent)" title="Transformar em atividade">
                    <i class="ph ph-arrow-u-up-right"></i>
                </button>
                <button type="button" class="btn-icon delete-btn" style="padding: 2px; color: var(--danger)" title="Excluir">
                    <i class="ph ph-trash"></i>
                </button>
            `;
            const checkbox = div.querySelector('.checkbox-custom');
            checkbox.addEventListener('change', (e) => {
                st.completed = e.target.checked;
            });
            const textInput = div.querySelector('.subtask-edit-input');
            textInput.addEventListener('change', (e) => {
                st.title = e.target.value.trim() || 'Sem título';
            });
            textInput.addEventListener('focus', () => textInput.style.border = '1px solid var(--border)');
            textInput.addEventListener('blur', () => textInput.style.border = '1px solid transparent');

            const promoteBtn = div.querySelector('.promote-btn');
            promoteBtn.addEventListener('click', async () => {
                const icon = promoteBtn.querySelector('i');
                const originalClass = icon.className;
                icon.className = 'ph ph-spinner ph-spin';
                promoteBtn.disabled = true;

                try {
                    const subId = st.id;
                    currentEditSubtasks = currentEditSubtasks.filter(s => s.id !== subId);
                    await supabase.from('subtasks').delete().eq('id', subId);
                    
                    const parentTask = tasks.find(t => t.id === taskToEdit);
                    if (parentTask) {
                        parentTask.subtasks = currentEditSubtasks;
                    }

                    const parentDate = editDateInput ? editDateInput.value : '';
                    const parentTag = editTagSelect ? editTagSelect.value : '';

                    const newTask = {
                        id: Date.now().toString(),
                        title: textInput.value.trim() || 'Nova Atividade do Checkpoint',
                        date: parentDate,
                        tagId: parentTag,
                        requesters: [],
                        notes: '',
                        azureCode: st.azureCode || '',
                        comments: [],
                        subtasks: [],
                        completed: false
                    };
                    tasks.push(newTask);
                    await saveTasks();
                    renderEditSubtasks();
                } catch (err) {
                    console.error("Erro ao transformar em atividade", err);
                    icon.className = originalClass;
                    promoteBtn.disabled = false;
                }
            });

            const delBtn = div.querySelector('.delete-btn');
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

    function renderEditComments() {
        if (!commentsList) return;
        commentsList.innerHTML = '';
        currentEditComments.forEach(comment => {
            const div = document.createElement('div');
            div.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
            div.style.padding = '10px';
            div.style.borderRadius = '8px';
            div.style.border = '1px solid var(--border)';
            div.style.display = 'flex';
            div.style.flexDirection = 'column';
            div.style.gap = '4px';

            const dateLabel = new Date(comment.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            
            div.innerHTML = `
                <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                    <span>${dateLabel}</span>
                    <i class="ph ph-trash" style="cursor: pointer; color: var(--danger)" title="Excluir" data-id="${comment.id}"></i>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-main); line-height: 1.4;">
                    ${comment.text.replace(/\n/g, '<br>')}
                </div>
            `;
            
            const delBtn = div.querySelector('.ph-trash');
            delBtn.addEventListener('click', () => {
                currentEditComments = currentEditComments.filter(c => c.id !== comment.id);
                renderEditComments();
            });

            commentsList.appendChild(div);
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
            
            const colSelect = document.getElementById('edit-column-select');
            if (colSelect && colSelect.value) {
                const result = applyColumnTarget(colSelect.value, task.date, task.completed);
                task.date = result.date;
                task.completed = result.completed;
                if (result.completed && !task.completedDate) task.completedDate = formatToYYYYMMDD(new Date());
                else if (!result.completed) task.completedDate = null;
            }

            if (editRequesterInput) {
                const reqVal = editRequesterInput.value.trim();
                task.requesters = reqVal ? reqVal.split(',').map(r => r.trim()).filter(Boolean) : [];
            }
            if (editTaskNotes) {
                task.notes = editTaskNotes.value.trim();
            }
            if (editTaskAzureCode) {
                task.azureCode = editTaskAzureCode.value.trim();
            }
            const editStartDateStr = document.getElementById('edit-start-date-input') ? document.getElementById('edit-start-date-input').value : '';
            const editEndDateStr = document.getElementById('edit-end-date-input') ? document.getElementById('edit-end-date-input').value : '';
            task.startDate = editStartDateStr;
            task.endDate = editEndDateStr;

            task.subtasks = currentEditSubtasks;
            task.comments = currentEditComments;
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
        if (taskAzureCode) taskAzureCode.value = '';
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
            div.style.gap = '6px';
            div.style.alignItems = 'center';
            div.innerHTML = `
                <input type="text" class="subtask-edit-input" value="${st.title.replace(/"/g, '&quot;')}" style="flex: 1; min-width: 0; background: transparent; border: 1px solid transparent; color: var(--text-main); font-family: inherit; font-size: 0.85rem; padding: 2px 4px; border-radius: 4px; transition: border-color 0.2s;" />
                <button type="button" class="btn-icon promote-btn" style="padding: 2px; color: var(--accent)" title="Transformar em atividade">
                    <i class="ph ph-arrow-u-up-right"></i>
                </button>
                <button type="button" class="btn-icon delete-btn" style="padding: 2px; color: var(--danger)" title="Excluir">
                    <i class="ph ph-trash"></i>
                </button>
            `;
            const textInput = div.querySelector('.subtask-edit-input');
            textInput.addEventListener('change', (e) => {
                st.title = e.target.value.trim() || 'Sem título';
            });
            textInput.addEventListener('focus', () => textInput.style.border = '1px solid var(--border)');
            textInput.addEventListener('blur', () => textInput.style.border = '1px solid transparent');

            const promoteBtn = div.querySelector('.promote-btn');
            promoteBtn.addEventListener('click', async () => {
                const icon = promoteBtn.querySelector('i');
                const originalClass = icon.className;
                icon.className = 'ph ph-spinner ph-spin';
                promoteBtn.disabled = true;

                try {
                    currentNewTaskSubtasks = currentNewTaskSubtasks.filter(s => s.id !== st.id);
                    
                    const parentDate = dateInput ? dateInput.value : '';
                    const parentTag = tagSelect ? tagSelect.value : '';

                    const newTask = {
                        id: Date.now().toString(),
                        title: textInput.value.trim() || 'Nova Atividade do Checkpoint',
                        date: parentDate,
                        tagId: parentTag,
                        requesters: [],
                        notes: '',
                        azureCode: st.azureCode || '',
                        comments: [],
                        subtasks: [],
                        completed: false
                    };
                    tasks.push(newTask);
                    await saveTasks();
                    renderNewTaskSubtasks();
                } catch (err) {
                    icon.className = originalClass;
                    promoteBtn.disabled = false;
                }
            });

            const delBtn = div.querySelector('.delete-btn');
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
            const azure = addSubtaskAzure ? addSubtaskAzure.value.trim() : '';
            if (val) {
                currentNewTaskSubtasks.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    title: val,
                    azureCode: azure,
                    completed: false
                });
                addSubtaskInput.value = '';
                if (addSubtaskAzure) addSubtaskAzure.value = '';
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
            const azure = newSubtaskAzure ? newSubtaskAzure.value.trim() : '';
            if (val) {
                currentEditSubtasks.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    title: val,
                    azureCode: azure,
                    completed: false
                });
                newSubtaskInput.value = '';
                if (newSubtaskAzure) newSubtaskAzure.value = '';
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

    if (addCommentBtn) {
        addCommentBtn.addEventListener('click', () => {
            const text = newCommentInput.value.trim();
            if (text) {
                currentEditComments.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    text: text,
                    createdAt: new Date().toISOString()
                });
                newCommentInput.value = '';
                // Render list and scroll to bottom
                renderEditComments();
                setTimeout(() => commentsList.scrollTop = commentsList.scrollHeight, 10);
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
