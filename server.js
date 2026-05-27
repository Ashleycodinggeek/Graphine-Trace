require('dotenv').config();
const mysql = require('mysql2');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');

const port = process.env.PORT || 8080;
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'healthcare_system_secret_key_2026',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.SECURE_COOKIES === 'true' } // Set to true in production with HTTPS
}));

// Only serve static files for non-API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next(); // Skip static file serving for API routes
  }
  express.static(path.join(__dirname, 'public'))(req, res, next);
});

// Serve homepage at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Database connection with fallback
let db;
let dbType = 'mysql';

try {
  // Try MySQL first
  db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "", // Set your MySQL password here
    database: process.env.DB_NAME || "healthcare_db"
  });

  db.connect(function(err) {
    if (err) {
      console.log('MySQL connection failed, falling back to SQLite:', err.message);
      dbType = 'sqlite';
      initializeSQLite();
    } else {
      console.log("Connected to MySQL database!");
      initializeDatabase();
    }
  });
} catch (error) {
  console.log('MySQL not available, using SQLite fallback');
  dbType = 'sqlite';
  initializeSQLite();
}

function initializeSQLite() {
  const sqlite3 = require('sqlite3').verbose();
  db = new sqlite3.Database('./healthcare_db.sqlite', (err) => {
    if (err) {
      console.error('SQLite connection failed:', err.message);
    } else {
      console.log('Connected to SQLite database!');
      initializeDatabase();
    }
  });
}

