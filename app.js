// Get all DOM elements
let themeToggle = document.getElementById('themeToggle');
let taskForm = document.getElementById('taskForm');
let taskInput = document.getElementById('taskInput');
let taskList = document.getElementById('taskList');
let toastContainer = document.getElementById('toastContainer');
let startBtn = document.getElementById('startBtn');
let pauseBtn = document.getElementById('pauseBtn');
let resetBtn = document.getElementById('resetBtn');
let timerTime = document.getElementById('timerTime');
let timerSession = document.getElementById('timerSession');
let timerCircle = document.getElementById('timerCircle');
let scoreDisplay = document.getElementById('scoreDisplay');
let weeklyAverage = document.getElementById('weeklyAverage');
let scoreChart = document.getElementById('scoreChart');

// Application state
let currentSection = 'today';
let currentStatus = 'todo';
let tasks = loadTasks();
let theme = loadTheme();

// Timer state
let workDuration = 25 * 60;
let breakDuration = 5 * 60;
let timeLeft = workDuration;
let isRunning = false;
let isWorkSession = true;
let timerInterval = null;

// Productivity tracking state
let scores = loadScores();
let today = new Date().toISOString().split('T')[0];
let chartCtx = null;

// Data Management Functions
function loadTasks() {
    try {
        const saved = localStorage.getItem('taskflow_tasks');
        return saved ? JSON.parse(saved) : {
            today: { todo: [], completed: [], 'wont-do': [], trash: [] },
            week: { todo: [], completed: [], 'wont-do': [], trash: [] }
        };
    } catch (error) {
        console.error('Error loading tasks:', error);
        return {
            today: { todo: [], completed: [], 'wont-do': [], trash: [] },
            week: { todo: [], completed: [], 'wont-do': [], trash: [] }
        };
    }
}

function saveTasks() {
    try {
        localStorage.setItem('taskflow_tasks', JSON.stringify(tasks));
    } catch (error) {
        console.error('Error saving tasks:', error);
    }
}

function loadTheme() {
    try {
        return localStorage.getItem('taskflow_theme') || 'light';
    } catch (error) {
        console.error('Error loading theme:', error);
        return 'light';
    }
}

function saveTheme() {
    try {
        localStorage.setItem('taskflow_theme', theme);
    } catch (error) {
        console.error('Error saving theme:', error);
    }
}

function loadScores() {
    try {
        const saved = localStorage.getItem('taskflow_scores');
        return saved ? JSON.parse(saved) : {};
    } catch (error) {
        console.error('Error loading scores:', error);
        return {};
    }
}

function saveScores() {
    try {
        localStorage.setItem('taskflow_scores', JSON.stringify(scores));
    } catch (error) {
        console.error('Error saving scores:', error);
    }
}

function loadTimerState() {
    try {
        const saved = localStorage.getItem('taskflow_timer');
        if (saved) {
            const state = JSON.parse(saved);
            timeLeft = state.timeLeft;
            isWorkSession = state.isWorkSession;
            updateTimerDisplay();
        }
    } catch (error) {
        console.error('Error loading timer state:', error);
    }
}

function saveTimerState() {
    try {
        const state = {
            timeLeft: timeLeft,
            isWorkSession: isWorkSession
        };
        localStorage.setItem('taskflow_timer', JSON.stringify(state));
    } catch (error) {
        console.error('Error saving timer state:', error);
    }
}

// Theme Management Functions
function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    applyTheme();
    saveTheme();
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggle) {
        themeToggle.classList.toggle('active', theme === 'dark');
    }
}

// Section Management Functions
function switchSection(section) {
    currentSection = section;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });

    renderTasks();
    updateStatusCounts();
}

function switchStatus(status) {
    currentStatus = status;

    document.querySelectorAll('.status-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === status);
    });

    renderTasks();
}

// Task Management Functions
function addTask() {
    if (!taskInput) return;

    const text = taskInput.value.trim();

    if (!text) {
        showToast('Please enter a task', 'error');
        return;
    }

    const task = {
        id: Date.now(),
        text: text,
        createdAt: new Date().toISOString(),
        status: 'todo'
    };

    tasks[currentSection].todo.push(task);
    saveTasks();

    taskInput.value = '';
    renderTasks();
    updateStatusCounts();
    showToast('Task added successfully', 'success');
}

function validateInput(input) {
    const submitBtn = document.querySelector('.add-btn');
    if (submitBtn) {
        submitBtn.disabled = !input.value.trim();
    }
}

