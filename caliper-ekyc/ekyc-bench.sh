#!/bin/bash

# --- Configuration ---
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_DIR="./results/bench_${TIMESTAMP}"
CALIPER_BIN="npx caliper launch manager" # Adjust if using global install
WORKSPACE="./"
NETWORK_CONFIG="network.yaml"
BENCH_CONFIG="benchmark.yaml"

# --- Setup ---
mkdir -p "${RESULT_DIR}"
echo "🚀 Starting eKYC Benchmark: ${TIMESTAMP}"
echo "📂 Results will be saved to: ${RESULT_DIR}"

# --- Execution ---
# We use the Caliper CLI to trigger the manager.
# All rounds defined in your YAML will execute sequentially.
${CALIPER_BIN} \
    --caliper-bind-sut fabric:fabric-gateway \
    --caliper-workspace "${WORKSPACE}" \
    --caliper-networkconfig "${NETWORK_CONFIG}" \
    --caliper-benchconfig "${BENCH_CONFIG}" \
    --caliper-flow-only-test \
    --caliper-report-path "${RESULT_DIR}/report.html"

# --- Cleanup & Logging ---
if [ $? -eq 0 ]; then
    echo "✅ Benchmark completed successfully."
    echo "📊 Final report available at: ${RESULT_DIR}/report.html"
else
    echo "❌ Benchmark failed. Check Caliper logs for details."
    exit 1
fi