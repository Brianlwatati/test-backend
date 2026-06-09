
import mysql.connector
from dataclasses import dataclass
from typing import Dict, List
from collections import Counter

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

    return mysql.connector.connect(**DB_CONFIG)


# =========================================================
# DATA CLASSES
# =========================================================

@dataclass
class Fixture:

    fixture_id: int

    home_player_id: int
    away_player_id: int

    home_odds: float
    draw_odds: float
    away_odds: float


# =========================================================
# FETCH FIXTURE
# =========================================================

def get_fixture(fixture_id: int) -> Fixture:

    db = get_connection()

    cursor = db.cursor(dictionary=True)

    query = """
    SELECT
        id,
        home_player_id,
        away_player_id,
        home_odds,
        draw_odds,
        away_odds
    FROM fixtures
    WHERE id = %s
    """

    cursor.execute(query, (fixture_id,))

    row = cursor.fetchone()

    cursor.close()
    db.close()

    return Fixture(
        fixture_id=row["id"],
        home_player_id=row["home_player_id"],
        away_player_id=row["away_player_id"],
        home_odds=float(row["home_odds"]),
        draw_odds=float(row["draw_odds"]),
        away_odds=float(row["away_odds"])
    )


# =========================================================
# GET PLAYER RATING
# =========================================================

def get_player_rating(player_id: int) -> int:

    db = get_connection()

    cursor = db.cursor()

    query = """
    SELECT rating
    FROM players
    WHERE id = %s
    """

    cursor.execute(query, (player_id,))

    rating = cursor.fetchone()[0]

    cursor.close()
    db.close()

    return rating


# =========================================================
# GET PLAYER FORM
# =========================================================

def get_player_form(player_id: int) -> Dict:

    db = get_connection()

    cursor = db.cursor(dictionary=True)

    query = """
    SELECT
        wins,
        draws,
        losses
    FROM players
    WHERE id = %s
    """

    cursor.execute(query, (player_id,))

    row = cursor.fetchone()

    cursor.close()
    db.close()

    total = row["wins"] + row["draws"] + row["losses"]

    if total == 0:
        total = 1

    form_score = (
        (row["wins"] * 3) +
        (row["draws"] * 1)
    ) / total

    return {
        "wins": row["wins"],
        "draws": row["draws"],
        "losses": row["losses"],
        "form_score": round(form_score, 2)
    }


# =========================================================
# GET HEAD TO HEAD
# =========================================================

def get_head_to_head(home_player_id, away_player_id):

    db = get_connection()

    cursor = db.cursor(dictionary=True)

    query = """
    SELECT
        outcome
    FROM fixtures
    WHERE (
        home_player_id = %s
        AND away_player_id = %s
    )
    OR (
        home_player_id = %s
        AND away_player_id = %s
    )
    AND status = 'finished'
    """

    cursor.execute(
        query,
        (
            home_player_id,
            away_player_id,
            away_player_id,
            home_player_id
        )
    )

    matches = cursor.fetchall()

    cursor.close()
    db.close()

    return matches


# =========================================================
# ELO RATING ENGINE
# =========================================================

def elo_rating_prediction(fixture: Fixture):

    home_rating = get_player_rating(
        fixture.home_player_id
    )

    away_rating = get_player_rating(
        fixture.away_player_id
    )

    difference = home_rating - away_rating

    if difference > 300:
        prediction = "H"

    elif difference < -300:
        prediction = "A"

    else:
        prediction = "D"

    confidence = min(
        abs(difference) / 10,
        95
    )

    return {
        "algorithm": "Elo Rating Engine",
        "prediction": prediction,
        "confidence": round(confidence, 2)
    }


# =========================================================
# FORM MOMENTUM AI
# =========================================================

def form_momentum_prediction(fixture: Fixture):

    home_form = get_player_form(
        fixture.home_player_id
    )

    away_form = get_player_form(
        fixture.away_player_id
    )

    difference = (
        home_form["form_score"] -
        away_form["form_score"]
    )

    if difference > 0.5:
        prediction = "H"

    elif difference < -0.5:
        prediction = "A"

    else:
        prediction = "D"

    confidence = min(
        abs(difference) * 30,
        90
    )

    return {
        "algorithm": "Form Momentum AI",
        "prediction": prediction,
        "confidence": round(confidence, 2)
    }


# =========================================================
# MARKET ODDS PREDICTOR
# =========================================================

def market_odds_prediction(fixture: Fixture):

    odds = {
        "H": fixture.home_odds,
        "D": fixture.draw_odds,
        "A": fixture.away_odds
    }

    prediction = min(
        odds,
        key=odds.get
    )

    confidence = round(
        100 / odds[prediction],
        2
    )

    return {
        "algorithm": "Market Odds Predictor",
        "prediction": prediction,
        "confidence": confidence
    }


# =========================================================
# HEAD TO HEAD ANALYZER
# =========================================================

def head_to_head_prediction(fixture: Fixture):

    matches = get_head_to_head(
        fixture.home_player_id,
        fixture.away_player_id
    )

    if len(matches) == 0:

        return {
            "algorithm": "Head To Head Analyzer",
            "prediction": "D",
            "confidence": 50
        }

    outcomes = Counter()

    for match in matches:

        outcomes[match["outcome"]] += 1

    prediction = outcomes.most_common(1)[0][0]

    confidence = (
        outcomes[prediction] /
        len(matches)
    ) * 100

    return {
        "algorithm": "Head To Head Analyzer",
        "prediction": prediction,
        "confidence": round(confidence, 2)
    }


# =========================================================
# SAVE PREDICTION
# =========================================================

def save_prediction(
    fixture_id,
    algorithm_id,
    prediction,
    confidence
):

    db = get_connection()

    cursor = db.cursor()

    query = """
    INSERT INTO match_predictions (
        fixture_id,
        algorithm_id,
        prediction_type,
        predicted_outcome,
        confidence_score
    )
    VALUES (%s, %s, 'AI', %s, %s)
    """

    values = (
        fixture_id,
        algorithm_id,
        prediction,
        confidence
    )

    cursor.execute(query, values)

    db.commit()

    cursor.close()
    db.close()


# =========================================================
# MAIN PREDICTION RUNNER
# =========================================================

def run_predictions(fixture_id):

    fixture = get_fixture(fixture_id)

    algorithms = [

        (1, elo_rating_prediction),

        (2, form_momentum_prediction),

        (3, market_odds_prediction),

        (4, head_to_head_prediction)
    ]

    results = []

    for algorithm_id, algorithm_function in algorithms:

        result = algorithm_function(fixture)

        results.append(result)

        save_prediction(
            fixture_id=fixture_id,
            algorithm_id=algorithm_id,
            prediction=result["prediction"],
            confidence=result["confidence"]
        )

        print(
            f"{result['algorithm']} "
            f"-> "
            f"{result['prediction']} "
            f"({result['confidence']}%)"
        )

    return results


# =========================================================
# EXECUTE
# =========================================================

if __name__ == "__main__":

    fixture_id = 28

    run_predictions(fixture_id)
