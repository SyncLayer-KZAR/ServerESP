from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from Crypto.PublicKey import ECC
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
import base64

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
db = SQLAlchemy(app)

# Database model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    E = db.Column(db.LargeBinary, nullable=False)
    P = db.Column(db.LargeBinary, nullable=False)
    working = db.Column(db.Boolean, default=True)

# AES encryption helpers
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

# ECC keypair
def generate_keypair():
    key = ECC.generate(curve='P-256')
    private_key = key.export_key(format='DER')
    public_key = key.public_key().export_key(format='DER')
    return private_key, public_key

# Register route
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data['username']
    password = data['password']

    # Generate keys
    S, P = generate_keypair()
    E = get_random_bytes(32)
    E_S = aes_encrypt(E, S)

    # Save to DB
    user = User(username=username, password=password, E=E, P=P, working=True)
    db.session.add(user)
    db.session.commit()

    # Print E(S) to the console for manual testing
    print("\n==== REGISTRATION INFO ====")
    print(f"Username: {username}")
    print(f"Password: {password}")
    print(f"E_S (base64): {base64.b64encode(E_S).decode()}")
    print("============================\n")

    return jsonify({
        'E': base64.b64encode(E).decode(),
        'E_S': base64.b64encode(E_S).decode(),
        'P': base64.b64encode(P).decode()
    })

# Login route
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data['username']
    password = data['password']
    E_S_prime_b64 = data['E_S']

    # Lookup user
    user = User.query.filter_by(username=username, password=password).first()
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401

    if not user.working:
        return jsonify({'error': 'Blocked'}), 403

    try:
        E_S_prime = base64.b64decode(E_S_prime_b64)
        S_prime = aes_decrypt(user.E, E_S_prime)

        # Reconstruct public key from decrypted private key
        key = ECC.import_key(S_prime)
        P_prime = key.public_key().export_key(format='DER')

        if P_prime != user.P:
            user.working = False
            db.session.commit()
            return jsonify({'error': 'Key mismatch, user blocked'}), 400

        # Successful login: rotate keys
        new_S, new_P = generate_keypair()
        new_E = get_random_bytes(32)
        new_E_S = aes_encrypt(new_E, new_S)

        # Save updated E and P
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

# Init
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)