function updateTaskStatus(taskId, newStatus) {
    const section = tasks[currentSection];
    let task = null;

    Object.keys(section).forEach(status => {
        const index = section[status].findIndex(t => t.id === taskId);
        if (index !== -1) {
            task = section[status].splice(index, 1)[0];
        }
    });

    if (task) {
        task.status = newStatus;
        section[newStatus].push(task);
        saveTasks();
        renderTasks();
        updateStatusCounts();

        const statusNames = {
            'todo': 'To Do',
            'completed': 'Completed',
            'wont-do': 'Won\'t Do',
            'trash': 'Trash'
        };

        showToast(`Task moved to ${statusNames[newStatus]}`, 'success');
    }
}

function deleteTask(taskId) {
    const section = tasks[currentSection];

    Object.keys(section).forEach(status => {
        const index = section[status].findIndex(t => t.id === taskId);
        if (index !== -1) {
            section[status].splice(index, 1);
        }
    });

    saveTasks();
    renderTasks();
    updateStatusCounts();
    showToast('Task deleted permanently', 'error');
}

// Rendering Functions
function renderTasks() {
    if (!taskList) return;

    const currentTasks = tasks[currentSection][currentStatus];

    if (currentTasks.length === 0) {
        taskList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${getEmptyStateIcon()}</div>
                <div>${getEmptyStateMessage()}</div>
            </div>
        `;
    } else {
        taskList.innerHTML = currentTasks.map(task => createTaskElement(task)).join('');
        bindTaskEvents();
    }

    // Update productivity score
    updateProductivityScore(tasks[currentSection]);
}

function createTaskElement(task) {
    const isCompleted = task.status === 'completed';
    const actions = getTaskActions(task);

    return `
        <div class="task-item ${isCompleted ? 'completed' : ''}" data-id="${task.id}">
            <div class="task-content">
                <div class="task-checkbox ${isCompleted ? 'checked' : ''}" data-id="${task.id}">
                    ${isCompleted ? '✓' : ''}
                </div>
                <div class="task-text">${escapeHtml(task.text)}</div>
                <div class="task-actions">
                    ${actions}
                </div>
            </div>
        </div>
    `;
}

function getTaskActions(task) {
    const actions = [];

    if (task.status !== 'completed') {
        actions.push(`<button class="task-action-btn btn-complete" data-id="${task.id}" data-action="complete">✓</button>`);
    }

    if (task.status !== 'wont-do') {
        actions.push(`<button class="task-action-btn btn-wont-do" data-id="${task.id}" data-action="wont-do">✗</button>`);
    }

    if (task.status !== 'trash') {
        actions.push(`<button class="task-action-btn btn-delete" data-id="${task.id}" data-action="trash">🗑</button>`);
    } else {
        actions.push(`<button class="task-action-btn btn-delete" data-id="${task.id}" data-action="delete">🗑</button>`);
    }

    return actions.join('');
}

function bindTaskEvents() {
    document.querySelectorAll('.task-item').forEach((item, index) => {
        setTimeout(() => {
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        }, index * 50);
    });

    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
        checkbox.addEventListener('click', () => {
            const taskId = Number(checkbox.dataset.id);
            const task = tasks[currentSection][currentStatus].find(t => t.id === taskId);
            if (!task) return;

            const newStatus = task.status === 'completed' ? 'todo' : 'completed';
            updateTaskStatus(taskId, newStatus);
        });
    });

    document.querySelectorAll('.task-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const taskId = Number(btn.dataset.id);
            const action = btn.dataset.action;

            if (action === 'complete') {
                updateTaskStatus(taskId, 'completed');
            } else if (action === 'wont-do') {
                updateTaskStatus(taskId, 'wont-do');
            } else if (action === 'trash') {
                updateTaskStatus(taskId, 'trash');
            } else if (action === 'delete') {
                deleteTask(taskId);
            }
        });
    });
}

function updateStatusCounts() {
    document.querySelectorAll('.status-tab').forEach(tab => {
        const status = tab.dataset.status;
        const count = tasks[currentSection][status].length;
        const countElement = tab.querySelector('.count');
        if (countElement) {
            countElement.textContent = count;
        }
    });
}

// Timer Functions
function startTimer() {
    if (!isRunning) {
        isRunning = true;
        timerInterval = setInterval(() => timerTick(), 1000);
        
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = 'inline-block';
        
        showToast('Timer started', 'success');
    }
}

function pauseTimer() {
    if (isRunning) {
        isRunning = false;
        clearInterval(timerInterval);
        
        if (startBtn) startBtn.style.display = 'inline-block';
        if (pauseBtn) pauseBtn.style.display = 'none';
        
        saveTimerState();
        showToast('Timer paused', 'info');
    }
}

function resetTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    timeLeft = isWorkSession ? workDuration : breakDuration;
    
    if (startBtn) startBtn.style.display = 'inline-block';
    if (pauseBtn) pauseBtn.style.display = 'none';
    
    updateTimerDisplay();
    saveTimerState();
    showToast('Timer reset', 'info');
}

function timerTick() {
    timeLeft--;
    updateTimerDisplay();
    saveTimerState();

    if (timeLeft <= 0) {
        completeTimer();
    }
}

function completeTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    
    showToast(`${isWorkSession ? 'Work' : 'Break'} session completed!`, 'success');
    
    playCompletionSound();
    isWorkSession = !isWorkSession;
    timeLeft = isWorkSession ? workDuration : breakDuration;
    
    if (startBtn) startBtn.style.display = 'inline-block';
    if (pauseBtn) pauseBtn.style.display = 'none';
    
    updateTimerDisplay();
    saveTimerState();
}

function updateTimerDisplay() {
    if (timerTime) {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    if (timerSession) {
        timerSession.textContent = isWorkSession ? 'Work Session' : 'Break Time';
    }

    if (timerCircle) {
        const totalTime = isWorkSession ? workDuration : breakDuration;
        const progress = ((totalTime - timeLeft) / totalTime) * 360;
        timerCircle.style.background = `conic-gradient(var(--accent-primary) ${progress}deg, var(--secondary-bg) ${progress}deg)`;
    }
}

function playCompletionSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        console.log('Audio not supported:', error);
    }
}

// Productivity Tracking Functions
function updateProductivityScore(sectionTasks) {
    const allTasks = [...sectionTasks.todo, ...sectionTasks.completed, ...sectionTasks['wont-do']];
    const total = allTasks.length;
    const completed = sectionTasks.completed.length;

    if (total === 0) {
        scores[today] = 0;
    } else {
        const score = Math.round((completed / total) * 10);
        scores[today] = score;
    }

    saveScores();
    updateProductivityUI();
}

function getEmoji(score) {
    if (score > 8) return '😎';
    if (score > 5) return '🙂';
    if (score > 2) return '😐';
    return '😞';
}

function getAverageWeeklyScore() {
    const last7 = Object.entries(scores)
        .sort((a, b) => new Date(b[0]) - new Date(a[0]))
        .slice(0, 7)
        .map(entry => entry[1]);

    if (last7.length === 0) return 0;
    const avg = last7.reduce((sum, val) => sum + val, 0) / last7.length;
    return Math.round(avg);
}

function updateProductivityUI() {
    if (scoreDisplay) {
        const todayScore = scores[today] || 0;
        const emoji = getEmoji(todayScore);
        scoreDisplay.textContent = `Today's Score: ${todayScore}/10 ${emoji}`;
    }

    if (weeklyAverage) {
        const average = getAverageWeeklyScore();
        weeklyAverage.textContent = `Weekly Avg: ${average}/10`;
    }
}