// Initialize database tables
function initializeDatabase() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      email TEXT,
      full_name TEXT,
      specialty TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      clinician_id INTEGER,
      name TEXT NOT NULL,
      date_of_birth DATE,
      gender TEXT,
      phone TEXT,
      address TEXT,
      emergency_contact TEXT,
      blood_type TEXT,
      allergies TEXT,
      medical_history TEXT,
      status TEXT DEFAULT 'active',
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (clinician_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS vital_signs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      blood_pressure TEXT,
      heart_rate TEXT,
      temperature TEXT,
      weight DECIMAL(5,2),
      height DECIMAL(5,2),
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      recorded_by INTEGER,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (recorded_by) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      clinician_id INTEGER,
      appointment_date DATE,
      appointment_time TIME,
      reason TEXT,
      status TEXT DEFAULT 'scheduled',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (clinician_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS medical_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      clinician_id INTEGER,
      diagnosis TEXT,
      prescription TEXT,
      treatment_plan TEXT,
      comments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (clinician_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS heatmap_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      user_id INTEGER,
      role TEXT,
      region TEXT,
      comment TEXT,
      map_timestamp DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS heatmap_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feedback_id INTEGER,
      clinician_id INTEGER,
      reply TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (feedback_id) REFERENCES heatmap_feedback(id),
      FOREIGN KEY (clinician_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      clinician_id INTEGER,
      sender_id INTEGER,
      sender_role TEXT,
      message TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (clinician_id) REFERENCES users(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`
  ];

  if (dbType === 'sqlite') {
    // SQLite initialization
    db.serialize(() => {
      queries.forEach((query, index) => {
        db.run(query, (err) => {
          if (err) {
            console.error(`Error creating table ${index + 1}:`, err);
          } else if (index === queries.length - 1) {
            console.log('Database tables initialized successfully');
            ensureSchema().then(insertInitialData).catch(err => {
              console.error('Schema migration error:', err);
              insertInitialData();
            });
          }
        });
      });
    });
  } else {
    // MySQL initialization
    queries.forEach((query, index) => {
      db.query(query, (err) => {
        if (err) {
          console.error(`Error creating table ${index + 1}:`, err);
        } else if (index === queries.length - 1) {
          console.log('Database tables initialized successfully');
          ensureSchema().then(insertInitialData).catch(err => {
            console.error('Schema migration error:', err);
            insertInitialData();
          });
        }
      });
    });
  }
}

function ensureSchema() {
  return new Promise(async (resolve, reject) => {
    try {
      if (dbType === 'sqlite') {
        const columns = await runQuery('PRAGMA table_info(users)');
        if (!columns.some(column => column.name === 'specialty')) {
          await runQuerySingle('ALTER TABLE users ADD COLUMN specialty TEXT');
        }
      } else {
        const columns = await runQuery("SHOW COLUMNS FROM users LIKE 'specialty'");
        if (!columns || columns.length === 0) {
          await runQuerySingle('ALTER TABLE users ADD COLUMN specialty VARCHAR(255)');
        }
      }
      resolve();
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('duplicate column')) {
        resolve();
      } else {
        reject(err);
      }
    }
  });
}

// Database abstraction functions
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (dbType === 'sqlite') {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    } else {
      db.query(sql, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    }
  });
}

function runQuerySingle(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (dbType === 'sqlite') {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ insertId: this.lastID, affectedRows: this.changes });
      });
    } else {
      db.query(sql, params, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    }
  });
}

async function findOrCreatePatientRecord(userId) {
  const patientResults = await runQuery('SELECT id FROM patients WHERE user_id = ?', [userId]);
  if (patientResults.length > 0) {
    return patientResults[0].id;
  }

  const userResults = await runQuery('SELECT full_name FROM users WHERE id = ?', [userId]);
  const fullName = userResults.length > 0 ? (userResults[0].full_name || 'Patient') : 'Patient';
  const insertResult = await runQuerySingle('INSERT INTO patients (user_id, name, status) VALUES (?, ?, \'active\')', [userId, fullName]);
  return insertResult.insertId;
}

function ensureSchema() {
  return new Promise(async (resolve, reject) => {
    try {
      if (dbType === 'sqlite') {
        const columns = await runQuery('PRAGMA table_info(users)');
        if (!columns.some(column => column.name === 'specialty')) {
          await runQuerySingle('ALTER TABLE users ADD COLUMN specialty TEXT');
        }
      } else {
        const columns = await runQuery("SHOW COLUMNS FROM users LIKE 'specialty'");
        if (!columns || columns.length === 0) {
          await runQuerySingle('ALTER TABLE users ADD COLUMN specialty VARCHAR(255)');
        }
      }
      resolve();
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('duplicate column')) {
        resolve();
      } else {
        reject(err);
      }
    }
  });
}

function insertInitialData() {
  const insertUser = (username, password, role, email, full_name) => {
    return new Promise((resolve, reject) => {
      if (dbType === 'sqlite') {
        db.run(
          `INSERT OR IGNORE INTO users (username, password, role, email, full_name) VALUES (?, ?, ?, ?, ?)`,
          [username, password, role, email, full_name],
          function(err) {
            if (err) {
              console.error(`Error inserting user ${username}:`, err);
              reject(err);
            } else {
              console.log(`User ${username} inserted/checked successfully`);
              resolve({ insertId: this.lastID });
            }
          }
        );
      } else {
        db.query(
          `INSERT IGNORE INTO users (username, password, role, email, full_name) VALUES (?, ?, ?, ?, ?)`,
          [username, password, role, email, full_name],
          (err, result) => {
            if (err) {
              console.error(`Error inserting user ${username}:`, err);
              reject(err);
            } else {
              console.log(`User ${username} inserted/checked successfully`);
              resolve(result);
            }
          }
        );
      }
    });
  };

  const insertPatient = (user_id, name, dob, gender, phone, clinician_id = null) => {
    return new Promise((resolve, reject) => {
      const sqliteQuery = clinician_id !== null
        ? `INSERT OR IGNORE INTO patients (user_id, name, date_of_birth, gender, phone, clinician_id) VALUES (?, ?, ?, ?, ?, ?)`
        : `INSERT OR IGNORE INTO patients (user_id, name, date_of_birth, gender, phone) VALUES (?, ?, ?, ?, ?)`;
      const sqliteParams = clinician_id !== null
        ? [user_id, name, dob, gender, phone, clinician_id]
        : [user_id, name, dob, gender, phone];

      const mysqlQuery = clinician_id !== null
        ? `INSERT IGNORE INTO patients (user_id, name, date_of_birth, gender, phone, clinician_id) VALUES (?, ?, ?, ?, ?, ?)`
        : `INSERT IGNORE INTO patients (user_id, name, date_of_birth, gender, phone) VALUES (?, ?, ?, ?, ?)`;
      const mysqlParams = clinician_id !== null
        ? [user_id, name, dob, gender, phone, clinician_id]
        : [user_id, name, dob, gender, phone];

      if (dbType === 'sqlite') {
        db.run(
          sqliteQuery,
          sqliteParams,
          function(err) {
            if (err) {
              console.error(`Error inserting patient ${name}:`, err);
              reject(err);
            } else {
              resolve(this.lastID);
            }
          }
        );
      } else {
        db.query(
          mysqlQuery,
          mysqlParams,
          (err) => {
            if (err) {
              console.error(`Error inserting patient ${name}:`, err);
              reject(err);
            } else {
              resolve(user_id);
            }
          }
        );
      }
    });
  };

  // Insert default admin user
  (async () => {
    try {
      await insertUser('admin', 'admin123', 'admin', 'admin@healthcare.com', 'System Administrator');
      
      // Insert default clinician
      const clinicianResult = await insertUser('clinician', 'clinician123', 'clinician', 'clinician@healthcare.com', 'Dr. Sarah Johnson');
      let clinicianId = clinicianResult.insertId;
      if (!clinicianId) {
        const clinicianRows = await runQuery('SELECT id FROM users WHERE username = ?', ['clinician']);
        clinicianId = clinicianRows.length > 0 ? clinicianRows[0].id : null;
      }

      // Insert sample patients assigned to the clinician
      const samplePatients = [
        { username: 'brian_kirui', name: 'Brian Kirui', dob: '1990-05-15', gender: 'male', phone: '+1234567890' },
        { username: 'matheus_cunha', name: 'Matheus Cunha', dob: '1985-03-22', gender: 'male', phone: '+1234567891' },
        { username: 'virginia_smith', name: 'Virginia Smith', dob: '1978-11-08', gender: 'female', phone: '+1234567892' },
        { username: 'sylvia_songol', name: 'Sylvia Songol', dob: '1992-07-30', gender: 'female', phone: '+1234567893' },
        { username: 'victory_jones', name: 'Victory Jones', dob: '1988-12-12', gender: 'male', phone: '+1234567894' }
      ];

      for (const patient of samplePatients) {
        try {
          const userResult = await insertUser(patient.username, 'password123', 'patient', `${patient.username}@example.com`, patient.name);
          // Get the user ID from the result; if the patient already exists, look it up
          let userId = userResult.insertId;
          if (!userId) {
            const existingUser = await runQuery('SELECT id FROM users WHERE username = ?', [patient.username]);
            userId = existingUser.length > 0 ? existingUser[0].id : null;
          }

          // Only insert or update patient record if we have a user ID
          if (userId) {
            await insertPatient(userId, patient.name, patient.dob, patient.gender, patient.phone, clinicianId);
            await runQuerySingle(
              `UPDATE patients SET clinician_id = ? WHERE user_id = ? AND (clinician_id IS NULL OR clinician_id = '')`,
              [clinicianId, userId]
            );
          }
        } catch (err) {
          console.error(`Error setting up patient ${patient.name}:`, err);
        }
      }
      console.log('Default data initialization completed');
    } catch (err) {
      console.error('Error in initial data setup:', err);
    }
  })();
}

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  // For API endpoints, return JSON; for page requests, redirect
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized', redirectTo: '/login.html' });
  }
  res.redirect('/login.html');
}

// Middleware to check specific roles
function requireRole(roles) {
  return function(req, res, next) {
    if (!req.session.userId) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthorized', redirectTo: '/login.html' });
      }
      return res.redirect('/login.html');
    }
    if (!roles.includes(req.session.role)) {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'Access denied' });
      }
      return res.status(403).send('Access denied');
    }
    next();
  };
}

// ================== AUTHENTICATION ROUTES ==================

// Login POST route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log(`Login attempt: username=${username}`);
    const results = await runQuery("SELECT id, username, role, full_name FROM users WHERE username = ? AND password = ?", [username, password]);

    if (results && results.length > 0) {
      const user = results[0];
      console.log(`Login successful for user: ${username} (role: ${user.role})`);
      
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.fullName = user.full_name;

      // Log the login
      try {
        await runQuerySingle("INSERT INTO system_logs (user_id, action, details) VALUES (?, ?, ?)",
          [user.id, 'login', `User ${user.username} logged in`]);
      } catch (logErr) {
        console.error('Error logging login action:', logErr);
      }

      // Redirect based on role
      switch(user.role) {
        case 'admin':
          return res.redirect('/admin-dashboard.html');
        case 'clinician':
          return res.redirect('/clinician-dashboard.html');
        case 'patient':
          return res.redirect('/patient-dashboard.html');
        default:
          return res.redirect('/login.html?error=1');
      }
    } else {
      console.log(`Login failed: no user found with username=${username}`);
      res.redirect('/login.html?error=1');
    }
  } catch (err) {
    console.error('Login error:', err);
    res.redirect('/login.html?error=1');
  }
});

// Admin-only login route
app.post('/api/admin-login', async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log(`Admin login attempt: username=${username}`);
    const results = await runQuery("SELECT id, username, role, full_name FROM users WHERE username = ? AND password = ? AND role = 'admin'", [username, password]);

    if (results && results.length > 0) {
      const user = results[0];
      console.log(`Admin login successful for user: ${username}`);
      
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.fullName = user.full_name;

      // Log the login
      try {
        await runQuerySingle("INSERT INTO system_logs (user_id, action, details) VALUES (?, ?, ?)",
          [user.id, 'login', `Admin ${user.username} logged in`]);
      } catch (logErr) {
        console.error('Error logging admin login action:', logErr);
      }

      res.json({ success: true, redirect: '/admin-dashboard.html' });
    } else {
      console.log(`Admin login failed: invalid credentials or not an admin`);
      res.status(401).json({ success: false, error: 'Invalid admin credentials' });
    }
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ success: false, error: 'Login error' });
  }
});

// Clinician-only login route
app.post('/api/clinician-login', async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log(`Clinician login attempt: username=${username}`);
    const results = await runQuery("SELECT id, username, role, full_name FROM users WHERE username = ? AND password = ? AND role = 'clinician'", [username, password]);

    if (results && results.length > 0) {
      const user = results[0];
      console.log(`Clinician login successful for user: ${username}`);
      
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.fullName = user.full_name;

      // Log the login
      try {
        await runQuerySingle("INSERT INTO system_logs (user_id, action, details) VALUES (?, ?, ?)",
          [user.id, 'login', `Clinician ${user.username} logged in`]);
      } catch (logErr) {
        console.error('Error logging clinician login action:', logErr);
      }

      res.json({ success: true, redirect: '/clinician-dashboard.html' });
    } else {
      console.log(`Clinician login failed: invalid credentials or not a clinician`);
      res.status(401).json({ success: false, error: 'Invalid clinician credentials' });
    }
  } catch (err) {
    console.error('Clinician login error:', err);
    res.status(500).json({ success: false, error: 'Login error' });
  }
});

// Patient-only login route
app.post('/api/patient-login', async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log(`Patient login attempt: username=${username}`);
    const results = await runQuery("SELECT id, username, role, full_name FROM users WHERE username = ? AND password = ? AND role = 'patient'", [username, password]);

    if (results && results.length > 0) {
      const user = results[0];
      console.log(`Patient login successful for user: ${username}`);
      
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.fullName = user.full_name;

      // Log the login
      try {
        await runQuerySingle("INSERT INTO system_logs (user_id, action, details) VALUES (?, ?, ?)",
          [user.id, 'login', `Patient ${user.username} logged in`]);
      } catch (logErr) {
        console.error('Error logging patient login action:', logErr);
      }

      res.json({ success: true, redirect: '/patient-dashboard.html' });
    } else {
      console.log(`Patient login failed: invalid credentials or not a patient`);
      res.status(401).json({ success: false, error: 'Invalid patient credentials' });
    }
  } catch (err) {
    console.error('Patient login error:', err);
    res.status(500).json({ success: false, error: 'Login error' });
  }
});

// DEBUG: Check users in database
app.get('/debug/users', async (req, res) => {
  try {
    const results = await runQuery("SELECT id, username, role, password FROM users");
    res.json(results);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// Logout route
app.post('/logout', async (req, res) => {
  if (req.session.userId) {
    try {
      await runQuerySingle("INSERT INTO system_logs (user_id, action, details) VALUES (?, ?, ?)",
        [req.session.userId, 'logout', `User ${req.session.username} logged out`]);
    } catch (err) {
      console.error('Error logging logout:', err);
    }
  }
  req.session.destroy();
  res.redirect('/login.html');
});

// Get current user info
app.get('/api/user', requireAuth, (req, res) => {
  res.json({
    id: req.session.userId,
    username: req.session.username,
    role: req.session.role,
    fullName: req.session.fullName
  });
});

// ================== GENERAL ROUTES ==================

// Serve login page
app.get('/', (req, res) => {
  if (req.session.userId) {
    // Redirect to appropriate dashboard
    switch(req.session.role) {
      case 'admin':
        return res.redirect('/admin-dashboard.html');
      case 'clinician':
        return res.redirect('/dashboard.html');
      case 'patient':
        return res.redirect('/patient-dashboard.html');
    }
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ================== ADMIN ROUTES ==================

// Get all users (Admin only)
app.get('/api/users', requireRole(['admin']), async (req, res) => {
  try {
    const results = await runQuery("SELECT id, username, role, email, full_name, specialty, created_at FROM users ORDER BY created_at DESC");
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// Create new user (Admin only)
app.post('/api/users', requireRole(['admin']), async (req, res) => {
  const { username, password, role, email, full_name, specialty } = req.body;

  try {
    const existing = await runQuery("SELECT id FROM users WHERE username = ?", [username]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const result = await runQuerySingle("INSERT INTO users (username, password, role, email, full_name, specialty) VALUES (?, ?, ?, ?, ?, ?)",
      [username, password, role, email, full_name, specialty || null]);

    const userId = result.insertId;

    // If the user is a patient, create a corresponding patient record
    if (role === 'patient') {
      await runQuerySingle("INSERT INTO patients (user_id, name, status) VALUES (?, ?, 'active')",
        [userId, full_name]);
    }

    // Log the action
    await runQuerySingle("INSERT INTO system_logs (user_id, action, details) VALUES (?, ?, ?)",
      [req.session.userId, 'create_user', `Created user ${username} with role ${role}`]);

    res.json({ success: true, userId: userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating user' });
  }
});

// Update user info (Admin only - for editing clinician/admin details)
app.put('/api/users/:userId', requireRole(['admin']), async (req, res) => {
  const userId = req.params.userId;
  const { full_name, email, specialty } = req.body;

  try {
    // Check if user exists
    const userResults = await runQuery("SELECT id, username, role FROM users WHERE id = ?", [userId]);
    if (userResults.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResults[0];

    // Update user info
    await runQuerySingle("UPDATE users SET full_name = ?, email = ?, specialty = ? WHERE id = ?",
      [full_name, email, specialty || null, userId]);

    // Log the action
    await runQuerySingle("INSERT INTO system_logs (user_id, action, details) VALUES (?, ?, ?)",
      [req.session.userId, 'update_user', `Updated user ${user.username} (${user.role})`]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating user' });
  }
});

// Delete user (Admin only)
app.delete('/api/users/:userId', requireRole(['admin']), async (req, res) => {
  const userId = req.params.userId;

  try {
    // Check if user exists
    const userResults = await runQuery("SELECT id, username, role FROM users WHERE id = ?", [userId]);
    if (userResults.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResults[0];

    // Prevent deletion of admin users or self
    if (user.role === 'admin' || user.id === req.session.userId) {
      return res.status(403).json({ error: 'Cannot delete admin users or yourself' });
    }

    // Delete user (cascade will handle related records if set up)
    await runQuerySingle("DELETE FROM users WHERE id = ?", [userId]);

    // Log the action
    await runQuerySingle("INSERT INTO system_logs (user_id, action, details) VALUES (?, ?, ?)",
      [req.session.userId, 'delete_user', `Deleted user ${user.username} with role ${user.role}`]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting user' });
  }
});

// Get system logs (Admin only)
app.get('/api/logs', requireRole(['admin']), async (req, res) => {
  try {
    const results = await runQuery(`SELECT l.*, u.username FROM system_logs l
                   LEFT JOIN users u ON l.user_id = u.id
                   ORDER BY l.timestamp DESC LIMIT 100`);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching logs' });
  }
});

// ================== CLINICIAN ROUTES ==================

// Get all patients (Clinicians and Admins)
app.get('/api/patients', requireRole(['admin', 'clinician']), async (req, res) => {
  try {
    let query = `SELECT p.*, u.username as patient_username, u.email, c.full_name as clinician_name
                 FROM patients p
                 LEFT JOIN users u ON p.user_id = u.id
                 LEFT JOIN users c ON p.clinician_id = c.id
                 WHERE p.status = 'active'`;

    // If user is a clinician, only show assigned patients
    if (req.session.role === 'clinician') {
      query += ` AND p.clinician_id = ?`;
    }

    const results = await runQuery(query, req.session.role === 'clinician' ? [req.session.userId] : []);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching patients' });
  }
});

// Clinician-only patients list: assigned patients only
app.get('/api/clinician/patients', requireRole(['clinician']), async (req, res) => {
  try {
    console.log('DEBUG: clinician patients route hit for user', req.session.userId);
    const results = await runQuery(`SELECT p.*, u.username as patient_username, u.email, c.full_name as clinician_name
                   FROM patients p
                   LEFT JOIN users u ON p.user_id = u.id
                   LEFT JOIN users c ON p.clinician_id = c.id
                   WHERE p.status = 'active' AND p.clinician_id = ?`, [req.session.userId]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching clinician patients' });
  }
});

// Clinician-only patients list alias for compatibility
app.get('/api/clinician-patients', requireRole(['clinician']), async (req, res) => {
  try {
    console.log('DEBUG: clinician patients alias route hit for user', req.session.userId);
    const results = await runQuery(`SELECT p.*, u.username as patient_username, u.email, c.full_name as clinician_name
                   FROM patients p
                   LEFT JOIN users u ON p.user_id = u.id
                   LEFT JOIN users c ON p.clinician_id = c.id
                   WHERE p.status = 'active' AND p.clinician_id = ?`, [req.session.userId]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching clinician patients' });
  }
});

// Get patient details with vitals (Clinicians and Admins)
app.get('/api/patients/:id', requireRole(['admin', 'clinician']), async (req, res) => {
  const patientId = req.params.id;

  try {
    // Get patient basic info
    let query = `SELECT p.*, u.username, u.email, c.full_name as clinician_name
                 FROM patients p
                 LEFT JOIN users u ON p.user_id = u.id
                 LEFT JOIN users c ON p.clinician_id = c.id
                 WHERE p.id = ?`;

    const params = [patientId];

    // If user is a clinician, check if patient is assigned to them
    if (req.session.role === 'clinician') {
      query += ` AND p.clinician_id = ?`;
      params.push(req.session.userId);
    }

    const patientResults = await runQuery(query, params);

    if (patientResults.length === 0) {
      return res.status(404).send('Patient not found or access denied');
    }

    const patient = patientResults[0];

    // Get latest vitals
    const vitalsResults = await runQuery(`SELECT blood_pressure, heart_rate, temperature, weight, height
                   FROM vital_signs
                   WHERE patient_id = ?
                   ORDER BY recorded_at DESC LIMIT 1`, [patientId]);

    if (vitalsResults.length > 0) {
      patient.vitals = vitalsResults[0];
    }

    res.json(patient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching patient' });
  }
});

// Update patient info (Admin only)
app.put('/api/patients/:id', requireRole(['admin']), async (req, res) => {
  const patientId = req.params.id;
  const { name, date_of_birth, gender, phone, email, clinician_id } = req.body;

  try {
    // Check if patient exists
    const patientResults = await runQuery("SELECT user_id FROM patients WHERE id = ?", [patientId]);
    if (patientResults.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const userId = patientResults[0].user_id;

    // Convert empty strings to null for optional fields
    const dateOfBirthValue = date_of_birth === '' ? null : date_of_birth;
    const genderValue = gender === '' ? null : gender;
    const phoneValue = phone === '' ? null : phone;
    const clinicianIdValue = clinician_id === '' ? null : clinician_id;

    // Update patients table
    await runQuerySingle("UPDATE patients SET name = ?, date_of_birth = ?, gender = ?, phone = ?, clinician_id = ? WHERE id = ?",
      [name, dateOfBirthValue, genderValue, phoneValue, clinicianIdValue, patientId]);

    // Update users table if email or name provided
    if (email || name) {
      await runQuerySingle("UPDATE users SET email = ?, full_name = ? WHERE id = ?", [email || null, name, userId]);
    }

    // Log the action
    await runQuerySingle("INSERT INTO system_logs (user_id, action, details) VALUES (?, ?, ?)",
      [req.session.userId, 'update_patient', `Updated patient ${patientId}`]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating patient' });
  }
});

// Add/update patient vitals (Clinicians only)
app.post('/api/patients/:id/vitals', requireRole(['clinician']), async (req, res) => {
  const patientId = req.params.id;
  const { blood_pressure, heart_rate, temperature, weight, height } = req.body;

  try {
    // Check if clinician has access to this patient
    const patientCheck = await runQuery("SELECT id FROM patients WHERE id = ? AND clinician_id = ?", [patientId, req.session.userId]);
    if (patientCheck.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await runQuerySingle("INSERT INTO vital_signs (patient_id, blood_pressure, heart_rate, temperature, weight, height, recorded_by) VALUES (?, ?, ?, ?, ?, ?)",
      [patientId, blood_pressure, heart_rate, temperature, weight, height, req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error recording vitals' });
  }
});

// Get appointments (Clinicians and Admins)
app.get('/api/appointments', requireRole(['admin', 'clinician']), async (req, res) => {
  try {
    let query = `SELECT a.*, p.name as patient_name, u.full_name as clinician_name
                 FROM appointments a
                 JOIN patients p ON a.patient_id = p.id
                 LEFT JOIN users u ON a.clinician_id = u.id`;

    // If user is a clinician, only show appointments for their assigned patients
    if (req.session.role === 'clinician') {
      query += ` WHERE p.clinician_id = ?`;
    }

    query += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC`;

    const results = await runQuery(query, req.session.role === 'clinician' ? [req.session.userId] : []);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching appointments');
  }
});

// DEBUG: Log all requests to /api/appointments
app.all('/api/appointments', (req, res, next) => {
  console.log(`${req.method} /api/appointments received`);
  next();
});

// Book an appointment (Clinicians and Admins)
app.post('/api/appointments', requireRole(['admin', 'clinician']), async (req, res) => {
  console.log('POST /api/appointments called', req.body);
  const { patient_id, appointment_date, appointment_time, reason } = req.body;

  try {
    // Check if clinician has access to this patient (admins can book for any patient)
    if (req.session.role === 'clinician') {
      const patientCheck = await runQuery("SELECT id FROM patients WHERE id = ? AND clinician_id = ?", [patient_id, req.session.userId]);
      if (patientCheck.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = await runQuerySingle(
      "INSERT INTO appointments (patient_id, clinician_id, appointment_date, appointment_time, reason, status) VALUES (?, ?, ?, ?, ?, 'scheduled')",
      [patient_id, req.session.userId, appointment_date, appointment_time, reason]
    );

    console.log('Appointment created:', result);
    res.json({ success: true, appointmentId: result.insertId });
  } catch (err) {
    console.error('Appointment error:', err);
    res.status(500).json({ error: 'Error booking appointment' });
  }
});

// Add medical notes (Clinicians only)
app.post('/api/notes', requireRole(['clinician']), async (req, res) => {
  const { patient_id, diagnosis, prescription, treatment_plan, comments } = req.body;

  try {
    // Check if clinician has access to this patient
    const patientCheck = await runQuery("SELECT id FROM patients WHERE id = ? AND clinician_id = ?", [patient_id, req.session.userId]);
    if (patientCheck.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await runQuerySingle("INSERT INTO medical_notes (patient_id, clinician_id, diagnosis, prescription, treatment_plan, comments) VALUES (?, ?, ?, ?, ?, ?)",
      [patient_id, req.session.userId, diagnosis, prescription, treatment_plan, comments]);
    res.json({ success: true, noteId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error saving notes' });
  }
});

// Get medical notes for a patient (Clinicians and Admins)
app.get('/api/notes/:patient_id', requireRole(['admin', 'clinician']), async (req, res) => {
  const patientId = req.params.patient_id;

  try {
    // First check if clinician has access to this patient
    if (req.session.role === 'clinician') {
      const patientCheck = await runQuery("SELECT id FROM patients WHERE id = ? AND clinician_id = ?", [patientId, req.session.userId]);
      if (patientCheck.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const results = await runQuery(`SELECT n.*, u.full_name as clinician_name
                   FROM medical_notes n
                   LEFT JOIN users u ON n.clinician_id = u.id
                   WHERE n.patient_id = ?
                   ORDER BY n.created_at DESC`, [patientId]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching notes' });
  }
});

// Get chat messages for a patient (Clinicians only)
app.get('/api/chat/:patient_id', requireRole(['clinician']), async (req, res) => {
  const patientId = req.params.patient_id;

  try {
    // Check if clinician has access to this patient
    const patientCheck = await runQuery("SELECT id FROM patients WHERE id = ? AND clinician_id = ?", [patientId, req.session.userId]);
    if (patientCheck.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const results = await runQuery(`SELECT c.*, u.full_name as sender_name
                   FROM chat_messages c
                   LEFT JOIN users u ON c.sender_id = u.id
                   WHERE c.patient_id = ?
                   ORDER BY c.timestamp ASC`, [patientId]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching chat' });
  }
});

// Send chat message (Clinicians only)
app.post('/api/chat', requireRole(['clinician']), async (req, res) => {
  const { patient_id, message } = req.body;

  try {
    // Check if clinician has access to this patient
    const patientCheck = await runQuery("SELECT id FROM patients WHERE id = ? AND clinician_id = ?", [patient_id, req.session.userId]);
    if (patientCheck.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await runQuerySingle("INSERT INTO chat_messages (patient_id, clinician_id, sender_id, sender_role, message) VALUES (?, ?, ?, 'clinician', ?)",
      [patient_id, req.session.userId, req.session.userId, message]);
    res.json({ success: true, messageId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error sending message' });
  }
});

// Generate patient report (Clinicians and Admins)
app.get('/api/patient-report/:patient_id', requireRole(['admin', 'clinician']), async (req, res) => {
  const patientId = req.params.patient_id;

  try {
    // Check if clinician has access to this patient
    if (req.session.role === 'clinician') {
      const patientCheck = await runQuery("SELECT id FROM patients WHERE id = ? AND clinician_id = ?", [patientId, req.session.userId]);
      if (patientCheck.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Get patient details
    const patientResults = await runQuery(`SELECT p.*, u.username, u.email
                      FROM patients p
                      LEFT JOIN users u ON p.user_id = u.id
                      WHERE p.id = ?`, [patientId]);

    if (patientResults.length === 0) {
      return res.status(404).send('Patient not found');
    }

    const patient = patientResults[0];

    // Get medical notes
    const notes = await runQuery(`SELECT n.*, u.full_name as clinician_name
                      FROM medical_notes n
                      LEFT JOIN users u ON n.clinician_id = u.id
                      WHERE n.patient_id = ?
                      ORDER BY n.created_at DESC`, [patientId]);

    // Get appointments
    const appointments = await runQuery(`SELECT a.*, u.full_name as clinician_name
                      FROM appointments a
                      LEFT JOIN users u ON a.clinician_id = u.id
                      WHERE a.patient_id = ?
                      ORDER BY a.appointment_date DESC`, [patientId]);

    // Get latest vitals
    const vitals = await runQuery(`SELECT * FROM vital_signs
                       WHERE patient_id = ?
                       ORDER BY recorded_at DESC LIMIT 1`, [patientId]);

    const report = {
      patient: patient,
      medical_notes: notes,
      appointments: appointments,
      latest_vitals: vitals[0] || null,
      generated_at: new Date().toISOString(),
      generated_by: req.session.fullName
    };

    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating report' });
  }
});

// ================== PATIENT ROUTES ==================

// Get patient's own profile (Patients only)
app.get('/api/patient/profile', requireRole(['patient']), async (req, res) => {
  try {
    const patientId = await findOrCreatePatientRecord(req.session.userId);
    const results = await runQuery(`SELECT p.*, u.username, u.email
                   FROM patients p
                   JOIN users u ON p.user_id = u.id
                   WHERE p.id = ?`, [patientId]);

    if (results.length === 0) {
      return res.status(404).send('Profile not found');
    }
    res.json(results[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching profile' });
  }
});

// Get patient's appointments (Patients only)
app.get('/api/patient/appointments', requireRole(['patient']), async (req, res) => {
  try {
    const results = await runQuery(`SELECT a.*, u.full_name as clinician_name
                   FROM appointments a
                   JOIN patients p ON a.patient_id = p.id
                   LEFT JOIN users u ON a.clinician_id = u.id
                   WHERE p.user_id = ?
                   ORDER BY a.appointment_date DESC, a.appointment_time DESC`, [req.session.userId]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching appointments');
  }
});

// Get patient's medical notes (Patients only)
app.get('/api/patient/notes', requireRole(['patient']), async (req, res) => {
  try {
    const results = await runQuery(`SELECT n.*, u.full_name as clinician_name
                   FROM medical_notes n
                   JOIN patients p ON n.patient_id = p.id
                   LEFT JOIN users u ON n.clinician_id = u.id
                   WHERE p.user_id = ?
                   ORDER BY n.created_at DESC`, [req.session.userId]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching notes' });
  }
});

// Get patient's chat messages (Patients only)
app.get('/api/patient/chat', requireRole(['patient']), async (req, res) => {
  try {
    const results = await runQuery(`SELECT c.*, u.full_name as sender_name
                   FROM chat_messages c
                   JOIN patients p ON c.patient_id = p.id
                   LEFT JOIN users u ON c.sender_id = u.id
                   WHERE p.user_id = ?
                   ORDER BY c.timestamp ASC`, [req.session.userId]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching chat' });
  }
});

// Send chat message as patient (Patients only)
app.post('/api/patient/chat', requireRole(['patient']), async (req, res) => {
  const { message } = req.body;

  try {
    // First get the patient's record
    const patientResults = await runQuery("SELECT id FROM patients WHERE user_id = ?", [req.session.userId]);

    if (patientResults.length === 0) {
      return res.status(500).json({ error: 'Patient record not found' });
    }

    const patientId = patientResults[0].id;
    const result = await runQuerySingle("INSERT INTO chat_messages (patient_id, sender_id, sender_role, message) VALUES (?, ?, 'patient', ?)",
      [patientId, req.session.userId, message]);
    res.json({ success: true, messageId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error sending message' });
  }
});

// Get patient's vital signs history (Patients only)
app.get('/api/patient/vitals', requireRole(['patient']), async (req, res) => {
  try {
    const results = await runQuery(`SELECT v.*, u.full_name as recorded_by_name
                   FROM vital_signs v
                   JOIN patients p ON v.patient_id = p.id
                   LEFT JOIN users u ON v.recorded_by = u.id
                   WHERE p.user_id = ?
                   ORDER BY v.recorded_at DESC`, [req.session.userId]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching vitals' });
  }
});

function parsePeriod(period) {
  const now = new Date();
  let since = new Date(now);

  switch (period) {
    case '1h':
      since.setHours(since.getHours() - 1);
      break;
    case '6h':
      since.setHours(since.getHours() - 6);
      break;
    case '24h':
      since.setDate(since.getDate() - 1);
      break;
    case '7d':
      since.setDate(since.getDate() - 7);
      break;
    case '30d':
      since.setDate(since.getDate() - 30);
      break;
    default:
      since.setDate(since.getDate() - 1);
      break;
  }

  return since.toISOString().slice(0, 19).replace('T', ' ');
}

app.get('/api/patient/vitals-history', requireRole(['patient']), async (req, res) => {
  const period = req.query.period || '24h';
  const since = parsePeriod(period);

  try {
    const results = await runQuery(`SELECT v.*, u.full_name as recorded_by_name
                   FROM vital_signs v
                   JOIN patients p ON v.patient_id = p.id
                   LEFT JOIN users u ON v.recorded_by = u.id
                   WHERE p.user_id = ? AND v.recorded_at >= ?
                   ORDER BY v.recorded_at ASC`, [req.session.userId, since]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching vitals history');
  }
});

app.get('/api/vitals-history/:patient_id', requireRole(['admin', 'clinician']), async (req, res) => {
  const period = req.query.period || '24h';
  const since = parsePeriod(period);
  const patientId = req.params.patient_id;

  try {
    // Check if clinician has access to this patient
    if (req.session.role === 'clinician') {
      const patientCheck = await runQuery("SELECT id FROM patients WHERE id = ? AND clinician_id = ?", [patientId, req.session.userId]);
      if (patientCheck.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const results = await runQuery(`SELECT v.*, u.full_name as recorded_by_name
                   FROM vital_signs v
                   LEFT JOIN users u ON v.recorded_by = u.id
                   WHERE v.patient_id = ? AND v.recorded_at >= ?
                   ORDER BY v.recorded_at ASC`, [patientId, since]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching vitals history');
  }
});

app.get('/api/heatmap-risk/:patient_id', requireRole(['admin', 'clinician']), async (req, res) => {
  const period = req.query.period || '7d';
  const since = parsePeriod(period);
  const patientId = req.params.patient_id;

  try {
    // Check if clinician has access to this patient
    if (req.session.role === 'clinician') {
      const patientCheck = await runQuery("SELECT id FROM patients WHERE id = ? AND clinician_id = ?", [patientId, req.session.userId]);
      if (patientCheck.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const vitals = await runQuery(`SELECT recorded_at, blood_pressure, heart_rate, temperature
                   FROM vital_signs
                   WHERE patient_id = ? AND recorded_at >= ?
                   ORDER BY recorded_at ASC`, [patientId, since]);

    const feedbackEvents = await runQuery(`SELECT map_timestamp
                   FROM heatmap_feedback
                   WHERE patient_id = ? AND map_timestamp >= ?
                   ORDER BY map_timestamp ASC`, [patientId, since]);

    const feedbackByLabel = {};
    feedbackEvents.forEach(event => {
      const label = new Date(event.map_timestamp).toLocaleString();
      feedbackByLabel[label] = (feedbackByLabel[label] || 0) + 1;
    });

    const labels = vitals.map(v => new Date(v.recorded_at).toLocaleString());
    const riskScores = vitals.map(v => {
      let score = 0;
      const heartRate = Number(v.heart_rate);
      const temperature = Number(v.temperature);

      if (!isNaN(heartRate)) {
        score += Math.max(0, Math.min((heartRate - 70) * 0.8, 30));
      }
      if (!isNaN(temperature)) {
        score += Math.max(0, Math.min((temperature - 36.5) * 30, 30));
      }
      if (v.blood_pressure) {
        const parts = v.blood_pressure.split('/').map(p => Number(p.trim()));
        if (parts.length === 2) {
          const [sys, dia] = parts;
          if (!isNaN(sys)) {
            if (sys >= 130) score += 10;
            if (sys >= 140) score += 10;
          }
          if (!isNaN(dia)) {
            if (dia >= 85) score += 10;
            if (dia >= 95) score += 10;
          }
        }
      }
      return Math.min(100, Math.round(score));
    });

    const feedbackDaily = labels.map(label => feedbackByLabel[label] || 0);
    let latestRiskScore = null;
    if (riskScores.length > 0) {
      latestRiskScore = riskScores[riskScores.length - 1];
    } else if (feedbackEvents.length > 0) {
      labels.push(new Date().toLocaleString());
      latestRiskScore = Math.min(100, Math.max(20, feedbackEvents.length * 10));
      riskScores.push(latestRiskScore);
      feedbackDaily.push(feedbackEvents.length);
    }

    res.json({ labels, riskScores, feedbackDaily, feedbackCount: feedbackEvents.length, latestRiskScore });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching heatmap risk data' });
  }
});

// Patient heatmap feedback and comments
app.post('/api/patient/heatmap-feedback', requireRole(['patient']), async (req, res) => {
  const { region, comment, map_timestamp } = req.body;

  try {
    const patientId = await findOrCreatePatientRecord(req.session.userId);
    const timestamp = map_timestamp || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const result = await runQuerySingle('INSERT INTO heatmap_feedback (patient_id, user_id, role, region, comment, map_timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [patientId, req.session.userId, 'patient', region, comment, timestamp]);

    res.json({ success: true, feedbackId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error saving heatmap feedback' });
  }
});

app.get('/api/patient/heatmap-feedback', requireRole(['patient']), async (req, res) => {
  try {
    const patientId = await findOrCreatePatientRecord(req.session.userId);
    const feedbackList = await runQuery(`SELECT h.*, u.full_name as patient_name
                   FROM heatmap_feedback h
                   LEFT JOIN users u ON h.user_id = u.id
                   WHERE h.patient_id = ?
                   ORDER BY h.created_at DESC`, [patientId]);

    const feedbackWithReplies = await Promise.all(feedbackList.map(async feedback => {
      const replies = await runQuery(`SELECT r.*, u.full_name as clinician_name
                     FROM heatmap_replies r
                     LEFT JOIN users u ON r.clinician_id = u.id
                     WHERE r.feedback_id = ?
                     ORDER BY r.created_at ASC`, [feedback.id]);
      return { ...feedback, replies };
    }));

    res.json(feedbackWithReplies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching heatmap feedback' });
  }
});

app.get('/api/heatmap-feedback/:patient_id', requireRole(['admin', 'clinician']), async (req, res) => {
  const patientId = req.params.patient_id;

  try {
    // Check if clinician has access to this patient
    if (req.session.role === 'clinician') {
      const patientCheck = await runQuery("SELECT id FROM patients WHERE id = ? AND clinician_id = ?", [patientId, req.session.userId]);
      if (patientCheck.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const feedbackList = await runQuery(`SELECT h.*, u.full_name as patient_name
                   FROM heatmap_feedback h
                   LEFT JOIN users u ON h.user_id = u.id
                   WHERE h.patient_id = ?
                   ORDER BY h.created_at DESC`, [patientId]);

    const feedbackWithReplies = await Promise.all(feedbackList.map(async feedback => {
      const replies = await runQuery(`SELECT r.*, u.full_name as clinician_name
                     FROM heatmap_replies r
                     LEFT JOIN users u ON r.clinician_id = u.id
                     WHERE r.feedback_id = ?
                     ORDER BY r.created_at ASC`, [feedback.id]);
      return { ...feedback, replies };
    }));

    res.json(feedbackWithReplies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching heatmap feedback' });
  }
});

app.post('/api/heatmap-feedback/:feedback_id/reply', requireRole(['admin', 'clinician']), async (req, res) => {
  const feedbackId = req.params.feedback_id;
  const { reply } = req.body;

  try {
    const result = await runQuerySingle('INSERT INTO heatmap_replies (feedback_id, clinician_id, reply) VALUES (?, ?, ?)',
      [feedbackId, req.session.userId, reply]);
    res.json({ success: true, replyId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error saving reply' });
  }
});

function logRegisteredRoutes() {
  if (!app._router || !app._router.stack) return;
  const routes = app._router.stack
    .filter(layer => layer.route && layer.route.path)
    .map(layer => `${Object.keys(layer.route.methods).join(',').toUpperCase()} ${layer.route.path}`);
  console.log('Registered routes:');
  routes.forEach(route => console.log(' -', route));
}

// Start server
app.listen(port, () => {
  console.log(`Healthcare Management System running on http://localhost:${port}`);
  logRegisteredRoutes();
});