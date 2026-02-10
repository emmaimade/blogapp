from sqlmodel import Session, select
from ..app.dbConfig import engine
from ..app.models.models import User, UserRole
from ..app.utils.auth import get_password_hash

def create_admin():
    with Session(engine) as session:
        # Check if admin already exists to avoid duplicates
        statement = select(User).where(User.username == "admin")
        existing_admin = session.exec(statement).first()
        
        if existing_admin:
            print("Admin user already exists!")
            return

        # Create the admin user
        admin_user = User(
            username="admin",
            email="admin@cms.com",
            hashed_password=get_password_hash("admin"), # Change this!
            role=UserRole.ADMIN,
            is_active=True
        )
        
        session.add(admin_user)
        session.commit()
        print("Admin user created successfully!")

if __name__ == "__main__":
    create_admin()