
/* =========================================================
   ORBIT — FRONTEND APPLICATION
   Sends data to Express and saves it in data.json.
   Also maintains a local browser backup.
========================================================= */

const STORAGE_KEYS = {
  tasks: "orbit_tasks",
  subscriptions: "orbit_subscriptions",
  bills: "orbit_bills",
  focus: "orbit_focus_today"
};

let tasks = [];
let subscriptions = [];
let bills = [];

let currentTaskFilter = "all";
let selectedDate = dateKey(new Date());

let plannerMonth = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1
);

let toastTimeout;
let saveQueue = Promise.resolve();

const pageInfo = {
  overview: {
    title: "Overview",
    subtitle: "Everything you need, all in one place."
  },
  planner: {
    title: "Planner",
    subtitle: "Your month, your tasks and your important dates."
  },
  tasks: {
    title: "To-do List",
    subtitle: "Plan your day and keep moving forward."
  },
  subscriptions: {
    title: "Subscriptions",
    subtitle: "Keep track of recurring services and renewals."
  },
  bills: {
    title: "Bills",
    subtitle: "Know what is due and what has been paid."
  },
  focus: {
    title: "Focus Mode",
    subtitle: "Make space for focused work and proper breaks."
  }
};


// Shortcut for selecting HTML elements.

const $ = (id) => document.getElementById(id);


// =========================================================
// 1. DATE AND GENERAL HELPER FUNCTIONS
// =========================================================

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function parseDate(value) {
  if (!value) return null;

  const parts = value.split("-").map(Number);

  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return null;
  }

  return new Date(
    parts[0],
    parts[1] - 1,
    parts[2],
    12
  );
}


function dateDifference(value, reference = dateKey(new Date())) {
  if (!value) return null;

  const firstParts = value.split("-").map(Number);
  const secondParts = reference.split("-").map(Number);

  if (firstParts.length !== 3 || secondParts.length !== 3) {
    return null;
  }

  const first = Date.UTC(
    firstParts[0],
    firstParts[1] - 1,
    firstParts[2]
  );

  const second = Date.UTC(
    secondParts[0],
    secondParts[1] - 1,
    secondParts[2]
  );

  return Math.round((first - second) / 86400000);
}


function formatDate(value, options = {}) {
  const date = parseDate(value);

  if (!date) return "No date set";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(options.year === false ? {} : { year: "numeric" })
  });
}


function formatLongDate(value) {
  const date = parseDate(value);

  if (!date) return "Choose a date";

  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}


function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(amount) || 0);
}


function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}


function makeId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}


function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}


function showToast(message) {
  const toast = $("toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}


// =========================================================
// 2. LOCAL STORAGE BACKUP
// =========================================================

function loadLocalBackup() {

  const read = (key) => {

    try {
      const parsed = JSON.parse(
        localStorage.getItem(key) || "[]"
      );

      return Array.isArray(parsed) ? parsed : [];

    } catch {
      return [];
    }

  };

  return {
    tasks: read(STORAGE_KEYS.tasks),
    subscriptions: read(STORAGE_KEYS.subscriptions),
    bills: read(STORAGE_KEYS.bills)
  };

}


function storeLocalBackup(data = {
  tasks,
  subscriptions,
  bills
}) {

  localStorage.setItem(
    STORAGE_KEYS.tasks,
    JSON.stringify(data.tasks)
  );

  localStorage.setItem(
    STORAGE_KEYS.subscriptions,
    JSON.stringify(data.subscriptions)
  );

  localStorage.setItem(
    STORAGE_KEYS.bills,
    JSON.stringify(data.bills)
  );

}


function updateConnectionStatus(isOnline, message) {

  const dot = document.querySelector(".status-dot");

  if (dot) {
    dot.className = `status-dot ${isOnline ? "online" : "offline"}`;
  }

  if ($("connectionStatus")) {
    $("connectionStatus").textContent = message;
  }

  if ($("saveStatus")) {
    $("saveStatus").textContent = isOnline
      ? "Saved to ORBIT data file"
      : "Browser backup active";
  }

}


// =========================================================
// 3. BACKEND COMMUNICATION
// =========================================================

// Send all current records to the backend.

async function saveData() {

  const snapshot = {
    tasks: [...tasks],
    subscriptions: [...subscriptions],
    bills: [...bills]
  };

  // Save a browser backup first.

  storeLocalBackup(snapshot);

  // Queue requests to avoid overlapping writes.

  saveQueue = saveQueue.then(async () => {

    const response = await fetch("/api/data", {
      method: "PUT",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(snapshot)
    });

    if (!response.ok) {
      throw new Error("The backend could not save the data.");
    }

    updateConnectionStatus(
      true,
      "Connected to local backend"
    );

  }).catch((error) => {

    console.error("Backend save failed:", error);

    updateConnectionStatus(
      false,
      "Browser backup active"
    );

    showToast(
      "Backend unavailable. Your browser backup was updated."
    );

  });

  return saveQueue;

}


// Load information from the backend.

async function loadData() {

  const localBackup = loadLocalBackup();

  try {

    const response = await fetch("/api/data");

    if (!response.ok) {
      throw new Error("Could not load data from the backend.");
    }

    const serverData = await response.json();

    const serverHasData = [
      "tasks",
      "subscriptions",
      "bills"
    ].some((key) => (
      Array.isArray(serverData[key]) &&
      serverData[key].length > 0
    ));

    const localHasData =
      localBackup.tasks.length +
      localBackup.subscriptions.length +
      localBackup.bills.length > 0;


    if (serverHasData) {

      tasks = Array.isArray(serverData.tasks)
        ? serverData.tasks
        : [];

      subscriptions = Array.isArray(serverData.subscriptions)
        ? serverData.subscriptions
        : [];

      bills = Array.isArray(serverData.bills)
        ? serverData.bills
        : [];

    } else if (localHasData) {

      // Migrate previous browser-only ORBIT information.

      tasks = localBackup.tasks;
      subscriptions = localBackup.subscriptions;
      bills = localBackup.bills;

      await saveData();

      showToast(
        "Your earlier ORBIT data has been moved to the backend."
      );

    } else {

      tasks = [];
      subscriptions = [];
      bills = [];

    }

    storeLocalBackup();

    updateConnectionStatus(
      true,
      "Connected to local backend"
    );

  } catch (error) {

    console.error("Backend load failed:", error);

    tasks = localBackup.tasks;
    subscriptions = localBackup.subscriptions;
    bills = localBackup.bills;

    updateConnectionStatus(
      false,
      "Browser backup active"
    );

    showToast(
      "Could not reach the backend. Using your browser backup."
    );

  }

}


// =========================================================
// 4. PAGE NAVIGATION
// =========================================================

function showPage(name) {

  if (!pageInfo[name]) return;

  document.querySelectorAll(".page-view").forEach((page) => {
    page.classList.remove("active");
  });

  document.querySelectorAll(".nav-link").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.page === name
    );
  });

  $(`view-${name}`).classList.add("active");

  $("pageTitle").textContent = pageInfo[name].title;
  $("pageSubtitle").textContent = pageInfo[name].subtitle;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


