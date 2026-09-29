import requests

base_url = "http://127.0.0.1:5000/api"

print("1. Creating User (Auth)")
res = requests.post(f"{base_url}/auth/register", json={
    "username": "tester",
    "email": "test@revo.co",
    "password": "password",
    "role": "citizen",
    "address": "12 Green Street",
    "city": "Mumbai",
    "state": "Maharashtra"
})
print(res.json())

print("2. Creating Society")
res = requests.post(f"{base_url}/society/create", json={
    "name": "Green Earth",
    "society_code": "GRN123",
    "admin_id": 1
})
print(res.json())

print("3. Joining Society")
res = requests.post(f"{base_url}/society/join", json={
    "user_id": 1,
    "society_code": "GRN123"
})
print(res.json())
