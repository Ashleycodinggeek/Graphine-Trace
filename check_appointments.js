const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./healthcare_db.sqlite');

db.all("SELECT * FROM appointments", [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log('Appointments:', rows);
  }
  db.close();
});