from app import db, User, MigrationRequest, app  # Include MigrationRequest
import base64
from datetime import datetime
import hashlib

def check_user_status(username):
    with app.app_context():
        user = User.query.filter_by(username=username).first()
        if not user:
            print(f"❌ No user found with username: {username}")
            return
        print("\n=== 👤 USER INFO ===")
        print(f"Username: {user.username}")
        print(f"Password: {user.password}")
        print(f"Working: {user.working}")
        print(f"E (len={len(user.E)}): {base64.b64encode(user.E).decode()}")
        print(f"P (len={len(user.P)}): {base64.b64encode(user.P).decode()}")
        print("=====================\n")

def check_migration_requests(username):
    with app.app_context():
        migrations = MigrationRequest.query.filter_by(username=username).all()
        if not migrations:
            print(f"⚠️ No migration requests found for: {username}")
            return
        print(f"\n=== 📲 MIGRATION REQUESTS for {username} ===")
        for m in migrations:
            expired = "✅" if m.expires_at > datetime.utcnow() else "❌ (expired)"
            print(f"PIN: {m.pin} | Expires: {m.expires_at} {expired}")
            print(f"Public Key (first 10 bytes): {base64.b64encode(m.public_key[:20]).decode()}... (len={len(m.public_key)} bytes)")
            if m.encrypted_secret:
                print(f"Encrypted Secret Present ✅ (len={len(m.encrypted_secret)} bytes)")
            else:
                print(f"Encrypted Secret: ❌ Not set yet")
            print("----------------------------------")

            user = User.query.filter_by(username=username).first()
            user_pub_hash = hashlib.sha256(user.P).hexdigest()
            migration_pub_hash = hashlib.sha256(m.public_key).hexdigest()

            print(f"User.P   SHA256: {user_pub_hash}")
            print(f"P2 (dest) SHA256: {migration_pub_hash}")

        print("======================================\n")

if __name__ == "__main__":
    username_to_check = "zak1"
    check_user_status(username_to_check)
    check_migration_requests(username_to_check)