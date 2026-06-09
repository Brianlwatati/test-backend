
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

cursor = db.cursor(dictionary=True)

# ==========================================
# LOAD FIXTURES JSON
# ==========================================

json_file = "jsonfolder/fixtures.json"

with open(json_file, "r", encoding="utf-8") as file:
    fixtures = json.load(file)

# ==========================================
# HELPER FUNCTIONS
# ==========================================

def get_player_id(username):

    query = "SELECT id FROM players WHERE username = %s"

    cursor.execute(query, (username,))

    result = cursor.fetchone()

    if result:
        return result["id"]

    return None


def get_team_id(team_name):

    query = "SELECT id FROM teams WHERE name = %s"

    cursor.execute(query, (team_name,))

    result = cursor.fetchone()

    if result:
        return result["id"]

    return None


# ==========================================
# INSERT QUERY
# ==========================================

insert_query = """
INSERT INTO fixtures (
    home_player_id,
    away_player_id,

    home_team_id,
    away_team_id,

    competition,
    kickoff_time,

    home_odds,
    draw_odds,
    away_odds,

    status
)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

# ==========================================
# INSERT FIXTURES
# ==========================================

for fixture in fixtures:

    home_player_id = get_player_id(
        fixture["home_player"]
    )

    away_player_id = get_player_id(
        fixture["away_player"]
    )

    home_team_id = get_team_id(
        fixture["home_team"]
    )

    away_team_id = get_team_id(
        fixture["away_team"]
    )

    # Skip if IDs not found
    if not all([
        home_player_id,
        away_player_id,
        home_team_id,
        away_team_id
    ]):
        print(
            f"Skipping fixture because IDs not found: "
            f"{fixture}"
        )
        continue

    values = (
        home_player_id,
        away_player_id,

        home_team_id,
        away_team_id,

        fixture["competition"],
        fixture["kickoff_time"],

        fixture["home_odds"],
        fixture["draw_odds"],
        fixture["away_odds"],

        fixture.get("status", "pending")
    )

    try:
        cursor.execute(insert_query, values)

        print(
            f"Inserted fixture: "
            f"{fixture['home_player']} vs "
            f"{fixture['away_player']}"
        )

    except mysql.connector.Error as err:
        print(f"Error inserting fixture: {err}")

# ==========================================
# SAVE CHANGES
# ==========================================

db.commit()

print("Finished importing fixtures.")

# ==========================================
# CLOSE CONNECTION
# ==========================================

cursor.close()
db.close()
