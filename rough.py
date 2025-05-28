from Crypto.PublicKey import ECC


def generate_keypair():
    key = ECC.generate(curve='P-256')
    private_key = key.export_key(format='DER')
    public_key = key.public_key().export_key(format='DER')
    return private_key, public_key


s, p = generate_keypair()

key = ECC.import_key(s)
P_prime = key.public_key().export_key(format='DER')

print(p==P_prime)


key = ECC.import_key(s+b'123')
P_prime = key.public_key().export_key(format='DER')

print(p==P_prime)
