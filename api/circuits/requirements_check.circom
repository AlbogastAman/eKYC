pragma circom 2.1.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template IdentityGate() {
    // --- PRIVATE INPUTS ---
    signal input dob;
    signal input dobSalt;
    signal input idNum;
    signal input idSalt;
    signal input country;
    signal input countrySalt;

    // --- PUBLIC INPUTS ---
    signal input expectedDobHash;
    signal input expectedIdHash;
    signal input expectedCountryHash;
    signal input thresholdDate;   // e.g., 20080217
    signal input requiredCountry;  // e.g., 65 (ISO code)

    // 1. VERIFY HASHES (Link to the VC)
    component dobHasher = Poseidon(2);
    dobHasher.inputs[0] <== dob;
    dobHasher.inputs[1] <== dobSalt;
    dobHasher.out === expectedDobHash;

    component idHasher = Poseidon(2);
    idHasher.inputs[0] <== idNum;
    idHasher.inputs[1] <== idSalt;
    idHasher.out === expectedIdHash;

    component countryHasher = Poseidon(2);
    countryHasher.inputs[0] <== country;
    countryHasher.inputs[1] <== countrySalt;
    countryHasher.out === expectedCountryHash;

    // 2. VERIFY BUSINESS LOGIC (Age & Country)
    
    // Age Check: dob <= thresholdDate (Older = smaller number)
    component ageCheck = LessEqThan(32);
    ageCheck.in[0] <== dob;
    ageCheck.in[1] <== thresholdDate;
    ageCheck.out === 1;

    // Country Check: country == requiredCountry
    component countryCheck = IsEqual();
    countryCheck.in[0] <== country;
    countryCheck.in[1] <== requiredCountry;
    countryCheck.out === 1;
}

// All "expected" values and "required" criteria are public
component main {public [
    expectedDobHash, 
    expectedIdHash, 
    expectedCountryHash, 
    thresholdDate, 
    requiredCountry
]} = IdentityGate();