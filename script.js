// Helper for date strings (YYYY-MM-DD)
function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Load tasks and migrate if needed (add date to old tasks)
let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
tasks = tasks.map(t => {
  if (!t.date) t.date = getTodayStr();
  if (!t.notes) t.notes = [];
  if (typeof t.notes === 'string' && t.notes) {
    t.notes = [t.notes];
  }
  if (typeof t.notes === 'string' && !t.notes) {
    t.notes = [];
  }
  if (!t.completedAt) t.completedAt = null;
  if (!t.subtasks) t.subtasks = [];
  if (t.parentId === undefined) t.parentId = null;
  return t;
});

// Selected date and start date (for day numbering)
let selectedDate = localStorage.getItem("selectedDate") || getTodayStr();
let startDate = localStorage.getItem("startDate") || selectedDate;
let currentCalendarMonth = new Date(selectedDate);
let currentNoteTaskIndex = null;
let editingNoteIndex = null;
let currentSummaryParentId = null;

// Chart instances
let weeklyActivityChart = null;
let taskDistributionChart = null;
let dailyCompletionChart = null;
let monthlyOverviewChart = null;

function saveAndRender() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
  localStorage.setItem("selectedDate", selectedDate);
  localStorage.setItem("startDate", startDate);
  renderTasks();
  updateDashboard();
  updateDayDisplay();
  renderCalendar();
  updateCharts();
  // Don't render saved notes here - only when eye icon is clicked
}

// Task Modal Functions
let subtaskInputCount = 0;

function openTaskModal() {
  document.getElementById('taskModal').style.display = 'flex';
  document.getElementById('mainTaskInput').value = '';
  document.getElementById('subtasksList').innerHTML = '';
  subtaskInputCount = 0;
  // Add one empty subtask input by default
  addSubtaskInput();
}

function closeTaskModal() {
  document.getElementById('taskModal').style.display = 'none';
}

function addSubtaskInput() {
  const subtasksList = document.getElementById('subtasksList');
  const inputId = `subtask-${subtaskInputCount++}`;
  
  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'subtask-input-wrapper';
  inputWrapper.innerHTML = `
    <input type="text" id="${inputId}" placeholder="Enter subtask" class="modal-input subtask-input">
    <button class="remove-subtask-btn" onclick="removeSubtaskInput(this)">✖</button>
  `;
  
  subtasksList.appendChild(inputWrapper);
  document.getElementById(inputId).focus();
}

function removeSubtaskInput(btn) {
  btn.parentElement.remove();
}

function saveTaskFromModal() {
  const mainTaskText = document.getElementById('mainTaskInput').value.trim();
  if (!mainTaskText) {
    alert('Please enter a main task');
    return;
  }
  
  // Create main task
  const mainTaskId = Date.now();
  tasks.push({
    text: mainTaskText,
    done: false,
    date: selectedDate,
    notes: [],
    subtasks: [],
    parentId: null,
    id: mainTaskId
  });
  
  // Get all subtask inputs
  const subtaskInputs = document.querySelectorAll('.subtask-input');
  subtaskInputs.forEach((input, index) => {
    const subtaskText = input.value.trim();
    if (subtaskText) {
      tasks.push({
        text: subtaskText,
        done: false,
        date: selectedDate,
        notes: [],
        subtasks: [],
        parentId: mainTaskId,
        id: mainTaskId + index + 1
      });
    }
  });
  
  closeTaskModal();
  saveAndRender();
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('taskModal');
  if (event.target === modal) {
    closeTaskModal();
  }
}

function toggleTask(index) {
  // index refers to the global tasks array index
  tasks[index].done = !tasks[index].done;
  
  // Record completion timestamp
  if (tasks[index].done) {
    tasks[index].completedAt = new Date().toISOString();
  } else {
    tasks[index].completedAt = null;
  }
  
  saveAndRender();
}

function addSubtask(parentIndex) {
  const parentTask = tasks[parentIndex];
  const subtaskText = prompt("Enter subtask:");
  if (!subtaskText) return;
  
  tasks.push({
    text: subtaskText,
    done: false,
    date: selectedDate,
    notes: [],
    subtasks: [],
    parentId: parentTask.id,
    id: Date.now()
  });
  
  saveAndRender();
}