// Utility Functions
function getEmptyStateIcon() {
    const icons = {
        'todo': '📝',
        'completed': '✅',
        'wont-do': '❌',
        'trash': '🗑️'
    };
    return icons[currentStatus] || '📝';
}

function getEmptyStateMessage() {
    const messages = {
        'todo': 'No tasks yet. Add one above!',
        'completed': 'No completed tasks yet.',
        'wont-do': 'No abandoned tasks.',
        'trash': 'Trash is empty.'
    };
    return messages[currentStatus] || 'No tasks found.';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toastContainer.contains(toast)) {
                toastContainer.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Event Listeners
if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        switchSection(e.target.dataset.section);
    });
});

document.querySelectorAll('.status-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
        switchStatus(e.target.dataset.status);
    });
});

if (taskForm) {
    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addTask();
    });
}

if (taskInput) {
    taskInput.addEventListener('input', (e) => {
        validateInput(e.target);
    });
}

if (startBtn) {
    startBtn.addEventListener('click', startTimer);
}

if (pauseBtn) {
    pauseBtn.addEventListener('click', pauseTimer);
}

if (resetBtn) {
    resetBtn.addEventListener('click', resetTimer);
}

// Initialize Chart Context
if (scoreChart) {
    chartCtx = scoreChart.getContext('2d');
}

// Initialize Application
function initApp() {
    applyTheme();
    renderTasks();
    updateStatusCounts();
    updateTimerDisplay();
    loadTimerState();
    updateProductivityUI();
}

// Load saved theme
if (localStorage.getItem('taskflow_theme') === 'dark') {
    theme = 'dark';
    if (themeToggle) {
        themeToggle.checked = true;
    }
}

// Run initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW registered', reg))
            .catch(err => console.log('SW registration failed:', err));
    });
}