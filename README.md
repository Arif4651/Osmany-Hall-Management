# Hall Backend

ASP.NET Core Web API backend for the Osmany Hall React frontend.

## Stack

- ASP.NET Core `net10.0`
- PostgreSQL through EF Core and Npgsql
- JWT bearer authentication
- Role-based authorization for `admin` and `student`
- EF Core migrations

## Configuration

Do not commit real database passwords or JWT secrets.

For local development, set secrets with:

```powershell
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=osmany_hall;Username=postgres;Password=YOUR_PASSWORD"
dotnet user-secrets set "Jwt:Secret" "replace_with_a_long_random_secret_at_least_32_chars"
```

For deployment, use environment variables:

```powershell
$env:ConnectionStrings__DefaultConnection="Host=...;Port=5432;Database=...;Username=...;Password=..."
$env:Jwt__Secret="replace_with_a_long_random_secret_at_least_32_chars"
```

## Run

```powershell
dotnet restore
dotnet ef database update
dotnet run
```

In local Debug builds, the project runs without a Windows apphost so repeated `dotnet run` calls do not fail while rebuilding a previously started backend executable. If another backend instance is already listening on `http://localhost:5012`, stop it first or use a port-kill command before starting a second copy.

In development, the app also runs pending migrations and seeds starter admin/student data at startup.

Seed logins:

- Admin: `admin@mist.ac.bd` / `Admin@123`
- Student: `2023001` / `2023001`

Student accounts use `student_id` as the username. When an admin creates a student, the backend creates the linked login account automatically, sets the initial password to the student ID, and requires a password change on first login.

## Main API Areas

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`
- `GET /api/auth/me`
- `GET /api/student/profile`
- `PUT /api/student/profile`
- `GET /api/students`
- `POST /api/students`
- `PUT /api/students/{id}`
- `DELETE /api/students/{id}`
- `POST /api/students/{id}/reset-password`
- `GET /api/meals/module`
- `PUT /api/meals/settings/cutoff`
- `PUT /api/meals/configuration`
- `GET /api/dashboard/admin`
- `GET /api/billing`
- `GET /api/payments`
- `GET /api/inventory`
- `GET /api/audit-logs`
- `GET /api/notifications/student/{studentId}`