function renderTasks() {
  const list = document.getElementById("taskList");
  list.innerHTML = "";

  // Render only tasks for the selected date (only parent tasks or tasks without parents)
  let any = false;
  tasks.forEach((task, index) => {
    if (task.date === selectedDate && !task.parentId) {
      any = true;
      const hasNotes = task.notes && task.notes.length > 0;
      
      // Get subtasks for this parent
      const subtasks = tasks.filter(t => t.parentId === task.id);
      const subtaskCount = subtasks.length;
      const completedSubtasks = subtasks.filter(t => t.done).length;
      
      // Format completion time and check if late
      let completionInfo = '';
      if (task.done && task.completedAt) {
        const completedDate = new Date(task.completedAt);
        const taskDate = new Date(task.date + 'T00:00:00');
        const isLate = completedDate.toDateString() !== taskDate.toDateString();
        
        const timeStr = completedDate.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        const dateStr = completedDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
        
        completionInfo = `
          <div class="completion-info ${isLate ? 'late' : 'on-time'}">
            <span class="completion-badge">${isLate ? '⚠️ Late' : '✓ On Time'}</span>
            <span class="completion-time">Completed: ${dateStr} at ${timeStr}</span>
          </div>
        `;
      }
      
      // Render parent task
      list.innerHTML += `
      <li class="parent-task">
        <div class="task-main">
          <input type="checkbox" ${task.done ? "checked" : ""}
            onclick="toggleTask(${index})">
          <span>${task.text}</span>
          <div class="task-actions">
            ${subtaskCount > 0 ? `<span class="subtask-count">${completedSubtasks}/${subtaskCount}</span>` : ''}
            <button class="add-subtask-btn" onclick="addSubtask(${index})" title="Add Subtask">✚</button>
            <button class="summary-btn" onclick="openNotesSummary(${index})" title="View Subtask Notes Summary">📑</button>
            
          </div>
        </div>
        ${completionInfo}
      </li>
    `;
      
      // Render subtasks
      subtasks.forEach((subtask) => {
        const subIndex = tasks.indexOf(subtask);
        const subHasNotes = subtask.notes && subtask.notes.length > 0;
        
        let subCompletionInfo = '';
        if (subtask.done && subtask.completedAt) {
          const completedDate = new Date(subtask.completedAt);
          const taskDate = new Date(subtask.date + 'T00:00:00');
          const isLate = completedDate.toDateString() !== taskDate.toDateString();
          
          const timeStr = completedDate.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          const dateStr = completedDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
          
          subCompletionInfo = `
            <div class="completion-info ${isLate ? 'late' : 'on-time'}">
              <span class="completion-badge">${isLate ? '⚠️ Late' : '✓ On Time'}</span>
              <span class="completion-time">Completed: ${dateStr} at ${timeStr}</span>
            </div>
          `;
        }
        
        list.innerHTML += `
        <li class="subtask">
          <div class="task-main">
            <input type="checkbox" ${subtask.done ? "checked" : ""}
              onclick="toggleTask(${subIndex})">
            <span>${subtask.text}</span>
           
          </div>
          ${subCompletionInfo}
        </li>
      `;
      });
    }
  });

  if (!any) {
    list.innerHTML = `<li class="empty">No tasks for this day.</li>`;
  }
}

function updateDashboard() {
  // Dashboard shows stats for the selected date
  const dayTasks = tasks.filter(t => t.date === selectedDate);
  const total = dayTasks.length;
  const completed = dayTasks.filter(t => t.done).length;
  const pending = total - completed;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  document.getElementById("progressBar").style.width = percent + "%";
  document.getElementById("progressText").innerText = percent + "% Completed";

  document.getElementById("totalTasks").innerText = total;
  document.getElementById("completedTasks").innerText = completed;
  document.getElementById("pendingTasks").innerText = pending;
}

function updateDayDisplay() {
  const start = new Date(startDate);
  const sel = new Date(selectedDate);
  const diff = Math.round((sel - start) / (1000 * 60 * 60 * 24));
  const dayNumber = diff + 1;
  document.getElementById("dayDisplay").innerText = `Day ${dayNumber} - ${selectedDate}`;
}

