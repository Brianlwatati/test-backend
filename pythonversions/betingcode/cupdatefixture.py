import json
import mysql.connector

# ==========================================
# DATABASE CONNECTION
# ==========================================

db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="FootBall1234",
    database="myefootball"
)
cursor = db.cursor()

# ==========================================
# LOAD RESULTS JSON
# ==========================================

json_file = "jsonfolder/fixture_results.json"

with open(json_file, "r", encoding="utf-8") as file:
    fixtures = json.load(file)

# ==========================================
# DETERMINE OUTCOME
# ==========================================

def determine_outcome(home_score, away_score):

    if home_score > away_score:
        return "H"

    elif away_score > home_score:
        return "A"

    return "D"

# ==========================================
# UPDATE QUERY
# ==========================================

update_query = """
UPDATE fixtures
SET
    home_score = %s,
    away_score = %s,
    outcome = %s,
    status = 'finished'
WHERE id = %s
"""

# ==========================================
# UPDATE FIXTURES
# ==========================================

for fixture in fixtures:

    fixture_id = fixture["fixture_id"]

    home_score = fixture["home_score"]
    away_score = fixture["away_score"]

    outcome = determine_outcome(
        home_score,
        away_score
    )

    values = (
        home_score,
        away_score,
        outcome,
        fixture_id
    )

    try:

        cursor.execute(update_query, values)

        print(
            f"Updated fixture {fixture_id} "
            f"-> {home_score}:{away_score} "
            f"({outcome})"
        )

    except mysql.connector.Error as err:

        print(
            f"Error updating fixture "
            f"{fixture_id}: {err}"
        )

# ==========================================
# SAVE CHANGES
# ==========================================

db.commit()

print("Finished updating fixtures.")

# ==========================================
# CLOSE CONNECTION
# ==========================================

cursor.close()
db.close()