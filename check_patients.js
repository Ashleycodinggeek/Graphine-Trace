const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./healthcare_db.sqlite');

db.all("SELECT * FROM patients", [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log('Patients:', rows);
  }
  db.close();
});