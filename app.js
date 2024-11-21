const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "transactions.db");
let db = null;

// Database initialization
const initializeDatabase = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Create tables
    await db.exec(`
      CREATE TABLE IF NOT EXISTS user (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS \`transaction\` (
        transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL,
        transaction_type TEXT CHECK(transaction_type IN ('DEPOSIT', 'WITHDRAWAL')),
        status TEXT CHECK(status IN ('PENDING', 'COMPLETED', 'FAILED')) DEFAULT 'PENDING',
        user_id INTEGER,
        timestamp TEXT DEFAULT (DATETIME('now')),
        FOREIGN KEY(user_id) REFERENCES user(user_id)
      );
    `);

    app.listen(5000, () => {
      console.log("Server is running on http://localhost:5000/");
    });
  } catch (error) {
    console.log(`Database Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDatabase();

// Add a new user
app.post("/api/users", async (req, res) => {
  const { username } = req.body;
  try {
    const query = `
      INSERT INTO user (username)
      VALUES (?);
    `;
    const result = await db.run(query, [username]);
    res.status(201).send({ user_id: result.lastID, username });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Add a new transaction
app.post("/api/transactions", async (req, res) => {
  const { amount, transaction_type, user_id } = req.body;
  try {
    const query = `
      INSERT INTO \`transaction\` (amount, transaction_type, user_id)
      VALUES (?, ?, ?);
    `;
    const result = await db.run(query, [amount, transaction_type, user_id]);
    res.status(201).send({
      transaction_id: result.lastID,
      amount,
      transaction_type,
      status: "PENDING",
      user_id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Get all transactions for a user
app.get("/api/transactions", async (req, res) => {
  const { user_id } = req.query;
  try {
    const query = `
      SELECT * FROM \`transaction\` WHERE user_id = ?;
    `;
    const transactions = await db.all(query, [user_id]);
    res.send({ transactions });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Update transaction status
app.put("/api/transactions/:transaction_id", async (req, res) => {
  const { status } = req.body;
  const { transaction_id } = req.params;
  try {
    const query = `
      UPDATE \`transaction\` SET status = ? WHERE transaction_id = ?;
    `;
    const result = await db.run(query, [status, transaction_id]);
    if (result.changes === 0) {
      res.status(404).send({ error: "Transaction not found" });
    } else {
      res.send({
        transaction_id,
        status,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});
