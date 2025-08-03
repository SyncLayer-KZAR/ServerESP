// src/components/sdk/synclayerSDK.js
import { openDB } from 'idb';

const DB_NAME = 'SyncLayerDB';
const DB_VERSION = 1;
const KEY_STORE_NAME = 'keys';
const E_S_STORAGE_KEY = 'synclayer_E_S';
const S2_STORAGE_KEY = 'synclayer_S2';
const BACKEND_URL = 'http://localhost:5050';

// ==== IndexedDB Helpers ====
async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
        db.createObjectStore(KEY_STORE_NAME);
      }
    },
  });
}

async function saveToDb(key, value) {
  const db = await getDb();
  await db.put(KEY_STORE_NAME, value, key);
}

async function getFromDb(key) {
  const db = await getDb();
  return await db.get(KEY_STORE_NAME, key);
}

// --- NEW HELPER FUNCTION ---
async function deleteFromDb(key) {
  try {
    const db = await getDb();
    await db.delete(KEY_STORE_NAME, key);
  } catch (err) {
    console.error(`Failed to delete '${key}' from IndexedDB:`, err);
    throw err;
  }
}

// ==== Crypto Helpers ====
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}


// ==== SDK Public Methods ====
const SynclayerSDK = {
  async saveEncryptedSecret(E_S_base64) {
    await saveToDb(E_S_STORAGE_KEY, E_S_base64);
  },

  async loadEncryptedSecret() {
    return await getFromDb(E_S_STORAGE_KEY);
  },

  // === Register ===
  async register(username, password) {
    try {
      // --- ADDED CLEANUP STEP ---
      // Clear any old migration keys to ensure a clean state
      await deleteFromDb(S2_STORAGE_KEY);

      const res = await fetch(`${BACKEND_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Registration failed');
      }

      const { E_S } = await res.json();
      await this.saveEncryptedSecret(E_S); // This will overwrite any old E_S
      return true;
    } catch (err) {
      console.error('Registration failed:', err);
      throw err;
    }
  },

  // === Login ===
  async login(username, password) {
    try {
      const E_S = await this.loadEncryptedSecret();
      if (!E_S) {
        throw new Error('Missing E_S from device storage');
      }

      const res = await fetch(`${BACKEND_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, E_S })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Login failed');
      }

      const { E_S: new_E_S } = await res.json();
      await this.saveEncryptedSecret(new_E_S);
      return true;
    } catch (err) {
      console.error('Login failed:', err);
      throw err;
    }
  },

  // === Start Migration (Destination Device) ===
  async startMigration(username) {
    try {
      const keyPair = await window.crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      );

      const privateKeyS2 = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
      const publicKeyP2 = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);

      await saveToDb(S2_STORAGE_KEY, privateKeyS2);

      const P2_b64 = arrayBufferToBase64(publicKeyP2);
      
      const res = await fetch(`${BACKEND_URL}/start_migration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, P2: P2_b64 })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to start migration');
      }

      return await res.json();

    } catch (err) {
      console.error('Migration failed:', err);
      throw err;
    }
  },

  // === Complete Migration (Source Device) ===
  async completeMigration(username, pin) {
    try {
      const pubKeyRes = await fetch(`${BACKEND_URL}/get_migration_pubkey?pin=${pin}`);
      if (!pubKeyRes.ok) {
        const error = await pubKeyRes.json();
        throw new Error(error.error || 'Could not fetch migration public key.');
      }
      const { P2: P2_b64 } = await pubKeyRes.json();
      const P2_ab = base64ToArrayBuffer(P2_b64);

      const E_S_b64 = await this.loadEncryptedSecret();
      if (!E_S_b64) {
        throw new Error('Local secret (E_S) not found on this device.');
      }
      const E_S_ab = base64ToArrayBuffer(E_S_b64);

      const P2_key = await window.crypto.subtle.importKey(
        'spki', P2_ab, { name: 'ECDH', namedCurve: 'P-256' }, true, []
      );

      const ephemeralKeyPair = await window.crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']
      );
      
      const sharedSecret = await window.crypto.subtle.deriveBits(
        { name: 'ECDH', public: P2_key }, ephemeralKeyPair.privateKey, 256
      );
      
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encrypted_E_S = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        await window.crypto.subtle.importKey('raw', sharedSecret, 'AES-GCM', false, ['encrypt']),
        E_S_ab
      );

      const ephemeralPubKey_ab = await window.crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey);
      
      const finalPayload = new Uint8Array(ephemeralPubKey_ab.byteLength + iv.byteLength + encrypted_E_S.byteLength);
      finalPayload.set(new Uint8Array(ephemeralPubKey_ab), 0);
      finalPayload.set(iv, ephemeralPubKey_ab.byteLength);
      finalPayload.set(new Uint8Array(encrypted_E_S), ephemeralPubKey_ab.byteLength + iv.byteLength);

      const res = await fetch(`${BACKEND_URL}/complete_migration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          pin,
          encrypted_data: arrayBufferToBase64(finalPayload.buffer)
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to complete migration.');
      }

      return await res.json();

    } catch (err) {
      console.error('Migration completion failed:', err);
      throw err;
    }
  },
  
    // === Fetch and Decrypt Secret (Destination Device) ===
  async fetchAndDecryptSecret(username, pin) {
    try {
      const res = await fetch(`${BACKEND_URL}/fetch_migration_data?username=${username}&pin=${pin}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch migration data.');
      }
      const { encrypted_data } = await res.json();
      const payload_ab = base64ToArrayBuffer(encrypted_data);

      const S2_ab = await getFromDb(S2_STORAGE_KEY);
      if (!S2_ab) {
        throw new Error('Destination device private key (S2) not found.');
      }
      const S2_key = await window.crypto.subtle.importKey(
        'pkcs8', S2_ab, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']
      );

      const ephemeralPubKey_ab = payload_ab.slice(0, 65);
      const iv = payload_ab.slice(65, 65 + 12);
      const ciphertext = payload_ab.slice(65 + 12);

      const ephemeralPubKey = await window.crypto.subtle.importKey(
        'raw', ephemeralPubKey_ab, { name: 'ECDH', namedCurve: 'P-256' }, true, []
      );

      const sharedSecret = await window.crypto.subtle.deriveBits(
        { name: 'ECDH', public: ephemeralPubKey }, S2_key, 256
      );

      const E_S_ab = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        await window.crypto.subtle.importKey('raw', sharedSecret, 'AES-GCM', false, ['decrypt']),
        ciphertext
      );

      await this.saveEncryptedSecret(arrayBufferToBase64(E_S_ab));

      return { success: true };

    } catch (err) {
      if (err.message !== 'Migration not yet completed by source device') {
        console.error('Decryption failed:', err);
      }
      throw err;
    }
  }
};

export default SynclayerSDK;
