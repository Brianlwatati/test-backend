import json
import mysql.connector

# =========================================================
# DATABASE CONFIG
# =========================================================

DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "FootBall1234",
    "database": "myefootball"
}


# =========================================================
# DATABASE CONNECTION
# =========================================================

def get_connection():

    return mysql.connector.connect(
        host=DB_CONFIG["host"],
        user=DB_CONFIG["user"],
        password=DB_CONFIG["password"],
        database=DB_CONFIG["database"]
    )


# =========================================================
# DETERMINE OUTCOME
# =========================================================

def determine_outcome(home_score, away_score):

    if home_score > away_score:
        return "H"

    elif away_score > home_score:
        return "A"

    return "D"


# =========================================================
# GET FIXTURE
# =========================================================

def get_fixture(fixture_id):

    db = get_connection()

    cursor = db.cursor(dictionary=True)

    query = """
    SELECT *
    FROM fixtures
    WHERE id = %s
    """

    cursor.execute(query, (fixture_id,))

    fixture = cursor.fetchone()

    cursor.close()
    db.close()

    return fixture


# =========================================================
# UPDATE FIXTURE RESULT
# =========================================================

def update_fixture_result(
    fixture_id,
    home_score,
    away_score
):

    outcome = determine_outcome(
        home_score,
        away_score
    )

    db = get_connection()

    cursor = db.cursor()

    query = """
    UPDATE fixtures
    SET
        home_score = %s,
        away_score = %s,
        outcome = %s,
        status = 'finished'
    WHERE id = %s
    """

    values = (
        home_score,
        away_score,
        outcome,
        fixture_id
    )

    cursor.execute(query, values)

    db.commit()

    cursor.close()
    db.close()

    return outcome


# =========================================================
# UPDATE PLAYER FORM
# =========================================================

def update_player_form(
    home_player_id,
    away_player_id,
    outcome
):

    db = get_connection()

    cursor = db.cursor()

    # -------------------------------------
    # HOME WIN
    # -------------------------------------

    if outcome == "H":

        cursor.execute("""
        UPDATE players
        SET wins = wins + 1
        WHERE id = %s
        """, (home_player_id,))

        cursor.execute("""
        UPDATE players
        SET losses = losses + 1
        WHERE id = %s
        """, (away_player_id,))

    # -------------------------------------
    # AWAY WIN
    # -------------------------------------

    elif outcome == "A":

        cursor.execute("""
        UPDATE players
        SET wins = wins + 1
        WHERE id = %s
        """, (away_player_id,))

        cursor.execute("""
        UPDATE players
        SET losses = losses + 1
        WHERE id = %s
        """, (home_player_id,))

    # -------------------------------------
    # DRAW
    # -------------------------------------

    else:

        cursor.execute("""
        UPDATE players
        SET draws = draws + 1
        WHERE id = %s
        """, (home_player_id,))

        cursor.execute("""
        UPDATE players
        SET draws = draws + 1
        WHERE id = %s
        """, (away_player_id,))

    db.commit()

    cursor.close()
    db.close()


# =========================================================
# UPDATE HEAD TO HEAD TABLE
# =========================================================

def update_head_to_head(
    home_player_id,
    away_player_id,
    outcome
):

    db = get_connection()

    cursor = db.cursor(dictionary=True)

    # -------------------------------------
    # CHECK EXISTING RECORD
    # -------------------------------------

    query = """
    SELECT *
    FROM player_head_to_head
    WHERE
        player1_id = %s
        AND player2_id = %s
    """

    cursor.execute(
        query,
        (
            home_player_id,
            away_player_id
        )
    )

    row = cursor.fetchone()

    # -------------------------------------
    # CREATE RECORD
    # -------------------------------------

    if row is None:

        insert_query = """
        INSERT INTO player_head_to_head (
            player1_id,
            player2_id,
            player1_wins,
            player2_wins,
            draws,
            total_matches
        )
        VALUES (%s, %s, 0, 0, 0, 0)
        """

        cursor.execute(
            insert_query,
            (
                home_player_id,
                away_player_id
            )
        )

    # -------------------------------------
    # UPDATE RESULTS
    # -------------------------------------

    if outcome == "H":

        cursor.execute("""
        UPDATE player_head_to_head
        SET
            player1_wins = player1_wins + 1,
            total_matches = total_matches + 1
        WHERE
            player1_id = %s
            AND player2_id = %s
        """, (
            home_player_id,
            away_player_id
        ))

    elif outcome == "A":

        cursor.execute("""
        UPDATE player_head_to_head
        SET
            player2_wins = player2_wins + 1,
            total_matches = total_matches + 1
        WHERE
            player1_id = %s
            AND player2_id = %s
        """, (
            home_player_id,
            away_player_id
        ))

    else:

        cursor.execute("""
        UPDATE player_head_to_head
        SET
            draws = draws + 1,
            total_matches = total_matches + 1
        WHERE
            player1_id = %s
            AND player2_id = %s
        """, (
            home_player_id,
            away_player_id
        ))

    db.commit()

    cursor.close()
    db.close()


# =========================================================
# UPDATE PREDICTION RESULTS
# =========================================================

def update_prediction_results(
    fixture_id,
    actual_outcome
):

    db = get_connection()

    cursor = db.cursor(dictionary=True)

    # -------------------------------------
    # GET PREDICTIONS
    # -------------------------------------

    query = """
    SELECT
        id,
        predicted_outcome
    FROM match_predictions
    WHERE fixture_id = %s
    """

    cursor.execute(query, (fixture_id,))

    predictions = cursor.fetchall()

    # -------------------------------------
    # UPDATE EACH PREDICTION
    # -------------------------------------

    for prediction in predictions:

        is_correct = (
            prediction["predicted_outcome"]
            == actual_outcome
        )

        update_query = """
        UPDATE match_predictions
        SET
            actual_outcome = %s,
            is_correct = %s
        WHERE id = %s
        """

        cursor.execute(
            update_query,
            (
                actual_outcome,
                is_correct,
                prediction["id"]
            )
        )

    db.commit()

    cursor.close()
    db.close()


# =========================================================
# MAIN COMPLETE WORKFLOW
# =========================================================

def complete_fixture(
    fixture_id,
    home_score,
    away_score
):

    # -------------------------------------
    # GET FIXTURE
    # -------------------------------------

    fixture = get_fixture(fixture_id)

    if fixture is None:

        print("Fixture not found.")
        return

    # -------------------------------------
    # UPDATE FIXTURE
    # -------------------------------------

    outcome = update_fixture_result(
        fixture_id,
        home_score,
        away_score
    )

    # -------------------------------------
    # UPDATE PLAYER FORM
    # -------------------------------------

    update_player_form(
        fixture["home_player_id"],
        fixture["away_player_id"],
        outcome
    )

    # -------------------------------------
    # UPDATE H2H
    # -------------------------------------

    update_head_to_head(
        fixture["home_player_id"],
        fixture["away_player_id"],
        outcome
    )

    # -------------------------------------
    # UPDATE PREDICTIONS
    # -------------------------------------

    update_prediction_results(
        fixture_id,
        outcome
    )

    print(
        f"Fixture {fixture_id} completed."
    )


# =========================================================
# EXECUTE
# =========================================================

if __name__ == "__main__":

    complete_fixture(
        fixture_id=28,
        home_score=1,
        away_score=1
    )

