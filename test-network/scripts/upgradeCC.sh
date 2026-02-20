#!/bin/bash

# 1. Configuration
CC_NAME="eKYC"
CC_SRC_PATH="../../chaincode/javascript/" 
CC_VERSION="2.5"                       
CC_SEQUENCE="7"                        
CHANNEL_NAME="mychannel"

# Path setup for the test-network directory
export CORE_PEER_TLS_ENABLED=true
export PATH=${PWD}/../../../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../../../config/
export ORDERER_CA=${PWD}/../organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

function setGlobals() {
  local ORG=$1
  if [ $ORG -eq 1 ]; then
    export CORE_PEER_LOCALMSPID="Org1MSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/../organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=${PWD}/../organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
    export CORE_PEER_ADDRESS=localhost:7051
  elif [ $ORG -eq 2 ]; then
    export CORE_PEER_LOCALMSPID="Org2MSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/../organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=${PWD}/../organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
    export CORE_PEER_ADDRESS=localhost:9051
  fi
}

echo "----------------------------------------------------------"
echo "Starting Chaincode Upgrade: ${CC_NAME} (v${CC_VERSION})"
echo "----------------------------------------------------------"
setGlobals 1
peer lifecycle chaincode querycommitted --channelID ${CHANNEL_NAME} --name ${CC_NAME} --tls --cafile ${ORDERER_CA}

echo "Step 1: Packaging Chaincode..."
peer lifecycle chaincode package ${CC_NAME}.tar.gz --path ${CC_SRC_PATH} --lang node --label ${CC_NAME}_${CC_VERSION}

echo "Step 2: Installing on Org1..."
setGlobals 1
peer lifecycle chaincode install ${CC_NAME}.tar.gz

echo "Step 3: Installing on Org2..."
setGlobals 2
peer lifecycle chaincode install ${CC_NAME}.tar.gz

echo "Step 4: Querying Package ID..."
setGlobals 1
# This logic extracts the specific ID for the version we just installed
QUERY_OUTPUT=$(peer lifecycle chaincode queryinstalled)
PACKAGE_ID=$(echo "$QUERY_OUTPUT" | grep "${CC_NAME}_${CC_VERSION}" | sed -n 's/.*Package ID: \(.*\), Label.*/\1/p')

if [ -z "$PACKAGE_ID" ]; then
  echo "ERROR: Could not find Package ID for ${CC_NAME}_${CC_VERSION}"
  exit 1
fi
echo "Package ID: $PACKAGE_ID"

echo "Step 5: Approving for Org1..."
setGlobals 1
peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile $ORDERER_CA --channelID ${CHANNEL_NAME} --name ${CC_NAME} --version ${CC_VERSION} --package-id ${PACKAGE_ID} --sequence ${CC_SEQUENCE}

echo "Step 6: Approving for Org2..."
setGlobals 2
peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile $ORDERER_CA --channelID ${CHANNEL_NAME} --name ${CC_NAME} --version ${CC_VERSION} --package-id ${PACKAGE_ID} --sequence ${CC_SEQUENCE}

echo "Step 7: Committing Definition..."
# We use the TLS variables provided by envVar.sh for the peers
peer lifecycle chaincode commit -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile $ORDERER_CA --channelID ${CHANNEL_NAME} --name ${CC_NAME} \
--peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/../organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
--peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/../organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
--version ${CC_VERSION} --sequence ${CC_SEQUENCE}

echo "----------------------------------------------------------"
echo "UPGRADE COMPLETE: ${CC_NAME} is now version ${CC_VERSION}"
echo "----------------------------------------------------------"