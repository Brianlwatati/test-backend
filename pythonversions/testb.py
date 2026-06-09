# Import tools used throughout the script

# combinations:
#   Generates all possible combinations of positions where doubles
#   can be placed.
#
# product:
#   Generates Cartesian products.
#   Used twice:
#   1. To expand double chances into all covered singles.
#   2. To generate all possible double-choice combinations.
from itertools import combinations, product

# defaultdict(int):
#   Automatically creates missing dictionary keys with value 0.
#   Used to track how many times each single ticket has already
#   been covered.
from collections import defaultdict

# Used for randomization throughout the system.
# Randomization helps avoid deterministic output and increases
# diversity between generated tickets.
import random


# ==========================================================
# SETTINGS
# ==========================================================

# Base prediction.
#
# Example:
#   A = Away Win
#   D = Draw
#   H = Home Win
#
# Every generated double-chance ticket starts from this
# prediction and replaces selected positions with doubles.
#
# Example:
#   AAAA
#
# Means:
#   Match 1 -> A
#   Match 2 -> A
#   Match 3 -> A
#   Match 4 -> A
single_prediction = "HAHH"


# Number of positions that will become double chances.
#
# Example:
#   num_doubles = 3
#
# Ticket:
#   A A A A
#
# Could become:
#   AD AD A HD
#
# Exactly 3 positions are converted.
num_doubles = 3


# Similarity filter strength.
#
# Smaller values = more diversity.
#
# Example:
#
# length = 4
#
# sim_diffs = 1
#
# Then tickets matching in 3 or more positions
# are rejected.
#
# This prevents near-duplicates.
sim_diffs = 1


# Maximum number of final tickets to keep.
#
# Generation may produce many more candidates,
# but only up to this number survives selection.
MAX_TICKETS = 2000


# Output filename.
output_file = "double_chance_outputb.txt"


# Random noise added to coverage score.
#
# Larger values:
#   More randomness
#   Less strict optimization
#
# Smaller values:
#   More deterministic behavior
#
# Useful for creating different outputs from
# identical inputs.
RANDOMNESS = 10


# ==========================================================
# DOUBLE CHANCE MAPPING
# ==========================================================
#
# Defines which double chances are allowed
# for each original prediction.
#
# Example:
#
# Original = H
#
# Allowed doubles:
#   HD
#   AD
#
# Meaning:
#   If position originally predicts H,
#   the generated ticket may use either:
#
#     HD
#     AD
#
# This controls expansion possibilities.
#
DOUBLE_MAP = {
    "H": ["HD", "AD"],
    "A": ["AD", "HD"]
}


# Alternative versions are left commented
# for experimentation.
#
# Uncomment one of these mappings if you
# want wider coverage.
#
# DOUBLE_MAP = {
#     "H": ["HD", "HA", "AD"],
#     "D": ["HD", "AD", "HA"],
#     "A": ["HA", "AD", "HD"]
# }
#
# DOUBLE_MAP = {
#     "H": ["HD", "HA"],
#     "D": ["HD", "AD"],
#     "A": ["HA", "AD"]
# }


# ==========================================================
# FUNCTIONS
# ==========================================================

def expand_ticket(ticket):
    """
    Convert a ticket containing doubles into all
    covered single predictions.

    Example:

        Ticket:
        ['AD', 'A', 'HD']

    Expands to:

        AAH
        AAD
        DAH
        DAD

    Returns:
        List of covered single strings.
    """

    choices = []

    # Process every position in the ticket.
    for item in ticket:

        # Single prediction.
        #
        # Example:
        #   A
        #
        # Must still be treated as a list
        # to make Cartesian product easier.
        if item in ["H", "D", "A"]:
            choices.append([item])

        # Double prediction.
        #
        # Example:
        #   AD
        #
        # Converts into:
        #   ['A', 'D']
        else:
            choices.append(list(item))

    # Example:
    #
    # choices =
    #
    # [
    #   ['A','D'],
    #   ['A'],
    #   ['H','D']
    # ]
    #
    # product(*choices)
    #
    # Generates every covered combination.
    return [''.join(p) for p in product(*choices)]


def ticket_string(ticket):
    """
    Creates a compact representation used for
    similarity comparison.

    Example:

        ['AD','A','HD']

    becomes

        AAH

    Why?

    Because only the first character of each
    double is used.

    This produces a simplified signature
    for diversity checking.
    """

    return ''.join(
        [x[0] if len(x) == 2 else x for x in ticket]
    )


def similarity(a, b):
    """
    Counts how many positions match between
    two strings.

    Example:

        AAHD
        AADD

    Matches:
        A == A
        A == A
        H != D
        D == D

    Result:
        3
    """

    return sum(x == y for x, y in zip(a, b))


# ==========================================================
# GENERATE RANDOMIZED TICKETS
# ==========================================================

