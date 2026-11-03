
/* =========================
   1. DATA STORAGE
========================= */

// Get saved information from the browser.
// If nothing has been saved yet, start with empty lists.

function loadData(key) {
    try {
        const savedData = localStorage.getItem(key);
        return savedData ? JSON.parse(savedData) : [];
    } catch (error) {
        console.error("Could not load saved data:", error);
        return [];
    }
}

let tasks = loadData("orbit_tasks");
let subscriptions = loadData("orbit_subscriptions");
let bills = loadData("orbit_bills");


// Save information in the browser.


    
async function saveData() {

    const data = {
        tasks: tasks,
        subscriptions: subscriptions,
        bills: bills
    };

    // Keep a browser backup as well
    localStorage.setItem("orbit_tasks", JSON.stringify(tasks));
    localStorage.setItem("orbit_subscriptions", JSON.stringify(subscriptions));
    localStorage.setItem("orbit_bills", JSON.stringify(bills));

    // Send the data to the backend
    try {

        const response = await fetch("/api/data", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error("Backend could not save data");
        }

    } catch (error) {
        console.error(error);
        showToast("Could not connect to the backend.");
    }
}


// Generate a unique ID for every entry.

function createId() {
    return Date.now().toString(36) +
        Math.random().toString(36).slice(2, 8);
}



/* =========================
   2. HELPER FUNCTIONS
========================= */

// Find an HTML element by its ID.

function getElement(id) {
    return document.getElementById(id);
}


// Format dates into a readable format.

function formatDate(dateString) {
    if (!dateString) {
        return "No date set";
    }

    const date = new Date(dateString + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
        return "Invalid date";
    }

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}


// Get the day number and month from a date.

function getDayAndMonth(dateString) {
    const date = new Date(dateString + "T00:00:00");

    return {
        day: date.getDate(),
        month: date.toLocaleDateString("en-IN", {
            month: "short"
        })
    };
}


// Format amounts as Indian Rupees.

function formatMoney(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(Number(amount) || 0);
}


// Convert text into safe HTML before displaying it.

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function(character) {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return replacements[character];
    });
}


// Show a small notification message.

let toastTimer;

function showToast(message) {
    const toast = getElement("toast");

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(function() {
        toast.classList.remove("show");
    }, 2500);
}


// Refresh Lucide icons after creating new HTML.

function refreshIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}



/* =========================
   3. PAGE NAVIGATION
========================= */

const pageInformation = {
    overview: {
        title: "Overview",
        subtitle: "Everything you need, all in one place."
    },

    tasks: {
        title: "My Tasks",
        subtitle: "Plan your day and keep moving forward."
    },

    subscriptions: {
        title: "Subscriptions",
        subtitle: "Keep your recurring expenses organised."
    },

    bills: {
        title: "Bills",
        subtitle: "Stay on top of your upcoming payments."
    },

    calendar: {
        title: "Calendar",
        subtitle: "Your tasks and payments, organised by date."
    }
};


// Open the selected page.

