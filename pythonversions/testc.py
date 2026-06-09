from itertools import combinations, product
from collections import defaultdict
from dataclasses import dataclass
import random
import csv

# =========================================================
# SETTINGS
# =========================================================

SINGLE_PREDICTION = "AHAHH"

NUM_DOUBLES = 3
SIM_DIFFS = 1

MAX_TICKETS = 2000

OUTPUT_TXT = "double_chance_output.txt"
OUTPUT_CSV = "double_chance_output.csv"

RANDOM_SEED = 42
random.seed(RANDOM_SEED)

# Optional randomness during tie-breaking
RANDOMNESS = 5

# =========================================================
# DOUBLE OPTIONS
# =========================================================

DOUBLE_MAP = {
    "H": ("HD", "HA", "AD"),
    "D": ("HD", "AD", "HA"),
    "A": ("HA", "AD", "HD")
}

# =========================================================
# DATA MODEL
# =========================================================

@dataclass
class Ticket:
    values: tuple
    covered: set


# =========================================================
# FUNCTIONS
# =========================================================

def expand_ticket(ticket):
    """
    Expand a ticket like:
        ('HD', 'A', 'HA')

    Into all covered singles:
        ['HAA', 'DAA', 'HAH', 'DAH']
    """

    choices = [
        (x,) if len(x) == 1 else tuple(x)
        for x in ticket
    ]

    return {
        ''.join(p)
        for p in product(*choices)
    }


def similarity(ticket1, ticket2):
    """
    Position-wise similarity between tickets.
    """

    return sum(
        a == b
        for a, b in zip(ticket1, ticket2)
    )


def generate_all_tickets():
    """
    Generate every possible ticket combination.
    """

    tickets = []

    positions_combos = list(
        combinations(
            range(len(SINGLE_PREDICTION)),
            NUM_DOUBLES
        )
    )

    random.shuffle(positions_combos)

    for positions in positions_combos:

        options = [
            DOUBLE_MAP[SINGLE_PREDICTION[pos]]
            for pos in positions
        ]

        for double_choices in product(*options):

            ticket = list(SINGLE_PREDICTION)

            for pos, choice in zip(positions, double_choices):
                ticket[pos] = choice

            ticket_tuple = tuple(ticket)

            covered = expand_ticket(ticket_tuple)

            tickets.append(
                Ticket(
                    values=ticket_tuple,
                    covered=covered
                )
            )

    return tickets


# =========================================================
# GREEDY COVERAGE OPTIMIZATION
# =========================================================

def select_best_tickets(all_tickets):
    """
    Greedy optimization:
    - maximize newly covered singles
    - minimize repetition
    - enforce diversity
    """

    selected = []

    covered_tracker = defaultdict(int)

    uncovered_global = set()

    # Collect every possible covered single
    for t in all_tickets:
        uncovered_global.update(t.covered)

    while all_tickets and len(selected) < MAX_TICKETS:

        best_ticket = None
        best_score = -1

        random.shuffle(all_tickets)

        for ticket in all_tickets:

            # ---------------------------------------------
            # Diversity filter
            # ---------------------------------------------

            too_similar = False

            for existing in selected:

                sim = similarity(
                    ticket.values,
                    existing.values
                )

                if sim >= len(SINGLE_PREDICTION) - SIM_DIFFS:
                    too_similar = True
                    break

            if too_similar:
                continue

            # ---------------------------------------------
            # Coverage scoring
            # ---------------------------------------------

            new_coverage = sum(
                1
                for c in ticket.covered
                if covered_tracker[c] == 0
            )

            repetition_penalty = sum(
                covered_tracker[c]
                for c in ticket.covered
            )

            score = (
                new_coverage * 100
                - repetition_penalty
                + random.randint(0, RANDOMNESS)
            )

            if score > best_score:
                best_score = score
                best_ticket = ticket

        if best_ticket is None:
            break

        selected.append(best_ticket)

        for c in best_ticket.covered:
            covered_tracker[c] += 1

        all_tickets.remove(best_ticket)

    return selected, covered_tracker


# =========================================================
# EXPORT
# =========================================================

def save_txt(selected, coverage_tracker):

    with open(OUTPUT_TXT, "w") as f:

        f.write("=" * 70 + "\n")
        f.write("ORIGINAL SINGLE PREDICTION\n")
        f.write("=" * 70 + "\n")
        f.write(f"{SINGLE_PREDICTION}\n\n")

        f.write("=" * 70 + "\n")
        f.write("SELECTED DOUBLE CHANCE TICKETS\n")
        f.write("=" * 70 + "\n")

        for idx, ticket in enumerate(selected, 1):

            ticket_str = " ".join(ticket.values)

            f.write(f"\n{idx:04d} | {ticket_str}\n")

            sorted_covered = sorted(ticket.covered)

            for c in sorted_covered:
                count = coverage_tracker[c]
                f.write(f"   {c}   (used {count}x)\n")

            f.write("\n" + "-" * 70 + "\n")


def save_csv(selected):

    with open(OUTPUT_CSV, "w", newline="") as csvfile:

        writer = csv.writer(csvfile)

        writer.writerow([
            "Ticket_Number",
            "Ticket",
            "Covered_Singles_Count"
        ])

        for idx, ticket in enumerate(selected, 1):

            writer.writerow([
                idx,
                " ".join(ticket.values),
                len(ticket.covered)
            ])


# =========================================================
# MAIN
# =========================================================

def main():

    print("Generating tickets...")

    all_tickets = generate_all_tickets()

    print(f"Generated {len(all_tickets)} candidate tickets")

    print("Selecting optimized tickets...")

    selected, coverage_tracker = select_best_tickets(all_tickets)

    print(f"Selected {len(selected)} tickets")

    unique_covered = sum(
        1
        for v in coverage_tracker.values()
        if v > 0
    )

    print(f"Unique singles covered: {unique_covered}")

    print("Saving files...")

    save_txt(selected, coverage_tracker)
    save_csv(selected)

    print(f"Saved TXT -> {OUTPUT_TXT}")
    print(f"Saved CSV -> {OUTPUT_CSV}")


# =========================================================
# RUN
# =========================================================

if __name__ == "__main__":
    main()