// Sidebar navigation.

document.querySelectorAll(".nav-link").forEach((button) => {

  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });

});


// Quick navigation buttons.

document.querySelectorAll("[data-go-page]").forEach((button) => {

  button.addEventListener("click", () => {
    showPage(button.dataset.goPage);
  });

});


// ORBIT logo navigation.

document.querySelectorAll("[data-page-link]").forEach((button) => {

  button.addEventListener("click", (event) => {
    event.preventDefault();
    showPage(button.dataset.pageLink);
  });

});


// =========================================================
// 5. TASK MANAGEMENT
// =========================================================

function isTaskOverdue(task) {

  return (
    !task.completed &&
    Boolean(task.dueDate) &&
    task.dueDate < dateKey(new Date())
  );

}


// Open the task form.

function openTaskForm(date = "") {

  $("taskForm").reset();

  $("taskEditId").value = "";

  $("taskFormTitle").textContent = "Create a new task";
  $("taskSubmit").textContent = "Save task";

  $("taskPriority").value = "medium";
  $("taskCategory").value = "Other";

  $("taskDate").value = date;

  $("taskForm").classList.remove("hidden");

  showPage("tasks");

  $("taskName").focus();

  $("taskForm").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

}


// Close a form.

function closeForm(formId) {

  $(formId).reset();
  $(formId).classList.add("hidden");

}


// Display tasks.