# Stores every candidate ticket generated.
tickets = []

# Tracks coverage frequency.
#
# Example:
#
# covered_tracker['AAHD'] = 5
#
# Means:
#   Single ticket AAHD has already been
#   covered by 5 selected tickets.
#
# Later we prefer tickets covering
# underrepresented outcomes.
covered_tracker = defaultdict(int)


# Generate every possible way to choose
# num_doubles positions.
#
# Example:
#
# AAAA
#
# num_doubles = 3
#
# Possible position sets:
#
# (0,1,2)
# (0,1,3)
# (0,2,3)
# (1,2,3)
#
positions_combos = list(
    combinations(range(len(single_prediction)),
                 num_doubles)
)

# Shuffle position order.
#
# Prevents deterministic generation.
random.shuffle(positions_combos)

print(positions_combos)


# Loop through each position combination.
for positions in positions_combos:

    options = []

    # Gather possible doubles for each selected position.
    for i in positions:
        options.append(
            DOUBLE_MAP[single_prediction[i]]
        )

    # Generate all possible double selections.
    #
    # Example:
    #
    # [
    #   ['AD','HD'],
    #   ['AD','HD'],
    #   ['AD','HD']
    # ]
    #
    # Produces:
    #
    # AD AD AD
    # AD AD HD
    # AD HD AD
    # ...
    #
    double_choice_list = list(product(*options))

    # Shuffle for randomness.
    random.shuffle(double_choice_list)

    # Process every possible double assignment.
    for double_choices in double_choice_list:

        # Start from original prediction.
        ticket = list(single_prediction)

        # Replace selected positions.
        for pos, dc in zip(positions, double_choices):
            ticket[pos] = dc

        # Expand into all covered singles.
        covered = expand_ticket(ticket)


        # Coverage score.
        #
        # Lower score = better.
        #
        # We want tickets that cover outcomes
        # not already heavily represented.
        repetition_score = sum(
            covered_tracker[c]
            for c in covered
        )

        # Add random noise.
        #
        # Prevents identical runs from always
        # producing identical ticket ordering.
        repetition_score += random.randint(
            0,
            RANDOMNESS
        )

        tickets.append({
            "ticket": ticket,
            "covered": covered,
            "score": repetition_score
        })


# Sort by score.
#
# Lowest repetition score first.
#
# random.random() acts as tie-breaker.
tickets.sort(
    key=lambda x: (
        x["score"],
        random.random()
    )
)


# ==========================================================
# SELECT DIVERSE TICKETS
# ==========================================================

selected = []

for item in tickets:

    too_similar = False

    current_str = ticket_string(
        item["ticket"]
    )

    # Compare against already selected tickets.
    for s in selected:

        selected_str = ticket_string(
            s["ticket"]
        )

        sim = similarity(
            current_str,
            selected_str
        )

        # Diversity filter.
        #
        # Example:
        #
        # length = 4
        # sim_diffs = 1
        #
        # threshold:
        #
        # 4 - 1 = 3
        #
        # If similarity >= 3
        #
        # reject ticket.
        #
        if sim >= len(single_prediction) - sim_diffs:
            too_similar = True
            break

    # Keep ticket if sufficiently different.
    if not too_similar:

        selected.append(item)

        # Update coverage statistics.
        #
        # Future tickets can now see
        # that these outcomes have
        # already been covered.
        for c in item["covered"]:
            covered_tracker[c] += 1

    # Stop once enough tickets selected.
    if len(selected) >= MAX_TICKETS:
        break


# ==========================================================
# FINAL SHUFFLE
# ==========================================================
#
# The selection process tends to create
# ordering patterns.
#
# Shuffle final results so the saved file
# looks more random.
#
random.shuffle(selected)


# ==========================================================
# SAVE TO FILE
# ==========================================================

with open(output_file, "w") as f:

    # Header section.
    f.write("=" * 60 + "\n")
    f.write("ORIGINAL SINGLE\n")
    f.write("=" * 60 + "\n")
    f.write(single_prediction + "\n\n")

    f.write("=" * 60 + "\n")
    f.write("RANDOMIZED DOUBLE CHANCE TICKETS\n")
    f.write("=" * 60 + "\n")

    # Write every selected ticket.
    for idx, item in enumerate(selected, 1):

        # Example:
        #
        # AD A HD A
        #
        ticket_str = " ".join(item["ticket"])

        f.write(f"\n{idx}. {ticket_str}\n")

        f.write("Covered Singles:\n")

        # Shuffle covered outcomes before output.
        #
        # Purely cosmetic.
        covered_random = item["covered"][:]
        random.shuffle(covered_random)

        # Write every covered single.
        for c in covered_random:
            f.write(f"   {c}\n")

        f.write("\n" + "-" * 60 + "\n")


# Final confirmation message.
print(f"Saved to: {output_file}")