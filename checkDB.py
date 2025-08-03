from app import db, User, MigrationRequest, app
import base64
from datetime import datetime, timezone # Use timezone-aware datetime
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
            # Use timezone-aware datetime for comparison
            expired = "✅" if m.expires_at.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc) else "❌ (expired)"
            print(f"PIN: {m.pin} | Expires: {m.expires_at} {expired}")
            print(f"Public Key (first 20 bytes): {base64.b64encode(m.public_key[:20]).decode()}... (len={len(m.public_key)} bytes)")
            
            # --- CORRECTED LINE ---
            # Check for the 'encrypted_data' attribute, not 'encrypted_secret'
            if m.encrypted_data:
                print(f"Encrypted Data Present ✅ (len={len(m.encrypted_data)} bytes)")
            else:
                print(f"Encrypted Data: ❌ Not set yet")
            print("----------------------------------")

            # This hashing check is a great idea for debugging!
            user = User.query.filter_by(username=username).first()
            if user:
                user_pub_hash = hashlib.sha256(user.P).hexdigest()
                migration_pub_hash = hashlib.sha256(m.public_key).hexdigest()

                print(f"User.P   SHA256: {user_pub_hash[:10]}...")
                print(f"P2 (dest) SHA256: {migration_pub_hash[:10]}...")

        print("======================================\n")

if __name__ == "__main__":
    # Make sure to re-register this user after deleting the DB
    username_to_check = "zak" 
    check_user_status(username_to_check)
    check_migration_requests(username_to_check)
