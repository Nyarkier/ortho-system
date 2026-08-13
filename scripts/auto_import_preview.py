import sys
import requests
import json

PREVIEW_URL = "http://127.0.0.1:8000/import/preview"
CONFIRM_URL = "http://127.0.0.1:8000/import/confirm"
ORIGIN = "http://localhost:5174"


def main(filepath: str):
    with open(filepath, "rb") as f:
        files = {"file": (filepath.split("\\")[-1], f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        headers = {"Origin": ORIGIN}
        print("Uploading for preview...")
        r = requests.post(PREVIEW_URL, files=files, headers=headers)
    try:
        j = r.json()
    except Exception as e:
        print("Preview response not JSON:", e)
        print(r.text)
        return

    print("Preview status:", j.get("status"))
    print(json.dumps(j.get("summary"), indent=2))

    ok_rows = []
    for grp in j.get("groups", []):
        for row in grp.get("rows", []):
            if row.get("status") == "ok":
                ok_rows.append({"data": row.get("data")})

    if not ok_rows:
        print("No rows with status 'ok' to import.")
        return

    payload = {"rows": ok_rows}
    print(f"Importing {len(ok_rows)} rows...")
    r2 = requests.post(CONFIRM_URL, json=payload)
    try:
        print(r2.json())
    except Exception:
        print("Confirm response not JSON")
        print(r2.text)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python auto_import_preview.py <xlsx-path>")
        sys.exit(1)
    main(sys.argv[1])