function renderTasks() {

  const list = $("taskList");

  const total = tasks.length;

  const completed = tasks.filter(
    (task) => task.completed
  ).length;

  const percentage = total
    ? Math.round((completed / total) * 100)
    : 0;


  $("taskProgressBar").style.width = `${percentage}%`;

  $("taskProgressLabel").textContent =
    `${percentage}% complete · ${completed}/${total} tasks`;


  let filtered = [...tasks];


  if (currentTaskFilter === "pending") {
    filtered = filtered.filter(
      (task) => !task.completed
    );
  }

  if (currentTaskFilter === "completed") {
    filtered = filtered.filter(
      (task) => task.completed
    );
  }

  if (currentTaskFilter === "overdue") {
    filtered = filtered.filter(isTaskOverdue);
  }


  filtered.sort((a, b) => {

    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }

    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;

    return a.dueDate.localeCompare(b.dueDate);

  });


  if (!filtered.length) {

    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i data-lucide="clipboard-list"></i>
        </div>

        <h4>
          ${tasks.length
            ? "No tasks in this view"
            : "Your to-do list is empty"}
        </h4>

        <p>
          ${tasks.length
            ? "Try another filter or add a new task."
            : "Add your first task and start organising your day."}
        </p>
      </div>
    `;

    refreshIcons();
    return;

  }


  list.innerHTML = filtered.map((task) => {

    const priority = [
      "low",
      "medium",
      "high"
    ].includes(task.priority)
      ? task.priority
      : "medium";

    const overdue = isTaskOverdue(task);

    const dueLabel = task.dueDate
      ? `Due ${formatDate(task.dueDate)}`
      : "No due date";


    return `
      <article
        class="item-card ${task.completed ? "is-complete" : ""}"
        data-record-id="${escapeHTML(task.id)}"
      >

        <button
          class="icon-button ${task.completed ? "complete-button" : ""}"
          data-action="toggle-task"
          data-id="${escapeHTML(task.id)}"
          title="${task.completed ? "Mark pending" : "Mark complete"}"
          aria-label="Toggle task completion"
        >
          <i data-lucide="${task.completed ? "check" : "circle"}"></i>
        </button>

        <div class="item-main">

          <h4>${escapeHTML(task.title)}</h4>

          <p>
            ${dueLabel}

            <span class="priority priority-${priority}">
              ${priority} priority
            </span>

            <span class="category-pill">
              ${escapeHTML(task.category || "Other")}
            </span>

            ${overdue
              ? '<span class="status-pill status-overdue">Overdue</span>'
              : ""}
          </p>

        </div>

        <div class="item-actions">

          <button
            class="icon-button"
            data-action="edit-task"
            data-id="${escapeHTML(task.id)}"
            title="Edit task"
            aria-label="Edit task"
          >
            <i data-lucide="pencil"></i>
          </button>

          <button
            class="icon-button delete-button"
            data-action="delete-task"
            data-id="${escapeHTML(task.id)}"
            title="Delete task"
            aria-label="Delete task"
          >
            <i data-lucide="trash-2"></i>
          </button>

        </div>

      </article>
    `;

  }).join("");


  refreshIcons();

}


// Add or update a task.

$("taskForm").addEventListener("submit", async (event) => {

  event.preventDefault();

  const id = $("taskEditId").value;

  const data = {
    title: $("taskName").value.trim(),
    dueDate: $("taskDate").value,
    priority: $("taskPriority").value,
    category: $("taskCategory").value
  };


  if (!data.title) {
    return showToast("Please enter a task name.");
  }


  if (id) {

    const task = tasks.find(
      (item) => String(item.id) === id
    );

    if (task) {
      Object.assign(task, data);
    }

    showToast("Task updated.");

  } else {

    tasks.push({
      id: makeId(),
      ...data,
      completed: false
    });

    showToast("Task added to your list.");

  }


  await saveData();

  closeForm("taskForm");

  renderAll();

});


// Edit an existing task.

function editTask(id) {

  const task = tasks.find(
    (item) => String(item.id) === String(id)
  );

  if (!task) return;

  $("taskEditId").value = task.id;
  $("taskName").value = task.title || "";
  $("taskDate").value = task.dueDate || "";
  $("taskPriority").value = task.priority || "medium";
  $("taskCategory").value = task.category || "Other";

  $("taskFormTitle").textContent = "Edit your task";
  $("taskSubmit").textContent = "Update task";

  $("taskForm").classList.remove("hidden");

  showPage("tasks");

  $("taskName").focus();

  $("taskForm").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

}


// Complete or reopen a task.

async function toggleTask(id) {

  const task = tasks.find(
    (item) => String(item.id) === String(id)
  );

  if (!task) return;

  task.completed = !task.completed;

  await saveData();

  renderAll();

  showToast(
    task.completed
      ? "Task completed!"
      : "Task moved back to pending."
  );

}


// Delete a task.

async function deleteTask(id) {

  tasks = tasks.filter(
    (item) => String(item.id) !== String(id)
  );

  await saveData();

  renderAll();

  showToast("Task deleted.");

}


// Task buttons.

$("showTaskForm").addEventListener("click", () => {
  openTaskForm();
});

$("cancelTask").addEventListener("click", () => {
  closeForm("taskForm");
});


// Task filters.

document.querySelectorAll("[data-task-filter]").forEach((button) => {

  button.addEventListener("click", () => {

    currentTaskFilter = button.dataset.taskFilter;

    document.querySelectorAll("[data-task-filter]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    renderTasks();

  });

});


// =========================================================
// 6. SUBSCRIPTION MANAGEMENT
// =========================================================

function renderSubscriptions() {

  const list = $("subscriptionList");

  if (!subscriptions.length) {

    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i data-lucide="repeat"></i>
        </div>

        <h4>No subscriptions added</h4>

        <p>
          Add your subscriptions to keep track of their costs and renewal dates.
        </p>
      </div>
    `;

    refreshIcons();
    return;

  }


  const sorted = [...subscriptions].sort((a, b) => {
    return (a.renewalDate || "9999").localeCompare(
      b.renewalDate || "9999"
    );
  });


  list.innerHTML = sorted.map((item) => {

    return `
      <article
        class="item-card"
        data-record-id="${escapeHTML(item.id)}"
      >

        <div class="preview-icon sub">
          <i data-lucide="repeat"></i>
        </div>

        <div class="item-main">

          <h4>${escapeHTML(item.name)}</h4>

          <p>
            Renews ${formatDate(item.renewalDate)}

            <span class="cycle-label">
              ${escapeHTML(item.cycle || "monthly")}
            </span>
          </p>

        </div>

        <div class="item-amount">
          ${formatMoney(item.amount)}
        </div>

        <div class="item-actions">

          <button
            class="icon-button"
            data-action="edit-subscription"
            data-id="${escapeHTML(item.id)}"
            title="Edit subscription"
            aria-label="Edit subscription"
          >
            <i data-lucide="pencil"></i>
          </button>

          <button
            class="icon-button delete-button"
            data-action="delete-subscription"
            data-id="${escapeHTML(item.id)}"
            title="Delete subscription"
            aria-label="Delete subscription"
          >
            <i data-lucide="trash-2"></i>
          </button>

        </div>

      </article>
    `;

  }).join("");


  refreshIcons();

}


