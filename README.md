# SyncLayer Device Validation Demo

## This repository demonstrates device-bound authentication using a combination of a Flask backend and a React Native frontend. 
## The system ensures that login credentials are only valid on the device that registered them, offering enhanced security through hardware-bound keys.

### Overview
	•	The Flask app serves as the backend API, managing user registration, secure key creation, and login validation.
	•	The React Native app acts as the client, interacting with the Flask server, securely storing keys, and managing authentication flows.


### Prerequisites
	•	Python 3.x
	•	Node.js & npm
	•	Expo CLI (for running the React Native app)
	•	Pip (Python package manager)

## Backend Setup (Flask)

1. Clone the repository and navigate to the project root.
2. Create a virtual environment (optional but recommended)
3. Install the required dependencies:
```
pip install Flask
```
4. Run the Flask server:
```
python app.py
```

## Frontend Setup (React Native)

1. Navigate to the `CryptoApp` directory:
```
cd CryptoApp
```
2. 	Install the required dependencies:
```
npm install
```
3.	Start the React Native development server:
```
npm start
```

## How It Works
SyncLayer provides secure, passwordless authentication using hardware-bound cryptographic keys.

### Registration Flow
1. The user registers on the React Native app.
2. The app generates a key pair and securely stores the private key on the device (using SecureStore / Keychain / Keystore).
3. The public key and user credentials are sent to the Flask backend and stored in a database.

### Login Flow
1. The user attempts to log in via the app.
2. A cryptographic challenge is issued by the server.
3. The device signs the challenge using its private key.
4. The server verifies the signature using the public key associated with the user.
5. If the signature is valid and the device is verified, login is successful.

### Device Verification
- If a user attempts to log in from a device that doesn't have the correct private key, the authentication fails.
- This ensures that only the original, registered device can access the account — enhancing both security and user trust.

You can test the behavior by:
- Registering a user on one device.
- Trying to log in with the same credentials on a second device.
- The second device will be rejected, demonstrating hardware-bound verification.





