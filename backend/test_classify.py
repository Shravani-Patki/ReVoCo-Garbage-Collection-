"""
Quick smoke-test for the /api/classify endpoint.
Run from the backend/ directory with the seeded database and Flask server running:
    python test_classify.py
"""
import sys, os, base64, json, urllib.request

# --- Create a tiny synthetic test image (solid red 224×224) ---
try:
    from PIL import Image
    import io
    img = Image.new('RGB', (224, 224), color=(220, 60, 60))
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    b64 = base64.b64encode(buf.getvalue()).decode()
    print("✅ Pillow available — using synthetic JPEG image")
except ImportError:
    # Fallback: use a small valid base64 JPEG from a known byte sequence
    print("⚠️  Pillow not available, using placeholder image")
    b64 = ""

if not b64:
    print("ERROR: Could not create a test image. Install Pillow first.")
    sys.exit(1)

payload = json.dumps({"image": f"data:image/jpeg;base64,{b64}"}).encode()

login_payload = json.dumps({"email": "citizen@gmail.com", "password": "password"}).encode()
login_req = urllib.request.Request(
    "http://127.0.0.1:5000/api/auth/login",
    data=login_payload,
    headers={"Content-Type": "application/json"},
    method="POST"
)

try:
    with urllib.request.urlopen(login_req, timeout=10) as resp:
        token = json.loads(resp.read())["token"]
except Exception as e:
    print(f"\n❌ Login failed: {e}")
    sys.exit(1)

req = urllib.request.Request(
    "http://127.0.0.1:5000/api/classify",
    data=payload,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
    method="POST"
)

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
        print("\n✅ Endpoint responded successfully!")
        print(f"   Raw class    : {data.get('raw_class')}")
        print(f"   Category     : {data.get('category')}")
        print(f"   Confidence   : {data.get('confidence')}%")
        print(f"   Bin color    : {data.get('bin_color')} Bin")
        print(f"   Disposal tips: {data.get('disposal_tips', [])[:1]}")
except Exception as e:
    print(f"\n❌ Request failed: {e}")