// Add or update a subscription.

$("subscriptionForm").addEventListener("submit", async (event) => {

  event.preventDefault();

  const id = $("subscriptionEditId").value;

  const data = {
    name: $("subscriptionName").value.trim(),
    amount: Number($("subscriptionAmount").value),
    cycle: $("subscriptionCycle").value,
    renewalDate: $("subscriptionDate").value
  };


  if (
    !data.name ||
    !Number.isFinite(data.amount) ||
    data.amount < 0 ||
    !data.renewalDate
  ) {
    return showToast("Please enter valid subscription details.");
  }


  if (id) {

    const item = subscriptions.find(
      (entry) => String(entry.id) === id
    );

    if (item) {
      Object.assign(item, data);
    }

    showToast("Subscription updated.");

  } else {

    subscriptions.push({
      id: makeId(),
      ...data
    });

    showToast("Subscription added.");

  }


  await saveData();

  closeForm("subscriptionForm");

  renderAll();

});


// Edit subscription.

function editSubscription(id) {

  const item = subscriptions.find(
    (entry) => String(entry.id) === String(id)
  );

  if (!item) return;

  $("subscriptionEditId").value = item.id;
  $("subscriptionName").value = item.name || "";
  $("subscriptionAmount").value = item.amount ?? "";
  $("subscriptionCycle").value = item.cycle || "monthly";
  $("subscriptionDate").value = item.renewalDate || "";

  $("subscriptionFormTitle").textContent = "Edit subscription";
  $("subscriptionSubmit").textContent = "Update subscription";

  $("subscriptionForm").classList.remove("hidden");

  showPage("subscriptions");

  $("subscriptionName").focus();

}


// Delete subscription.

async function deleteSubscription(id) {

  subscriptions = subscriptions.filter(
    (item) => String(item.id) !== String(id)
  );

  await saveData();

  renderAll();

  showToast("Subscription deleted.");

}


// Subscription form buttons.

$("showSubscriptionForm").addEventListener("click", () => {

  $("subscriptionForm").reset();

  $("subscriptionEditId").value = "";

  $("subscriptionFormTitle").textContent = "Add a subscription";
  $("subscriptionSubmit").textContent = "Save subscription";

  $("subscriptionForm").classList.remove("hidden");

  $("subscriptionName").focus();

});


$("cancelSubscription").addEventListener("click", () => {
  closeForm("subscriptionForm");
});


// =========================================================
// 7. BILL MANAGEMENT
// =========================================================

