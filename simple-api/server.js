require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes

// Root
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Simple API 🚀",
  });
});

// Get all users
app.get("/api/users", (req, res) => {
  const users = [
    { id: 1, name: "Alice Johnson", email: "alice@example.com", role: "admin" },
    { id: 2, name: "Bob Smith", email: "bob@example.com", role: "user" },
    { id: 3, name: "Carol White", email: "carol@example.com", role: "user" },
  ];

  res.json({
    success: true,
    count: users.length,
    data: users,
  });
});

// Get single user by ID
app.get("/api/users/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const users = [
    { id: 1, name: "Alice Johnson", email: "alice@example.com", role: "admin" },
    { id: 2, name: "Bob Smith", email: "bob@example.com", role: "user" },
    { id: 3, name: "Carol White", email: "carol@example.com", role: "user" },
  ];

  const user = users.find((u) => u.id === id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: `User with id ${id} not found`,
    });
  }

  res.json({
    success: true,
    data: user,
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📡 Available routes:`);
  console.log(`   GET  /`);
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/users`);
  console.log(`   GET  /api/users/:id`);
});