function changeDay(offset) {
  const d = new Date(selectedDate);
  d.setDate(d.getDate() + offset);
  selectedDate = d.toISOString().slice(0, 10);
  closeNotes(); // Close notes when changing date
  saveAndRender();
}

function goToToday() {
  selectedDate = getTodayStr();
  currentCalendarMonth = new Date(selectedDate);
  closeNotes(); // Close notes when going to today
  saveAndRender();
}

// delete completed tasks only for the current selected day
function deleteTask() {
  tasks = tasks.filter(task => !(task.date === selectedDate && task.done));
  saveAndRender();
}

// Calendar functions
function changeMonth(offset) {
  currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + offset);
  renderCalendar();
}

function selectDate(dateStr) {
  selectedDate = dateStr;
  closeNotes(); // Close notes when selecting a new date
  saveAndRender();
}

function renderCalendar() {
  const year = currentCalendarMonth.getFullYear();
  const month = currentCalendarMonth.getMonth();
  
  // Update month display
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  document.getElementById("monthDisplay").innerText = `${monthNames[month]} ${year}`;
  
  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const calendarDates = document.getElementById("calendarDates");
  calendarDates.innerHTML = "";
  
  // Add empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "calendar-date empty";
    calendarDates.appendChild(emptyDiv);
  }
  
  // Add days of the month
  const today = getTodayStr();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateDiv = document.createElement("div");
    dateDiv.className = "calendar-date";
    dateDiv.innerText = day;
    dateDiv.onclick = () => selectDate(dateStr);
    
    // Highlight today
    if (dateStr === today) {
      dateDiv.classList.add("today");
    }
    
    // Highlight selected date
    if (dateStr === selectedDate) {
      dateDiv.classList.add("selected");
    }
    
    // Show indicator if date has tasks
    const hasTasks = tasks.some(t => t.date === dateStr);
    if (hasTasks) {
      dateDiv.classList.add("has-tasks");
    }
    
    calendarDates.appendChild(dateDiv);
  }
}

