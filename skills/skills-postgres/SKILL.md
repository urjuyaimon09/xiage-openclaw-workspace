PostgreSQL 🐘

PostgreSQL database management.

Setup
export DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"

Features
SQL query execution
Schema management
Index optimization
Backup and restore
Performance monitoring
Extensions management
Usage Examples
"Show all tables"
"Run query: SELECT * FROM users"
"Create index on email column"
"Show slow queries"

Commands
psql "$DATABASE_URL" -c "SELECT * FROM users LIMIT 10"

Safety Rules
ALWAYS confirm before destructive operations
BACKUP before schema changes