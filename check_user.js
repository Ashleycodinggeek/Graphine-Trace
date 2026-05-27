const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./healthcare_db.sqlite');

db.all("SELECT * FROM users WHERE id=3", [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log('User:', rows);
  }
  db.close();
});