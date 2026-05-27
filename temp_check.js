const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./healthcare_db.sqlite');
db.all('SELECT u.id, u.username, u.role, p.id AS patient_id, p.name AS patient_name FROM users u LEFT JOIN patients p ON u.id = p.user_id WHERE u.role = "patient"', (err, rows) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});