function renderBills() {

  const list = $("billList");

  const unpaid = bills.filter((bill) => !bill.paid);
  const paid = bills.filter((bill) => bill.paid);


  $("unpaidBillCount").textContent = unpaid.length;
  $("paidBillCount").textContent = paid.length;

  $("allBillsTotal").textContent = formatMoney(
    bills.reduce(
      (sum, bill) => sum + (Number(bill.amount) || 0),
      0
    )
  );


  if (!bills.length) {

    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i data-lucide="receipt"></i>
        </div>

        <h4>No bills added</h4>

        <p>
          Add a bill to keep its due date and payment status in one place.
        </p>
      </div>
    `;

    refreshIcons();
    return;

  }


  const sorted = [...bills].sort((a, b) => {
    return (a.dueDate || "9999").localeCompare(
      b.dueDate || "9999"
    );
  });


  list.innerHTML = sorted.map((bill) => {

    return `
      <article
        class="item-card"
        data-record-id="${escapeHTML(bill.id)}"
      >

        <div class="preview-icon bill">
          <i data-lucide="receipt"></i>
        </div>

        <div class="item-main">

          <h4>${escapeHTML(bill.name)}</h4>

          <p>
            Due ${formatDate(bill.dueDate)}

            <span class="status-pill ${bill.paid ? "status-paid" : "status-unpaid"}">
              ${bill.paid ? "Paid" : "Unpaid"}
            </span>

            ${
              !bill.paid && dateDifference(bill.dueDate) < 0
                ? '<span class="status-pill status-overdue">Overdue</span>'
                : ""
            }
          </p>

        </div>

        <div class="item-amount">
          ${formatMoney(bill.amount)}
        </div>

        <div class="item-actions">

          <button
            class="icon-button ${bill.paid ? "complete-button" : ""}"
            data-action="toggle-bill"
            data-id="${escapeHTML(bill.id)}"
            title="${bill.paid ? "Mark unpaid" : "Mark paid"}"
            aria-label="Toggle bill payment"
          >
            <i data-lucide="${bill.paid ? "undo-2" : "check"}"></i>
          </button>

          <button
            class="icon-button"
            data-action="edit-bill"
            data-id="${escapeHTML(bill.id)}"
            title="Edit bill"
            aria-label="Edit bill"
          >
            <i data-lucide="pencil"></i>
          </button>

          <button
            class="icon-button delete-button"
            data-action="delete-bill"
            data-id="${escapeHTML(bill.id)}"
            title="Delete bill"
            aria-label="Delete bill"
          >
            <i data-lucide="trash-2"></i>
          </button>

        </div>

      </article>
    `;

  }).join("");


  refreshIcons();

}


// Add or update bill.

$("billForm").addEventListener("submit", async (event) => {

  event.preventDefault();

  const id = $("billEditId").value;

  const data = {
    name: $("billName").value.trim(),
    amount: Number($("billAmount").value),
    dueDate: $("billDate").value
  };


  if (
    !data.name ||
    !Number.isFinite(data.amount) ||
    data.amount < 0 ||
    !data.dueDate
  ) {
    return showToast("Please enter valid bill details.");
  }


  if (id) {

    const bill = bills.find(
      (item) => String(item.id) === id
    );

    if (bill) {
      Object.assign(bill, data);
    }

    showToast("Bill updated.");

  } else {

    bills.push({
      id: makeId(),
      ...data,
      paid: false
    });

    showToast("Bill added successfully.");

  }


  await saveData();

  closeForm("billForm");

  renderAll();

});


// Edit bill.

function editBill(id) {

  const bill = bills.find(
    (item) => String(item.id) === String(id)
  );

  if (!bill) return;

  $("billEditId").value = bill.id;
  $("billName").value = bill.name || "";
  $("billAmount").value = bill.amount ?? "";
  $("billDate").value = bill.dueDate || "";

  $("billFormTitle").textContent = "Edit your bill";
  $("billSubmit").textContent = "Update bill";

  $("billForm").classList.remove("hidden");

  showPage("bills");

  $("billName").focus();

}


// Mark bill paid or unpaid.

async function toggleBill(id) {

  const bill = bills.find(
    (item) => String(item.id) === String(id)
  );

  if (!bill) return;

  bill.paid = !bill.paid;

  await saveData();

  renderAll();

  showToast(
    bill.paid
      ? "Bill marked as paid."
      : "Bill marked as unpaid."
  );

}


// Delete bill.

async function deleteBill(id) {

  bills = bills.filter(
    (item) => String(item.id) !== String(id)
  );

  await saveData();

  renderAll();

  showToast("Bill deleted.");

}


// Bill form buttons.

$("showBillForm").addEventListener("click", () => {

  $("billForm").reset();

  $("billEditId").value = "";

  $("billFormTitle").textContent = "Add a new bill";
  $("billSubmit").textContent = "Save bill";

  $("billForm").classList.remove("hidden");

  $("billName").focus();

});


$("cancelBill").addEventListener("click", () => {
  closeForm("billForm");
});


// =========================================================
// 8. PLANNER AND CALENDAR
// =========================================================

// Collect all tasks, bills and subscription renewals
// and convert them into calendar events.

function getCalendarEvents() {

  const events = [];


  tasks.forEach((task) => {

    if (task.dueDate) {

      events.push({
        id: task.id,
        title: task.title,
        date: task.dueDate,
        kind: "task",
        detail: task.completed
          ? "Completed task"
          : `${task.priority || "medium"} priority task`,
        completed: Boolean(task.completed)
      });

    }

  });


  bills.forEach((bill) => {

    if (bill.dueDate) {

      events.push({
        id: bill.id,
        title: bill.name,
        date: bill.dueDate,
        kind: "bill",
        detail: bill.paid
          ? "Bill paid"
          : `Payment due · ${formatMoney(bill.amount)}`,
        completed: Boolean(bill.paid)
      });

    }

  });


  subscriptions.forEach((item) => {

    if (item.renewalDate) {

      events.push({
        id: item.id,
        title: item.name,
        date: item.renewalDate,
        kind: "sub",
        detail: `Renewal · ${formatMoney(item.amount)}`,
        completed: false
      });

    }

  });


  return events;

}


function eventsOnDate(value) {

  return getCalendarEvents().filter((event) => {
    return event.date === value;
  });

}


// Display schedule for the selected calendar day.

function renderSelectedDay() {

  const date = parseDate(selectedDate);

  $("selectedDateTitle").textContent =
    date?.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short"
    }) || "Selected day";

  $("selectedDateSubtitle").textContent =
    formatLongDate(selectedDate);


  const events = eventsOnDate(selectedDate);


  if (!events.length) {

    $("selectedDayItems").innerHTML = `
      <div class="day-empty">
        Nothing scheduled for this date yet.<br>
        Use the + button to add a task.
      </div>
    `;

    return;

  }


  const iconByKind = {
    task: "check-circle-2",
    bill: "receipt",
    sub: "repeat"
  };


  $("selectedDayItems").innerHTML = events.map((event) => {

    return `
      <div class="day-item">

        <span class="day-item-icon ${event.kind}">
          <i data-lucide="${iconByKind[event.kind]}"></i>
        </span>

        <span class="day-item-copy">
          <strong>${escapeHTML(event.title)}</strong>
          <small>${escapeHTML(event.detail)}</small>
        </span>

      </div>
    `;

  }).join("");


  refreshIcons();

}


// Display the monthly calendar.

function renderPlanner() {

  const year = plannerMonth.getFullYear();
  const month = plannerMonth.getMonth();


  $("plannerMonthTitle").textContent =
    plannerMonth.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric"
    });


  const firstDay = new Date(year, month, 1);

  // Monday-first calendar.

  const startOffset = (firstDay.getDay() + 6) % 7;

  const gridStart = new Date(
    year,
    month,
    1 - startOffset
  );


  const today = dateKey(new Date());
  const allEvents = getCalendarEvents();

  const html = [];


  // Six rows of seven days.

  for (let index = 0; index < 42; index++) {

    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index
    );

    const key = dateKey(date);

    const dayEvents = allEvents.filter((event) => {
      return event.date === key;
    });


    const classes = ["calendar-day"];

    if (date.getMonth() !== month) {
      classes.push("other-month");
    }

    if (key === today) {
      classes.push("today");
    }

    if (key === selectedDate) {
      classes.push("selected");
    }


    const chips = dayEvents.slice(0, 2).map((event) => {

      return `
        <span class="calendar-event ${event.kind}-event">
          ${escapeHTML(event.title)}
        </span>
      `;

    }).join("");


    const extra = dayEvents.length > 2
      ? `<span class="more-events">+${dayEvents.length - 2} more</span>`
      : "";


    html.push(`
      <button
        class="${classes.join(" ")}"
        data-calendar-date="${key}"
        aria-label="${formatLongDate(key)}; ${dayEvents.length} items"
      >

        <span class="day-number">${date.getDate()}</span>

        ${key === today
          ? '<span class="today-label">TODAY</span>'
          : ""}

        ${chips}

        ${extra}

      </button>
    `);

  }


  $("calendarGrid").innerHTML = html.join("");

  renderSelectedDay();

}


// Previous month.

$("previousMonth").addEventListener("click", () => {

  plannerMonth = new Date(
    plannerMonth.getFullYear(),
    plannerMonth.getMonth() - 1,
    1
  );

  selectedDate = dateKey(plannerMonth);

  renderPlanner();

});


// Next month.

$("nextMonth").addEventListener("click", () => {

  plannerMonth = new Date(
    plannerMonth.getFullYear(),
    plannerMonth.getMonth() + 1,
    1
  );

  selectedDate = dateKey(plannerMonth);

  renderPlanner();

});


// Return to current date.

$("goToday").addEventListener("click", () => {

  const now = new Date();

  plannerMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  selectedDate = dateKey(now);

  renderPlanner();

});


// Select a calendar date.

$("calendarGrid").addEventListener("click", (event) => {

  const button = event.target.closest("[data-calendar-date]");

  if (!button) return;

  selectedDate = button.dataset.calendarDate;

  const date = parseDate(selectedDate);

  plannerMonth = new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );

  renderPlanner();

});


// Add a task directly from the selected date.

$("addTaskForSelectedDate").addEventListener("click", () => {
  openTaskForm(selectedDate);
});


// =========================================================
// 9. REMINDERS
// =========================================================

function reminderText(value) {

  const difference = dateDifference(value);

  if (difference === 0) return "Due today";

  if (difference === 1) return "Due tomorrow";

  if (difference < 0) {
    return `Overdue by ${Math.abs(difference)} day${Math.abs(difference) === 1 ? "" : "s"}`;
  }

  return `In ${difference} days`;

}


function renderReminders() {

  const today = dateKey(new Date());


  // Due today or overdue.

  const todayEvents = getCalendarEvents().filter((event) => {

    if (event.kind === "task" && event.completed) return false;

    if (event.kind === "bill" && event.completed) return false;

    return event.date <= today;

  }).sort((a, b) => a.date.localeCompare(b.date));


  // Due in the next seven days.

  const upcoming = getCalendarEvents().filter((event) => {

    if (event.kind === "task" && event.completed) return false;

    if (event.kind === "bill" && event.completed) return false;

    const difference = dateDifference(event.date);

    return difference > 0 && difference <= 7;

  }).sort((a, b) => a.date.localeCompare(b.date));


  const renderRows = (events) => {

    if (!events.length) {

      return `
        <div class="empty-small">
          Nothing to show here right now.
        </div>
      `;

    }


    return events.slice(0, 5).map((event) => {

      const icon =
        event.kind === "task"
          ? "check-circle-2"
          : event.kind === "bill"
            ? "receipt"
            : "repeat";

      const kindClass =
        event.kind === "task" ? "" : event.kind;


      const typeLabel =
        event.kind === "task"
          ? "Task"
          : event.kind === "bill"
            ? "Bill"
            : "Subscription";


      return `
        <div class="preview-row">

          <span class="preview-icon ${kindClass}">
            <i data-lucide="${icon}"></i>
          </span>

          <span class="preview-details">
            <h4>${escapeHTML(event.title)}</h4>
            <p>${typeLabel} · ${reminderText(event.date)}</p>
          </span>

        </div>
      `;

    }).join("");

  };


  $("todayReminders").innerHTML = todayEvents.length
    ? renderRows(todayEvents)
    : `<div class="empty-small">No overdue or due-today items. You're all caught up!</div>`;

  $("upcomingReminders").innerHTML = renderRows(upcoming);

  refreshIcons();

}


// =========================================================
// 10. DASHBOARD
// =========================================================

function getFocusStats() {

  try {

    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.focus) || "{}"
    );

    if (saved.date !== dateKey(new Date())) {
      return {
        date: dateKey(new Date()),
        count: 0
      };
    }

    return {
      date: saved.date,
      count: Number(saved.count) || 0
    };

  } catch {

    return {
      date: dateKey(new Date()),
      count: 0
    };

  }

}


