const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./healthcare_db.sqlite');

db.all("SELECT * FROM patients WHERE id=1", [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log('Patient:', rows);
  }
  db.close();
});