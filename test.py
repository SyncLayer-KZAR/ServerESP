import argparse
import requests
import base64
import sys

URL = 'http://127.0.0.1:5000'

def register_user(username, password):
    print(f"\nRegistering user: {username}")
    data = {'username': username, 'password': password}
    r = requests.post(f'{URL}/register', json=data)
    if r.status_code == 200:
        resp = r.json()
        print("✔️ Registered Successfully.")
        print("E:", resp['E'])
        print("E_S:", resp['E_S'])
        print("P:", resp['P'])
    else:
        print("❌ Registration Failed:", r.text)

def login_user(username, password, E_S_str):
    print(f"\nLogging in user: {username}")
    data = {
        'username': username,
        'password': password,
        'E_S': E_S_str
    }
    r = requests.post(f'{URL}/login', json=data)
    if r.status_code == 200:
        resp = r.json()
        print("✔️ Login Success")
        print("E:", resp['E'])
        print("E_S:", resp['E_S'])
        print("P:", resp['P'])
    else:
        print("❌ Login Failed:", r.status_code, r.text)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Test user registration and login.")
    parser.add_argument("action", choices=["register", "login"], help="Action to perform")
    parser.add_argument("--username", required=True, help="Username")
    parser.add_argument("--password", required=True, help="Password")
    parser.add_argument("--E_S", help="Base64 encoded E(S) for login")

    args = parser.parse_args()

    if args.action == "register":
        register_user(args.username, args.password)
    elif args.action == "login":
        if not args.E_S:
            print("❌ Error: --E_S must be provided for login.")
            sys.exit(1)
        login_user(args.username, args.password, args.E_S)