// Notes functions
function openNotes(index) {
  // Close notes if clicking on a different task
  if (currentNoteTaskIndex !== null && currentNoteTaskIndex !== index) {
    closeNotes();
  }
  
  // If we were in summary view, clear it
  currentSummaryParentId = null;

  currentNoteTaskIndex = index;
  editingNoteIndex = null;
  const task = tasks[index];
  
  document.getElementById("notesCard").style.display = "block";
  document.getElementById("notesTaskTitle").innerText = `Notes: ${task.text}`;
  document.getElementById("notesTextarea").innerHTML = "";
  document.getElementById("noteEditorContainer").style.display = "none";
  document.getElementById("addNoteBtn").style.display = "block";
  document.querySelector(".save-notes-btn").innerText = "Save Note";
  
  // Render saved notes for this task
  renderSavedNotes();
  
  // Scroll to notes card
  document.getElementById("notesCard").scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function openNotesSummary(parentIndex) {
  // Close notes if switching
  if (currentSummaryParentId !== null && currentSummaryParentId !== tasks[parentIndex].id) {
    closeNotes();
  }

  currentSummaryParentId = tasks[parentIndex].id;
  currentNoteTaskIndex = null;
  editingNoteIndex = null;

  const parentTask = tasks[parentIndex];
  document.getElementById("notesCard").style.display = "block";
  document.getElementById("notesTaskTitle").innerText = `Notes Summary: ${parentTask.text}`;
  document.getElementById("notesTextarea").innerHTML = "";
  // Hide editor for summary view
  document.getElementById("noteEditorContainer").style.display = "none";
  document.getElementById("addNoteBtn").style.display = "none";
  document.querySelector(".save-notes-btn").innerText = "Save Note";

  renderSavedNotes();
  document.getElementById("notesCard").scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeNotes() {
  document.getElementById("notesCard").style.display = "none";
  document.getElementById("noteEditorContainer").style.display = "none";
  document.getElementById("addNoteBtn").style.display = "block";
  document.getElementById("savedNotesContainer").innerHTML = ""; // Clear saved notes display
  currentNoteTaskIndex = null;
  editingNoteIndex = null;
  currentSummaryParentId = null;
  document.getElementById("notesTextarea").innerHTML = "";
}

function toggleNoteEditor() {
  const editorContainer = document.getElementById("noteEditorContainer");
  const addBtn = document.getElementById("addNoteBtn");
  
  if (editorContainer.style.display === "none") {
    editorContainer.style.display = "block";
    addBtn.style.display = "none";
    document.getElementById("notesTextarea").focus();
  } else {
    editorContainer.style.display = "none";
    addBtn.style.display = "block";
  }
}

function formatText(command) {
  document.execCommand(command, false, null);
  document.getElementById("notesTextarea").focus();
}

function saveNotes() {
  if (currentNoteTaskIndex !== null) {
    const notesEditor = document.getElementById("notesTextarea");
    const notesHTML = notesEditor.innerHTML.trim();
    const notesText = notesEditor.innerText.trim();
    
    if (!notesText) return;
    
    if (editingNoteIndex !== null) {
      // Editing existing note
      tasks[currentNoteTaskIndex].notes[editingNoteIndex] = notesHTML;
    } else {
      // Adding new note
      tasks[currentNoteTaskIndex].notes.push(notesHTML);
    }
    
    saveAndRender();
    
    // Clear editor and hide it
    document.getElementById("notesTextarea").innerHTML = "";
    document.getElementById("noteEditorContainer").style.display = "none";
    document.getElementById("addNoteBtn").style.display = "block";
    editingNoteIndex = null;
    
    // Re-render saved notes to show the new/updated note
    renderSavedNotes();
    
    // Show success feedback
    const btn = document.querySelector(".save-notes-btn");
    btn.innerText = "Saved ✓";
    setTimeout(() => {
      btn.innerText = "Save Note";
    }, 1000);
  }
}

function renderSavedNotes() {
  const container = document.getElementById("savedNotesContainer");
  container.innerHTML = "";
  
  // If summary view is active, aggregate notes from subtasks
  if (currentSummaryParentId !== null) {
    const subtasks = tasks.filter(t => t.parentId === currentSummaryParentId);
    if (subtasks.length === 0) {
      container.innerHTML = `<div class="card">No subtasks for this task.</div>`;
      return;
    }

    let anyNotes = false;
    subtasks.forEach((subtask) => {
      const subIndex = tasks.indexOf(subtask);
      const wrapper = document.createElement('div');
      wrapper.className = 'card saved-note-card';
      let inner = `<div class="saved-note-header"><h4>${subtask.text}</h4><div class="note-actions"><button class="open-subtask-notes" onclick="openNotes(${subIndex})" title="Open Subtask Notes">Open</button></div></div>`;
      if (subtask.notes && subtask.notes.length > 0) {
        anyNotes = true;
        subtask.notes.forEach((note, noteIndex) => {
          inner += `<p class="note-content">${note}</p>`;
        });
      } else {
        inner += `<p class="note-content muted">No notes for this subtask.</p>`;
      }
      wrapper.innerHTML = inner;
      container.appendChild(wrapper);
    });

    if (!anyNotes) {
      // If none of the subtasks have notes, show message
      container.insertAdjacentHTML('afterbegin', `<div class="card">No notes found for any subtasks.</div>`);
    }
    return;
  }

  // Default: show notes for a specific task
  if (currentNoteTaskIndex !== null && tasks[currentNoteTaskIndex]) {
    const task = tasks[currentNoteTaskIndex];
    
    if (task.notes && task.notes.length > 0) {
      task.notes.forEach((note, noteIndex) => {
        const noteCard = document.createElement("div");
        noteCard.className = "card saved-note-card";
        noteCard.innerHTML = `
          <div class="saved-note-header">
            <h4>Note ${noteIndex + 1}</h4>
            <div class="note-actions">
              <button class="edit-note-btn" onclick="editNote(${currentNoteTaskIndex}, ${noteIndex})" title="Edit Note">🖊️</button>
              <button class="delete-note-btn" onclick="deleteNote(${currentNoteTaskIndex}, ${noteIndex})" title="Delete Note">🗑️</button>
            </div>
          </div>
          <p class="note-content">${note}</p>
        `;
        container.appendChild(noteCard);
      });
    }
  }
}

function editNote(taskIndex, noteIndex) {
  currentNoteTaskIndex = taskIndex;
  editingNoteIndex = noteIndex;
  const note = tasks[taskIndex].notes[noteIndex];
  
  document.getElementById("notesCard").style.display = "block";
  document.getElementById("notesTaskTitle").innerText = `Edit Note ${noteIndex + 1}: ${tasks[taskIndex].text}`;
  document.getElementById("notesTextarea").innerHTML = note;
  document.getElementById("noteEditorContainer").style.display = "block";
  document.getElementById("addNoteBtn").style.display = "none";
  document.querySelector(".save-notes-btn").innerText = "Update Note";
  
  document.getElementById("notesCard").scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function deleteNote(taskIndex, noteIndex) {
  if (confirm("Delete this note?")) {
    tasks[taskIndex].notes.splice(noteIndex, 1);
    saveAndRender();
    // Re-render saved notes after deletion
    renderSavedNotes();
  }
}

// Export and Email Functions
function exportToCSV() {
  // Gather all tasks with notes
  const tasksWithNotes = tasks.filter(t => t.notes && t.notes.length > 0);
  
  if (tasksWithNotes.length === 0) {
    alert("No notes to export!");
    return;
  }
  
  // Create CSV content
  let csvContent = "Date,Day,Task,Note Number,Note Content\n";
  
  tasksWithNotes.forEach(task => {
    const start = new Date(startDate);
    const taskDate = new Date(task.date);
    const dayNumber = Math.round((taskDate - start) / (1000 * 60 * 60 * 24)) + 1;
    
    task.notes.forEach((note, index) => {
      // Remove HTML tags for CSV
      const plainNote = note.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').replace(/"/g, '""');
      csvContent += `"${task.date}","Day ${dayNumber}","${task.text}","${index + 1}","${plainNote}"\n`;
    });
  });
  
  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  const filename = `study-tracker-notes-${getTodayStr()}.csv`;
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  alert(`Notes exported successfully!\nFile: ${filename}`);
}

function emailNotes() {
  // Gather all tasks with notes
  const tasksWithNotes = tasks.filter(t => t.notes && t.notes.length > 0);
  
  if (tasksWithNotes.length === 0) {
    alert("No notes to email!");
    return;
  }
  
  // Create email body
  let emailBody = "Study Tracker - Notes Summary\n";
  emailBody += "=" .repeat(50) + "\n\n";
  
  tasksWithNotes.forEach(task => {
    const start = new Date(startDate);
    const taskDate = new Date(task.date);
    const dayNumber = Math.round((taskDate - start) / (1000 * 60 * 60 * 24)) + 1;
    
    emailBody += `Date: ${task.date} (Day ${dayNumber})\n`;
    emailBody += `Task: ${task.text}\n`;
    emailBody += `Status: ${task.done ? 'Completed ✓' : 'Pending'}\n`;
    emailBody += `Number of Notes: ${task.notes.length}\n`;
    emailBody += "-" .repeat(30) + "\n";
    
    task.notes.forEach((note, index) => {
      // Remove HTML tags for email
      const plainNote = note.replace(/<[^>]*>/g, '\n').trim();
      emailBody += `\nNote ${index + 1}:\n${plainNote}\n`;
    });
    
    emailBody += "\n" + "=" .repeat(50) + "\n\n";
  });
  
  // Create mailto link
  const subject = `Study Tracker Notes - ${getTodayStr()}`;
  const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
  
  // Open email client
  window.location.href = mailtoLink;
}

// Charts Functions
function updateCharts() {
  updateWeeklyActivityChart();
  updateTaskDistributionChart();
  updateDailyCompletionChart();
  updateMonthlyOverviewChart();
}

function updateWeeklyActivityChart() {
  const ctxEl = document.getElementById('weeklyActivityChart');
  if (!ctxEl) return;
  const ctx = ctxEl.getContext('2d');
  
  // Get last 7 days data
  const today = new Date();
  const labels = [];
  const completedData = [];
  const pendingData = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    
    const dayTasks = tasks.filter(t => t.date === dateStr);
    const completed = dayTasks.filter(t => t.done).length;
    const pending = dayTasks.length - completed;
    
    labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    completedData.push(completed);
    pendingData.push(pending);
  }
  
  if (weeklyActivityChart) {
    weeklyActivityChart.destroy();
  }
  
  weeklyActivityChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Completed',
          data: completedData,
          backgroundColor: (() => {
            const g = ctx.createLinearGradient(0, 0, 0, 200);
            g.addColorStop(0, '#438BC4'); // Bluebird
            g.addColorStop(1, '#8CC1E9'); // Clear Skies
            return g;
          })(),
          borderRadius: 8,
          barThickness: 25
        },
        {
          label: 'Pending',
          data: pendingData,
          backgroundColor: (() => {
            const g = ctx.createLinearGradient(0, 0, 0, 200);
            g.addColorStop(0, '#8CC1E9'); // Clear Skies
            g.addColorStop(1, '#FFF8E7'); // Clouds
            return g;
          })(),
          borderRadius: 8,
          barThickness: 25
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

function updateTaskDistributionChart() {
  const ctxEl = document.getElementById('taskDistributionChart');
  if (!ctxEl) return;
  const ctx = ctxEl.getContext('2d');
  
  const totalTasks = tasks.length;
  const completed = tasks.filter(t => t.done).length;
  const pending = totalTasks - completed;
  
  if (taskDistributionChart) {
    taskDistributionChart.destroy();
  }
  
  taskDistributionChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Completed', 'Pending'],
      datasets: [{
        data: [completed, pending],
        backgroundColor: [
          (() => { const g = ctx.createLinearGradient(0,0,200,0); g.addColorStop(0,'#0055A0'); g.addColorStop(1,'#438BC4'); return g; })(),
          '#8CC1E9'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'bottom'
        }
      }
    }
  });
}

function updateDailyCompletionChart() {
  const ctxEl = document.getElementById('dailyCompletionChart');
  if (!ctxEl) return;
  const ctx = ctxEl.getContext('2d');
  
  // Get last 14 days data
  const today = new Date();
  const labels = [];
  const percentages = [];
  
  for (let i = 13; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    
    const dayTasks = tasks.filter(t => t.date === dateStr);
    const completed = dayTasks.filter(t => t.done).length;
    const percent = dayTasks.length > 0 ? Math.round((completed / dayTasks.length) * 100) : 0;
    
    labels.push(date.getDate());
    percentages.push(percent);
  }
  
  if (dailyCompletionChart) {
    dailyCompletionChart.destroy();
  }
  
  dailyCompletionChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Completion %',
        data: percentages,
        borderColor: '#438BC4',
        backgroundColor: 'rgba(67, 139, 196, 0.12)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#438BC4',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    }
  });
}

