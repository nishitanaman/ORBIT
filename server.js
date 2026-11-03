
// =========================================================
// ORBIT BACKEND
// Node.js + Express + JSON file storage
// =========================================================

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, "data.json");


// =========================================================
// 1. MIDDLEWARE
// =========================================================

app.use(express.json({ limit: "1mb" }));


// =========================================================
// 2. CREATE DATA FILE IF IT DOES NOT EXIST
// =========================================================

function ensureDataFile() {

  if (!fs.existsSync(DATA_FILE)) {

    const emptyData = {
      tasks: [],
      subscriptions: [],
      bills: []
    };

    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(emptyData, null, 2)
    );

  }

}


// =========================================================
// 3. READ DATA
// =========================================================

function readData() {

  ensureDataFile();

  const raw = fs.readFileSync(DATA_FILE, "utf8");

  const parsed = JSON.parse(raw || "{}");

  return {

    tasks: Array.isArray(parsed.tasks)
      ? parsed.tasks
      : [],

    subscriptions: Array.isArray(parsed.subscriptions)
      ? parsed.subscriptions
      : [],

    bills: Array.isArray(parsed.bills)
      ? parsed.bills
      : []

  };

}


// =========================================================
// 4. WRITE DATA
// =========================================================

function writeData(data) {

  // Write to a temporary file before replacing the old file.

  const temporaryFile = `${DATA_FILE}.tmp`;

  fs.writeFileSync(
    temporaryFile,
    JSON.stringify(data, null, 2),
    "utf8"
  );

  fs.renameSync(temporaryFile, DATA_FILE);

}


// =========================================================
// 5. CLEAN AND VALIDATE RECORDS
// =========================================================

function cleanRecords(records, type) {

  if (!Array.isArray(records)) {
    return [];
  }

  return records.map((record) => {

    const item =
      record && typeof record === "object"
        ? record
        : {};

    const id = String(
      item.id ||
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );


    // TASKS

    if (type === "tasks") {

      return {

        id,

        title: String(item.title || "")
          .trim()
          .slice(0, 120),

        dueDate: String(item.dueDate || ""),

        priority: [
          "low",
          "medium",
          "high"
        ].includes(item.priority)
          ? item.priority
          : "medium",

        category: [
          "Study",
          "Personal",
          "Work",
          "Other"
        ].includes(item.category)
          ? item.category
          : "Other",

        completed: Boolean(item.completed)

      };

    }


    // SUBSCRIPTIONS

    if (type === "subscriptions") {

      return {

        id,

        name: String(item.name || "")
          .trim()
          .slice(0, 100),

        amount: Math.max(
          0,
          Number(item.amount) || 0
        ),

        cycle: item.cycle === "yearly"
          ? "yearly"
          : "monthly",

        renewalDate: String(item.renewalDate || "")

      };

    }


    // BILLS

    return {

      id,

      name: String(item.name || "")
        .trim()
        .slice(0, 100),

      amount: Math.max(
        0,
        Number(item.amount) || 0
      ),

      dueDate: String(item.dueDate || ""),

      paid: Boolean(item.paid)

    };

  }).filter((item) => {

    return type === "tasks"
      ? item.title.length > 0
      : item.name.length > 0;

  });

}


// =========================================================
// 6. GET API
// Retrieve all saved ORBIT records.
// =========================================================

app.get("/api/data", (req, res) => {

  try {

    const data = readData();

    res.json(data);

  } catch (error) {

    console.error("Could not read data.json:", error);

    res.status(500).json({
      message: "Could not read saved ORBIT data."
    });

  }

});


// =========================================================
// 7. PUT API
// Save tasks, subscriptions and bills.
// =========================================================

app.put("/api/data", (req, res) => {

  try {

    const body = req.body || {};

    const data = {

      tasks: cleanRecords(
        body.tasks,
        "tasks"
      ),

      subscriptions: cleanRecords(
        body.subscriptions,
        "subscriptions"
      ),

      bills: cleanRecords(
        body.bills,
        "bills"
      )

    };


    writeData(data);


    res.json({

      message: "ORBIT data saved successfully.",

      counts: {
        tasks: data.tasks.length,
        subscriptions: data.subscriptions.length,
        bills: data.bills.length
      }

    });

  } catch (error) {

    console.error("Could not save data.json:", error);

    res.status(500).json({
      message: "Could not save ORBIT data."
    });

  }

});


// =========================================================
// 8. HEALTH CHECK API
// =========================================================

app.get("/api/health", (req, res) => {

  res.json({

    status: "ok",

    storage: "JSON file",

    fileExists: fs.existsSync(DATA_FILE)

  });

});


// =========================================================
// 9. SERVE FRONTEND FILES
// =========================================================

app.use(express.static(__dirname, {
  index: false
}));


app.get("/", (req, res) => {

  res.sendFile(
    path.join(__dirname, "main.html")
  );

});


// =========================================================
// 10. START SERVER
// =========================================================

app.listen(PORT, () => {

  ensureDataFile();

  console.log(
    `ORBIT is running at http://localhost:${PORT}`
  );

  console.log("Storage: data.json");

});

