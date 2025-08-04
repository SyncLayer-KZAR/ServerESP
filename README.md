# SyncLayer: Device-Bound Web Authentication Demo

This repository demonstrates a powerful security pattern: device-bound authentication for web applications. The system uses a Flask backend and a React frontend to ensure that user credentials, even if stolen, are only valid on the device that originally registered them.

This project has been updated from a React Native implementation to a modern web-based architecture, showcasing how to build, bundle, and consume a standalone security SDK for any web project.

### Overview

* **Flask Backend**: Serves as the API, managing user registration, secure key rotation, and login validation. It never stores passwords or private keys.
* **`metamask2` (React App)**: The core reference application. This project contains the source code for the `synclayerSDK.web.js` and demonstrates its direct usage within a React component structure.
* **`dummy-wallet` (Vite + React App)**: A separate, clean-room test application. Its purpose is to demonstrate how a third-party developer would consume the final, bundled `synclayer-sdk-web.js` file, proving the SDK's portability.

---

### How It Works

SyncLayer provides enhanced security by tying a user's session to their specific browser/device using cryptography.

#### Registration Flow
1.  A user registers on a web app (e.g., `DummyWallet`).
2.  The SyncLayer SDK generates a cryptographic key pair (`S`/`P`) within the browser. The private key `S` is immediately encrypted with a key derived from the user's password and a server-provided secret, creating `E_S`.
3.  The encrypted secret `E_S` is stored in the browser's **IndexedDB**. The private key `S` is discarded and never touches the server.
4.  The public key `P` and user credentials are sent to the Flask backend.

#### Login Flow
1.  The user attempts to log in. The app sends the username, password, and the stored `E_S`.
2.  The backend uses the password to derive a key and attempts to decrypt `E_S` to recover the private key `S`.
3.  **This decryption will only succeed if the `E_S` came from the correct user session.** An `E_S` from another device will fail a cryptographic check (MAC check), immediately blocking the attempt.
4.  If successful, the server verifies that the public key derived from the recovered `S` matches the one on record.
5.  If all checks pass, the server issues a new `E_S` for the next session, and the login is successful.

#### Device Migration Flow
1.  **On the new device (Destination):** The user initiates the migration. The SDK generates a new key pair (`S2`/`P2`), stores `S2` locally (with a 5-minute expiry), and sends `P2` to the server. The server returns a short, secure PIN.
2.  **On the old device (Source):** The user enters the PIN. The SDK uses the PIN to fetch `P2` from the server, then encrypts its current `E_S` using `P2` and sends the encrypted data to the server.
3.  **Back on the new device:** The SDK polls the server. Once it finds the encrypted data, it uses its stored private key `S2` to decrypt it, successfully transferring the user's secret to the new device.

---

### Prerequisites
* Python 3.x & `pip`
* Node.js & `npm`

---

### Setup and Running the Demo

This is a multi-part process. Follow the steps in order.

#### 1. Start the Backend Server

The backend must be running for the frontends to work.

```bash
# Navigate to the project root (the folder containing this README)
# Set up and activate a Python virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows, use `venv\Scripts\activate`

# Install dependencies
pip install Flask Flask-SQLAlchemy pycryptodome

# Run the Flask server
python app.py
```

The backend will now be running on `http://localhost:5050`.

#### 2. Build the Standalone SDK

Next, we need to build the distributable SDK from the `metamask2` project.

```bash
# Navigate to the metamask2 directory
cd metamask2

# Install its dependencies
npm install

# Run the specific build script for the web SDK
npm run build:sdk:web
```

This will create a final, bundled file at `metamask2/dist/synclayer-sdk-web.js`.

#### 3. Run the `dummy-wallet` Test App

This is the primary way to test the SDK as an external module.

```bash
# From the metamask2 directory, go back to the root and into dummy-wallet
cd ../dummy-wallet

# --- Crucial Step: Copy the SDK bundle into the test app ---
# This command copies the file from the metamask2 build output to the dummy-wallet public folder.
cp ../metamask2/dist/synclayer-sdk-web.js ./public/

# Install the test app's dependencies
npm install

# Run the Vite development server
npm run dev
```

Your browser will open to the `DummyWallet` application, which is now using the SDK you just built. You can test the full registration, login, and migration flow here.

#### (Optional) 4. Run the `metamask2` App

You can also run the main `metamask2` application directly. It uses the same SDK but imports the source code directly instead of the bundle.

```bash
# Make sure you are in the metamask2 directory
cd metamask2

# If you haven't already, install dependencies
npm install

# Start the React development server
npm start