function updateMonthlyOverviewChart() {
  const ctxEl = document.getElementById('monthlyOverviewChart');
  if (!ctxEl) return;
  const ctx = ctxEl.getContext('2d');
  
  // Get current month data by week
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const completedData = [0, 0, 0, 0];
  const totalData = [0, 0, 0, 0];
  
  tasks.forEach(task => {
    const taskDate = new Date(task.date);
    if (taskDate.getFullYear() === year && taskDate.getMonth() === month) {
      const day = taskDate.getDate();
      const weekIndex = Math.min(Math.floor((day - 1) / 7), 3);
      
      totalData[weekIndex]++;
      if (task.done) {
        completedData[weekIndex]++;
      }
    }
  });
  
  if (monthlyOverviewChart) {
    monthlyOverviewChart.destroy();
  }
  
  monthlyOverviewChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Completed',
          data: completedData,
          backgroundColor: (() => { const g = ctx.createLinearGradient(0,0,0,200); g.addColorStop(0,'#0055A0'); g.addColorStop(1,'#12284B'); return g; })(),
          borderRadius: 8
        },
        {
          label: 'Total',
          data: totalData,
          backgroundColor: '#8CC1E9',
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

// Initial Load
renderTasks();
updateDashboard();
updateDayDisplay();
renderCalendar();
updateCharts();