import random

def generate_random_pairs(n, output_file="output.txt"):
    numbers1 = list(range(1, n + 1))
    numbers2 = list(range(1, n + 1))

    # Shuffle both lists independently
    random.shuffle(numbers1)
    random.shuffle(numbers2)

    # Create pairs
    pairs = list(zip(numbers1, numbers2))

    # Save to txt file
    with open(output_file, "w") as f:
        for a, b in pairs:
            f.write(f"{a}, {b}\n")

    return pairs

# Example usage
n = 15
pairs = generate_random_pairs(n)

print("Generated pairs:")
for pair in pairs:
    print(pair)

print("\nSaved to output.txt")