function showPage(pageName) {

    const page = getElement("view-" + pageName);

    if (!page) {
        return;
    }

    // Hide all pages.

    document.querySelectorAll(".page-view").forEach(function(view) {
        view.classList.remove("active");
    });

    // Show the selected page.

    page.classList.add("active");


    // Update sidebar selection.

    document.querySelectorAll(".nav-link").forEach(function(button) {
        button.classList.toggle(
            "active",
            button.dataset.page === pageName
        );
    });


    // Update page heading.

    getElement("pageTitle").textContent =
        pageInformation[pageName].title;

    getElement("pageSubtitle").textContent =
        pageInformation[pageName].subtitle;

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// Navigation buttons.

document.querySelectorAll(".nav-link").forEach(function(button) {

    button.addEventListener("click", function() {
        showPage(button.dataset.page);
    });

});


// Buttons that take the user to another page.

document.querySelectorAll("[data-go-page]").forEach(function(button) {

    button.addEventListener("click", function() {
        showPage(button.dataset.goPage);
    });

});



/* =========================
   4. FORM VISIBILITY
========================= */

function openForm(formId, inputId) {

    const form = getElement(formId);

    form.classList.remove("hidden");

    if (inputId) {
        getElement(inputId).focus();
    }
}


function closeForm(formId) {
    const form = getElement(formId);

    form.reset();
    form.classList.add("hidden");
}



/* =========================
   5. TASK MANAGEMENT
========================= */

const taskForm = getElement("taskForm");


// Display all tasks.

function renderTasks() {

    const taskList = getElement("taskList");

    if (tasks.length === 0) {
        taskList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i data-lucide="clipboard-list"></i>
                </div>

                <h4>No tasks yet</h4>

                <p>Add your first task and start organising your day.</p>
            </div>
        `;

        refreshIcons();
        return;
    }


    // Put unfinished tasks before completed tasks.

    const sortedTasks = [...tasks].sort(function(a, b) {

        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }

        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;

        return a.dueDate.localeCompare(b.dueDate);
    });


    taskList.innerHTML = sortedTasks.map(function(task) {

        const priority = task.priority || "medium";

        return `
            <article class="item-card ${task.completed ? "is-complete" : ""}">

                <button
                    class="icon-button ${task.completed ? "complete-button" : ""}"
                    data-action="toggle-task"
                    data-id="${task.id}"
                    aria-label="${task.completed ? "Mark incomplete" : "Mark complete"}"
                    title="${task.completed ? "Mark incomplete" : "Mark complete"}"
                >
                    <i data-lucide="${task.completed ? "check" : "circle"}"></i>
                </button>

                <div class="item-main">

                    <h4>${escapeHTML(task.title)}</h4>

                    <p>
                        ${task.dueDate ? "Due " + formatDate(task.dueDate) : "No due date"}
                        <span class="priority priority-${priority}">
                            ${priority.charAt(0).toUpperCase() + priority.slice(1)} priority
                        </span>
                    </p>

                </div>

                <div class="item-actions">

                    <button
                        class="icon-button"
                        data-action="edit-task"
                        data-id="${task.id}"
                        aria-label="Edit task"
                        title="Edit task"
                    >
                        <i data-lucide="pencil"></i>
                    </button>

                    <button
                        class="icon-button delete-button"
                        data-action="delete-task"
                        data-id="${task.id}"
                        aria-label="Delete task"
                        title="Delete task"
                    >
                        <i data-lucide="trash-2"></i>
                    </button>

                </div>

            </article>
        `;

    }).join("");


    refreshIcons();
}


// Add a new task or update an existing one.

taskForm.addEventListener("submit", function(event) {

    event.preventDefault();

    const editId = getElement("taskEditId").value;

    const taskData = {
        title: getElement("taskName").value.trim(),
        dueDate: getElement("taskDate").value,
        priority: getElement("taskPriority").value
    };


    if (!taskData.title) {
        showToast("Please enter a task name.");
        return;
    }


    if (editId) {

        const task = tasks.find(function(item) {
            return item.id === editId;
        });

        if (task) {
            Object.assign(task, taskData);
            showToast("Task updated successfully.");
        }

    } else {

        tasks.push({
            id: createId(),
            ...taskData,
            completed: false
        });

        showToast("New task added.");
    }


    saveData();
    renderAll();
    closeForm("taskForm");

    getElement("taskSubmit").textContent = "Save task";
    getElement("taskFormTitle").textContent = "Create a new task";

});


// Edit a task.

function editTask(id) {

    const task = tasks.find(function(item) {
        return item.id === id;
    });

    if (!task) return;

    showPage("tasks");

    getElement("taskEditId").value = task.id;
    getElement("taskName").value = task.title;
    getElement("taskDate").value = task.dueDate || "";
    getElement("taskPriority").value = task.priority || "medium";

    getElement("taskFormTitle").textContent = "Edit your task";
    getElement("taskSubmit").textContent = "Update task";

    openForm("taskForm", "taskName");

    getElement("taskForm").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}


// Mark a task as completed or incomplete.

function toggleTask(id) {

    const task = tasks.find(function(item) {
        return item.id === id;
    });

    if (!task) return;

    task.completed = !task.completed;

    saveData();
    renderAll();

    showToast(task.completed ? "Task completed!" : "Task reopened.");
}


// Delete a task.

function deleteTask(id) {

    tasks = tasks.filter(function(task) {
        return task.id !== id;
    });

    saveData();
    renderAll();

    showToast("Task deleted.");
}



/* =========================
   6. SUBSCRIPTION MANAGEMENT
========================= */

const subscriptionForm = getElement("subscriptionForm");


// Display all subscriptions.

function renderSubscriptions() {

    const subscriptionList = getElement("subscriptionList");

    if (subscriptions.length === 0) {

        subscriptionList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i data-lucide="repeat"></i>
                </div>

                <h4>No subscriptions added</h4>

                <p>Add your subscriptions to keep track of recurring expenses.</p>
            </div>
        `;

        refreshIcons();
        return;
    }


    subscriptionList.innerHTML = subscriptions.map(function(subscription) {

        return `
            <article class="item-card">

                <div class="preview-icon">
                    <i data-lucide="repeat"></i>
                </div>

                <div class="item-main">

                    <h4>${escapeHTML(subscription.name)}</h4>

                    <p>
                        Renews on ${formatDate(subscription.renewalDate)}
                        <span class="cycle-label">
                            ${subscription.cycle}
                        </span>
                    </p>

                </div>

                <div class="item-amount">
                    ${formatMoney(subscription.amount)}
                </div>

                <div class="item-actions">

                    <button
                        class="icon-button"
                        data-action="edit-subscription"
                        data-id="${subscription.id}"
                        aria-label="Edit subscription"
                        title="Edit subscription"
                    >
                        <i data-lucide="pencil"></i>
                    </button>

                    <button
                        class="icon-button delete-button"
                        data-action="delete-subscription"
                        data-id="${subscription.id}"
                        aria-label="Delete subscription"
                        title="Delete subscription"
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

subscriptionForm.addEventListener("submit", function(event) {

    event.preventDefault();

    const editId = getElement("subscriptionEditId").value;

    const subscriptionData = {
        name: getElement("subscriptionName").value.trim(),
        amount: Number(getElement("subscriptionAmount").value),
        cycle: getElement("subscriptionCycle").value,
        renewalDate: getElement("subscriptionDate").value
    };


    if (!subscriptionData.name || subscriptionData.amount < 0) {
        showToast("Please enter valid subscription details.");
        return;
    }


    if (editId) {

        const subscription = subscriptions.find(function(item) {
            return item.id === editId;
        });

        if (subscription) {
            Object.assign(subscription, subscriptionData);
        }

        showToast("Subscription updated.");

    } else {

        subscriptions.push({
            id: createId(),
            ...subscriptionData
        });

        showToast("Subscription added.");
    }


    saveData();
    renderAll();
    closeForm("subscriptionForm");

    getElement("subscriptionSubmit").textContent = "Save subscription";
    getElement("subscriptionFormTitle").textContent = "Add a subscription";

});


// Edit a subscription.

function editSubscription(id) {

    const subscription = subscriptions.find(function(item) {
        return item.id === id;
    });

    if (!subscription) return;

    showPage("subscriptions");

    getElement("subscriptionEditId").value = subscription.id;
    getElement("subscriptionName").value = subscription.name;
    getElement("subscriptionAmount").value = subscription.amount;
    getElement("subscriptionCycle").value = subscription.cycle;
    getElement("subscriptionDate").value = subscription.renewalDate;

    getElement("subscriptionFormTitle").textContent = "Edit subscription";
    getElement("subscriptionSubmit").textContent = "Update subscription";

    openForm("subscriptionForm", "subscriptionName");

    getElement("subscriptionForm").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}


// Delete a subscription.

function deleteSubscription(id) {

    subscriptions = subscriptions.filter(function(item) {
        return item.id !== id;
    });

    saveData();
    renderAll();

    showToast("Subscription deleted.");
}



/* =========================
   7. BILL MANAGEMENT
========================= */

const billForm = getElement("billForm");


// Display all bills.

function renderBills() {

    const billList = getElement("billList");

    if (bills.length === 0) {

        billList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i data-lucide="receipt"></i>
                </div>

                <h4>No bills added</h4>

                <p>Add your upcoming bills and keep your payments organised.</p>
            </div>
        `;

        refreshIcons();
        return;
    }


    const sortedBills = [...bills].sort(function(a, b) {
        return a.dueDate.localeCompare(b.dueDate);
    });


    billList.innerHTML = sortedBills.map(function(bill) {

        return `
            <article class="item-card">

                <div class="preview-icon payment-icon">
                    <i data-lucide="receipt"></i>
                </div>

                <div class="item-main">

                    <h4>${escapeHTML(bill.name)}</h4>

                    <p>
                        Due ${formatDate(bill.dueDate)}

                        <span class="payment-status ${bill.paid ? "payment-paid" : "payment-unpaid"}">
                            ${bill.paid ? "Paid" : "Unpaid"}
                        </span>
                    </p>

                </div>

                <div class="item-amount">
                    ${formatMoney(bill.amount)}
                </div>

                <div class="item-actions">

                    <button
                        class="icon-button"
                        data-action="toggle-bill"
                        data-id="${bill.id}"
                        aria-label="${bill.paid ? "Mark unpaid" : "Mark paid"}"
                        title="${bill.paid ? "Mark unpaid" : "Mark paid"}"
                    >
                        <i data-lucide="${bill.paid ? "undo-2" : "check"}"></i>
                    </button>

                    <button
                        class="icon-button"
                        data-action="edit-bill"
                        data-id="${bill.id}"
                        aria-label="Edit bill"
                        title="Edit bill"
                    >
                        <i data-lucide="pencil"></i>
                    </button>

                    <button
                        class="icon-button delete-button"
                        data-action="delete-bill"
                        data-id="${bill.id}"
                        aria-label="Delete bill"
                        title="Delete bill"
                    >
                        <i data-lucide="trash-2"></i>
                    </button>

                </div>

            </article>
        `;

    }).join("");


    refreshIcons();
}


// Add or update a bill.

billForm.addEventListener("submit", function(event) {

    event.preventDefault();

    const editId = getElement("billEditId").value;

    const billData = {
        name: getElement("billName").value.trim(),
        amount: Number(getElement("billAmount").value),
        dueDate: getElement("billDate").value
    };


    if (!billData.name || billData.amount < 0) {
        showToast("Please enter valid bill details.");
        return;
    }


    if (editId) {

        const bill = bills.find(function(item) {
            return item.id === editId;
        });

        if (bill) {
            Object.assign(bill, billData);
        }

        showToast("Bill updated.");

    } else {

        bills.push({
            id: createId(),
            ...billData,
            paid: false
        });

        showToast("Bill added successfully.");
    }


    saveData();
    renderAll();
    closeForm("billForm");

    getElement("billSubmit").textContent = "Save bill";
    getElement("billFormTitle").textContent = "Add a new bill";

});


// Edit a bill.

function editBill(id) {

    const bill = bills.find(function(item) {
        return item.id === id;
    });

    if (!bill) return;

    showPage("bills");

    getElement("billEditId").value = bill.id;
    getElement("billName").value = bill.name;
    getElement("billAmount").value = bill.amount;
    getElement("billDate").value = bill.dueDate;

    getElement("billFormTitle").textContent = "Edit your bill";
    getElement("billSubmit").textContent = "Update bill";

    openForm("billForm", "billName");

    getElement("billForm").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}


// Mark a bill paid or unpaid.

function toggleBill(id) {

    const bill = bills.find(function(item) {
        return item.id === id;
    });

    if (!bill) return;

    bill.paid = !bill.paid;

    saveData();
    renderAll();

    showToast(bill.paid ? "Bill marked as paid." : "Bill marked as unpaid.");
}


// Delete a bill.

function deleteBill(id) {

    bills = bills.filter(function(item) {
        return item.id !== id;
    });

    saveData();
    renderAll();

    showToast("Bill deleted.");
}



/* =========================
   8. DASHBOARD
========================= */

// Update the statistics on the overview page.

function updateDashboard() {

    // Count unfinished tasks.

    const openTasks = tasks.filter(function(task) {
        return !task.completed;
    }).length;


    // Count subscriptions.

    const subscriptionCount = subscriptions.length;


    // Calculate estimated monthly subscription cost.

    const monthlyCost = subscriptions.reduce(function(total, subscription) {

        const amount = Number(subscription.amount) || 0;

        if (subscription.cycle === "yearly") {
            return total + amount / 12;
        }

        return total + amount;

    }, 0);


    getElement("statOpenTasks").textContent = openTasks;
    getElement("statSubscriptions").textContent = subscriptionCount;
    getElement("statMonthlySpend").textContent = formatMoney(monthlyCost);


    renderOverviewTasks();
    renderOverviewPayments();
}


// Show a small task preview on the dashboard.

function renderOverviewTasks() {

    const container = getElement("overviewTasks");

    const unfinishedTasks = tasks
        .filter(function(task) {
            return !task.completed;
        })
        .sort(function(a, b) {

            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;

            return a.dueDate.localeCompare(b.dueDate);

        })
        .slice(0, 4);


    if (unfinishedTasks.length === 0) {

        container.innerHTML = `
            <div class="empty-small">
                You're all caught up! Add a task whenever you're ready.
            </div>
        `;

        return;
    }


    container.innerHTML = unfinishedTasks.map(function(task) {

        return `
            <div class="preview-row">

                <div class="preview-icon">
                    <i data-lucide="check-circle-2"></i>
                </div>

                <div class="preview-details">
                    <h4>${escapeHTML(task.title)}</h4>
                    <p>${task.dueDate ? "Due " + formatDate(task.dueDate) : "No due date"}</p>
                </div>

            </div>
        `;

    }).join("");


    refreshIcons();
}


// Combine bills and subscriptions for the payment preview.

function getPaymentItems() {

    const subscriptionPayments = subscriptions.map(function(subscription) {

        return {
            name: subscription.name,
            amount: subscription.amount,
            date: subscription.renewalDate,
            type: "Subscription",
            paid: false
        };

    });


    const billPayments = bills
        .filter(function(bill) {
            return !bill.paid;
        })
        .map(function(bill) {

            return {
                name: bill.name,
                amount: bill.amount,
                date: bill.dueDate,
                type: "Bill",
                paid: false
            };

        });


    return [...subscriptionPayments, ...billPayments]
        .filter(function(item) {
            return item.date;
        })
        .sort(function(a, b) {
            return a.date.localeCompare(b.date);
        });
}


// Show upcoming payments on the dashboard.

function renderOverviewPayments() {

    const container = getElement("overviewPayments");

    const payments = getPaymentItems().slice(0, 4);


    if (payments.length === 0) {

        container.innerHTML = `
            <div class="empty-small">
                No upcoming payments. Add a bill or subscription to get started.
            </div>
        `;

        return;
    }


    container.innerHTML = payments.map(function(payment) {

        return `
            <div class="preview-row">

                <div class="preview-icon payment-icon">
                    <i data-lucide="wallet"></i>
                </div>

                <div class="preview-details">
                    <h4>${escapeHTML(payment.name)}</h4>
                    <p>${payment.type} · ${formatDate(payment.date)}</p>
                </div>

                <span class="preview-amount">
                    ${formatMoney(payment.amount)}
                </span>

            </div>
        `;

    }).join("");


    refreshIcons();
}



/* =========================
   9. CALENDAR
========================= */

function renderCalendar() {

    const calendarList = getElement("calendarList");

    const calendarItems = [];


    // Add tasks with due dates.

    tasks.forEach(function(task) {

        if (task.dueDate) {

            calendarItems.push({
                name: task.title,
                date: task.dueDate,
                type: "Task",
                details: task.completed ? "Completed" : "To do"
            });

        }

    });


    // Add bills.

    bills.forEach(function(bill) {

        calendarItems.push({
            name: bill.name,
            date: bill.dueDate,
            type: "Bill",
            details: bill.paid ? "Payment completed" : "Payment pending"
        });

    });


    // Add subscription renewals.

    subscriptions.forEach(function(subscription) {

        calendarItems.push({
            name: subscription.name,
            date: subscription.renewalDate,
            type: "Renewal",
            details: formatMoney(subscription.amount) + " · " + subscription.cycle
        });

    });


    // Sort everything by date.

    calendarItems.sort(function(a, b) {
        return a.date.localeCompare(b.date);
    });


    if (calendarItems.length === 0) {

        calendarList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i data-lucide="calendar-days"></i>
                </div>

                <h4>Your calendar is empty</h4>

                <p>Add tasks, bills or subscriptions to see them here.</p>
            </div>
        `;

        refreshIcons();
        return;
    }


    calendarList.innerHTML = calendarItems.map(function(item) {

        const dateParts = getDayAndMonth(item.date);

        return `
            <div class="calendar-row">

                <div class="calendar-date">
                    <strong>${dateParts.day}</strong>
                    <span>${dateParts.month}</span>
                </div>

                <div class="calendar-details">
                    <h4>${escapeHTML(item.name)}</h4>
                    <p>${escapeHTML(item.details)}</p>
                </div>

                <span class="calendar-type">
                    ${item.type}
                </span>

            </div>
        `;

    }).join("");


    refreshIcons();
}



/* =========================
   10. BUTTON EVENT HANDLING
========================= */

// Handle actions such as edit, delete, complete and mark paid.

document.addEventListener("click", function(event) {

    const button = event.target.closest("[data-action]");

    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;


    switch (action) {

        // TASK ACTIONS

        case "toggle-task":
            toggleTask(id);
            break;

        case "edit-task":
            editTask(id);
            break;

        case "delete-task":
            deleteTask(id);
            break;


        // SUBSCRIPTION ACTIONS

        case "edit-subscription":
            editSubscription(id);
            break;

        case "delete-subscription":
            deleteSubscription(id);
            break;


        // BILL ACTIONS

        case "toggle-bill":
            toggleBill(id);
            break;

        case "edit-bill":
            editBill(id);
            break;

        case "delete-bill":
            deleteBill(id);
            break;

    }

});



/* =========================
   11. FORM BUTTONS
========================= */

// Open task form.

getElement("showTaskForm").addEventListener("click", function() {

    getElement("taskEditId").value = "";
    getElement("taskFormTitle").textContent = "Create a new task";
    getElement("taskSubmit").textContent = "Save task";

    openForm("taskForm", "taskName");

});


// Open subscription form.

getElement("showSubscriptionForm").addEventListener("click", function() {

    getElement("subscriptionEditId").value = "";
    getElement("subscriptionFormTitle").textContent = "Add a subscription";
    getElement("subscriptionSubmit").textContent = "Save subscription";

    openForm("subscriptionForm", "subscriptionName");

});


// Open bill form.

getElement("showBillForm").addEventListener("click", function() {

    getElement("billEditId").value = "";
    getElement("billFormTitle").textContent = "Add a new bill";
    getElement("billSubmit").textContent = "Save bill";

    openForm("billForm", "billName");

});


// Cancel editing or adding.

getElement("cancelTaskEdit").addEventListener("click", function() {
    closeForm("taskForm");
});

getElement("cancelSubscriptionEdit").addEventListener("click", function() {
    closeForm("subscriptionForm");
});

getElement("cancelBillEdit").addEventListener("click", function() {
    closeForm("billForm");
});



/* =========================
   12. CURRENT DATE
========================= */

function displayCurrentDate() {

    const today = new Date();

    getElement("todayLabel").textContent =
        today.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short"
        });

}



/* =========================
   13. RENDER EVERYTHING
========================= */

function renderAll() {

    renderTasks();
    renderSubscriptions();
    renderBills();

    updateDashboard();
    renderCalendar();

    refreshIcons();
}



/* =========================
   14. START THE WEBSITE
========================= */

async function startOrbit() {

    try {

        const response = await fetch("/api/data");

        if (!response.ok) {
            throw new Error("Could not load backend data");
        }

        const data = await response.json();

        const hasServerData =
            data.tasks.length > 0 ||
            data.subscriptions.length > 0 ||
            data.bills.length > 0;

        if (hasServerData) {

            tasks = data.tasks;
            subscriptions = data.subscriptions;
            bills = data.bills;

        } else {

            // Preserve any information already saved in the browser.
            await saveData();

        }

    } catch (error) {

        console.error(error);
        showToast("Backend unavailable. Using browser storage.");

    }

    displayCurrentDate();
    renderAll();
    showPage("overview");
}

startOrbit();

