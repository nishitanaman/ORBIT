
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const dataFile = path.join(__dirname, "data.json");

app.use(express.json());


// Read data from the JSON file

function readData() {
    const data = fs.readFileSync(dataFile, "utf8");
    return JSON.parse(data);
}


// Save data in the JSON file

function saveData(data) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}


// Open the website

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "main.html"));
});

app.get("/style.css", (req, res) => {
    res.sendFile(path.join(__dirname, "style.css"));
});

app.get("/app.js", (req, res) => {
    res.sendFile(path.join(__dirname, "app.js"));
});


// Get all saved data

app.get("/api/data", (req, res) => {
    try {
        res.json(readData());
    } catch (error) {
        res.status(500).json({
            message: "Unable to read data"
        });
    }
});


// Save updated data

app.put("/api/data", (req, res) => {
    try {
        const data = {
            tasks: Array.isArray(req.body.tasks) ? req.body.tasks : [],
            subscriptions: Array.isArray(req.body.subscriptions)
                ? req.body.subscriptions : [],
            bills: Array.isArray(req.body.bills) ? req.body.bills : []
        };

        saveData(data);

        res.json({
            message: "Data saved successfully"
        });

    } catch (error) {
        res.status(500).json({
            message: "Unable to save data"
        });
    }
});


// Start the server

app.listen(PORT, () => {
    console.log(`ORBIT is running at http://localhost:${PORT}`);
});