function updateDashboard() {

  const open = tasks.filter(
    (task) => !task.completed
  ).length;

  const completed = tasks.filter(
    (task) => task.completed
  ).length;

  const focusCount = getFocusStats().count;

  const now = new Date();

  const monthStart = dateKey(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );

  const monthEnd = dateKey(
    new Date(now.getFullYear(), now.getMonth() + 1, 0)
  );


  // Convert yearly subscriptions into monthly equivalents.

  const subscriptionMonthly = subscriptions.reduce(
    (sum, item) => {
      return sum +
        (Number(item.amount) || 0) /
        (item.cycle === "yearly" ? 12 : 1);
    },
    0
  );


  // Count only unpaid bills in the current month.

  const unpaidBillsThisMonth = bills
    .filter((bill) => (
      !bill.paid &&
      bill.dueDate >= monthStart &&
      bill.dueDate <= monthEnd
    ))
    .reduce(
      (sum, bill) => sum + (Number(bill.amount) || 0),
      0
    );


  $("statOpenTasks").textContent = open;

  $("statCompleted").textContent = completed;

  $("taskProgressText").textContent = tasks.length
    ? `${Math.round(completed / tasks.length * 100)}% of all tasks`
    : "Ready for your first task";

  $("statMonthlyCost").textContent =
    formatMoney(subscriptionMonthly + unpaidBillsThisMonth);

  $("statFocusSessions").textContent = focusCount;

  $("expenseTotal").textContent =
    formatMoney(subscriptionMonthly + unpaidBillsThisMonth);

  $("subscriptionEstimate").textContent =
    formatMoney(subscriptionMonthly);

  $("unpaidBillsTotal").textContent =
    formatMoney(unpaidBillsThisMonth);


  // Show pending tasks on the overview.

  const preview = [...tasks]
    .filter((task) => !task.completed)
    .sort((a, b) => (
      (a.dueDate || "9999").localeCompare(b.dueDate || "9999")
    ))
    .slice(0, 4);


  $("overviewTasks").innerHTML = preview.length
    ? preview.map((task) => `
        <div class="preview-row">

          <span class="preview-icon">
            <i data-lucide="check-circle-2"></i>
          </span>

          <span class="preview-details">
            <h4>${escapeHTML(task.title)}</h4>
            <p>${task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date"}</p>
          </span>

          <span class="preview-amount">
            ${escapeHTML(task.priority || "medium")}
          </span>

        </div>
      `).join("")
    : `<div class="empty-small">Your pending tasks will appear here. Add one whenever you're ready.</div>`;


  renderReminders();

  refreshIcons();

}


