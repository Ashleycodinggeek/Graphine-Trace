const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./healthcare_db.sqlite');

db.all("SELECT id, username, role, full_name FROM users", [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log('Users:', rows);
  }
  db.close();
});