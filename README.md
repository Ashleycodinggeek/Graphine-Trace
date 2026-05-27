# Healthcare Management System

A comprehensive web-based healthcare management system designed to support administrators, clinicians, and patients in managing and accessing medical information efficiently.

## Features

### Administrator Features
- **User Management**: Create, view, and manage all system users
- **System Oversight**: Monitor system logs and user activities
- **Dashboard**: View system statistics and user counts

### Clinician Features
- **Patient Management**: View and manage patient profiles with health data
- **Vital Signs Recording**: Add and update patient vital signs (blood pressure, heart rate, temperature, weight, height)
- **Medical Notes**: Create detailed medical notes with diagnosis, prescription, and treatment plans
- **Appointment Management**: View scheduled appointments
- **Chat System**: Communicate with patients in real-time
- **Report Generation**: Generate comprehensive patient health reports

### Patient Features
- **Personal Dashboard**: View personal health overview and statistics
- **Profile Management**: Access personal and medical information
- **Appointment Viewing**: Check upcoming and past appointments
- **Medical Records**: View medical notes and treatment history
- **Vital Signs History**: Track personal health metrics over time
- **Doctor Communication**: Chat directly with clinicians

## Technical Architecture

- **Frontend**: HTML, CSS, and JavaScript with responsive design
- **Backend**: Node.js with Express.js framework
- **Database**: MySQL with relational data structure
- **Authentication**: Session-based authentication with role-based access control
- **Security**: Role-based permissions and secure data handling

## Database Schema

The system uses the following main tables:
- `users` - System users with roles (admin, clinician, patient)
- `patients` - Patient demographic and medical information
- `vital_signs` - Patient vital signs measurements
- `appointments` - Scheduled medical appointments
- `medical_notes` - Clinical notes and treatment records
- `chat_messages` - Communication between patients and clinicians
- `system_logs` - Audit trail of system activities

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### System Requirements
The system automatically detects your database configuration:
- **Primary**: MySQL (localhost:3306)
- **Fallback**: SQLite (./healthcare_db.sqlite)

### Quick Start

1. **Install Dependencies**
```bash
npm install
```

2. **Start the Server**
```bash
npm start
```

The server will:
- Attempt to connect to MySQL on localhost
- If MySQL is unavailable, automatically fall back to SQLite
- Initialize database tables on first run
- Create default admin and clinician accounts

3. **Access the Application**
Open your browser and navigate to:
```
http://localhost:8080
```

### Default Credentials

#### Admin Account
- Username: `admin`
- Password: `admin123`
- Role: Administrator

#### Clinician Account
- Username: `clinician`
- Password: `clinician123`
- Role: Clinician (Dr. Sarah Johnson)

#### Sample Patient Accounts
- **Brian Kirui**: `brian_kirui` / `password123`
- **Matheus Cunha**: `matheus_cunha` / `password123`
- **Virginia Smith**: `virginia_smith` / `password123`
- **Sylvia Songol**: `sylvia_songol` / `password123`
- **Victory Jones**: `victory_jones` / `password123`

## Database Configuration

### Using SQLite (Default/Fallback)
No additional configuration needed. The system automatically creates `healthcare_db.sqlite` in the project root.

### Using MySQL

1. **Create Database**
```sql
CREATE DATABASE healthcare_db;
USE healthcare_db;
```

2. **Configure Connection** (in server.js)
```javascript
db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "your_password_here",  // Update this
  database: "healthcare_db"
});
```