// =========================================================
// 11. GLOBAL SEARCH
// =========================================================

function searchItems(query) {

  const q = query.trim().toLowerCase();

  if (!q) return [];


  return [

    ...tasks.map((item) => ({
      ...item,
      type: "task",
      page: "tasks",
      label: item.title
    })),

    ...subscriptions.map((item) => ({
      ...item,
      type: "subscription",
      page: "subscriptions",
      label: item.name
    })),

    ...bills.map((item) => ({
      ...item,
      type: "bill",
      page: "bills",
      label: item.name
    }))

  ].filter((item) => {

    return String(item.label || "")
      .toLowerCase()
      .includes(q);

  }).slice(0, 8);

}


$("globalSearch").addEventListener("input", () => {

  const results = searchItems(
    $("globalSearch").value
  );

  const container = $("searchResults");


  if (!$("globalSearch").value.trim()) {

    container.classList.add("hidden");
    container.innerHTML = "";

    return;

  }


  if (!results.length) {

    container.innerHTML = `
      <div class="search-empty">
        No matching items found.
      </div>
    `;

  } else {

    const icons = {
      task: "list-checks",
      subscription: "repeat",
      bill: "receipt"
    };


    container.innerHTML = results.map((item) => {

      return `
        <button
          class="search-result"
          data-search-page="${item.page}"
          data-search-id="${escapeHTML(item.id)}"
        >

          <i data-lucide="${icons[item.type]}"></i>

          <span>${escapeHTML(item.label)}</span>

          <small>${item.type}</small>

        </button>
      `;

    }).join("");

    refreshIcons();

  }


  container.classList.remove("hidden");

});


