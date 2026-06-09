from itertools import combinations, product
from collections import defaultdict

# ==========================================
# SETTINGS
# ==========================================

# Original singles prediction
single_prediction = "AHAH"

# Number of positions to convert into doubles
num_doubles = 2
sim_diffs = 1

# Maximum tickets to save
MAX_TICKETS = 50

# Output file
output_file = "double_chance_output.txt"

# Double chance mapping
# DOUBLE_MAP = {
#     "H": ["HD", "HA"],
#     "D": ["HD", "AD"],
#     "A": ["HA", "AD"]
# }

DOUBLE_MAP = {
    "H": ["HD", "HA", "AD"],
    "D": ["HD", "AD", "HA"],
    "A": ["HA", "AD", "HD"]
}

# ==========================================
# FUNCTIONS
# ==========================================

def expand_ticket(ticket):
    """
    Expand ticket into all covered singles.
    """
    choices = []

    for item in ticket:
        if item in ["H", "D", "A"]:
            choices.append([item])
        else:
            choices.append(list(item))

    return [''.join(p) for p in product(*choices)]


def similarity(a, b):
    """
    Count matching positions.
    """
    return sum(x == y for x, y in zip(a, b))


# ==========================================
# GENERATE TICKETS
# ==========================================

tickets = []
covered_tracker = defaultdict(int)

positions_combos = list(
    combinations(range(len(single_prediction)), num_doubles)
)

for positions in positions_combos:

    options = []

    for i in positions:
        options.append(DOUBLE_MAP[single_prediction[i]])

    for double_choices in product(*options):

        ticket = list(single_prediction)

        for pos, dc in zip(positions, double_choices):
            ticket[pos] = dc

        covered = expand_ticket(ticket)

        repetition_score = sum(
            covered_tracker[c] for c in covered
        )

        tickets.append({
            "ticket": ticket,
            "covered": covered,
            "score": repetition_score
        })

# Sort by lowest repetition
tickets.sort(key=lambda x: x["score"])

# ==========================================
# SELECT BEST TICKETS
# ==========================================

selected = []

for item in tickets:

    too_similar = False

    for s in selected:

        sim = similarity(
            ''.join(
                [x[0] if len(x) == 2 else x for x in item["ticket"]]
            ),
            ''.join(
                [x[0] if len(x) == 2 else x for x in s["ticket"]]
            )
        )

        if sim >= len(single_prediction) - sim_diffs:
            too_similar = True
            break

    if not too_similar:

        selected.append(item)

        for c in item["covered"]:
            covered_tracker[c] += 1

    if len(selected) >= MAX_TICKETS:
        break

# ==========================================
# SAVE TO TXT FILE
# ==========================================

with open(output_file, "w") as f:

    f.write("=" * 60 + "\n")
    f.write("ORIGINAL SINGLE\n")
    f.write("=" * 60 + "\n")
    f.write(single_prediction + "\n\n")

    f.write("=" * 60 + "\n")
    f.write("GENERATED DOUBLE CHANCE TICKETS\n")
    f.write("=" * 60 + "\n")

    for idx, item in enumerate(selected, 1):

        ticket_str = " ".join(item["ticket"])

        f.write(f"\n{idx}. {ticket_str}\n")

        f.write("Covered Singles:\n")

        for c in item["covered"]:
            f.write(f"   {c}\n")

        f.write("\n" + "-" * 60 + "\n")

print(f"Saved to: {output_file}")



