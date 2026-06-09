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
# LOAD JSON FILE
# ==========================================

json_file = "jsonfolder/players.json"

with open(json_file, "r", encoding="utf-8") as file:
    players = json.load(file)

# ==========================================
# INSERT QUERY
# ==========================================

insert_query = """
INSERT INTO players (
    username,
    display_name,
    platform,
    country,
    rating,
    wins,
    draws,
    losses
)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
"""

# ==========================================
# INSERT PLAYERS
# ==========================================

for player in players:

    values = (
        player.get("username"),
        player.get("display_name"),
        player.get("platform"),
        player.get("country"),
        player.get("rating", 1000),
        player.get("wins", 0),
        player.get("draws", 0),
        player.get("losses", 0)
    )

    try:
        cursor.execute(insert_query, values)
        print(f"Inserted: {player.get('username')}")

    except mysql.connector.Error as err:
        print(f"Error inserting player: {err}")

# ==========================================
# COMMIT CHANGES
# ==========================================

db.commit()

print("Finished importing players.")

# ==========================================
# CLOSE CONNECTION
# ==========================================

cursor.close()
db.close()