3. **Restart Server**
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /login` - User login
- `POST /logout` - User logout
- `GET /api/user` - Get current user info

### Admin Routes
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `GET /api/logs` - Get system logs

### Clinician Routes
- `GET /api/patients` - Get all patients
- `GET /api/patients/:id` - Get specific patient with vitals
- `POST /api/patients/:id/vitals` - Add patient vitals
- `GET /api/appointments` - Get all appointments
- `POST /api/notes` - Add medical notes
- `GET /api/notes/:patient_id` - Get patient medical notes
- `GET /api/chat/:patient_id` - Get chat with patient
- `POST /api/chat` - Send message to patient
- `GET /api/patient-report/:patient_id` - Generate patient report

### Patient Routes
- `GET /api/patient/profile` - Get personal profile
- `GET /api/patient/appointments` - Get personal appointments
- `GET /api/patient/notes` - Get medical notes
- `GET /api/patient/chat` - Get chat messages
- `POST /api/patient/chat` - Send message to clinician
- `GET /api/patient/vitals` - Get vital signs history

## Features Summary

The system provides comprehensive healthcare management with the following capabilities:

### For Administrators
- Create and manage all system users
- View system activity logs with detailed audit trails
- Monitor system statistics in real-time
- Change user roles and permissions

### For Clinicians
- Access comprehensive patient directory with filtering
- Record and track vital signs (BP, HR, temperature, weight, height)
- Create detailed medical notes with diagnosis and treatment plans
- View patient medical history and appointments
- Generate comprehensive patient health reports
- Communicate with patients via integrated chat system
- Track appointment schedules

### For Patients
- View personal health overview dashboard
- Check vital signs history and trends
- Access medical notes and treatment plans from clinicians
- View appointment schedules and history
- Communicate with assigned clinicians
- Download and print medical records

## Security Features

- Session-based authentication
- Role-based access control (RBAC)
- Password-protected user accounts
- Secure API endpoints with role validation
- Activity logging for audit trails
- SQL injection prevention with parameterized queries

## Troubleshooting

### Application won't start
- Ensure Node.js is installed: `node --version`
- Check if port 8080 is available
- Try removing `node_modules` and reinstalling: `npm install`

### Database connection issues
- The system automatically falls back to SQLite if MySQL is unavailable
- For MySQL, verify credentials in `server.js`
- Check MySQL is running: `mysql --version`

### Login failures
- Verify username and password from "Default Credentials" section above
- Check browser console for errors (F12)
- Clear browser cache and cookies

## Future Enhancements

- Email notifications for appointments
- Advanced reporting and analytics
- Mobile app integration
- Two-factor authentication (2FA)
- Prescription management system
- Health insurance integration
- Multi-language support
- Export to PDF reports
- Integration with external health systems

## License

This project is provided as-is for educational and healthcare management purposes.
````
- **Username**: brian_kirui
- **Password**: password123
- **Username**: matheus_cunha
- **Password**: password123
- **Username**: virginia_smith
- **Password**: password123

## User Roles & Permissions

### Administrator
- Full system access
- User account management
- System monitoring and logs
- All clinician and patient features

### Clinician
- Patient data access and management
- Vital signs recording
- Medical notes creation
- Appointment viewing
- Patient communication
- Report generation

### Patient
- Personal health data viewing
- Appointment information
- Medical records access
- Communication with clinicians
- Health metrics tracking

## API Endpoints

### Authentication
- `POST /login` - User authentication
- `POST /logout` - User logout
- `GET /api/user` - Get current user info

### Administrator
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `GET /api/logs` - Get system logs

### Clinician
- `GET /api/patients` - Get all patients
- `GET /api/patients/:id` - Get patient details
- `POST /api/patients/:id/vitals` - Record vital signs
- `GET /api/appointments` - Get appointments
- `POST /api/notes` - Create medical notes
- `GET /api/notes/:patient_id` - Get patient notes
- `GET /api/chat/:patient_id` - Get patient chat
- `POST /api/chat` - Send chat message
- `GET /api/patient-report/:patient_id` - Generate report

### Patient
- `GET /api/patient/profile` - Get own profile
- `GET /api/patient/appointments` - Get own appointments
- `GET /api/patient/notes` - Get own medical notes
- `GET /api/patient/chat` - Get chat messages
- `POST /api/patient/chat` - Send chat message
- `GET /api/patient/vitals` - Get vital signs history

## Security Features

- **Role-Based Access Control**: Users can only access authorized features
- **Session Management**: Secure session handling with automatic logout
- **Input Validation**: Server-side validation of all user inputs
- **SQL Injection Protection**: Parameterized queries
- **Audit Logging**: All user actions are logged for security monitoring

## Usage Guide

### For Administrators
1. Login with admin credentials
2. Use the dashboard to monitor system statistics
3. Manage user accounts through the User Management section
4. Review system logs for security and activity monitoring

### For Clinicians
1. Login with clinician credentials
2. View patient list and detailed profiles
3. Record vital signs and create medical notes
4. Manage appointments and communicate with patients
5. Generate comprehensive health reports

### For Patients
1. Login with patient credentials
2. View personal health dashboard and statistics
3. Check upcoming appointments and medical history
4. Review medical notes from clinicians
5. Communicate directly with healthcare providers

## Future Enhancements

- Email notifications for appointments
- File upload for medical documents
- Advanced reporting and analytics
- Mobile application
- Integration with medical devices
- Multi-language support
- Advanced search and filtering
- Backup and recovery features

## Contributing

This system is designed to be extensible and maintainable. Contributions for new features, bug fixes, and improvements are welcome.

## License

This project is developed for educational and healthcare management purposes.