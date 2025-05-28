from app import db, User, app  # Import `app` as well
import base64

def check_user_status(username):
    with app.app_context():  # Enter the Flask app context
        user = User.query.filter_by(username=username).first()
        if not user:
            print(f"❌ No user found with username: {username}")
            return
        print(f"Username: {user.username}")
        print(f"Password: {user.password}")
        print(f"Working: {user.working}")
        print(f"E: {base64.b64encode(user.E).decode()} ({len(user.E)} bytes)")
        print(f"Public Key: {user.P[:10]}... ({len(user.P)} bytes)")

if __name__ == "__main__":
    username_to_check = "you"
    check_user_status(username_to_check)