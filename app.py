from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from Crypto.PublicKey import ECC
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
import base64
import string
import random
from datetime import datetime, timedelta, timezone

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
db = SQLAlchemy(app)

# ===================== Models =====================
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    E = db.Column(db.LargeBinary, nullable=False)
    P = db.Column(db.LargeBinary, nullable=False)
    working = db.Column(db.Boolean, default=True)

class MigrationRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    pin = db.Column(db.String(10), unique=True, nullable=False)
    username = db.Column(db.String(120), nullable=False)
    public_key = db.Column(db.LargeBinary, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    encrypted_secret = db.Column(db.LargeBinary, nullable=True)

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

def generate_pin(length=6):
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))

# ===================== Routes =====================
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data['username']
    password = data['password']

    S, P = generate_keypair()
    E = get_random_bytes(32)
    E_S = aes_encrypt(E, S)

    user = User(username=username, password=password, E=E, P=P, working=True)
    db.session.add(user)
    db.session.commit()

    return jsonify({
        'E': base64.b64encode(E).decode(),
        'E_S': base64.b64encode(E_S).decode(),
        'P': base64.b64encode(P).decode()
    })

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data['username']
    password = data['password']
    E_S_prime_b64 = data['E_S']

    user = User.query.filter_by(username=username, password=password).first()
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    if not user.working:
        return jsonify({'error': 'Blocked'}), 403

    try:
        E_S_prime = base64.b64decode(E_S_prime_b64)
        S_prime = aes_decrypt(user.E, E_S_prime)

        key = ECC.import_key(S_prime)
        P_prime = key.public_key().export_key(format='DER')

        if P_prime != user.P:
            user.working = False
            db.session.commit()
            return jsonify({'error': 'Key mismatch, user blocked'}), 400

        new_S, new_P = generate_keypair()
        new_E = get_random_bytes(32)
        new_E_S = aes_encrypt(new_E, new_S)

        user.E = new_E
        user.P = new_P
        db.session.commit()

        return jsonify({
            'E': base64.b64encode(new_E).decode(),
            'E_S': base64.b64encode(new_E_S).decode(),
            'P': base64.b64encode(new_P).decode()
        })

    except Exception:
        user.working = False
        db.session.commit()
        return jsonify({'error': 'Decryption failed, user blocked'}), 400

@app.route('/start_migration', methods=['POST'])
def start_migration():
    data = request.get_json()
    username = data.get('username')
    P2_b64 = data.get('P2')

    if not username or not P2_b64:
        return jsonify({'error': 'Missing username or P2'}), 400

    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({'error': 'User does not exist'}), 404
    if not user.working:
        return jsonify({'error': 'User is blocked'}), 403

    try:
        P2 = base64.b64decode(P2_b64)
    except Exception:
        return jsonify({'error': 'Invalid base64 encoding for P2'}), 400

    while True:
        pin = generate_pin()
        if not MigrationRequest.query.filter_by(pin=pin).first():
            break

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    migration = MigrationRequest(pin=pin, username=username, public_key=P2, expires_at=expires_at)

    db.session.add(migration)
    db.session.commit()

    return jsonify({'pin': pin, 'expires_at': expires_at.isoformat()})


def hybrid_encrypt_ecc(public_key_der, plaintext):
    """
    Encrypt `plaintext` using ECDH-derived AES key with recipient's public ECC key.
    Returns: ephemeral_pubkey + encrypted blob
    """
    # Load P2 (destination's public key)
    P2 = ECC.import_key(public_key_der)

    # Generate ephemeral ECC key (random key just for this encryption)
    ephemeral_key = ECC.generate(curve='P-256')
    eph_pub_key = ephemeral_key.public_key().export_key(format='DER')

    # Derive shared secret: ephemeral_priv * P2_pub
    shared_secret_point = P2.pointQ * ephemeral_key.d
    shared_bytes = int(shared_secret_point.x).to_bytes(32, 'big')

    # AES encrypt
    ciphertext = aes_encrypt(shared_bytes, plaintext)

    # Return ephemeral public key + ciphertext
    return eph_pub_key + ciphertext


@app.route('/complete_migration', methods=['POST'])
def complete_migration():
    try:
        data = request.get_json()
        username = data['username']
        pin = data['pin']

        user = User.query.filter_by(username=username).first()
        if not user:
            return jsonify({'error': 'Invalid username'}), 404

        migration = MigrationRequest.query.filter_by(pin=pin, username=username).first()
        if not migration:
            return jsonify({'error': 'Invalid or expired PIN'}), 400

        expires_at_aware = migration.expires_at.replace(tzinfo=timezone.utc)
        if expires_at_aware < datetime.now(timezone.utc):
            return jsonify({'error': 'Expired PIN'}), 400

        # ✅ Use the correct hybrid encryption
        encrypted_E = hybrid_encrypt_ecc(migration.public_key, user.E)

        migration.encrypted_secret = encrypted_E
        db.session.commit()

        return jsonify({'status': 'Migration data stored'})

    except Exception as e:
        print("❌ Error in /complete_migration:", e)
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/fetch_migration_data', methods=['GET'])
def fetch_migration_data():
    try:
        username = request.args.get('username')
        pin = request.args.get('pin')

        if not username or not pin:
            return jsonify({'error': 'Missing username or PIN'}), 400

        migration = MigrationRequest.query.filter_by(pin=pin, username=username).first()
        if not migration:
            return jsonify({'error': 'Invalid PIN or username'}), 404

        if migration.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            return jsonify({'error': 'Migration request expired'}), 400

        if not migration.encrypted_secret:
            return jsonify({'error': 'Migration not completed yet'}), 400

        return jsonify({
            'encrypted_E': base64.b64encode(migration.encrypted_secret).decode()
        })

    except Exception as e:
        print("❌ Error in /fetch_migration_data:", e)
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error'}), 500
    
    
# ===================== Run =====================
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5050, debug=True)