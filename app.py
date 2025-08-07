from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from Crypto.PublicKey import ECC
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
import base64
import string
import secrets
from datetime import datetime, timedelta, timezone
import traceback
# --- NEW: Import password hashing utilities ---
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
db = SQLAlchemy(app)

# ===================== Models =====================
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), unique=True, nullable=False)
    # The password column will now store a long hash, not the plain password.
    password = db.Column(db.String(256), nullable=False)
    E = db.Column(db.LargeBinary, nullable=False)
    P = db.Column(db.LargeBinary, nullable=False)
    working = db.Column(db.Boolean, default=True)

class MigrationRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    pin = db.Column(db.String(10), unique=True, nullable=False)
    username = db.Column(db.String(120), nullable=False)
    public_key = db.Column(db.LargeBinary, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    encrypted_data = db.Column(db.LargeBinary, nullable=True)

# ===================== Crypto Helpers =====================
def aes_encrypt(key, plaintext):
    iv = get_random_bytes(12)
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext)
    return iv + tag + ciphertext

def aes_decrypt(key, blob):
    iv = blob[:12]
    tag = blob[12:28]
    ciphertext = blob[28:]
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    return cipher.decrypt_and_verify(ciphertext, tag)

def generate_keypair():
    key = ECC.generate(curve='P-256')
    private_key = key.export_key(format='DER')
    public_key = key.public_key().export_key(format='DER')
    return private_key, public_key

def generate_pin():
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    pin = ''.join(secrets.choice(alphabet) for i in range(8))
    return pin

# ===================== Routes =====================
@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data['username']
        password = data['password']

        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username already exists'}), 409

        S, P = generate_keypair()
        E = get_random_bytes(32)
        E_S = aes_encrypt(E, S)

        # --- MODIFIED: Hash the password before storing ---
        hashed_password = generate_password_hash(password)
        user = User(username=username, password=hashed_password, E=E, P=P, working=True)
        
        db.session.add(user)
        db.session.commit()

        return jsonify({'E_S': base64.b64encode(E_S).decode()})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {e}'}), 500


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    E_S_prime_b64 = data.get('E_S')

    # --- MODIFIED: Find user by username only first ---
    user = User.query.filter_by(username=username).first()

    # --- MODIFIED: Securely check password hash ---
    # If no user or if the password hash doesn't match, it's an invalid login.
    if not user or not check_password_hash(user.password, password):
        return jsonify({'error': 'Invalid username or password'}), 401

    try:
        # Step 1: Always attempt decryption first
        E_S_prime = base64.b64decode(E_S_prime_b64)
        S_prime = aes_decrypt(user.E, E_S_prime)

        # Step 2: If decryption succeeds, verify the public key
        key = ECC.import_key(S_prime)
        P_prime = key.public_key().export_key(format='DER')

        if P_prime != user.P:
            user.working = False
            db.session.commit()
            return jsonify({'error': 'Key mismatch, user blocked'}), 400

        # Step 3: If keys match, this is the legitimate device.
        # NOW we check if the account had been previously locked.
        if not user.working:
            return jsonify({'error': 'User blocked. Someone has your credentials!!!'}), 401

        # Step 4: All checks passed. This is a successful login.
        new_S, new_P = generate_keypair()
        new_E = get_random_bytes(32)
        new_E_S = aes_encrypt(new_E, new_S)

        user.E = new_E
        user.P = new_P
        db.session.commit()

        return jsonify({'E_S': base64.b64encode(new_E_S).decode()})

    except Exception as e:
        # This block now ONLY catches decryption failures
        user.working = False
        db.session.commit()
        traceback.print_exc()
        return jsonify({'error': 'Decryption failed, user blocked'}), 400
    

@app.route('/start_migration', methods=['POST'])
def start_migration():
    try:
        data = request.get_json()
        username = data.get('username')
        P2_b64 = data.get('P2')

        if not username or not P2_b64:
            return jsonify({'error': 'Missing username or P2'}), 400

        if not User.query.filter_by(username=username, working=True).first():
            return jsonify({'error': 'User does not exist or is blocked'}), 404

        P2 = base64.b64decode(P2_b64)

        while True:
            pin = generate_pin()
            if not MigrationRequest.query.filter_by(pin=pin).first():
                break

        expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
        migration = MigrationRequest(pin=pin, username=username, public_key=P2, expires_at=expires_at)
        db.session.add(migration)
        db.session.commit()

        return jsonify({'pin': pin, 'expires_at': expires_at.isoformat()})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {e}'}), 500

@app.route('/get_migration_pubkey', methods=['GET'])
def get_migration_pubkey():
    try:
        pin = request.args.get('pin')
        if not pin:
            return jsonify({'error': 'PIN is required'}), 400

        migration = MigrationRequest.query.filter_by(pin=pin).first()
        if not migration or migration.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            return jsonify({'error': 'Invalid or expired PIN'}), 404

        return jsonify({'P2': base64.b64encode(migration.public_key).decode()})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {e}'}), 500

@app.route('/complete_migration', methods=['POST'])
def complete_migration():
    try:
        data = request.get_json()
        username = data.get('username')
        pin = data.get('pin')
        encrypted_data_b64 = data.get('encrypted_data')

        if not all([username, pin, encrypted_data_b64]):
            return jsonify({'error': 'Missing required fields'}), 400

        migration = MigrationRequest.query.filter_by(pin=pin, username=username).first()
        if not migration or migration.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            return jsonify({'error': 'Invalid or expired PIN'}), 400

        migration.encrypted_data = base64.b64decode(encrypted_data_b64)
        db.session.commit()
        return jsonify({'status': 'Migration data stored successfully'})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {e}'}), 500

@app.route('/fetch_migration_data', methods=['GET'])
def fetch_migration_data():
    try:
        username = request.args.get('username')
        pin = request.args.get('pin')

        if not username or not pin:
            return jsonify({'error': 'Missing username or PIN'}), 400

        migration = MigrationRequest.query.filter_by(pin=pin, username=username).first()
        if not migration or migration.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            return jsonify({'error': 'Invalid or expired PIN'}), 404

        if not migration.encrypted_data:
            return jsonify({'error': 'Migration not yet completed by source device'}), 400

        print(f"Migration data for {username} with PIN {pin} fetched successfully.")
        return jsonify({'encrypted_data': base64.b64encode(migration.encrypted_data).decode()})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'An internal server error occurred: {e}'}), 500



@app.route('/healthcheck', methods=['GET'])
def healthcheck():
    return jsonify({'status': 'ok'}), 200


# ===================== Run =====================
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5050, debug=True)
