import pandas as pd

data = [
    {
        "name": "Alice Example",
        "phone": "09171230000",
        "address": "10 Example St",
        "age": 28,
        "occupation": "Designer",
        "status": "Single",
        "complaint": "Filling",
        "visit_date": "2026-08-15",
        "visit_time": "11:00",
        "visit_no": 1,
        "description": "Filling",
        "debit": 400,
        "credit_amount": 0,
        "credit_date": "2026-08-15",
        "payment_method": "Cash",
        "checked_in_at": "2026-08-15 11:00:00",
    },
    {
        "name": "Bob MissingPhone",
        "phone": "",
        "address": "20 Sample Ave",
        "age": 40,
        "occupation": "Farmer",
        "status": "Married",
        "complaint": "Cleaning",
        "visit_date": "2026-08-16",
        "visit_time": "14:00",
        "visit_no": 2,
        "description": "Cleaning",
        "debit": 200,
        "credit_amount": 0,
        "credit_date": "2026-08-16",
        "payment_method": "GCash",
        "checked_in_at": "",
    },
]

df = pd.DataFrame(data)
df.index += 2  # make rows start at 2 to mimic Excel with header row

df.to_excel('test_import.xlsx', index=False)
print('Wrote test_import.xlsx')
