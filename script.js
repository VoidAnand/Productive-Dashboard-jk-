// ----------------------
// TO-DO LIST
// ----------------------
function addTodo() {
    let text = document.getElementById("todoText").value;
    if (text.trim() === "") return;

    let list = document.getElementById("todoList");

    let li = document.createElement("li");
    li.innerHTML = `
        ${text}
        <span onclick="removeTodo(this)">✖</span>
    `;

    list.appendChild(li);
    document.getElementById("todoText").value = "";

    saveTodos();
}

function removeTodo(el) {
    el.parentElement.remove();
    saveTodos();
}

function saveTodos() {
    let todos = [];
    document.querySelectorAll("#todoList li").forEach(li => {
        todos.push(li.innerText.replace("✖", "").trim());
    });
    localStorage.setItem("todos", JSON.stringify(todos));
}

function loadTodos() {
    let saved = JSON.parse(localStorage.getItem("todos")) || [];
    saved.forEach(t => {
        let li = document.createElement("li");
        li.innerHTML = `${t} <span onclick="removeTodo(this)">✖</span>`;
        document.getElementById("todoList").appendChild(li);
    });
}

loadTodos();

// ----------------------
// POMODORO TIMER
// ----------------------
let time = 25 * 60;
let timerInterval = null;

function updateTimer() {
    let minutes = Math.floor(time / 60);
    let seconds = time % 60;

    document.getElementById("timer").innerText =
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startTimer() {
    if (timerInterval) return;

    timerInterval = setInterval(() => {
        if (time > 0) {
            time--;
            updateTimer();
        } else {
            clearInterval(timerInterval);
            timerInterval = null;
            alert("Time's up!");
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function resetTimer() {
    pauseTimer();
    time = 25 * 60;
    updateTimer();
}

updateTimer();

// ----------------------
// NOTES
// ----------------------
function saveNotes() {
    let text = document.getElementById("notes").value;
    localStorage.setItem("notes", text);
}

function loadNotes() {
    let saved = localStorage.getItem("notes");
    if (saved) document.getElementById("notes").value = saved;
}

loadNotes();
