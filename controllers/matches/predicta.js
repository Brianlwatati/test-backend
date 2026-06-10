genSimplePrediction = (H, D, A) => {
    if (H < D && H < A) return "1";
    if (D < H && D < A) return "X";
    if (A < H && A < D) return "2";
    return "1"; // Default to home win if odds are equal
}