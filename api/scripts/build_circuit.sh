#!/bin/bash
set -e 

# 1. Setup
echo "🧹 Cleaning and creating build directory..."
rm -rf build
mkdir -p build

# 2. Ensure circomlib is installed
if [ ! -d "node_modules/circomlib" ]; then
    echo "📦 Installing circomlib..."
    npm install circomlib
fi

# 3. Compile Circuit
# Note: We use -l node_modules so 'include "circomlib/..."' works
echo "🔨 Compiling circuit..."
circom circuits/requirements_check.circom --r1cs --wasm --sym -o build -l node_modules

# 4. Powers of Tau (Universal Setup)
# We use 15 because multiple GreaterThan(64) calls are constraint-heavy
if [ ! -f "build/pot15_final.ptau" ]; then
    echo "🌊 Generating Powers of Tau..."
    snarkjs powersoftau new bn128 15 build/pot15_0000.ptau -v
    snarkjs powersoftau contribute build/pot15_0000.ptau build/pot15_0001.ptau --name="First contribution" -v -e="random_entropy"
    snarkjs powersoftau prepare phase2 build/pot15_0001.ptau build/pot15_final.ptau -v
fi

# 5. Groth16 Setup
echo "🔑 Generating Proving Key..."
snarkjs groth16 setup build/requirements_check.r1cs build/pot15_final.ptau build/requirements_check_final.zkey

# 6. Export Verification Key
echo "📋 Exporting Verification Key..."
snarkjs zkey export verificationkey build/requirements_check_final.zkey build/requirements_check_key.json

echo "✅ Build Complete!"