// Close the search list when clicking outside it.

document.addEventListener("click", (event) => {

  if (!event.target.closest(".search-wrap")) {
    $("searchResults").classList.add("hidden");
  }


  const result = event.target.closest("[data-search-page]");

  if (result) {

    showPage(result.dataset.searchPage);

    $("globalSearch").value = "";

    $("searchResults").classList.add("hidden");


    setTimeout(() => {

      const card = document.querySelector(
        `[data-record-id="${CSS.escape(result.dataset.searchId)}"]`
      );

      if (card) {
        card.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }

    }, 80);

  }

});


// Quick Add opens a new task with today's date.

$("quickAddButton").addEventListener("click", () => {
  openTaskForm(dateKey(new Date()));
});


// =========================================================
// 12. POMODORO FOCUS TIMER
// =========================================================

const focusDurations = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60
};

const focusLabels = {
  focus: "FOCUS SESSION",
  short: "SHORT BREAK",
  long: "LONG BREAK"
};

let focusMode = "focus";

let remainingSeconds = focusDurations.focus;

let timerInterval = null;


// Update the timer display.

function updateTimerDisplay() {

  const minutes = Math.floor(
    remainingSeconds / 60
  ).toString().padStart(2, "0");

  const seconds = (
    remainingSeconds % 60
  ).toString().padStart(2, "0");


  $("timerDisplay").textContent =
    `${minutes}:${seconds}`;

  $("timerModeLabel").textContent =
    focusLabels[focusMode];


  const progress = (
    (focusDurations[focusMode] - remainingSeconds) /
    focusDurations[focusMode]
  ) * 100;


  $("timerProgress").parentElement.style.setProperty("--timer-progress", `${progress}%`);


  $("timerStatus").textContent = timerInterval
    ? "You're in the zone"
    : "Ready when you are";


  const button = $("startPauseTimer");


  button.innerHTML = timerInterval
    ? '<i data-lucide="pause"></i><span>Pause</span>'
    : '<i data-lucide="play"></i><span>Start</span>';


  refreshIcons();

}


// Switch between focus and break modes.

function setFocusMode(mode) {

  if (!focusDurations[mode]) return;

  clearInterval(timerInterval);

  timerInterval = null;

  focusMode = mode;

  remainingSeconds = focusDurations[mode];


  document.querySelectorAll("[data-focus-mode]").forEach((button) => {

    button.classList.toggle(
      "active",
      button.dataset.focusMode === mode
    );

  });


  updateTimerDisplay();

}


// Handle completed sessions.

function completeFocusSession() {

  if (focusMode === "focus") {

    const stats = getFocusStats();

    stats.count += 1;

    localStorage.setItem(
      STORAGE_KEYS.focus,
      JSON.stringify(stats)
    );


    showToast(
      "Focus session complete. Take a little break!"
    );


    const nextMode = stats.count % 4 === 0
      ? "long"
      : "short";


    updateDashboard();

    $("focusTodayCount").textContent = stats.count;

    setFocusMode(nextMode);

  } else {

    showToast(
      "Break complete. Ready for another focus session?"
    );

    setFocusMode("focus");

  }

}


// Start or pause timer.

function startTimer() {

  if (timerInterval) {

    clearInterval(timerInterval);

    timerInterval = null;

    updateTimerDisplay();

    return;

  }


  if (remainingSeconds <= 0) {
    remainingSeconds = focusDurations[focusMode];
  }


  timerInterval = setInterval(() => {

    remainingSeconds -= 1;


    if (remainingSeconds <= 0) {

      remainingSeconds = 0;

      clearInterval(timerInterval);

      timerInterval = null;

      updateTimerDisplay();

      completeFocusSession();

      return;

    }


    updateTimerDisplay();

  }, 1000);


  updateTimerDisplay();

}


// Timer buttons.

$("startPauseTimer").addEventListener("click", startTimer);


$("resetTimer").addEventListener("click", () => {

  clearInterval(timerInterval);

  timerInterval = null;

  remainingSeconds = focusDurations[focusMode];

  updateTimerDisplay();

});


document.querySelectorAll("[data-focus-mode]").forEach((button) => {

  button.addEventListener("click", () => {
    setFocusMode(button.dataset.focusMode);
  });

});


// =========================================================
// 13. DISPLAY DATE AND RENDER THE APPLICATION
// =========================================================

function displayCurrentDate() {

  $("todayLabel").textContent =
    new Date().toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short"
    });

}


// Render all application sections.

function renderAll() {

  renderTasks();

  renderSubscriptions();

  renderBills();

  renderPlanner();

  updateDashboard();

  $("focusTodayCount").textContent =
    getFocusStats().count;

  refreshIcons();

}


// Start ORBIT.

async function startOrbit() {

  displayCurrentDate();

  await loadData();

  renderAll();

  showPage("overview");

  updateTimerDisplay();

}

startOrbit();


